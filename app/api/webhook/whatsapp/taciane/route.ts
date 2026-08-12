// ARQUIVO: app/api/webhook/whatsapp/taciane/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Webhook dedicado da Taciane (Meta Cloud API). Taciane é uma atendente HUMANA — esta
// rota NUNCA importa nem chama nenhuma função de IA (analisarMensagem, handlers de
// Maria/João, agentes/joao, ou qualquer outro agente). Só espelha em Conversa/Mensagem
// o que o cliente realmente mandou — nenhuma resposta automática é gerada aqui.
//
// REGRA CRÍTICA: só processa eventos cujo metadata.phone_number_id seja exatamente o
// número da Taciane (confirmado visualmente no Meta for Developers). Qualquer outro
// valor é ignorado com auditoria sanitizada — nunca cai para outro canal/agente, nunca
// fallback para Maria, João ou Morgana. Esta rota é fisicamente isolada delas.
//
// Ordem segura de validação do POST (mesma ordem do roteador unificado — ver
// lib/whatsapp/meta-router-v2.ts, que documenta o porquê):
//   rawBody → valida assinatura X-Hub-Signature-256 (META_APP_SECRET) → só então
//   JSON.parse → só então extrai phone_number_id e decide o que fazer.
//
// Feature flag WHATSAPP_TACIANE_CONVERSAS_V2:
//   - ausente ou "false" (padrão): responde 200 (para a Meta não reenviar
//     indefinidamente) mas não persiste nada — nenhuma escrita no banco.
//   - "true": persiste mensagens de cliente em Conversa/Mensagem.

import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { resolveWhatsappEnvVar } from "@/lib/whatsapp/env-allowlist";
import { verificarAssinaturaMeta } from "@/lib/whatsapp/verify-signature";
import { getCanalTaciane, mensagemJaProcessada, persistirMensagemCliente } from "@/lib/whatsapp/agentes/taciane";
import type { CanalWhatsapp } from "@/app/generated/prisma/client";

export const maxDuration = 30;

// Número da Taciane — confirmado visualmente no Meta for Developers (phone_number_id
// 1238399969356190, display_phone_number "+55 81 7401-8568"). Guarda hardcoded de
// propósito: mesmo que o registro CanalWhatsapp no banco esteja errado ou ausente, esta
// rota só processa eventos deste número específico.
const PHONE_NUMBER_ID_TACIANE = "1238399969356190";

// ─── Tipos do payload Meta Cloud API ─────────────────────────────────────────

type MetaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "document" | "sticker" | "reaction" | string;
  text?: { body: string };
};

type MetaContact = { profile: { name: string }; wa_id: string };

type MetaValue = {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: unknown[];
};

type MetaWebhookPayload = {
  object: string;
  entry: Array<{ id: string; changes: Array<{ value: MetaValue; field: string }> }>;
};

// ─── GET — verificação do webhook pela Meta ──────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  let verifyToken: string;
  try {
    verifyToken = await resolveWhatsappEnvVar("TACIANE_META_VERIFY_TOKEN", "verify_token");
  } catch (err) {
    console.error(
      "[taciane/webhook] Verify token não configurado/permitido:",
      err instanceof Error ? err.message : err,
    );
    return new Response("Forbidden", { status: 403 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.info("[taciane/webhook] Verificação do webhook Meta aprovada.");
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[taciane/webhook] Verificação do webhook Meta falhou. Token inválido.");
  return new Response("Forbidden", { status: 403 });
}

// ─── POST — recebimento de eventos ───────────────────────────────────────────

export async function POST(request: Request) {
  const rawBody = await request.text();

  let appSecret: string;
  try {
    appSecret = await resolveWhatsappEnvVar("META_APP_SECRET", "app_secret");
  } catch (err) {
    console.error(
      "[taciane/webhook] App Secret não configurado/permitido:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ ok: false, message: "Configuração inválida." }, { status: 500 });
  }

  const assinaturaValida = verificarAssinaturaMeta({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature-256"),
    appSecret,
  });

  if (!assinaturaValida) {
    console.warn("[taciane/webhook] Assinatura X-Hub-Signature-256 inválida — requisição rejeitada.");
    return NextResponse.json({ ok: false, message: "Assinatura inválida." }, { status: 401 });
  }

  let body: MetaWebhookPayload;
  try {
    body = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      await processarValor(change.value).catch((err) => {
        console.error("[taciane/webhook] Erro ao processar evento:", err);
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Processamento ────────────────────────────────────────────────────────────

async function processarValor(value: MetaValue) {
  const phoneNumberId = value?.metadata?.phone_number_id;

  // ─── Guarda obrigatória: só processa eventos do número da Taciane ───────────
  if (phoneNumberId !== PHONE_NUMBER_ID_TACIANE) {
    await auditLog({
      action: "WHATSAPP_TACIANE_PHONE_NUMBER_ID_DIVERGENTE",
      entity: "CanalWhatsapp",
      entityId: null,
      metadata: { phoneNumberIdRecebido: phoneNumberId ?? null },
    });
    console.warn("[taciane/webhook] Evento com phone_number_id divergente — ignorado.", { phoneNumberId });
    return;
  }

  const conversasV2Ligada = process.env.WHATSAPP_TACIANE_CONVERSAS_V2 === "true";
  if (!conversasV2Ligada) {
    console.info("[taciane/webhook] WHATSAPP_TACIANE_CONVERSAS_V2 desligada — evento recebido, nada persistido.");
    return;
  }

  const canal = await getCanalTaciane();
  if (!canal) {
    console.warn("[taciane/webhook] CanalWhatsapp 'taciane-villa' não encontrado — evento ignorado.");
    return;
  }

  if (!canal.ativo) {
    console.warn("[taciane/webhook] Canal 'taciane-villa' inativo — evento ignorado.");
    return;
  }

  for (const msg of value.messages ?? []) {
    await processarMensagem({ canal, msg, contacts: value.contacts ?? [] }).catch((err) => {
      console.error("[taciane/webhook] Erro ao persistir mensagem:", err);
    });
  }
}

async function processarMensagem({
  canal,
  msg,
  contacts,
}: {
  canal: CanalWhatsapp;
  msg: MetaMessage;
  contacts: MetaContact[];
}) {
  const externalMessageId = msg.id;
  if (!externalMessageId) {
    // Nunca inventamos um identificador — sem id real da Meta, a mensagem é
    // descartada em vez de gravada sem controle de idempotência.
    console.warn("[taciane/webhook] Mensagem sem id da Meta — descartada (nenhum identificador é inventado).");
    return;
  }

  const jaProcessada = await mensagemJaProcessada({ canal, externalMessageId });
  if (jaProcessada) {
    console.info("[taciane/webhook] Evento duplicado (reentrega da Meta) — ignorado.", { externalMessageId });
    return;
  }

  const telefone = msg.from;
  if (!telefone) return;

  const nomeContato = contacts.find((c) => c.wa_id === telefone)?.profile?.name?.trim() || "Cliente";
  const texto = msg.type === "text" ? (msg.text?.body?.trim() ?? "") : "";

  await persistirMensagemCliente({
    canal,
    telefone,
    nomeContato,
    externalMessageId,
    messageType: msg.type,
    texto,
    rawPayload: msg,
  });
}
