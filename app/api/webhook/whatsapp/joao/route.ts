// ARQUIVO: app/api/webhook/whatsapp/joao/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint exclusivo do João (outbound). Maria usa /api/webhook/whatsapp.
// Endpoint separado evita qualquer ambiguidade de roteamento.

import { NextResponse } from "next/server";
import { getVillaKnowledgeBase } from "@/lib/villa-kb";
import { prisma } from "@/lib/prisma";

// ─── Helpers (copiados do whatsapp/route.ts para manter independência) ────────

function getWhatsappNumber(remoteJid?: string): string | null {
  if (!remoteJid) return null;
  const num = remoteJid.replace(/@.*$/, "").replace(/\D/g, "");
  if (num.length < 8) return null;
  return `+${num}`;
}

function getTextMessage(payload: { data?: { message?: { conversation?: string; extendedTextMessage?: { text?: string } } } }): string | null {
  const msg = payload.data?.message;
  return msg?.conversation ?? msg?.extendedTextMessage?.text ?? null;
}

// ─── Contexto da conversa ─────────────────────────────────────────────────────

async function getContextoJoao(telefone: string): Promise<string> {
  const conversa = await prisma.conversa.findFirst({
    where: { telefone, instanceName: "joao-villa" },
    orderBy: { updatedAt: "desc" },
    include: {
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { conteudo: true, direcao: true, createdAt: true },
      },
    },
  });

  if (!conversa || conversa.mensagens.length === 0) return "";

  return conversa.mensagens
    .reverse()
    .map((m) => `${m.direcao === "ENTRADA" ? "Cliente" : "João"}: ${m.conteudo}`)
    .join("\n");
}

// ─── Prompt do João ───────────────────────────────────────────────────────────
// Fonte oficial: JOAO_MASTER_PROMPT_V1.0 (23/06/2026)
const JOAO_SYSTEM_PROMPT = `${getVillaKnowledgeBase()}

---

Você é João, especialista comercial outbound da Villa Empreendimentos. Você entrou em contato primeiro com este cliente. Agora ele está respondendo a você.

Personalidade: direto, objetivo, consultivo. Tom profissional e cordial — sem exageros. Uma pergunta por mensagem.

Seu objetivo: qualificar o interesse do cliente e agendar uma conversa com a equipe comercial.

== REGRA ABSOLUTA DE PREÇOS ==
Nunca informe preços, valores, descontos ou condições comerciais. Se perguntarem, diga:
"Os valores são personalizados para cada projeto. Nossa equipe comercial vai analisar sua necessidade e enviar uma proposta."

== COMPORTAMENTO ==
- Se o cliente demonstrar interesse real: capture dados (tipo de obra, cidade, volume, prazo) e informe que um especialista vai entrar em contato.
- Se o cliente disser que não tem interesse agora: agradeça, pergunte se pode contatar futuramente e encerre com cordialidade.
- Se o cliente perguntar algo técnico que você não sabe: diga que vai verificar com a equipe e retorna.
- Nunca prometa datas, prazos ou disponibilidade de equipamentos.
- Máximo 3 trocas de mensagem antes de propor falar com o comercial.

Responda APENAS com um JSON no seguinte formato (sem markdown):
{
  "resposta": "texto da resposta para o cliente",
  "interesse": true/false,
  "dadosCapturados": {
    "tipoObra": "string ou null",
    "cidade": "string ou null",
    "volume": "string ou null"
  }
}`;

async function analisarMensagemJoao({
  nomeContato,
  texto,
  contexto,
}: {
  nomeContato: string;
  texto: string;
  contexto: string;
}): Promise<{ resposta: string; interesse: boolean }> {
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
    };
  } catch (err) {
    console.error("[joao/webhook] Erro ao analisar mensagem:", err);
    return {
      resposta: "Obrigado pelo retorno! Em breve nossa equipe entrará em contato.",
      interesse: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function enviarWhatsappJoao({ telefone, texto }: { telefone: string; texto: string }) {
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: { event?: string; data?: { key?: { fromMe?: boolean; remoteJid?: string }; message?: { conversation?: string; extendedTextMessage?: { text?: string } }; pushName?: string } };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  if (body.event !== "messages.upsert") return NextResponse.json({ ok: true });
  if (body.data?.key?.fromMe) return NextResponse.json({ ok: true });

  const texto = getTextMessage(body);
  if (!texto) return NextResponse.json({ ok: true });

  const telefone = getWhatsappNumber(body.data?.key?.remoteJid);
  if (!telefone) return NextResponse.json({ ok: true });

  const nomeContato = body.data?.pushName?.trim() || "Cliente";

  try {
    const contexto = await getContextoJoao(telefone);
    const { resposta, interesse } = await analisarMensagemJoao({ nomeContato, texto, contexto });
    await enviarWhatsappJoao({ telefone, texto: resposta });
    return NextResponse.json({ ok: true, agente: "joao", interesse });
  } catch (error) {
    console.error("[joao/webhook] Erro:", error);
    return NextResponse.json({ ok: false, message: "Erro interno." }, { status: 500 });
  }
}
