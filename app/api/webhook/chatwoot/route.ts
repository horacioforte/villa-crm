// ARQUIVO: app/api/webhook/chatwoot/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Recebe eventos do Chatwoot e persiste no banco Villa CRM.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

console.log("[webhook/chatwoot] prisma defined:", !!prisma);
console.log("[webhook/chatwoot] prisma keys:", Object.keys(prisma as any).slice(0,20));

// Chatwoot envia um token no header "X-Chatwoot-Hmac-Sha256" (opcional).
// Por ora validamos apenas via token fixo no env.
function verificarToken(req: NextRequest): boolean {
  const token = process.env.CHATWOOT_WEBHOOK_TOKEN;
  if (!token) return true; // sem configuração, aceita tudo (modo dev)
  return req.headers.get("x-chatwoot-hmac-sha256") === token;
}

export async function POST(req: NextRequest) {
  if (!verificarToken(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const evento = body.event as string | undefined;

  try {
    // ── Mensagem nova recebida ou enviada ──────────────────────────────────
    if (evento === "message_created") {
      await handleMensagem(body);
    }

    // ── Conversa atualizada (status, atendente etc.) ───────────────────────
    if (evento === "conversation_updated" || evento === "conversation_created") {
      await handleConversa(body);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/chatwoot] Erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// ─── Handlers ──────────────────────────────────────────────────────────────

async function handleMensagem(body: Record<string, unknown>) {
  const conversation = body.conversation as Record<string, unknown> | undefined;
  const message = (body.message ?? body) as Record<string, unknown>; // aceita payloads com ou sem wrapper `message`

  const chatwootConversaId = conversation?.id as number | undefined;
  const inboxName = (conversation?.meta as Record<string, unknown> | undefined)
    ?.channel as string | undefined;

  if (!chatwootConversaId) return;

  // Descobre o instanceName pelo nome da inbox (ex: "maria-villa")
  const instanceName = resolverInstance(inboxName ?? "");

  // Garante que a conversa existe no banco
  const conversa = await upsertConversa(chatwootConversaId, instanceName, body);

  if (!conversa) return;

  // Evita duplicatas pelo ID do WhatsApp
  const waMessageId = message.id ? String(message.id) : undefined;
  if (waMessageId) {
    const existe = await prisma.mensagem.findFirst({
      where: { waMessageId },
    });
    if (existe) return;
  }

  const conteudo =
    (message.content as string) ||
    ((message.attachments as unknown[])?.length ? "[anexo]" : "");

  if (!conteudo) return;

  const messageType = message.message_type as string | undefined; // "incoming" | "outgoing"
  const direcao = messageType === "outgoing" ? "SAIDA" : "ENTRADA";
  const autorTipo =
    messageType === "outgoing" &&
    (message.sender as Record<string, unknown>)?.type === "agent_bot"
      ? "IA"
      : messageType === "outgoing"
      ? "HUMANO"
      : "IA"; // mensagens de entrada são processadas pela IA

  await prisma.mensagem.create({
    data: {
      conversaId: conversa.id,
      conteudo: conteudo as string,
      direcao: direcao as "ENTRADA" | "SAIDA",
      autor: autorTipo as "IA" | "HUMANO" | "SISTEMA",
      waMessageId: waMessageId,
    },
  });

  // Atualiza ultimaMensagemEm na conversa
  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date() },
  });
}

async function handleConversa(body: Record<string, unknown>) {
  const conversation = (body.conversation ??
    body) as Record<string, unknown>;
  const chatwootId = conversation.id as number | undefined;
  if (!chatwootId) return;

  const inboxName = (conversation.meta as Record<string, unknown> | undefined)
    ?.channel as string | undefined;
  const instanceName = resolverInstance(inboxName ?? "");

  await upsertConversa(chatwootId, instanceName, body);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function upsertConversa(
  chatwootId: number,
  instanceName: string,
  body: Record<string, unknown>
) {
  const conversation = (body.conversation ??
    body) as Record<string, unknown>;

  const statusChatwoot = conversation.status as string | undefined;
  const status = mapStatus(statusChatwoot);

  const meta = conversation.meta as Record<string, unknown> | undefined;
  const sender = meta?.sender as Record<string, unknown> | undefined;
  const telefone = sender?.phone_number as string | undefined;
  const nomeContato = sender?.name as string | undefined;

  const existing = await prisma.conversa.findFirst({
    where: { chatwootId },
  });

  if (existing) {
    return prisma.conversa.update({
      where: { id: existing.id },
      data: { status, nomeContato: nomeContato ?? existing.nomeContato },
    });
  }

  return prisma.conversa.create({
    data: {
      chatwootId,
      instanceName,
      status,
      telefone,
      nomeContato,
    },
  });
}

function mapStatus(s: string | undefined): "ABERTA" | "PENDENTE" | "CONCLUIDA" | "SPAM" {
  if (s === "resolved") return "CONCLUIDA";
  if (s === "pending") return "PENDENTE";
  if (s === "snoozed") return "PENDENTE";
  return "ABERTA";
}

function resolverInstance(inboxName: string): string {
  // Chatwoot salva o nome da inbox; tentamos mapear para o instanceName da Evolution
  if (inboxName.toLowerCase().includes("joao")) return "joao-villa";
  if (inboxName.toLowerCase().includes("morgana")) return "morgana-villa";
  if (inboxName.toLowerCase().includes("taciane")) return "taciane-villa";
  return "maria-villa"; // padrão
}
