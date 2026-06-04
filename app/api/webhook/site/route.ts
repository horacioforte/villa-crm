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
  email: z.string().trim().email(),
  telefone: z.string().trim().min(8),
  mensagem: z.string().trim().min(3),
  empresa: z.string().trim().optional(),
});

type SiteWebhookInput = z.infer<typeof siteWebhookSchema>;

function detectarTipoServico(mensagem: string): TipoServico | undefined {
  const texto = mensagem.toLowerCase();

  if (texto.includes("betoneira")) return TipoServico.BETONEIRA;
  if (texto.includes("central")) return TipoServico.CENTRAL_IN_LOCO;
  if (texto.includes("bomba")) return TipoServico.BOMBA_LANCA;

  return undefined;
}

function getTaskDueDate() {
  const date = new Date();
  date.setHours(date.getHours() + 2);
  return date;
}

async function enviarConfirmacaoBrevo(data: SiteWebhookInput) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn("[WEBHOOK_SITE] BREVO_API_KEY não configurada.");
    return;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
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
  const tipoServico = detectarTipoServico(data.mensagem);
  const dataVencimento = getTaskDueDate();

  try {
    const result = await prisma.$transaction(async (tx) => {
      let empresa = await tx.empresa.findFirst({
        where: {
          OR: [
            { email: { equals: data.email, mode: "insensitive" } },
            { razaoSocial: { equals: empresaNome, mode: "insensitive" } },
          ],
        },
      });

      if (!empresa) {
        empresa = await tx.empresa.create({
          data: {
            razaoSocial: empresaNome,
            nomeFantasia: data.empresa?.trim() || null,
            telefone: data.telefone,
            email: data.email,
            segmento: "Lead inbound",
            observacoes: "Origem: formulário do site",
            ativa: true,
          },
        });
      }

      let pessoa = await tx.pessoa.findFirst({
        where: {
          empresaId: empresa.id,
          OR: [
            { email: { equals: data.email, mode: "insensitive" } },
            { nome: { equals: data.nome, mode: "insensitive" } },
          ],
        },
      });

      if (!pessoa) {
        pessoa = await tx.pessoa.create({
          data: {
            nome: data.nome,
            email: data.email,
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
          descricao: data.mensagem,
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

      await tx.historicoContato.create({
        data: {
          tipo: TipoContato.OUTRO,
          resumo: "Contato via formulário do site",
          detalhes: data.mensagem,
          oportunidadeId: oportunidade.id,
          empresaId: empresa.id,
          pessoaId: pessoa.id,
        },
      });

      await tx.tarefa.create({
        data: {
          titulo: `Retornar contato: ${data.nome}`,
          descricao: `Lead recebido pelo formulário do site.\nTelefone/WhatsApp: ${data.telefone}\nEmail: ${data.email}`,
          tipo: TipoAtividade.LIGACAO,
          prioridade: PrioridadeTarefa.ALTA,
          status: StatusTarefa.PENDENTE,
          dataVencimento,
          horaVencimento: dataVencimento.toTimeString().slice(0, 5),
          oportunidadeId: oportunidade.id,
          empresaId: empresa.id,
          pessoaId: pessoa.id,
        },
      });

      return { oportunidadeId: oportunidade.id };
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
