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

export const maxDuration = 60;

const tipoServicoSchema = z
  .enum([
    "BOMBA_LANCA",
    "BOMBA_ESTACIONARIA",
    "BETONEIRA",
    "CENTRAL_IN_LOCO",
    "TELEBELT",
  ])
  .nullable()
  .optional();

const mariaResponseSchema = z.object({
  resposta: z.string().trim().min(1),
  isLead: z.boolean(),
  qualificado: z.boolean(),
  tipoServico: tipoServicoSchema,
  cidade: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  prazo: z.string().nullable().optional(),
  temperatura: z.enum(["QUENTE", "MEDIA", "FRIA"]).default("MEDIA"),
  temperaturaMotivo: z.string().nullable().optional(),
  urgente: z.boolean().default(false),
});

const termometroLeadSchema = z.object({
  temperatura: z.enum(["QUENTE", "MEDIA", "FRIA"]),
  urgente: z.boolean(),
  motivo: z.string().trim().min(1),
});

type MariaResponse = z.infer<typeof mariaResponseSchema>;

type EvolutionWebhookPayload = {
  event?: string;
  data?: {
    key?: {
      fromMe?: boolean;
      remoteJid?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
    };
    pushName?: string;
  };
};

const MARIA_SYSTEM_PROMPT = `Você é Maria, SDR receptiva da Villa Empreendimentos (locação de bombas de concreto, betoneiras, centrais de concreto e telebelt).

Personalidade: rápida, simpática, humana. Nunca robótica. Uma pergunta por mensagem.

Fluxo de qualificação (máximo 4 perguntas):
1. Tipo de serviço (bomba, betoneira, central ou telebelt?)
2. Cidade da obra
3. Volume estimado de concreto por mês
4. Data prevista de início

Quando tiver informações suficientes (mínimo tipo + cidade), encerre com:
"Ótimo! Vou passar seu contato para nosso consultor. Ele retorna em até 2 horas."

Regras:
- Uma pergunta por mensagem.
- Tom caloroso e direto.
- Se pedir preço, informe que depende do volume e localização.
- Se urgente, diga que vai acionar o consultor agora.
- Se mencionar apenas "bomba", use BOMBA_LANCA como tipoServico.
- Use o contexto recente da conversa para completar dados. Se o cliente responder só a cidade, combine com o tipo de serviço perguntado/mencionado antes.

Responda APENAS com JSON válido, sem markdown:
{
  "resposta": "texto da resposta para o cliente",
  "isLead": true/false,
  "qualificado": true/false,
  "tipoServico": "BOMBA_LANCA|BOMBA_ESTACIONARIA|BETONEIRA|CENTRAL_IN_LOCO|TELEBELT|null",
  "cidade": "cidade mencionada ou null",
  "volume": "volume mencionado ou null",
  "prazo": "prazo mencionado ou null",
  "temperatura": "QUENTE|MEDIA|FRIA",
  "urgente": true/false
}`;

function extractJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("Resposta da Maria nao contem JSON.");
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function getTextMessage(payload: EvolutionWebhookPayload) {
  return (
    payload.data?.message?.conversation ??
    payload.data?.message?.extendedTextMessage?.text ??
    ""
  ).trim();
}

function getWhatsappNumber(remoteJid?: string) {
  if (!remoteJid || remoteJid.endsWith("@g.us")) {
    return null;
  }

  const [number] = remoteJid.split("@");
  const digits = number?.replace(/\D/g, "");
  return digits || null;
}

function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.toLowerCase() === "null") {
    return null;
  }

  return trimmed;
}

function getTaskDueDate(urgente: boolean) {
  const date = new Date();

  if (urgente) {
    date.setMinutes(date.getMinutes() + 30);
    return date;
  }

  date.setHours(date.getHours() + 2);
  return date;
}

function getTipoServico(tipoServico: MariaResponse["tipoServico"]) {
  if (!tipoServico) {
    return null;
  }

  const tipos: Record<NonNullable<MariaResponse["tipoServico"]>, TipoServico> = {
    BOMBA_LANCA: TipoServico.BOMBA_LANCA,
    BOMBA_ESTACIONARIA: TipoServico.BOMBA_ESTACIONARIA,
    BETONEIRA: TipoServico.BETONEIRA,
    CENTRAL_IN_LOCO: TipoServico.CENTRAL_IN_LOCO,
    TELEBELT: TipoServico.TELEBELT,
  };

  return tipos[tipoServico];
}

function inferTipoServico(texto: string) {
  const lower = texto.toLowerCase();

  if (lower.includes("bomba_estacionaria") || lower.includes("estacionaria")) {
    return "BOMBA_ESTACIONARIA" as const;
  }

  if (
    lower.includes("bomba_lanca") ||
    lower.includes("bomba lança") ||
    lower.includes("bomba lanca") ||
    lower.includes("bomba")
  ) {
    return "BOMBA_LANCA" as const;
  }

  if (lower.includes("betoneira")) {
    return "BETONEIRA" as const;
  }

  if (
    lower.includes("central_in_loco") ||
    lower.includes("central") ||
    lower.includes("concreto")
  ) {
    return "CENTRAL_IN_LOCO" as const;
  }

  if (lower.includes("telebelt")) {
    return "TELEBELT" as const;
  }

  return null;
}

function inferCidade(texto: string, contexto: string) {
  const textoLimpo = cleanNullable(texto);

  if (
    textoLimpo &&
    textoLimpo.length <= 60 &&
    /^[\p{L}\s.'-]+$/u.test(textoLimpo) &&
    !inferTipoServico(textoLimpo)
  ) {
    return textoLimpo;
  }

  const cidadeAtual = texto.match(/\b(?:em|de|para)\s+([\p{L}\s.'-]{2,60})/iu)?.[1];
  if (cidadeAtual) {
    return cidadeAtual.trim();
  }

  const cidadeContexto = contexto.match(/\bCidade:\s*([^\n]+)/i)?.[1];
  return cleanNullable(cidadeContexto);
}

function normalizarDadosComContexto({
  dados,
  texto,
  contexto,
}: {
  dados: MariaResponse;
  texto: string;
  contexto: string;
}): MariaResponse {
  const tipoServico = dados.tipoServico ?? inferTipoServico(`${texto}\n${contexto}`);
  const cidade = cleanNullable(dados.cidade) ?? inferCidade(texto, contexto);
  const qualificado = Boolean(tipoServico && cidade) || dados.qualificado;

  return {
    ...dados,
    isLead: dados.isLead || Boolean(tipoServico),
    qualificado,
    tipoServico,
    cidade,
  };
}

async function analisarMensagem({
  nomeContato,
  texto,
  contexto,
}: {
  nomeContato: string;
  texto: string;
  contexto: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY nao configurada.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: MARIA_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              `Nome do cliente: ${nomeContato}`,
              contexto ? `Contexto recente da conversa:\n${contexto}` : null,
              `Mensagem atual: ${texto}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Erro Anthropic ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.type === "text" ? data.content[0].text : "";
    return mariaResponseSchema.parse(JSON.parse(extractJson(responseText)));
  } finally {
    clearTimeout(timeout);
  }
}

async function classificarTermometroLead({
  dados,
  nomeContato,
  telefone,
  texto,
  contexto,
}: {
  dados: MariaResponse;
  nomeContato: string;
  telefone: string;
  texto: string;
  contexto: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY nao configurada.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const prompt = `Você é Maria, SDR da Villa Empreendimentos.

Classifique o termômetro deste lead de WhatsApp com base no contexto comercial completo.

Critérios:
- QUENTE: urgência declarada, pediu preço/orçamento, prazo menor que 30 dias, data definida, alto volume, ou intenção clara de contratar.
- MEDIA: tem necessidade real com tipo de serviço e cidade, mas ainda faltam volume/prazo/urgência.
- FRIA: curiosidade inicial, informação vaga, sem obra clara ou sem intenção comercial.

Dados já identificados:
- Nome: ${nomeContato}
- Telefone: ${telefone}
- Tipo de serviço: ${dados.tipoServico ?? "não informado"}
- Cidade: ${cleanNullable(dados.cidade) ?? "não informada"}
- Volume: ${cleanNullable(dados.volume) ?? "não informado"}
- Prazo: ${cleanNullable(dados.prazo) ?? "não informado"}
- Mensagem atual: ${texto}

Contexto recente:
${contexto || "Sem histórico anterior."}

Responda APENAS com JSON válido, sem markdown:
{
  "temperatura": "QUENTE|MEDIA|FRIA",
  "urgente": true/false,
  "motivo": "motivo objetivo em uma frase curta"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Erro Anthropic ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.type === "text" ? data.content[0].text : "";
    return termometroLeadSchema.parse(JSON.parse(extractJson(responseText)));
  } finally {
    clearTimeout(timeout);
  }
}

async function getContextoConversa(telefone: string) {
  const pessoa = await prisma.pessoa.findFirst({
    where: {
      OR: [{ whatsapp: telefone }, { telefone }],
    },
    select: {
      id: true,
      historicos: {
        where: {
          tipo: TipoContato.WHATSAPP,
        },
        orderBy: {
          dataContato: "desc",
        },
        take: 6,
        select: {
          resumo: true,
          detalhes: true,
          dataContato: true,
        },
      },
      oportunidades: {
        where: {
          ativa: true,
          status: {
            notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          titulo: true,
          descricao: true,
          tipoServico: true,
        },
      },
    },
  });

  if (!pessoa) {
    return "";
  }

  const oportunidade = pessoa.oportunidades[0];
  const linhasOportunidade = oportunidade
    ? [
        "Oportunidade aberta existente:",
        `- Titulo: ${oportunidade.titulo}`,
        oportunidade.tipoServico ? `- Tipo: ${oportunidade.tipoServico}` : null,
        oportunidade.descricao ? `- Descricao: ${oportunidade.descricao}` : null,
      ].filter(Boolean)
    : [];

  const linhasHistorico = pessoa.historicos
    .slice()
    .reverse()
    .map((historico) =>
      [
        `- ${historico.resumo}`,
        historico.detalhes ? historico.detalhes : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );

  return [...linhasOportunidade, ...linhasHistorico].join("\n").slice(0, 3000);
}

async function registrarInteracaoParcial({
  dados,
  nomeContato,
  telefone,
  texto,
}: {
  dados: MariaResponse;
  nomeContato: string;
  telefone: string;
  texto: string;
}) {
  const cidade = cleanNullable(dados.cidade);
  const volume = cleanNullable(dados.volume);
  const prazo = cleanNullable(dados.prazo);
  const tipoServico = getTipoServico(dados.tipoServico);

  await prisma.$transaction(async (tx) => {
    let pessoa = await tx.pessoa.findFirst({
      where: {
        OR: [{ whatsapp: telefone }, { telefone }],
      },
      include: {
        empresa: true,
      },
    });

    let empresa =
      pessoa?.empresa ??
      (await tx.empresa.findFirst({
        where: {
          OR: [
            { telefone },
            { razaoSocial: { equals: nomeContato, mode: "insensitive" } },
          ],
        },
      }));

    if (!empresa) {
      empresa = await tx.empresa.create({
        data: {
          razaoSocial: nomeContato,
          telefone,
          segmento: "Lead WhatsApp",
          cidade,
          observacoes: `Origem: WhatsApp\nLead ainda em qualificacao.`,
          ativa: true,
        },
      });
    }

    if (!pessoa) {
      pessoa = await tx.pessoa.create({
        data: {
          nome: nomeContato,
          telefone,
          whatsapp: telefone,
          tipo: TipoPessoa.CONTATO,
          influenciaDecisao: InfluenciaDecisao.INFLUENCIADOR,
          nivelRelacionamento: NivelRelacionamento.NEUTRO,
          empresaId: empresa.id,
          ativa: true,
        },
        include: {
          empresa: true,
        },
      });
    }

    await tx.historicoContato.create({
      data: {
        tipo: TipoContato.WHATSAPP,
        resumo: `WhatsApp em qualificacao de ${nomeContato} (${telefone})`,
        detalhes: [
          `Mensagem: ${texto}`,
          `Resposta Maria: ${dados.resposta}`,
          tipoServico ? `Tipo: ${tipoServico}` : null,
          cidade ? `Cidade: ${cidade}` : null,
          volume ? `Volume: ${volume}` : null,
          prazo ? `Prazo: ${prazo}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        empresaId: empresa.id,
        pessoaId: pessoa.id,
      },
    });
  });
}

async function enviarWhatsapp({
  telefone,
  texto,
}: {
  telefone: string;
  texto: string;
}) {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!apiUrl || !apiKey || !instance) {
    throw new Error("Variaveis da Evolution API nao configuradas.");
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
        text: texto,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Erro Evolution ${response.status}: ${errorText}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function registrarLeadQualificado({
  dados,
  nomeContato,
  telefone,
  texto,
}: {
  dados: MariaResponse;
  nomeContato: string;
  telefone: string;
  texto: string;
}) {
  const tipoServico = getTipoServico(dados.tipoServico);
  const cidade = cleanNullable(dados.cidade);
  const volume = cleanNullable(dados.volume);
  const prazo = cleanNullable(dados.prazo);
  const temperatura = dados.temperatura as TemperaturaOportunidade;
  const temperaturaMotivo =
    cleanNullable(dados.temperaturaMotivo) ??
    (dados.urgente
      ? "Lead WhatsApp com urgencia informada."
      : "Lead WhatsApp qualificado pela Maria.");
  const dataVencimento = getTaskDueDate(dados.urgente);

  if (!tipoServico || !cidade) {
    return { oportunidadeId: null, criada: false };
  }

  return prisma.$transaction(async (tx) => {
    let pessoa = await tx.pessoa.findFirst({
      where: {
        OR: [{ whatsapp: telefone }, { telefone }],
      },
      include: {
        empresa: true,
      },
    });

    let empresa =
      pessoa?.empresa ??
      (await tx.empresa.findFirst({
        where: {
          OR: [
            { telefone },
            { razaoSocial: { equals: nomeContato, mode: "insensitive" } },
          ],
        },
      }));

    if (!empresa) {
      empresa = await tx.empresa.create({
        data: {
          razaoSocial: nomeContato,
          telefone,
          segmento: "Lead WhatsApp",
          cidade,
          observacoes: `Origem: WhatsApp\nMensagem inicial: ${texto}`,
          ativa: true,
        },
      });
    }

    if (!pessoa) {
      pessoa = await tx.pessoa.create({
        data: {
          nome: nomeContato,
          telefone,
          whatsapp: telefone,
          tipo: TipoPessoa.CONTATO,
          influenciaDecisao: InfluenciaDecisao.INFLUENCIADOR,
          nivelRelacionamento: NivelRelacionamento.NEUTRO,
          empresaId: empresa.id,
          ativa: true,
        },
        include: {
          empresa: true,
        },
      });
    }

    const oportunidadeAberta = await tx.oportunidade.findFirst({
      where: {
        pessoaId: pessoa.id,
        ativa: true,
        status: {
          notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const descricao = [
      `Lead recebido via WhatsApp.`,
      `Cidade: ${cidade}`,
      volume ? `Volume: ${volume}` : null,
      prazo ? `Prazo: ${prazo}` : null,
      `Telefone: ${telefone}`,
    ]
      .filter(Boolean)
      .join("\n");

    const oportunidade = oportunidadeAberta
      ? await tx.oportunidade.update({
          where: {
            id: oportunidadeAberta.id,
          },
          data: {
            tipoServico: oportunidadeAberta.tipoServico ?? tipoServico,
            temperatura,
            temperaturaMotivo,
          },
        })
      : await tx.oportunidade.create({
          data: {
            titulo: `WhatsApp - ${nomeContato}${cidade ? ` / ${cidade}` : ""}`,
            descricao,
            tipo: TipoOperacao.LOCACAO,
            tipoServico,
            canalOrigem: CanalOrigem.OUTROS,
            status: StatusOportunidade.NOVA,
            temperatura,
            temperaturaMotivo,
            empresaId: empresa.id,
            pessoaId: pessoa.id,
            ativa: true,
          },
        });

    await tx.historicoContato.create({
      data: {
        tipo: TipoContato.WHATSAPP,
        resumo: `WhatsApp de ${nomeContato} (${telefone})`,
        detalhes: [
          `Mensagem: ${texto}`,
          `Resposta Maria: ${dados.resposta}`,
          `Cidade: ${cidade}`,
          volume ? `Volume: ${volume}` : null,
          prazo ? `Prazo: ${prazo}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        oportunidadeId: oportunidade.id,
        empresaId: empresa.id,
        pessoaId: pessoa.id,
      },
    });

    const tarefaExistente = await tx.tarefa.findFirst({
      where: {
        oportunidadeId: oportunidade.id,
        tipo: TipoAtividade.WHATSAPP,
        status: {
          in: [StatusTarefa.PENDENTE, StatusTarefa.EM_ANDAMENTO],
        },
      },
      select: {
        id: true,
      },
    });

    if (!tarefaExistente) {
      await tx.tarefa.create({
        data: {
          titulo: `Retornar WhatsApp: ${nomeContato} (${telefone})`,
          descricao,
          tipo: TipoAtividade.WHATSAPP,
          prioridade: dados.urgente ? PrioridadeTarefa.URGENTE : PrioridadeTarefa.ALTA,
          status: StatusTarefa.PENDENTE,
          dataVencimento,
          horaVencimento: dataVencimento.toTimeString().slice(0, 5),
          oportunidadeId: oportunidade.id,
          empresaId: empresa.id,
          pessoaId: pessoa.id,
        },
      });
    }

    return {
      oportunidadeId: oportunidade.id,
      criada: !oportunidadeAberta,
    };
  });
}

export async function POST(request: Request) {
  let body: EvolutionWebhookPayload;

  try {
    body = (await request.json()) as EvolutionWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload JSON invalido." }, { status: 400 });
  }

  if (body.event !== "messages.upsert") {
    return NextResponse.json({ ok: true });
  }

  if (body.data?.key?.fromMe) {
    return NextResponse.json({ ok: true });
  }

  const texto = getTextMessage(body);

  if (!texto) {
    return NextResponse.json({ ok: true });
  }

  const telefone = getWhatsappNumber(body.data?.key?.remoteJid);

  if (!telefone) {
    return NextResponse.json({ ok: true });
  }

  const nomeContato = body.data?.pushName?.trim() || "Cliente";

  try {
    const contexto = await getContextoConversa(telefone);
    const dadosMaria = await analisarMensagem({ nomeContato, texto, contexto });
    let dados = normalizarDadosComContexto({ dados: dadosMaria, texto, contexto });
    await enviarWhatsapp({ telefone, texto: dados.resposta });

    if (dados.isLead && dados.qualificado) {
      const termometro = await classificarTermometroLead({
        dados,
        nomeContato,
        telefone,
        texto,
        contexto,
      });
      dados = {
        ...dados,
        temperatura: termometro.temperatura,
        temperaturaMotivo: termometro.motivo,
        urgente: termometro.urgente,
      };
    }

    const lead = dados.isLead && dados.qualificado
      ? await registrarLeadQualificado({ dados, nomeContato, telefone, texto })
      : { oportunidadeId: null, criada: false };

    if (dados.isLead && !dados.qualificado) {
      await registrarInteracaoParcial({ dados, nomeContato, telefone, texto });
    }

    return NextResponse.json({
      ok: true,
      leadQualificado: Boolean(lead.oportunidadeId),
      oportunidadeId: lead.oportunidadeId,
      oportunidadeCriada: lead.criada,
    });
  } catch (error) {
    console.error("[WEBHOOK_WHATSAPP] Erro ao processar mensagem:", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message.includes("configurada") ? 503 : 500;

    return NextResponse.json({ ok: false, message }, { status });
  }
}
