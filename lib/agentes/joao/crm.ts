// ARQUIVO: lib/agentes/joao/crm.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ações no CRM e envio de WhatsApp pelo João. Isolado da Maria.

export async function enviarWhatsappJoao({ telefone, texto }: { telefone: string; texto: string }) {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.JOAO_EVOLUTION_API_KEY;
  const instance = "joao-villa";

  if (!apiUrl || !apiKey) throw new Error("JOAO_EVOLUTION_API_KEY não configurada.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: telefone, text: texto }),
    });
  } finally {
    clearTimeout(timeout);
  }
}
