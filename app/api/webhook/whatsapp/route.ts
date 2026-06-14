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
} from "@/app/generated/prisma/client"
import { prisma } from "@/lib/prisma";

export const maxDuration = 90;

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
  modalidade: z.string().nullable().optional(),
  quantidadeCaminhoes: z.string().nullable().optional(),
  comOperador: z.string().nullable().optional(),
  duracaoContrato: z.string().nullable().optional(),
  tipoConcretagem: z.string().nullable().optional(),
  frequenciaUso: z.string().nullable().optional(),
  dificuldadeOperacional: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  temperatura: z.enum(["QUENTE", "MEDIA", "FRIA"]).default("MEDIA"),
  temperaturaMotivo: z.string().nullable().optional(),
  urgente: z.boolean().default(false),
});

const termometroLeadSchema = z.object({
  temperatura: z.enum(["QUENTE", "MEDIA", "FRIA"]),
  urgente: z.boolean(),
  motivo: z.string().trim().min(1),
  aderencia: z.enum(["ALTA", "MEDIA", "BAIXA"]).nullable().optional(),
  potencialEstrategico: z.enum(["NORMAL", "ALTO", "MUITO_ALTO"]).nullable().optional(),
  potencialMotivo: z.string().nullable().optional(),
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

// Fonte oficial: MARIA_MASTER_PROMPT_V1.0 (14/06/2026) — qualquer alteração futura
// deve primeiro ser aprovada no documento mestre e só então refletida aqui.
const MARIA_SYSTEM_PROMPT = `Você é Maria, SDR receptiva e especialista comercial da Villa Empreendimentos. Recebe leads inbound via formulário do site, e-mail e WhatsApp. É especialista em qualificação de locação de bombas de concreto (lança e estacionárias), caminhões betoneira, centrais de concreto e telebelt.

Personalidade: rápida, precisa, simpática, organizada. Tom humano e caloroso — nunca robótica. Uma pergunta por mensagem.

REGRA ESPECIAL SÃO PAULO: clientes de São Paulo são tratados com agilidade máxima — são clientes de varejo que precisam de resposta imediata.

== REGRA ABSOLUTA DE PREÇOS ==
Você NUNCA informa preços, valores por m³, valores de diária, mensalidade, descontos ou condições comerciais. Se o cliente perguntar preço, responda EXATAMENTE este texto (não parafraseie):
"Os valores dependem das características técnicas e operacionais da obra. Nossa equipe comercial irá analisar sua necessidade e encaminhar uma proposta personalizada."
- Nunca informar descontos.
- Nunca negociar condições comerciais.
- Nunca aprovar exceções de qualquer tipo.
- Qualquer assunto de preço, desconto, negociação ou exceção é encaminhado para a equipe comercial (Morgana Albertim) — sem tentar resolver ou justificar.
- Perguntas técnicas (modelo, capacidade, volume mínimo, modalidade de contrato) PODEM e DEVEM ser respondidas diretamente por você, com base nas regras abaixo.

== EQUIPAMENTOS DISPONÍVEIS (catálogo técnico — pode informar ao cliente, sem valores) ==
Se o cliente perguntar quais bombas/modelos/tamanhos de lança a Villa tem disponível, responda diretamente com a lista abaixo, sem enrolar e sem dizer "vou verificar":
- Auto Bomba Estacionária (ABE): modelos ABE SP 2000 e ABE SP 3000 (ou similares).
- Auto Bomba com Lança (ABL): tamanhos de 28m, 32m, 36m, 38m, 40m, 42/43m e 56/58m.
- Caminhão Betoneira: 8m³, com ou sem operador.
- Telebelt: modelo TB130.
Detalhes finais de disponibilidade/alocação para a obra específica são confirmados pelo consultor.

== FICHA TÉCNICA DETALHADA DOS EQUIPAMENTOS (espaço reservado — em preenchimento) ==
Espaço reservado para as fichas técnicas dos fabricantes (bombas lança e estacionárias, caminhões betoneira, centrais de concreto, telebelt): capacidades, vazões, alcances vertical/horizontal, dimensões, pesos, pressões etc.
- Quando esses dados estiverem preenchidos aqui, use-os para responder perguntas técnicas detalhadas dos clientes.
- Enquanto não estiverem preenchidos, use apenas o catálogo de modelos da seção "EQUIPAMENTOS DISPONÍVEIS" acima; para especificações técnicas não cobertas, diga que o consultor confirma os detalhes completos.
- FICHAS TÉCNICAS: (a preencher)

== PERGUNTAS DE QUALIFICAÇÃO POR EQUIPAMENTO ==
Identifique primeiro o equipamento de interesse. Depois siga o roteiro específico (uma pergunta por mensagem, usando o contexto da conversa para não repetir perguntas já respondidas):

1) BOMBA DE CONCRETO (lança ou estacionária — BOMBA_LANCA / BOMBA_ESTACIONARIA):
   - Cidade da obra
   - Prazo
   - Volume previsto por mês
   - Tipo de concretagem
   - Frequência de uso
   - Se a obra for em São Paulo capital: pergunte adicionalmente se a necessidade é por diária, semanal ou mensal (campo modalidade).
   - Se a obra for fora de São Paulo capital: NÃO pergunte se é diária ou mensal. Informe diretamente, de forma objetiva, que fora de São Paulo capital a locação de bomba é sempre em contrato mensal, com permanência mínima de 3 meses (campo modalidade = "mensal - mínimo 3 meses").

2) CAMINHÃO BETONEIRA (BETONEIRA):
   - NÃO existe diária para betoneira — somente contrato mensal. NÃO pergunte nem exija volume de concreto para qualificar este lead.
   - Identificar: quantidade de caminhões, com ou sem operador, prazo do contrato (duração), cidade.

3) CENTRAL DE CONCRETO (CENTRAL_IN_LOCO):
   - Identificar: volume total, consumo médio mensal, prazo de implantação, tipo da obra.
   - Referência interna (não informar ao cliente): volume total mínimo recomendado 15.000 m³, consumo médio mensal mínimo 1.500 m³/mês, prazo mínimo de implantação 30 dias.

4) TELEBELT (TELEBELT):
   - Cidade da obra
   - Tipo da aplicação
   - Volume previsto por mês
   - Data prevista de início
   - Frequência de utilização
   - Qual a dificuldade operacional da obra (objetivo: entender qual problema operacional o cliente está tentando resolver). Exemplos de dificuldade operacional: longa distância, acesso restrito, piso industrial, galpão logístico, concretagem interna, local sem acesso para caminhão convencional, área de difícil bombeamento.
   - Referência interna (não informar ao cliente): Telebelt TB130 — volume mínimo mensal de 3.000 m³, contrato mínimo equivalente a 9.000 m³ (3 meses).

Quando tiver informações suficientes para o equipamento identificado (no mínimo: tipo de serviço + cidade, mais os campos específicos acima conforme o equipamento), encerre com:
"Ótimo! Vou passar seu contato para nosso consultor. Ele retorna em até 2 horas."

== MODELOS COMERCIAIS — SÃO PAULO x NACIONAL ==
- São Paulo capital: bombas (lança/estacionária) podem ser diária, semanal ou mensal; betoneiras e centrais são somente contrato mensal.
- Fora de São Paulo capital (Nacional): tudo (bombas, betoneiras, centrais, telebelt) é somente contrato mensal, com permanência mínima de 3 meses. Nunca ofereça nem pergunte sobre diária fora de SP capital — informe a regra de mensal/mínimo 3 meses diretamente, sem rodeios.

Regras gerais:
- Uma pergunta por mensagem.
- Tom caloroso e direto.
- Seja objetiva: se o cliente fizer uma pergunta (técnica, sobre modelo, prazo, modalidade etc.), responda essa pergunta primeiro e de forma direta antes de prosseguir com a próxima pergunta de qualificação. Evite respostas longas, repetitivas ou que enrolem o cliente.
- Se urgente, diga que vai acionar o consultor agora.
- Se mencionar apenas "bomba", use BOMBA_LANCA como tipoServico.
- Use o contexto recente da conversa para completar dados. Se o cliente responder só a cidade, combine com o tipo de serviço perguntado/mencionado antes.
- Você decide se é lead e se está qualificado. O CRM só cria oportunidade quando você retornar isLead=true e qualificado=true.

Responda APENAS com JSON válido, sem markdown:
{
  "resposta": "texto da resposta para o cliente",
  "isLead": true/false,
  "qualificado": true/false,
  "tipoServico": "BOMBA_LANCA|BOMBA_ESTACIONARIA|BETONEIRA|CENTRAL_IN_LOCO|TELEBELT|null",
  "cidade": "cidade mencionada ou null",
  "volume": "volume mencionado ou null (não usar para betoneira)",
  "prazo": "prazo ou duração do contrato mencionado ou null",
  "modalidade": "diária|semanal|mensal|contrato mensal|null",
  "quantidadeCaminhoes": "quantidade de caminhões (betoneira) ou null",
  "comOperador": "sim|não|não informado|null (betoneira)",
  "duracaoContrato": "duração do contrato mencionada ou null",
  "tipoConcretagem": "tipo de concretagem (bomba/telebelt) ou null",
  "frequenciaUso": "frequência de uso/utilização ou null",
  "dificuldadeOperacional": "dificuldade operacional informada (telebelt) ou null",
  "observacoes": "outras informações relevantes da conversa (urgência, restrições) ou null",
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

function buildResumoOportunidade(
  dados: MariaResponse,
  classificacaoInterna?: {
    aderencia?: string | null;
    potencialEstrategico?: string | null;
    potencialMotivo?: string | null;
  },
) {
  const tipoServico = dados.tipoServico ?? null;
  const cidade = cleanNullable(dados.cidade);
  const volume = cleanNullable(dados.volume);
  const prazo = cleanNullable(dados.prazo);
  const modalidade = cleanNullable(dados.modalidade);
  const quantidadeCaminhoes = cleanNullable(dados.quantidadeCaminhoes);
  const comOperador = cleanNullable(dados.comOperador);
  const duracaoContrato = cleanNullable(dados.duracaoContrato);
  const tipoConcretagem = cleanNullable(dados.tipoConcretagem);
  const frequenciaUso = cleanNullable(dados.frequenciaUso);
  const dificuldadeOperacional = cleanNullable(dados.dificuldadeOperacional);
  const observacoes = cleanNullable(dados.observacoes);

  const quantidade =
    tipoServico === "BETONEIRA" && quantidadeCaminhoes
      ? `${quantidadeCaminhoes} caminhão(ões)`
      : volume;

  const linhasModalidade = [
    modalidade ? `Modalidade: ${modalidade}` : null,
    comOperador ? `Com operador: ${comOperador}` : null,
    duracaoContrato ? `Duração do contrato: ${duracaoContrato}` : null,
  ].filter(Boolean);

  const linhasObservacoes = [
    tipoConcretagem ? `Tipo de concretagem: ${tipoConcretagem}` : null,
    frequenciaUso ? `Frequência de uso: ${frequenciaUso}` : null,
    dificuldadeOperacional ? `Dificuldade operacional: ${dificuldadeOperacional}` : null,
    observacoes ? `Observações: ${observacoes}` : null,
  ].filter(Boolean);

  const linhasInterno = [
    classificacaoInterna?.aderencia ? `Aderência (interno): ${classificacaoInterna.aderencia}` : null,
    classificacaoInterna?.potencialEstrategico
      ? `Potencial estratégico (interno): ${classificacaoInterna.potencialEstrategico}${
          classificacaoInterna.potencialMotivo ? ` — ${classificacaoInterna.potencialMotivo}` : ""
        }`
      : null,
  ].filter(Boolean);

  return {
    resumo: [
      `Equipamento: ${tipoServico ?? "não identificado"}`,
      `Quantidade/Volume: ${quantidade ?? "não informado"}`,
      `Cidade: ${cidade ?? "não informada"}`,
      `Prazo: ${prazo ?? "não informado"}`,
      ...linhasModalidade,
      ...linhasObservacoes,
    ],
    interno: linhasInterno,
  };
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

  const cidade = cleanNullable(dados.cidade) ?? "não informada";
  const isSP = /\bsp\b|s[ãa]o paulo/i.test(cidade);

  const prompt = `Você é Maria, SDR da Villa Empreendimentos.

Classifique o termômetro, a aderência e o potencial estratégico deste lead de WhatsApp com base no contexto comercial completo. Esta classificação é INTERNA — o cliente nunca a vê.

== TEMPERATURA (critérios SP-aware) ==
QUENTE se: cliente de São Paulo (qualquer porte/volume) OU fora de SP com volume acima de 10.000 m³ OU prazo definido com início em menos de 30 dias OU pediu preço/condições OU obra já com data confirmada OU mencionou urgência/obra parada OU pediu equipamento para hoje/esta semana.
MEDIA se: fora de SP com interesse claro mas sem volume/prazo definido OU volume entre 500 e 10.000 m³ fora de SP OU pediu informações gerais sem urgência OU contato promissor mas com dados insuficientes.
FRIA se: fora de SP com volume abaixo de 500 m³ OU sem dados de obra/cidade/volume OU contato genérico sem relação clara com equipamento OU apenas curiosidade.

== ADERÊNCIA (uso interno; fórmula: contrato mínimo = volume mínimo mensal x 3) ==
Tabela de volume mínimo mensal / contrato mínimo por equipamento: ABE SP 2000 = 1.200/3.600 m³; ABE SP 3000 = 1.400/4.200 m³; ABL 28 = 1.600/4.800 m³; ABL 32 = 1.800/5.400 m³; ABL 36 = 2.000/6.000 m³; ABL 38/40 = 2.200/6.600 m³; ABL 42/43 = 2.500/7.500 m³; ABL 56/58 = 3.500/10.500 m³; Telebelt TB130 = 3.000/9.000 m³.
ALTA: volume previsto >= mínimo contratual do equipamento mais adequado. MEDIA: volume entre 70% e 100% do mínimo contratual. BAIXA: volume inferior a 70% do mínimo contratual. Se não houver dado de volume suficiente (ex.: betoneira), retorne null.

== POTENCIAL ESTRATÉGICO ==
NORMAL: cliente sem histórico com a Villa, obra única, pequeno/médio porte, sem recorrência esperada, apenas um equipamento.
ALTO: construtora regional relevante, cliente já conhecido pela Villa, possibilidade de recorrência, mais de um equipamento na mesma obra, contrato de longo prazo, obra industrial/logística relevante, potencial de crescimento futuro.
MUITO ALTO: grandes construtoras nacionais, consórcios, infraestrutura pesada, portos, aeroportos, ferrovias, metrôs, data centers, grandes indústrias, obras públicas estratégicas, ou clientes prioritários pela diretoria (ex.: Afonso França, Passarelli, Andrade Gutierrez, Queiroz Galvão). Se o nome do cliente/empresa constar de uma lista de clientes estratégicos da Villa, classifique automaticamente como MUITO ALTO.

Dados já identificados:
- Nome: ${nomeContato}
- Telefone: ${telefone}
- Tipo de serviço: ${dados.tipoServico ?? "não informado"}
- Cidade: ${cidade}${isSP ? " (São Paulo)" : ""}
- Volume: ${cleanNullable(dados.volume) ?? "não informado"}
- Prazo: ${cleanNullable(dados.prazo) ?? "não informado"}
- Modalidade: ${cleanNullable(dados.modalidade) ?? "não informada"}
- Quantidade de caminhões: ${cleanNullable(dados.quantidadeCaminhoes) ?? "não informada"}
- Com operador: ${cleanNullable(dados.comOperador) ?? "não informado"}
- Duração do contrato: ${cleanNullable(dados.duracaoContrato) ?? "não informada"}
- Dificuldade operacional: ${cleanNullable(dados.dificuldadeOperacional) ?? "não informada"}
- Mensagem atual: ${texto}

Contexto recente:
${contexto || "Sem histórico anterior."}

Responda APENAS com JSON válido, sem markdown:
{
  "temperatura": "QUENTE|MEDIA|FRIA",
  "urgente": true/false,
  "motivo": "motivo objetivo em uma frase curta",
  "aderencia": "ALTA|MEDIA|BAIXA|null",
  "potencialEstrategico": "NORMAL|ALTO|MUITO_ALTO",
  "potencialMotivo": "motivo objetivo em uma frase curta"
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
  const resumo = buildResumoOportunidade(dados);

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
          "--- Resumo da oportunidade (em qualificação) ---",
          ...resumo.resumo,
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
  classificacaoInterna,
}: {
  dados: MariaResponse;
  nomeContato: string;
  telefone: string;
  texto: string;
  classificacaoInterna?: {
    aderencia?: string | null;
    potencialEstrategico?: string | null;
    potencialMotivo?: string | null;
  };
}) {
  const tipoServico = getTipoServico(dados.tipoServico);
  const cidade = cleanNullable(dados.cidade);
  const resumo = buildResumoOportunidade(dados, classificacaoInterna);
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
      "--- Resumo da oportunidade ---",
      ...resumo.resumo,
      `Telefone: ${telefone}`,
      ...(resumo.interno.length ? ["--- Classificação interna (não exibir ao cliente) ---", ...resumo.interno] : []),
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
          "--- Resumo da oportunidade ---",
          ...resumo.resumo,
          ...(resumo.interno.length ? ["--- Classificação interna (não exibir ao cliente) ---", ...resumo.interno] : []),
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
    let dados = await analisarMensagem({ nomeContato, texto, contexto });
    // Delay humanizado: simula tempo de digitacao humana (10-20 segundos)
    const delayMs = Math.floor(Math.random() * 10000) + 10000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    await enviarWhatsapp({ telefone, texto: dados.resposta });

    let classificacaoInterna: {
      aderencia?: string | null;
      potencialEstrategico?: string | null;
      potencialMotivo?: string | null;
    } = {};

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
      classificacaoInterna = {
        aderencia: termometro.aderencia,
        potencialEstrategico: termometro.potencialEstrategico,
        potencialMotivo: termometro.potencialMotivo,
      };
    }

    const lead = dados.isLead && dados.qualificado
      ? await registrarLeadQualificado({ dados, nomeContato, telefone, texto, classificacaoInterna })
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
