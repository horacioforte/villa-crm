// ARQUIVO: lib/agentes/joao/handler.ts
// REGRA: nunca remover. Apenas acrescentar.
// Função de análise de mensagens do João (outbound). Isolado da Maria.

import { JOAO_SYSTEM_PROMPT } from "./prompt";

export async function analisarMensagemJoao({
  nomeContato,
  texto,
  contexto,
}: {
  nomeContato: string;
  texto: string;
  contexto: string;
}): Promise<{ resposta: string; interesse: boolean; confidenceScore: number; gatilho: string }> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: JOAO_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Contexto da conversa:\n${contexto || "Primeiro contato."}\n\nNome do cliente: ${nomeContato}\nMensagem recebida: ${texto}`,
        },
      ],
    });

    const raw = message.content[0]?.type === "text" ? message.content[0].text : "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      resposta: parsed.resposta ?? "Obrigado pelo retorno! Como posso ajudar?",
      interesse: parsed.interesse ?? false,
      confidenceScore: typeof parsed.confidence_score === "number" ? parsed.confidence_score : 0,
      gatilho: parsed.gatilho ?? "nenhum",
    };
  } catch (err) {
    console.error("[joao/handler] Erro ao analisar mensagem:", err);
    return {
      resposta: "Obrigado pelo retorno! Em breve nossa equipe entrará em contato.",
      interesse: false,
      confidenceScore: 0,
      gatilho: "nenhum",
    };
  } finally {
    clearTimeout(timeout);
  }
}
