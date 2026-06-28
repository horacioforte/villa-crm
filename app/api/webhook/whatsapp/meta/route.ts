// ARQUIVO: app/api/webhook/whatsapp/meta/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Handler unificado Meta Cloud API — recebe webhooks de TODOS os números Meta (Maria, João etc.)
// e roteia para o agente correto baseado no phone_number_id da mensagem.
// Substituiu a configuração de webhook individual por número no Meta Developer Console.

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 90;

// ─── GET — verificação do webhook pelo Meta ───────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Aceita qualquer um dos verify tokens configurados
  const validTokens = [
    process.env.META_WEBHOOK_VERIFY_TOKEN,
    process.env.MARIA_META_VERIFY_TOKEN,
  ].filter(Boolean);

  if (mode === "subscribe" && validTokens.includes(token ?? "")) {
    console.log("[webhook/meta] Webhook verificado com sucesso.");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[webhook/meta] Verificação falhou. Token inválido:", token);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ─── POST — recebimento de mensagens e roteamento ────────────────────────────

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true });
  }

  const entries = (body.entry as Record<string, unknown>[] | undefined) ?? [];

  for (const entry of entries) {
    const changes = (entry.changes as Record<string, unknown>[] | undefined) ?? [];

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const metadata = value.metadata as Record<string, string> | undefined;
      const phoneNumberId = metadata?.phone_number_id;

      if (!phoneNumberId) continue;

      const mariaPhoneId = process.env.MARIA_META_PHONE_NUMBER_ID;
      const joaoPhoneId  = process.env.META_JOAO_PHONE_NUMBER_ID;

      if (phoneNumberId === mariaPhoneId) {
        // Delegar ao handler da Maria
        await delegarParaAgente(request, body, "maria");
      } else if (phoneNumberId === joaoPhoneId) {
        // Delegar ao handler do João
        await delegarParaAgente(request, body, "joao");
      } else {
        console.warn("[webhook/meta] phone_number_id não reconhecido:", phoneNumberId);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Delegação interna para o handler do agente ──────────────────────────────

async function delegarParaAgente(
  originalRequest: NextRequest,
  body: Record<string, unknown>,
  agente: "maria" | "joao"
) {
  try {
    const url = new URL(originalRequest.url);
    const targetUrl = `${url.origin}/api/webhook/whatsapp/${agente}`;

    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.error(`[webhook/meta] Erro ao delegar para ${agente}:`, resp.status);
    }
  } catch (err) {
    console.error(`[webhook/meta] Exceção ao delegar para ${agente}:`, err);
  }
}
