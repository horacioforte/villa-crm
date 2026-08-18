// ARQUIVO: lib/bi-executivo/analise.ts
// Análise Executiva da IA do BI Executivo (18/08/2026).
// REGRA: o backend calcula todos os números (lib/metrics/comercial.ts). A IA
// só recebe o resumo já calculado e interpreta — nunca recalcula, nunca
// inventa cliente, valor ou fato fora dos dados fornecidos.

export type AnaliseExecutivaMetricas = {
  periodoLabel: string;
  pipelinePotencial: { total: number; quantidade: number };
  pipelineProposto: { total: number; quantidade: number };
  pipelineContratadoPeriodo: { valor: number; quantidade: number };
  perdidoPeriodo: { valor: number; quantidade: number };
  funil: {
    abertas: number;
    comProposta: number;
    emNegociacao: number;
    ganhasNoPeriodo: number;
  };
  oportunidadesEstrategicasSemProposta: number;
};

export type AnaliseExecutivaIA = {
  analise: string;
  alertas: string[];
  prioridades: string[];
};

function formatCurrencyBR(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function buildPrompt(m: AnaliseExecutivaMetricas): string {
  return `Você é um analista comercial da Villa Empreendimentos (locação e venda de bombas de concreto e betoneiras), escrevendo para os sócios da empresa.

Os números abaixo já foram calculados pelo sistema — use SOMENTE estes números. Nunca invente cliente, valor, obra ou fato que não esteja aqui. Nunca recalcule nada, apenas interprete.

Ao citar um valor em R$ no seu texto, copie o número exatamente como está formatado abaixo (ex.: "R$ 140.000,00" continua "R$ 140.000,00", nunca vire "R$ 140M" nem "R$ 140 mil" abreviado incorretamente). Não arredonde, não abrevie e não troque a escala (mil/milhão) de nenhum valor.

## Período: ${m.periodoLabel}

Pipeline Potencial (oportunidades abertas): ${formatCurrencyBR(m.pipelinePotencial.total)} em ${m.pipelinePotencial.quantidade} oportunidades
Pipeline Proposto (propostas vigentes de oportunidades abertas): ${formatCurrencyBR(m.pipelineProposto.total)} em ${m.pipelineProposto.quantidade} propostas
Contratado no período: ${formatCurrencyBR(m.pipelineContratadoPeriodo.valor)} em ${m.pipelineContratadoPeriodo.quantidade} contratos
Perdido no período: ${formatCurrencyBR(m.perdidoPeriodo.valor)} em ${m.perdidoPeriodo.quantidade} negócios

Funil comercial (estoque atual): ${m.funil.abertas} oportunidades abertas, ${m.funil.comProposta} com proposta vigente, ${m.funil.emNegociacao} em negociação, ${m.funil.ganhasNoPeriodo} ganhas no período selecionado

Oportunidades estratégicas (marcadas manualmente) sem proposta: ${m.oportunidadesEstrategicasSemProposta}

Responda EXATAMENTE neste formato, sem nada além disso:
ANALISE: [2 a 3 frases objetivas sobre a situação comercial, baseadas só nos números acima]
ALERTA1: [uma situação real que merece atenção da diretoria, baseada nos números acima]
ALERTA2: [opcional — só inclua esta linha se houver um segundo alerta real e distinto]
ALERTA3: [opcional — só inclua esta linha se houver um terceiro alerta real e distinto]
PRIORIDADE1: [uma ação concreta recomendada com base nos dados]
PRIORIDADE2: [opcional — só inclua se houver uma segunda prioridade real e distinta]
PRIORIDADE3: [opcional — só inclua se houver uma terceira prioridade real e distinta]

Regra importante sobre ALERTA e PRIORIDADE: gere de 1 a 3 linhas de cada, sempre com conteúdo real e
distinto entre si. NUNCA escreva uma linha ALERTA ou PRIORIDADE só para completar as três — se só
houver 1 ou 2 pontos genuinamente relevantes, pare nessa quantidade e não escreva a linha seguinte.
A única exceção: se não houver absolutamente nenhum alerta a reportar, escreva só
"ALERTA1: Nenhum alerta relevante no momento." e nada em ALERTA2/ALERTA3 — nunca misture essa frase
com um alerta real em outra linha.`;
}

function parseResposta(text: string): AnaliseExecutivaIA | null {
  const analise = text.match(/ANALISE:\s*(.+)/i)?.[1]?.trim();
  const alertas = [1, 2, 3]
    .map((n) => text.match(new RegExp(`ALERTA${n}:\\s*(.+)`, "i"))?.[1]?.trim())
    .filter((v): v is string => Boolean(v));
  const prioridades = [1, 2, 3]
    .map((n) => text.match(new RegExp(`PRIORIDADE${n}:\\s*(.+)`, "i"))?.[1]?.trim())
    .filter((v): v is string => Boolean(v));

  if (!analise) return null;

  return { analise, alertas, prioridades };
}

/** Retorna null se ANTHROPIC_API_KEY ausente ou se a chamada falhar — a tela
 * deve tratar isso mostrando que a análise da IA está indisponível, nunca
 * fabricando um texto substituto. */
export async function gerarAnaliseExecutiva(
  metricas: AnaliseExecutivaMetricas,
): Promise<AnaliseExecutivaIA | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: buildPrompt(metricas) }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error (BI Executivo):", await response.json().catch(() => null));
      return null;
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? "";
    return parseResposta(text);
  } catch (error) {
    console.error("Análise Executiva IA — erro:", error);
    return null;
  }
}
