// ARQUIVO: app/api/webhook/whatsapp/morgana/route.ts
// Webhook dedicado da Morgana (Evolution API). Morgana é uma vendedora HUMANA — esta
// rota NUNCA importa nem chama nenhuma função de IA (analisarMensagem, handlers de
// Maria/João ou qualquer outro agente). Só espelha em Conversa/Mensagem o que
// realmente aconteceu no WhatsApp dela: mensagens de cliente e mensagens enviadas por
// ela mesma (pela Central ou direto pelo celular, via evento fromMe).
//
// REGRA CRÍTICA: só processa eventos cujo body.instance === "morgana-villa". Qualquer
// outro valor é ignorado com auditoria sanitizada — nunca cai para outro agente, nunca
// fallback para a lógica da Maria (que hoje roda incondicionalmente em
// /api/webhook/whatsapp, sem checar instance — ver comentário daquele arquivo). Esta
// rota é isolada dele de propósito.
//
// Feature flag WHATSAPP_MORGANA_CONVERSAS_V2:
//   - ausente ou "false": a rota responde 200 (para a Evolution não re-tentar
//     indefinidamente) mas não persiste nada — nenhuma escrita no banco.
//   - "true": processa e persiste normalmente.

import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import {
  getCanalMorgana,
  mensagemJaProcessada,
  persistirMensagemCliente,
  reconciliarOuCriarMensagemHumana,
} from "@/lib/whatsapp/agentes/morgana";

export const maxDuration = 30;

const INSTANCE_NAME = "morgana-villa";

// ─── Tipos do payload Evolution API ──────────────────────────────────────────

type EvolutionMessageBody = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
};

type EvolutionMessage = {
  key?: { fromMe?: boolean; remoteJid?: string; id?: string };
  message?: EvolutionMessageBody;
  messageType?: string;
  pushName?: string;
};

type EvolutionWebhookPayload = {
  event?: string;
  instance?: string;
  data?: {
    key?: { fromMe?: boolean; remoteJid?: string; id?: string };
    message?: EvolutionMessageBody;
    messages?: EvolutionMessage[];
    messageType?: string;
    pushName?: string;
  };
};

// ─── Helpers de parsing (duplicados propositalmente — sem importar nada do
// webhook da Maria, para manter esta rota fisicamente isolada de qualquer IA) ──

function normalizeEvolutionMessage(payload: EvolutionWebhookPayload): EvolutionMessage | undefined {
  const raw = payload.data?.messages?.[0] ?? (payload.data as EvolutionMessage | undefined);
  if (!raw) return undefined;
  return raw;
}

function getTextMessage(msg: EvolutionMessage | undefined): string {
  return (msg?.message?.conversation ?? msg?.message?.extendedTextMessage?.text ?? "").trim();
}

function getWhatsappNumber(msg: EvolutionMessage | undefined): string | null {
  const remoteJid = msg?.key?.remoteJid;
  if (!remoteJid || remoteJid.endsWith("@g.us")) return null;
  const [number] = remoteJid.split("@");
  const digits = number?.replace(/\D/g, "");
  return digits || null;
}

// ─── POST — recebimento de eventos Evolution ─────────────────────────────────

export async function POST(request: Request) {
  let body: EvolutionWebhookPayload;

  try {
    body = (await request.json()) as EvolutionWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload JSON inválido." }, { status: 400 });
  }

  // ─── Guarda obrigatória: só processa eventos da instância da Morgana ────────
  if (body.instance !== INSTANCE_NAME) {
    await auditLog({
      action: "WHATSAPP_MORGANA_INSTANCE_DIVERGENTE",
      entity: "CanalWhatsapp",
      entityId: null,
      metadata: { instanceRecebida: body.instance ?? null },
    });
    console.warn("[morgana/webhook] Evento com instance divergente — ignorado.", { instance: body.instance });
    return NextResponse.json({ ok: true });
  }

  if (body.event !== "messages.upsert") {
    return NextResponse.json({ ok: true });
  }

  const conversasV2Ligada = process.env.WHATSAPP_MORGANA_CONVERSAS_V2 === "true";
  if (!conversasV2Ligada) {
    console.info("[morgana/webhook] WHATSAPP_MORGANA_CONVERSAS_V2 desligada — evento recebido, nada persistido.");
    return NextResponse.json({ ok: true });
  }

  const msg = normalizeEvolutionMessage(body);
  if (!msg) {
    return NextResponse.json({ ok: true });
  }

  const externalMessageId = msg.key?.id;
  if (!externalMessageId) {
    // Nunca inventamos um identificador — sem id real da Evolution, a mensagem é
    // descartada em vez de gravada sem controle de idempotência.
    console.warn("[morgana/webhook] Mensagem sem key.id — descartada (nenhum identificador é inventado).");
    return NextResponse.json({ ok: true });
  }

  const telefone = getWhatsappNumber(msg);
  if (!telefone) {
    return NextResponse.json({ ok: true });
  }

  const texto = getTextMessage(msg);
  const messageType = msg.messageType ?? (msg.message?.conversation || msg.message?.extendedTextMessage ? "text" : "unknown");
  const nomeContato = msg.pushName?.trim() || "Cliente";
  const canal = await getCanalMorgana();

  if (!canal) {
    console.warn("[morgana/webhook] CanalWhatsapp 'morgana-villa' não encontrado — evento ignorado.");
    return NextResponse.json({ ok: true });
  }

  if (!canal.ativo) {
    console.warn("[morgana/webhook] Canal 'morgana-villa' inativo — evento ignorado.");
    return NextResponse.json({ ok: true });
  }

  try {
    if (msg.key?.fromMe) {
      // Mensagem da própria Morgana — pela Central (eco, deve reconciliar) ou
      // direto pelo celular dela (deve criar). Nunca aciona nenhuma IA.
      await reconciliarOuCriarMensagemHumana({
        canal,
        telefone,
        nomeContato,
        externalMessageId,
        messageType,
        texto,
        rawPayload: msg,
      });
    } else {
      // Mensagem de cliente real — só persiste, nenhuma resposta automática é gerada.
      const jaProcessada = await mensagemJaProcessada({ canal, externalMessageId });
      if (jaProcessada) {
        console.info("[morgana/webhook] Evento de cliente duplicado — ignorado.", { externalMessageId });
        return NextResponse.json({ ok: true });
      }

      await persistirMensagemCliente({
        canal,
        telefone,
        nomeContato,
        externalMessageId,
        messageType,
        texto,
        rawPayload: msg,
      });
    }
  } catch (err) {
    console.error("[morgana/webhook] Erro ao persistir evento:", err);
  }

  return NextResponse.json({ ok: true });
}
