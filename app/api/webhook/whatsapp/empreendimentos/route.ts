// ARQUIVO: app/api/webhook/whatsapp/empreendimentos/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Webhook dedicado do número institucional "Villa Empreendimentos" (Meta Cloud API,
// atendimento HUMANO). Esta rota NUNCA importa nem chama nenhuma função de IA
// (analisarMensagem, handlers de Maria/João, agentes/joao, ou qualquer outro agente).
// Só espelha em Conversa/Mensagem o que o cliente realmente mandou — nenhuma resposta
// automática é gerada aqui.
//
// REGRA CRÍTICA: só processa eventos cujo metadata.phone_number_id seja exatamente o
// phoneNumberId do CanalWhatsapp 'empreendimentos-villa' cadastrado no banco. Qualquer
// outro valor é ignorado com auditoria sanitizada — nunca cai para outro canal/agente,
// nunca fallback para Maria, João, Taciane ou Morgana. Esta rota é fisicamente isolada
// delas. Diferente da rota da Taciane (que tem o phone_number_id fixo no código), aqui
// o número vem do banco: enquanto o canal não for cadastrado (ou estiver inativo), a
// rota responde 200 para a Meta mas não persiste nada — inerte por padrão.
//
// Ordem segura de validação do POST (mesma ordem do roteador unificado — ver
// lib/whatsapp/meta-router-v2.ts, que documenta o porquê):
//   rawBody → valida assinatura X-Hub-Signature-256 (META_APP_SECRET) → só então
//   JSON.parse → só então extrai phone_number_id e decide o que fazer.

import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { resolveWhatsappEnvVar } from "@/lib/whatsapp/env-allowlist";
import { verificarAssinaturaMeta } from "@/lib/whatsapp/verify-signature";
import { getCanalEmpreendimentos, mensagemJaProcessada, persistirMensagemCliente, processarStatusRecebido, type MetaStatus } from "@/lib/whatsapp/agentes/empreendimentos";
import { buscarMidiaMeta } from "@/lib/whatsapp/meta-client";
import type { CanalWhatsapp } from "@/app/generated/prisma/client";

export const maxDuration = 30;

// ─── Tipos do payload Meta Cloud API ─────────────────────────────────────────

type MetaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "document" | "sticker" | "reaction" | string;
  text?: { body: string };
  // ACRESCENTADO — mídia recebida. Formato oficial da Meta Cloud API: cada tipo traz
  // um objeto com `id` (usado para buscar o conteúdo real via Graph API) e `mime_type`.
  image?: { id: string; mime_type?: string; caption?: string };
  video?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  document?: { id: string; mime_type?: string; caption?: string; filename?: string };
};

type MetaContact = { profile: { name: string }; wa_id: string };

type MetaValue = {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  // ACRESCENTADO — recibos de entrega/leitura/falha das mensagens que enviamos
  // (ver processarStatusRecebido em lib/whatsapp/agentes/empreendimentos.ts).
  statuses?: MetaStatus[];
};

type MetaWebhookPayload = {
  object: string;
  entry: Array<{ id: string; changes: Array<{ value: MetaValue; field: string }> }>;
};

// ACRESCENTADO — identifica mídia recebida (imagem/áudio/vídeo/documento), retornando
// o media id (usado para buscar o conteúdo via buscarMidiaMeta) e o mimetype declarado.
function getMediaMeta(msg: MetaMessage): { mediaId: string; mimetype?: string } | null {
  if (msg.image) return { mediaId: msg.image.id, mimetype: msg.image.mime_type };
  if (msg.video) return { mediaId: msg.video.id, mimetype: msg.video.mime_type };
  if (msg.audio) return { mediaId: msg.audio.id, mimetype: msg.audio.mime_type };
  if (msg.document) return { mediaId: msg.document.id, mimetype: msg.document.mime_type };
  return null;
}

// ─── GET — verificação do webhook pela Meta ──────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  let verifyToken: string;
  try {
    verifyToken = await resolveWhatsappEnvVar("EMPREENDIMENTOS_META_VERIFY_TOKEN", "verify_token");
  } catch (err) {
    console.error(
      "[empreendimentos/webhook] Verify token não configurado/permitido:",
      err instanceof Error ? err.message : err,
    );
    return new Response("Forbidden", { status: 403 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.info("[empreendimentos/webhook] Verificação do webhook Meta aprovada.");
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[empreendimentos/webhook] Verificação do webhook Meta falhou. Token inválido.");
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
      "[empreendimentos/webhook] App Secret não configurado/permitido:",
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
    console.warn("[empreendimentos/webhook] Assinatura X-Hub-Signature-256 inválida — requisição rejeitada.");
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
        console.error("[empreendimentos/webhook] Erro ao processar evento:", err);
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Processamento ────────────────────────────────────────────────────────────

async function processarValor(value: MetaValue) {
  const phoneNumberId = value?.metadata?.phone_number_id;

  // ─── Guarda obrigatória: só processa eventos do número deste canal ──────────
  // O phoneNumberId esperado vem do CanalWhatsapp cadastrado no banco — nunca de
  // comparação com env var, nunca aceito do payload sem conferir.
  const canal = await getCanalEmpreendimentos();
  if (!canal) {
    console.warn("[empreendimentos/webhook] CanalWhatsapp 'empreendimentos-villa' não encontrado — evento ignorado.");
    return;
  }

  if (!canal.ativo) {
    console.warn("[empreendimentos/webhook] Canal 'empreendimentos-villa' inativo — evento ignorado.");
    return;
  }

  if (!phoneNumberId || !canal.phoneNumberId || phoneNumberId !== canal.phoneNumberId) {
    await auditLog({
      action: "WHATSAPP_EMPREENDIMENTOS_PHONE_NUMBER_ID_DIVERGENTE",
      entity: "CanalWhatsapp",
      entityId: canal.id,
      metadata: { phoneNumberIdRecebido: phoneNumberId ?? null },
    });
    console.warn("[empreendimentos/webhook] Evento com phone_number_id divergente — ignorado.", { phoneNumberId });
    return;
  }

  for (const msg of value.messages ?? []) {
    await processarMensagem({ canal, msg, contacts: value.contacts ?? [] }).catch((err) => {
      console.error("[empreendimentos/webhook] Erro ao persistir mensagem:", err);
    });
  }

  // ACRESCENTADO — sem isso, uma mensagem aceita pela Meta na hora do envio mas
  // rejeitada depois (ex.: cliente sem opt-in, número inválido) ficava para sempre
  // com status ENVIADA no CRM, sem nenhum jeito de saber que não chegou de verdade.
  for (const status of value.statuses ?? []) {
    await processarStatusRecebido(status).catch((err) => {
      console.error("[empreendimentos/webhook] Erro ao processar status recebido:", err);
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
    console.warn("[empreendimentos/webhook] Mensagem sem id da Meta — descartada (nenhum identificador é inventado).");
    return;
  }

  const jaProcessada = await mensagemJaProcessada({ canal, externalMessageId });
  if (jaProcessada) {
    console.info("[empreendimentos/webhook] Evento duplicado (reentrega da Meta) — ignorado.", { externalMessageId });
    return;
  }

  const telefone = msg.from;
  if (!telefone) return;

  const nomeContato = contacts.find((c) => c.wa_id === telefone)?.profile?.name?.trim() || "Cliente";
  const texto =
    msg.type === "text"
      ? (msg.text?.body?.trim() ?? "")
      : (msg.image?.caption ?? msg.video?.caption ?? msg.document?.caption ?? "").trim();

  // ACRESCENTADO — busca best-effort do arquivo real quando a mensagem é de mídia.
  // Nunca bloqueia o processamento: se falhar (token, rede, arquivo grande), a
  // mensagem é salva normalmente do jeito que já era antes, só sem mídia anexada.
  const mediaMeta = getMediaMeta(msg);
  let mediaResolvida: { mediaUrl: string; mimeType?: string } | null = null;
  if (mediaMeta) {
    try {
      const accessToken = await resolveWhatsappEnvVar(canal.accessTokenEnvVar as string, "access_token", {
        canalId: canal.id,
      });
      mediaResolvida = await buscarMidiaMeta({ mediaId: mediaMeta.mediaId, accessToken });
    } catch (err) {
      console.warn("[empreendimentos/webhook] Não foi possível resolver token para buscar mídia:", err);
    }
  }

  await persistirMensagemCliente({
    canal,
    telefone,
    nomeContato,
    externalMessageId,
    messageType: msg.type,
    texto,
    rawPayload: msg,
    mediaUrl: mediaResolvida?.mediaUrl,
    mimeType: mediaResolvida?.mimeType ?? mediaMeta?.mimetype,
  });
}
