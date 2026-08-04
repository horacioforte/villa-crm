// ARQUIVO: lib/whatsapp/meta-client.ts
// Fase 2 — Central de Atendimento WhatsApp.
//
// Único ponto de comunicação com a WhatsApp Cloud API da Meta (graph.facebook.com).
// Nenhuma outra rota ou serviço novo deve chamar graph.facebook.com diretamente —
// os fluxos legados de Maria (lib/agentes/maria/crm.ts) e João V1
// (lib/agentes/joao/crm.ts, enviarWhatsappJoao) continuam com suas próprias chamadas
// diretas por enquanto (regra do projeto: nunca remover, só acrescentar); a migração
// deles para este serviço é trabalho futuro, fora desta etapa.
//
// Regras de desenho (Fase 2, Etapa 3):
// - Recebe canalId, nunca token/segredo diretamente. Resolve credenciais só aqui,
//   só no servidor, só via lib/whatsapp/env-allowlist.
// - Mensagem.canalWhatsappId é sempre derivado do Conversa.canalWhatsappId já
//   persistido — nunca aceito como valor confiável vindo do chamador.
// - Sem fallback para outro provedor: se o canal não é META_CLOUD_API, ou está
//   inativo, a função falha — não tenta Evolution nem Chatwoot.

import { prisma } from "@/lib/prisma";
import {
  AutorMensagem,
  CanalWhatsappTipo,
  Prisma,
  StatusMensagem,
} from "@/app/generated/prisma/client";
import { resolveWhatsappEnvVar } from "./env-allowlist";

const GRAPH_API_VERSION = "v20.0";
const TIMEOUT_MS = 10_000;

export class CanalInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanalInvalidoError";
  }
}

export class EnvioMetaError extends Error {
  readonly errorCode: string;
  constructor(message: string, errorCode: string) {
    super(message);
    this.name = "EnvioMetaError";
    this.errorCode = errorCode;
  }
}

type CanalAtivoMeta = Awaited<ReturnType<typeof buscarCanalAtivoMeta>>;

async function buscarCanalAtivoMeta(canalId: string) {
  const canal = await prisma.canalWhatsapp.findUnique({ where: { id: canalId } });

  if (!canal) throw new CanalInvalidoError("Canal não encontrado.");
  if (!canal.ativo) throw new CanalInvalidoError("Canal está desativado.");
  if (canal.tipo !== CanalWhatsappTipo.META_CLOUD_API) {
    throw new CanalInvalidoError("Canal não é do tipo META_CLOUD_API.");
  }
  if (!canal.phoneNumberId) {
    throw new CanalInvalidoError("Canal sem phoneNumberId configurado.");
  }
  if (!canal.accessTokenEnvVar) {
    throw new CanalInvalidoError("Canal sem accessTokenEnvVar configurado.");
  }

  return canal;
}

function sanitizarTelefone(telefone: string): string {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 10) {
    throw new CanalInvalidoError("Telefone de destino inválido.");
  }
  return digits;
}

/**
 * Garante a invariante obrigatória: toda Mensagem pertence ao mesmo canal da sua
 * Conversa. Não aceita canalId "confiado" do chamador — sempre relê o canal real da
 * conversa no banco e rejeita qualquer divergência.
 */
async function criarOuReaproveitarMensagemPendente({
  conversaId,
  canal,
  conteudo,
  messageType,
  autorUsuarioId,
  replyToMensagemId,
  retryMensagemId,
}: {
  conversaId: string;
  canal: CanalAtivoMeta;
  conteudo: string;
  messageType: string;
  autorUsuarioId?: string | null;
  replyToMensagemId?: string | null;
  retryMensagemId?: string;
}) {
  const conversa = await prisma.conversa.findUnique({
    where: { id: conversaId },
    select: { id: true, canalWhatsappId: true },
  });

  if (!conversa) throw new CanalInvalidoError("Conversa não encontrada.");
  if (conversa.canalWhatsappId !== canal.id) {
    throw new CanalInvalidoError(
      "canalId informado diverge do canalWhatsappId já registrado na conversa.",
    );
  }

  if (retryMensagemId) {
    const existente = await prisma.mensagem.findUnique({ where: { id: retryMensagemId } });
    if (!existente) throw new CanalInvalidoError("Mensagem de retry não encontrada.");
    if (existente.conversaId !== conversaId || existente.canalWhatsappId !== canal.id) {
      throw new CanalInvalidoError("Mensagem de retry não pertence a esta conversa/canal.");
    }
    if (existente.status === StatusMensagem.ENVIADA || existente.status === StatusMensagem.ENTREGUE || existente.status === StatusMensagem.LIDA) {
      throw new CanalInvalidoError("Mensagem de retry já foi enviada com sucesso — reenvio bloqueado.");
    }

    // Reaproveita a mesma linha em vez de criar uma nova — evita duplicidade em
    // tentativas repetidas (ex.: usuário clicou "reenviar" duas vezes).
    return prisma.mensagem.update({
      where: { id: retryMensagemId },
      data: { status: StatusMensagem.PENDENTE, errorCode: null, errorMessage: null },
    });
  }

  return prisma.mensagem.create({
    data: {
      conversaId,
      conteudo,
      direcao: "SAIDA",
      autor: autorUsuarioId ? AutorMensagem.HUMANO : AutorMensagem.IA,
      status: StatusMensagem.PENDENTE,
      canalWhatsappId: canal.id,
      messageType,
      autorUsuarioId: autorUsuarioId ?? undefined,
      replyToMensagemId: replyToMensagemId ?? undefined,
    },
  });
}

function classificarErroGraphApi(status: number, corpo: unknown): { code: string; message: string } {
  const erro = (corpo as { error?: { code?: number | string; message?: string } } | null)?.error;
  return {
    code: erro?.code !== undefined ? String(erro.code) : String(status),
    // A mensagem de erro da própria Meta nunca contém nosso access token — é seguro
    // persistir/logar. Não incluímos aqui nenhum header ou corpo bruto da requisição.
    message: erro?.message ?? "Erro desconhecido da Meta API.",
  };
}

async function chamarGraphApi(canal: CanalAtivoMeta, payload: Record<string, unknown>) {
  const accessToken = await resolveWhatsappEnvVar(canal.accessTokenEnvVar as string, "access_token", {
    canalId: canal.id,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${canal.phoneNumberId}/messages`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const corpo = await response.json().catch(() => null);

    if (!response.ok) {
      const { code, message } = classificarErroGraphApi(response.status, corpo);
      throw new EnvioMetaError(message, code);
    }

    const externalMessageId = (corpo as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id;
    return { externalMessageId };
  } catch (err) {
    if (err instanceof EnvioMetaError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new EnvioMetaError("Timeout ao chamar a Meta Cloud API.", "TIMEOUT");
    }
    throw new EnvioMetaError(err instanceof Error ? err.message : "Erro desconhecido.", "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

async function marcarComoEnviada(mensagemId: string, externalMessageId: string | undefined) {
  try {
    return await prisma.mensagem.update({
      where: { id: mensagemId },
      data: { status: StatusMensagem.ENVIADA, externalMessageId: externalMessageId ?? undefined },
    });
  } catch (err) {
    // Corrida rara: externalMessageId já usado nesse canal (ex.: retry duplicado
    // processado duas vezes em paralelo). A constraint composta do banco garante que
    // não há duplicidade real — tratamos como já enviada.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.mensagem.findUniqueOrThrow({ where: { id: mensagemId } });
    }
    throw err;
  }
}

async function marcarComoErro(mensagemId: string, err: unknown) {
  const { code, message } =
    err instanceof EnvioMetaError
      ? { code: err.errorCode, message: err.message }
      : { code: "UNKNOWN", message: err instanceof Error ? err.message : "Erro desconhecido." };

  await prisma.mensagem.update({
    where: { id: mensagemId },
    data: { status: StatusMensagem.ERRO, errorCode: code, errorMessage: message },
  });
}

// ─── API pública ────────────────────────────────────────────────────────────

export type EnviarTextoInput = {
  canalId: string;
  conversaId: string;
  telefone: string;
  texto: string;
  autorUsuarioId?: string | null;
  /** externalMessageId da mensagem original, para responder "em contexto" na Meta. */
  replyToExternalMessageId?: string | null;
  replyToMensagemId?: string | null;
  /** Reenvio seguro de uma tentativa anterior (PENDENTE/ERRO) — evita linha duplicada. */
  retryMensagemId?: string;
};

export async function enviarTextoMeta({
  canalId,
  conversaId,
  telefone,
  texto,
  autorUsuarioId,
  replyToExternalMessageId,
  replyToMensagemId,
  retryMensagemId,
}: EnviarTextoInput) {
  const canal = await buscarCanalAtivoMeta(canalId);
  const numero = sanitizarTelefone(telefone);

  const mensagem = await criarOuReaproveitarMensagemPendente({
    conversaId,
    canal,
    conteudo: texto,
    messageType: "text",
    autorUsuarioId,
    replyToMensagemId,
    retryMensagemId,
  });

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: numero,
    type: "text",
    text: { body: texto },
  };
  if (replyToExternalMessageId) {
    payload.context = { message_id: replyToExternalMessageId };
  }

  try {
    const { externalMessageId } = await chamarGraphApi(canal, payload);
    return await marcarComoEnviada(mensagem.id, externalMessageId);
  } catch (err) {
    await marcarComoErro(mensagem.id, err);
    throw err;
  }
}

export type EnviarTemplateInput = {
  canalId: string;
  conversaId: string;
  telefone: string;
  templateName: string;
  idiomaCode: string;
  parametros?: string[];
  autorUsuarioId?: string | null;
  retryMensagemId?: string;
};

export async function enviarTemplateMeta({
  canalId,
  conversaId,
  telefone,
  templateName,
  idiomaCode,
  parametros = [],
  autorUsuarioId,
  retryMensagemId,
}: EnviarTemplateInput) {
  const canal = await buscarCanalAtivoMeta(canalId);
  const numero = sanitizarTelefone(telefone);

  const conteudoRegistro = `[template:${templateName}] ${parametros.join(", ")}`.trim();

  const mensagem = await criarOuReaproveitarMensagemPendente({
    conversaId,
    canal,
    conteudo: conteudoRegistro,
    messageType: "template",
    autorUsuarioId,
    retryMensagemId,
  });

  const payload = {
    messaging_product: "whatsapp",
    to: numero,
    type: "template",
    template: {
      name: templateName,
      language: { code: idiomaCode },
      ...(parametros.length
        ? { components: [{ type: "body", parameters: parametros.map((texto) => ({ type: "text", text: texto })) }] }
        : {}),
    },
  };

  try {
    const { externalMessageId } = await chamarGraphApi(canal, payload);
    return await marcarComoEnviada(mensagem.id, externalMessageId);
  } catch (err) {
    await marcarComoErro(mensagem.id, err);
    throw err;
  }
}
