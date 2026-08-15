// ARQUIVO: app/api/mensagens/midia/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Envia mídia (imagem, documento, vídeo, áudio) via WhatsApp e salva no banco.
// Aceita multipart/form-data com: arquivo (File), conversaId (string), caption (string, opcional).
// Roteamento idêntico ao /api/mensagens/route.ts:
//   - META_CLOUD_API → enviarMidiaMeta (upload na Meta + send)
//   - EVOLUTION → base64 via /message/sendMedia/{instance}
//   - CHATWOOT_MIRROR → bloqueado (422)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { CanalWhatsappTipo } from "@/app/generated/prisma/client";
import { enviarMidiaMeta, CanalInvalidoError, EnvioMetaError } from "@/lib/whatsapp/meta-client";

function getEvolutionToken(instanceName: string): string {
  if (instanceName.startsWith("joao")) return process.env.JOAO_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  if (instanceName.startsWith("morgana")) return process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  if (instanceName.startsWith("taciane")) return process.env.TACIANE_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  return process.env.EVOLUTION_API_KEY ?? "";
}

function mimeParaTipo(mimeType: string): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Falha ao processar o arquivo." }, { status: 400 });
  }

  const conversaId = formData.get("conversaId") as string | null;
  const arquivo = formData.get("arquivo") as File | null;
  const caption = ((formData.get("caption") as string | null) ?? "").trim();

  if (!conversaId || !arquivo || arquivo.size === 0) {
    return NextResponse.json({ error: "conversaId e arquivo são obrigatórios." }, { status: 400 });
  }

  // Limite de 50 MB por segurança (WhatsApp aceita até 100 MB para documentos)
  const MAX_BYTES = 50 * 1024 * 1024;
  if (arquivo.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Limite: 50 MB." }, { status: 413 });
  }

  const conversa = await prisma.conversa.findUnique({
    where: { id: conversaId },
    include: { canalWhatsapp: true },
  });

  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  if (!conversa.telefone) return NextResponse.json({ error: "Conversa sem telefone de destino." }, { status: 400 });

  // ─── Bloqueia CHATWOOT_MIRROR ────────────────────────────────────────────────
  if (conversa.canalWhatsapp?.tipo === CanalWhatsappTipo.CHATWOOT_MIRROR) {
    return NextResponse.json(
      { error: "Envio bloqueado: conversa espelhada do Chatwoot, sem regra de envio definida." },
      { status: 422 },
    );
  }

  const mimeType = arquivo.type || "application/octet-stream";
  const nomeArquivo = arquivo.name || "arquivo";
  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const tipo = mimeParaTipo(mimeType);

  const canalEhMetaCloudApi = conversa.canalWhatsapp?.tipo === CanalWhatsappTipo.META_CLOUD_API;
  const canalEhHumano = conversa.canalWhatsapp?.agenteIA === null;

  // ─── Bloqueia humano META sem feature flag ───────────────────────────────────
  if (canalEhMetaCloudApi && canalEhHumano && process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2 !== "true") {
    return NextResponse.json(
      { error: "Envio pelo Workspace ainda não habilitado para este canal (feature desativada)." },
      { status: 422 },
    );
  }

  const usarMetaClient =
    canalEhMetaCloudApi &&
    (canalEhHumano ? process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2 === "true" : true);

  // ─── META CLOUD API ──────────────────────────────────────────────────────────
  if (usarMetaClient) {
    try {
      const mensagem = await enviarMidiaMeta({
        canalId: conversa.canalWhatsappId as string,
        conversaId,
        telefone: conversa.telefone,
        arquivo: buffer,
        mimeType,
        nomeArquivo,
        caption,
        autorUsuarioId: user.id,
      });

      await prisma.conversa.update({
        where: { id: conversaId },
        data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
      });

      return NextResponse.json(mensagem);
    } catch (err) {
      const message =
        err instanceof CanalInvalidoError || err instanceof EnvioMetaError
          ? err.message
          : "Erro ao enviar mídia via Meta Cloud API.";
      console.error("[api/mensagens/midia] Meta error:", err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // ─── EVOLUTION API (Morgana e legado) ───────────────────────────────────────
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const token = getEvolutionToken(conversa.instanceName);
  const base64 = buffer.toString("base64");

  let waMessageId: string | undefined;
  try {
    const resp = await fetch(`${apiUrl}/message/sendMedia/${conversa.instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: token },
      body: JSON.stringify({
        number: conversa.telefone,
        mediatype: tipo,
        media: `data:${mimeType};base64,${base64}`,
        ...(caption ? { caption } : {}),
        ...(tipo === "document" ? { fileName: nomeArquivo } : {}),
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      waMessageId = data?.key?.id;
    } else {
      console.error("[api/mensagens/midia] Evolution respondeu:", resp.status, await resp.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[api/mensagens/midia] Erro Evolution:", err);
  }

  const conteudoRegistro = caption || `[${tipo}: ${nomeArquivo}]`;
  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId,
      conteudo: conteudoRegistro,
      direcao: "SAIDA",
      autor: "HUMANO",
      autorUsuarioId: user.id,
      waMessageId,
      status: waMessageId ? "ENVIADA" : "ERRO",
      canalWhatsappId: conversa.canalWhatsappId,
      externalMessageId: waMessageId,
      messageType: tipo,
    },
  });

  await prisma.conversa.update({
    where: { id: conversaId },
    data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
  });

  return NextResponse.json(mensagem);
}
