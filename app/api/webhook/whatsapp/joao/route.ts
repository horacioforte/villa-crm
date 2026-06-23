// ARQUIVO: app/api/webhook/whatsapp/joao/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint exclusivo do João (outbound). Maria usa /api/webhook/whatsapp.
// Endpoint separado evita qualquer ambiguidade de roteamento.

import { NextResponse } from "next/server";
import { analisarMensagemJoao } from "@/lib/agentes/joao/handler";
import { getContextoJoao } from "@/lib/agentes/joao/contexto";
import { enviarWhatsappJoao } from "@/lib/agentes/joao/crm";

// ─── Helpers de parsing do payload ───────────────────────────────────────────

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
