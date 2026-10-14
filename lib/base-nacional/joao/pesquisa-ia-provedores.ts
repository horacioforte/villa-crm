// ARQUIVO: lib/base-nacional/joao/pesquisa-ia-provedores.ts
// REGRA: nunca remover. Apenas acrescentar.
// Implementações REAIS de ClienteBuscaIA (Claude e OpenAI, com busca web). Só são chamadas
// quando JOAO_PESQUISA_IA_ATIVA=true e o provedor correspondente está configurado — ver
// pesquisa-ia-config.ts. NUNCA chamadas pelos testes automatizados (sempre usam um cliente
// simulado — ver pesquisa-ia.test.ts). Mesmo padrão de chamada de lib/agentes/joao/investigador.ts
// e investigador-openai.ts (web_search / web_search_preview), adaptado para o público B/C da
// fila comercial do João.

import type { AchadoBrutoPesquisaIA, ClienteBuscaIA, EntradaPesquisaIA, RespostaClienteBuscaIA } from "./pesquisa-ia";

function extrairJson(texto: string): unknown {
  let t = texto.trim();
  const md = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md) t = md[1].trim();
  const inicio = t.indexOf("[");
  const fim = t.lastIndexOf("]");
  if (inicio === -1 || fim === -1 || fim < inicio) return [];
  try { return JSON.parse(t.slice(inicio, fim + 1)); } catch { return []; }
}

function paraAchados(json: unknown): AchadoBrutoPesquisaIA[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map(x => ({
      nome: String(x.nome ?? ""),
      cargo: String(x.cargo ?? ""),
      linkedinUrl: typeof x.linkedinUrl === "string" ? x.linkedinUrl : null,
      fonteUrl: String(x.fonteUrl ?? ""),
      trecho: String(x.trecho ?? ""),
    }))
    .filter(a => a.nome && a.fonteUrl);
}

// Preço de referência (USD por 1M tokens) só para estimar custoUsd gravado em
// JoaoEnriquecimentoConsumo — é custo operacional da ferramenta, não preço de venda da Villa
// (nunca aparece para o cliente nem é usado em nenhuma mensagem comercial).
const CUSTO_POR_1M_TOKENS: Record<"claude" | "openai", number> = { claude: 1, openai: 2.5 };

export const clienteClaude: ClienteBuscaIA = {
  provedor: "claude",
  async buscar(entrada: EntradaPesquisaIA, prompt: string): Promise<RespostaClienteBuscaIA> {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client as any).beta.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          betas: ["web-search-2025-03-05"],
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
          messages: [{ role: "user", content: prompt }],
        },
        { signal: controller.signal },
      );
      const blocos = Array.isArray(response.content) ? response.content : [];
      const texto = blocos.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
      const tokensEstimados = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
      return { achados: paraAchados(extrairJson(texto)), tokensEstimados, custoUsd: (tokensEstimados / 1_000_000) * CUSTO_POR_1M_TOKENS.claude };
    } finally {
      clearTimeout(timeout);
    }
  },
};

export const clienteOpenAI: ClienteBuscaIA = {
  provedor: "openai",
  async buscar(entrada: EntradaPesquisaIA, prompt: string): Promise<RespostaClienteBuscaIA> {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client as any).responses.create(
        { model: "gpt-4o", tools: [{ type: "web_search_preview" }], input: prompt },
        { signal: controller.signal },
      );
      const texto = typeof response.output_text === "string" ? response.output_text : "";
      const tokensEstimados = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
      return { achados: paraAchados(extrairJson(texto)), tokensEstimados, custoUsd: (tokensEstimados / 1_000_000) * CUSTO_POR_1M_TOKENS.openai };
    } finally {
      clearTimeout(timeout);
    }
  },
};

export function clientePorProvedor(provedor: "claude" | "openai"): ClienteBuscaIA {
  return provedor === "claude" ? clienteClaude : clienteOpenAI;
}
