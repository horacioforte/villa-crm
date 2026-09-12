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
  // ACRESCENTADO — tipos de mídia. Antes só texto era reconhecido; qualquer mídia
  // (imagem/áudio/vídeo/documento) virava um rótulo genérico sem conteúdo nenhum
  // salvo (ver getMediaMeta abaixo e buscarMidiaBase64).
  imageMessage?: { mimetype?: string; caption?: string; fileLength?: { low?: number } | number | string };
  videoMessage?: { mimetype?: string; caption?: string; fileLength?: { low?: number } | number | string };
  audioMessage?: { mimetype?: string; fileLength?: { low?: number } | number | string };
  documentMessage?: {
    mimetype?: string;
    caption?: string;
    fileName?: string;
    title?: string;
    fileLength?: { low?: number } | number | string;
  };
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
  const m = msg?.message;
  return (
    m?.conversation ??
    m?.extendedTextMessage?.text ??
    // ACRESCENTADO — legenda de imagem/vídeo/documento, quando houver.
    m?.imageMessage?.caption ??
    m?.videoMessage?.caption ??
    m?.documentMessage?.caption ??
    ""
  ).trim();
}

function getWhatsappNumber(msg: EvolutionMessage | undefined): string | null {
  const remoteJid = msg?.key?.remoteJid;
  if (!remoteJid || remoteJid.endsWith("@g.us")) return null;
  const [number] = remoteJid.split("@");
  const digits = number?.replace(/\D/g, "");
  return digits || null;
}

// ─── ACRESCENTADO — resolução de mídia recebida ──────────────────────────────
// Antes, qualquer mídia (imagem/áudio/vídeo/documento) só virava um rótulo genérico
// (ex.: "[documentMessage]") sem o arquivo em si ser salvo — o link que a Evolution
// devolve no payload (msg.message.<tipo>.url) é um link criptografado do WhatsApp, não
// dá pra abrir direto num <img>/<a>. A Evolution API tem um endpoint próprio que já
// descriptografa e devolve o conteúdo em base64, usando o mesmo key.id do evento —
// buscarMidiaBase64 chama esse endpoint. Tudo aqui é best-effort e aditivo: se falhar
// por qualquer motivo (rede, token, arquivo grande, endpoint indisponível), a mensagem
// continua sendo salva normalmente do jeito que já era antes, só sem mídia anexada.

const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // limite de segurança — arquivo maior não é embutido

function getFileLengthBytes(fileLength: { low?: number } | number | string | undefined): number | null {
  if (fileLength == null) return null;
  if (typeof fileLength === "number") return fileLength;
  if (typeof fileLength === "string") return Number(fileLength) || null;
  if (typeof fileLength === "object" && typeof fileLength.low === "number") return fileLength.low;
  return null;
}

function getMediaMeta(msg: EvolutionMessage | undefined): { mimetype?: string; fileLength: number | null } | null {
  const m = msg?.message;
  if (!m) return null;
  if (m.documentMessage) return { mimetype: m.documentMessage.mimetype, fileLength: getFileLengthBytes(m.documentMessage.fileLength) };
  if (m.imageMessage) return { mimetype: m.imageMessage.mimetype, fileLength: getFileLengthBytes(m.imageMessage.fileLength) };
  if (m.videoMessage) return { mimetype: m.videoMessage.mimetype, fileLength: getFileLengthBytes(m.videoMessage.fileLength) };
  if (m.audioMessage) return { mimetype: m.audioMessage.mimetype, fileLength: getFileLengthBytes(m.audioMessage.fileLength) };
  return null;
}

async function buscarMidiaBase64(externalMessageId: string): Promise<{ mediaUrl: string; mimeType?: string } | null> {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const token = process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  if (!apiUrl || !token) return null;

  try {
    const resp = await fetch(`${apiUrl}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: token },
      body: JSON.stringify({ message: { key: { id: externalMessageId } }, convertToMp4: false }),
    });

    if (!resp.ok) {
      console.warn("[morgana/webhook] Falha ao buscar mídia na Evolution:", resp.status, await resp.text().catch(() => ""));
      return null;
    }

    const data = await resp.json();
    const base64: string | undefined = data?.base64 ?? data?.media;
    const mimetype: string | undefined = data?.mimetype;
    if (!base64) return null;

    const bytesAproximados = Math.floor((base64.length * 3) / 4);
    if (bytesAproximados > MAX_MEDIA_BYTES) {
      console.warn("[morgana/webhook] Mídia maior que o limite de segurança — não embutida.", { externalMessageId, bytesAproximados });
      return null;
    }

    return { mediaUrl: `data:${mimetype ?? "application/octet-stream"};base64,${base64}`, mimeType: mimetype };
  } catch (err) {
    console.warn("[morgana/webhook] Erro ao buscar mídia na Evolution:", err);
    return null;
  }
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

  // ACRESCENTADO — busca best-effort do arquivo real quando a mensagem é de mídia.
  // Nunca bloqueia nem derruba o processamento do evento: se falhar, mediaResolvida
  // fica null e a mensagem é salva exatamente como já era antes desta mudança.
  const mediaMeta = getMediaMeta(msg);
  const mediaResolvida = mediaMeta ? await buscarMidiaBase64(externalMessageId) : null;

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
        mediaUrl: mediaResolvida?.mediaUrl,
        mimeType: mediaResolvida?.mimeType ?? mediaMeta?.mimetype,
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
        mediaUrl: mediaResolvida?.mediaUrl,
        mimeType: mediaResolvida?.mimeType ?? mediaMeta?.mimetype,
      });
    }
  } catch (err) {
    console.error("[morgana/webhook] Erro ao persistir evento:", err);
  }

  return NextResponse.json({ ok: true });
}
