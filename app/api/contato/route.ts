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

const contatoSchema = z.object({
  nome: z.string().trim().min(2),
  empresa: z.string().trim().min(1),
  telefone: z.string().trim().min(8),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  cidade: z.string().trim().min(2),
  cargo: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  canal: z.string().trim().optional(),
  temperatura: z
    .enum(["QUENTE", "MEDIA", "FRIA"])
    .optional()
    .default("MEDIA"),
  score: z.coerce.number().optional(),
  volume_total: z.string().trim().optional(),
  volume_mensal: z.string().trim().optional(),
  prazo: z.string().trim().optional(),
  tipo_obra: z.string().trim().optional(),
  decisor: z.string().trim().optional(),
  mensagem: z.string().trim().optional(),
  origem: z.string().trim().optional(),
});

type ContatoInput = z.infer<typeof contatoSchema>;

function getCleanPhone(telefone: string) {
  return telefone.replace(/\D/g, "");
}

function getTaskDueDate() {
  const date = new Date();
  date.setHours(date.getHours() + 2);
  return date;
}

function getResumoContato(data: ContatoInput) {
  return [
    `Diagnóstico Central de Concreto — ${data.empresa} em ${data.cidade}.`,
    data.volume_total ? `Volume total: ${data.volume_total}.` : null,
    data.volume_mensal ? `Volume mensal: ${data.volume_mensal}.` : null,
    data.prazo ? `Prazo: ${data.prazo}.` : null,
    data.tipo_obra ? `Tipo de obra: ${data.tipo_obra}.` : null,
    data.decisor ? `Decisor: ${data.decisor}.` : null,
    typeof data.score === "number" ? `Score: ${data.score}/100.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function getDetalhesContato(data: ContatoInput) {
  return [
    data.mensagem || "Lead recebido pela landing de diagnóstico central.",
    "",
    `Nome: ${data.nome}`,
    `Empresa: ${data.empresa}`,
    `Telefone/WhatsApp: ${data.telefone}`,
    data.email ? `Email: ${data.email}` : null,
    `Cidade: ${data.cidade}`,
    data.cargo ? `Cargo: ${data.cargo}` : null,
    data.canal ? `Canal: ${data.canal}` : null,
    data.origem ? `Origem: ${data.origem}` : null,
    `Temperatura: ${data.temperatura}`,
    typeof data.score === "number" ? `Score: ${data.score}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function enviarBoasVindasWhatsApp(data: ContatoInput) {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  const telefone = getCleanPhone(data.telefone);

  if (!apiUrl || !apiKey || !instance) {
    console.warn("[API_CONTATO] Variaveis da Evolution API nao configuradas.");
    return;
  }

  if (!telefone) {
    console.warn("[API_CONTATO] Telefone invalido para envio WhatsApp.");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: telefone,
        text: [
          `Olá, ${data.nome}! 👋 Aqui é a Maria da Villa Empreendimentos.`,
          "",
          "Recebi seu diagnóstico de Central de Concreto agora mesmo e já estou analisando suas respostas.",
          "",
          "Em até 2 horas te envio a avaliação completa informando se sua obra tem perfil para uma central exclusiva. 🏗️",
          "",
          "Qualquer dúvida é só falar aqui!",
        ].join("\n"),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[API_CONTATO] Erro Evolution:", errorText);
    }
  } catch (error) {
    console.error("[API_CONTATO] Falha/timeout Evolution:", error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const parsed = contatoSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Dados invalidos.", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const telefoneLimpo = getCleanPhone(data.telefone);
  const empresaNome = data.empresa.trim() || data.nome;
  const resumo = getResumoContato(data);
  const detalhes = getDetalhesContato(data);
  const dataVencimento = getTaskDueDate();

  try {
    await prisma.$transaction(async (tx) => {
      const empresaWhere = data.email
        ? {
            OR: [
              { email: { equals: data.email, mode: "insensitive" as const } },
              { razaoSocial: { equals: empresaNome, mode: "insensitive" as const } },
              { telefone: telefoneLimpo || data.telefone },
            ],
          }
        : {
            OR: [
              { razaoSocial: { equals: empresaNome, mode: "insensitive" as const } },
              { telefone: telefoneLimpo || data.telefone },
            ],
          };

      let empresa = await tx.empresa.findFirst({
        where: empresaWhere,
      });

      if (!empresa) {
        empresa = await tx.empresa.create({
          data: {
            razaoSocial: empresaNome,
            nomeFantasia: empresaNome,
            telefone: telefoneLimpo || data.telefone,
            email: data.email ?? null,
            segmento: "Lead inbound",
            cidade: data.cidade,
            observacoes: `Origem: ${data.origem ?? "landing-central-concreto"}\n${resumo}`,
            ativa: true,
          },
        });
      }

      const pessoaWhere = data.email
        ? {
            empresaId: empresa.id,
            OR: [
              { email: { equals: data.email, mode: "insensitive" as const } },
              { whatsapp: telefoneLimpo || data.telefone },
              { telefone: telefoneLimpo || data.telefone },
              { nome: { equals: data.nome, mode: "insensitive" as const } },
            ],
          }
        : {
            empresaId: empresa.id,
            OR: [
              { whatsapp: telefoneLimpo || data.telefone },
              { telefone: telefoneLimpo || data.telefone },
              { nome: { equals: data.nome, mode: "insensitive" as const } },
            ],
          };

      let pessoa = await tx.pessoa.findFirst({
        where: pessoaWhere,
      });

      if (!pessoa) {
        pessoa = await tx.pessoa.create({
          data: {
            nome: data.nome,
            email: data.email ?? null,
            telefone: telefoneLimpo || data.telefone,
            whatsapp: telefoneLimpo || data.telefone,
            cargo: data.cargo ?? null,
            tipo: TipoPessoa.CONTATO,
            influenciaDecisao: data.decisor?.toLowerCase().includes("sim")
              ? InfluenciaDecisao.DECISOR
              : InfluenciaDecisao.INFLUENCIADOR,
            nivelRelacionamento: NivelRelacionamento.NEUTRO,
            empresaId: empresa.id,
            ativa: true,
          },
        });
      }

      const oportunidade = await tx.oportunidade.create({
        data: {
          titulo: `Diagnóstico Central — ${data.nome} / ${data.cidade}`,
          descricao: resumo,
          tipo: TipoOperacao.LOCACAO,
          tipoServico: TipoServico.CENTRAL_IN_LOCO,
          canalOrigem: CanalOrigem.SITE,
          status: StatusOportunidade.NOVA,
          temperatura: data.temperatura as TemperaturaOportunidade,
          temperaturaMotivo:
            typeof data.score === "number"
              ? `Score da landing: ${data.score}/100.`
              : "Lead recebido pela landing de diagnóstico central.",
          empresaId: empresa.id,
          pessoaId: pessoa.id,
          ativa: true,
        },
      });

      await tx.historicoContato.create({
        data: {
          tipo: TipoContato.WHATSAPP,
          resumo: "Diagnóstico Central de Concreto recebido",
          detalhes,
          oportunidadeId: oportunidade.id,
          empresaId: empresa.id,
          pessoaId: pessoa.id,
        },
      });

      await tx.tarefa.create({
        data: {
          titulo: `Retornar diagnóstico central: ${data.nome} (${data.telefone})`,
          descricao: detalhes,
          tipo: TipoAtividade.WHATSAPP,
          prioridade:
            data.temperatura === "QUENTE" ? PrioridadeTarefa.URGENTE : PrioridadeTarefa.ALTA,
          status: StatusTarefa.PENDENTE,
          dataVencimento,
          horaVencimento: dataVencimento.toTimeString().slice(0, 5),
          oportunidadeId: oportunidade.id,
          empresaId: empresa.id,
          pessoaId: pessoa.id,
        },
      });
    });

    await enviarBoasVindasWhatsApp(data);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[API_CONTATO] Erro ao salvar contato:", error);
    return NextResponse.json(
      { success: false, message: "Erro interno ao receber contato." },
      { status: 500 },
    );
  }
}
