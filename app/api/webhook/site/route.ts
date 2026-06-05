import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CanalOrigem,
  InfluenciaDecisao,
  NivelRelacionamento,
  PrioridadeTarefa,
  StatusOportunidade,
  StatusTarefa,
  TemperaturaOportunidade,
  TipoAtividade,
  TipoContato,
  TipoOperacao,
  TipoPessoa,
  TipoServico,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const siteWebhookSchema = z.object({
  nome: z.string().trim().min(2),
  telefone: z.string().trim().min(8),
  tipoNecessidade: z.string().trim().min(1),
  cidadeObra: z.string().trim().min(2),
  volumeEstimado: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  empresa: z.string().trim().optional(),
});

type SiteWebhookInput = z.infer<typeof siteWebhookSchema>;

function getTaskDueDate() {
  const date = new Date();
  date.setHours(date.getHours() + 2);
  return date;
}

function mapTipoServico(tipoNecessidade: string): TipoServico | undefined {
  const tipos: Record<string, TipoServico | undefined> = {
    "Bomba de concreto": TipoServico.BOMBA_LANCA,
    Betoneira: TipoServico.BETONEIRA,
    "Central de concreto": TipoServico.CENTRAL_IN_LOCO,
    Telebelt: TipoServico.TELEBELT,
  };

  return tipos[tipoNecessidade];
}

function getResumoContato(data: SiteWebhookInput) {
  return [
    `Contato via site — ${data.tipoNecessidade} em ${data.cidadeObra}.`,
    data.volumeEstimado ? `Volume: ${data.volumeEstimado}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function enviarConfirmacaoBrevo(data: SiteWebhookInput) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!data.email) {
    return;
  }

  if (!apiKey) {
    console.warn("[WEBHOOK_SITE] BREVO_API_KEY não configurada.");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Villa Empreendimentos",
          email: "comercial@villaempreendimentos.com.br",
        },
        to: [{ email: data.email, name: data.nome }],
        replyTo: {
          email: "comercial@villaempreendimentos.com.br",
          name: "Villa Empreendimentos",
        },
        subject: "Recebemos seu contato — Villa Empreendimentos",
        htmlContent: `
          <p>Olá ${data.nome}!</p>
          <p>Recebemos sua mensagem e nossa equipe entrará em contato em até 2 horas.</p>
          <p>Qualquer dúvida, responda este email.</p>
          <p>
            Villa Empreendimentos<br />
            (81) XXXX-XXXX
          </p>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[WEBHOOK_SITE] Erro ao enviar Brevo:", errorText);
    }
  } catch (error) {
    console.error("[WEBHOOK_SITE] Falha/timeout no Brevo:", error);
  } finally {
    clearTimeout(timeout);
  }
}

async function criarPendenciasEmBackground({
  data,
  oportunidadeId,
  empresaId,
  pessoaId,
}: {
  data: SiteWebhookInput;
  oportunidadeId: string;
  empresaId: string;
  pessoaId: string;
}) {
  const dataVencimento = getTaskDueDate();
  const results = await Promise.allSettled([
    prisma.historicoContato.create({
      data: {
        tipo: TipoContato.OUTRO,
        resumo: "Contato via formulário do site",
        detalhes: getResumoContato(data),
        oportunidadeId,
        empresaId,
        pessoaId,
      },
    }),
    prisma.tarefa.create({
      data: {
        titulo: `Retornar contato: ${data.nome} — ${data.tipoNecessidade} ${data.cidadeObra}`,
        descricao: [
          `Lead recebido pelo formulário do site.`,
          `Telefone/WhatsApp: ${data.telefone}`,
          data.email ? `Email: ${data.email}` : null,
          data.volumeEstimado ? `Volume: ${data.volumeEstimado}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        tipo: TipoAtividade.LIGACAO,
        prioridade: PrioridadeTarefa.ALTA,
        status: StatusTarefa.PENDENTE,
        dataVencimento,
        horaVencimento: dataVencimento.toTimeString().slice(0, 5),
        oportunidadeId,
        empresaId,
        pessoaId,
      },
    }),
  ]);

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("[WEBHOOK_SITE] Erro em tarefa de background:", result.reason);
    }
  });
}

export async function POST(request: Request) {
  const parsed = siteWebhookSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Dados inválidos.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const empresaNome = data.empresa?.trim() || data.nome;
  const titulo = `Inbound — ${data.nome}${data.empresa ? ` / ${data.empresa}` : ""}`;
  const tipoServico = mapTipoServico(data.tipoNecessidade);
  const descricao = getResumoContato(data);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const empresaWhere = data.email
        ? {
            OR: [
              { email: { equals: data.email, mode: "insensitive" as const } },
              { razaoSocial: { equals: empresaNome, mode: "insensitive" as const } },
            ],
          }
        : {
            razaoSocial: { equals: empresaNome, mode: "insensitive" as const },
          };
      let empresa = await tx.empresa.findFirst({
        where: empresaWhere,
      });

      if (!empresa) {
        empresa = await tx.empresa.create({
          data: {
            razaoSocial: empresaNome,
            nomeFantasia: data.empresa?.trim() || null,
            telefone: data.telefone,
            email: data.email ?? null,
            segmento: "Lead inbound",
            cidade: data.cidadeObra,
            observacoes: `Origem: formulário do site\n${getResumoContato(data)}`,
            ativa: true,
          },
        });
      }

      const pessoaWhere = data.email
        ? {
            empresaId: empresa.id,
            OR: [
              { email: { equals: data.email, mode: "insensitive" as const } },
              { nome: { equals: data.nome, mode: "insensitive" as const } },
            ],
          }
        : {
            empresaId: empresa.id,
            nome: { equals: data.nome, mode: "insensitive" as const },
          };
      let pessoa = await tx.pessoa.findFirst({
        where: pessoaWhere,
      });

      if (!pessoa) {
        pessoa = await tx.pessoa.create({
          data: {
            nome: data.nome,
            email: data.email ?? null,
            telefone: data.telefone,
            whatsapp: data.telefone,
            tipo: TipoPessoa.CONTATO,
            influenciaDecisao: InfluenciaDecisao.INFLUENCIADOR,
            nivelRelacionamento: NivelRelacionamento.NEUTRO,
            empresaId: empresa.id,
            ativa: true,
          },
        });
      }

      const oportunidade = await tx.oportunidade.create({
        data: {
          titulo,
          descricao,
          tipo: TipoOperacao.LOCACAO,
          tipoServico,
          canalOrigem: CanalOrigem.SITE,
          status: StatusOportunidade.NOVA,
          temperatura: TemperaturaOportunidade.MEDIA,
          empresaId: empresa.id,
          pessoaId: pessoa.id,
          ativa: true,
        },
      });

      return {
        oportunidadeId: oportunidade.id,
        empresaId: empresa.id,
        pessoaId: pessoa.id,
      };
    });

    void criarPendenciasEmBackground({
      data,
      oportunidadeId: result.oportunidadeId,
      empresaId: result.empresaId,
      pessoaId: result.pessoaId,
    }).catch((backgroundError) => {
      console.error(
        "[WEBHOOK_SITE] Erro em processamento de background:",
        backgroundError,
      );
    });

    await enviarConfirmacaoBrevo(data);

    return NextResponse.json(
      { success: true, oportunidadeId: result.oportunidadeId },
      { status: 201 },
    );
  } catch (error) {
    console.error("[WEBHOOK_SITE] Erro ao criar lead:", error);
    return NextResponse.json(
      { success: false, message: "Erro interno ao receber contato." },
      { status: 500 },
    );
  }
}
