// ARQUIVO: app/api/webhook/whatsapp/maria/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Webhook exclusivo da Maria via Meta Cloud API (WhatsApp Business API oficial).
// Formato Meta — diferente do Evolution API usado anteriormente.

import { NextRequest, NextResponse } from "next/server";
import { analisarMensagem, classificarTermometroLead } from "@/lib/agentes/maria/handler";
import { getContextoConversa } from "@/lib/agentes/maria/contexto";
import {
  enviarWhatsappMeta,
  registrarLeadQualificado,
  registrarInteracaoParcial,
} from "@/lib/agentes/maria/crm";

export const maxDuration = 90;

// ─── Verificação do webhook (GET) ────────────────────────────────────────────
// A Meta chama este endpoint com hub.mode, hub.verify_token e hub.challenge
// para confirmar que o servidor é válido.

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.MARIA_META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[maria/meta-webhook] Webhook verificado com sucesso.");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[maria/meta-webhook] Verificação falhou. Token inválido.");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ─── Recebimento de mensagens (POST) ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  // Ignora eventos que não são do WhatsApp Business Account
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

      const messages = (value.messages as Record<string, unknown>[] | undefined) ?? [];
      const contacts = (value.contacts as Record<string, unknown>[] | undefined) ?? [];

      for (const message of messages) {
        // Ignora mensagens enviadas por nós
        if ((message.from as string) === process.env.MARIA_META_PHONE_NUMBER_ID) continue;

        // Só processa mensagens de texto
        if (message.type !== "text") continue;

        const texto = ((message.text as Record<string, unknown>)?.body as string)?.trim();
        if (!texto) continue;

        const telefone = message.from as string;
        if (!telefone) continue;

        // Nome do contato
        const contact = contacts.find(
          (c) => (c.wa_id as string) === telefone
        );
        const nomeContato =
          ((contact?.profile as Record<string, unknown>)?.name as string)?.trim() || "Cliente";

        // Processa com a IA da Maria (em background para retornar 200 rápido)
        processarMensagemMaria({ telefone, nomeContato, texto }).catch((err) => {
          console.error("[maria/meta-webhook] Erro ao processar mensagem:", err);
        });
      }
    }
  }

  // Meta exige resposta 200 rápida
  return NextResponse.json({ ok: true });
}

// ─── Processamento assíncrono ─────────────────────────────────────────────────

async function processarMensagemMaria({
  telefone,
  nomeContato,
  texto,
}: {
  telefone: string;
  nomeContato: string;
  texto: string;
}) {
  try {
    const contexto = await getContextoConversa(telefone);
    let dados = await analisarMensagem({ nomeContato, texto, contexto });
    await enviarWhatsappMeta({ telefone, texto: dados.resposta });

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

    if (dados.isLead && dados.qualificado) {
      await registrarLeadQualificado({ dados, nomeContato, telefone, texto, classificacaoInterna });
    } else if (dados.isLead) {
      await registrarInteracaoParcial({ dados, nomeContato, telefone, texto });
    }
  } catch (err) {
    console.error("[maria/meta-webhook] Erro interno:", err);
  }
}
