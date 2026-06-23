// ARQUIVO: lib/agentes/maria/handler.ts
// REGRA: nunca remover. Apenas acrescentar.
// Schemas Zod, types, helpers e funções de análise da Maria.

import { z } from "zod";
import { TipoServico } from "@/app/generated/prisma/client";
import { MARIA_SYSTEM_PROMPT } from "./prompt";

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

export const tipoServicoSchema = z
  .enum([
    "BOMBA_LANCA",
    "BOMBA_ESTACIONARIA",
    "BETONEIRA",
    "CENTRAL_IN_LOCO",
    "TELEBELT",
  ])
  .nullable()
  .optional();

export const mariaResponseSchema = z.object({
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

export const termometroLeadSchema = z.object({
  temperatura: z.enum(["QUENTE", "MEDIA", "FRIA"]),
  urgente: z.boolean(),
  motivo: z.string().trim().min(1),
  aderencia: z.enum(["ALTA", "MEDIA", "BAIXA"]).nullable().optional(),
  potencialEstrategico: z.enum(["NORMAL", "ALTO", "MUITO_ALTO"]).nullable().optional(),
  potencialMotivo: z.string().nullable().optional(),
});

export type MariaResponse = z.infer<typeof mariaResponseSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function extractJson(text: string) {
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

export function cleanNullable(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.toLowerCase() === "null") {
    return null;
  }

  return trimmed;
}

export function getTaskDueDate(urgente: boolean) {
  const date = new Date();

  if (urgente) {
    date.setMinutes(date.getMinutes() + 30);
    return date;
  }

  date.setHours(date.getHours() + 2);
  return date;
}

export function buildResumoOportunidade(
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

export function getTipoServico(tipoServico: MariaResponse["tipoServico"]) {
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

// ─── Funções de análise ───────────────────────────────────────────────────────

export async function analisarMensagem({
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

export async function classificarTermometroLead({
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
