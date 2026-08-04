// ARQUIVO: app/api/webhook/whatsapp/joao/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Webhook exclusivo do João (outbound) — Meta Cloud API.
// GET: verificação do webhook pelo Meta (compartilhado entre V1 e V2 — mesmo mecanismo).
// POST: recebimento de mensagens e status updates.
//
// Fase 2 (Etapa 3) — ACRESCENTADO: branch por feature flag WHATSAPP_JOAO_V2.
//   - "false" ou ausente (padrão): fluxo V1 abaixo, sem NENHUMA alteração de
//     comportamento em relação ao que já rodava em produção.
//   - "true": delega inteiramente para lib/whatsapp/joao-webhook-v2.ts.
// Nunca os dois caminhos executam para o mesmo evento — a checagem da flag decide um
// único branch antes de qualquer processamento começar.

import { NextResponse } from "next/server";
import { analisarMensagemJoao } from "@/lib/agentes/joao/handler";
import { getContextoJoao } from "@/lib/agentes/joao/contexto";
import { enviarWhatsappJoao, processarRespostaJoao } from "@/lib/agentes/joao/crm";
import { processarWebhookJoaoV2 } from "@/lib/whatsapp/joao-webhook-v2";

export const maxDuration = 90;

// ─── Tipos do payload Meta Cloud API ─────────────────────────────────────────

type MetaMessage = {
  from: string;           // número do remetente (sem +)
  id: string;            // message ID
  timestamp: string;
  type: "text" | "image" | "audio" | "document" | "sticker" | "reaction" | string;
  text?: { body: string };
};

type MetaContact = {
  profile: { name: string };
  wa_id: string;
};

type MetaValue = {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: Array<{ id: string; status: string; timestamp: string; recipient_id: string }>;
};

type MetaWebhookPayload = {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{ value: MetaValue; field: string }>;
  }>;
};

// ─── GET — verificação do webhook pelo Meta ───────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.info("[joao/webhook] Verificação do webhook Meta aprovada.");
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[joao/webhook] Verificação do webhook Meta falhou.", { mode, token });
  return new Response("Forbidden", { status: 403 });
}

// ─── POST — mensagens recebidas ───────────────────────────────────────────────
// Branch único, decidido antes de qualquer processamento: V2 se a flag estiver
// exatamente "true", V1 (legado, inalterado) em qualquer outro caso — inclusive
// ausente, vazia, ou com qualquer outro valor.

export async function POST(request: Request) {
  if (process.env.WHATSAPP_JOAO_V2 === "true") {
    return processarWebhookJoaoV2(request);
  }

  return processarWebhookJoaoV1(request);
}

async function processarWebhookJoaoV1(request: Request) {
  let body: MetaWebhookPayload;

  try {
    body = (await request.json()) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  // Meta envia status updates (delivered, read) — ignorar silenciosamente
  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const value = change.value;
      const messages = value.messages ?? [];

      for (const msg of messages) {
        // Só processa mensagens de texto
        if (msg.type !== "text" || !msg.text?.body) continue;

        const texto = msg.text.body.trim();
        const telefone = msg.from; // já no formato internacional sem '+'
        const nomeContato =
          value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name?.trim() ||
          "Cliente";

        console.info("[joao/webhook] Mensagem recebida", { telefone, nomeContato, texto: texto.substring(0, 80) });

        try {
          const contexto = await getContextoJoao(telefone);
          const { resposta, interesse, confidenceScore, gatilho } = await analisarMensagemJoao({
            nomeContato,
            texto,
            contexto,
          });

          // Envia resposta via Meta Cloud API
          await enviarWhatsappJoao({ telefone, texto: resposta });

          // Registra no CRM + cria oportunidade se score >= 70
          await processarRespostaJoao({
            telefone,
            nomeContato,
            textoCiente: texto,
            textoJoao: resposta,
            interesse,
            confidenceScore,
            gatilho,
          }).catch((err) => {
            console.error("[joao/webhook] Erro ao registrar no CRM:", err);
          });
        } catch (error) {
          console.error("[joao/webhook] Erro ao processar mensagem:", error);
        }
      }
    }
  }

  // Meta exige sempre 200 para não reenviar o evento
  return NextResponse.json({ ok: true });
}
