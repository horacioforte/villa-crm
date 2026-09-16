// ARQUIVO: lib/whatsapp/agentes/taciane.ts
// Fase 2 — Central de Atendimento WhatsApp. Camada de persistência Conversa/Mensagem
// para a Taciane (Meta Cloud API).
//
// Taciane é uma atendente HUMANA — este módulo NUNCA importa nem chama nenhuma função
// de IA (analisarMensagem, handlers de Maria/João, ou qualquer outro agente). Não
// existe, propositalmente, nenhum caminho de código aqui que gere uma resposta
// automática. Isso é uma garantia arquitetural, verificada por teste
// (taciane.test.ts): o arquivo não referencia nada de lib/agentes/*.
//
// Diferente da Morgana (Evolution API / Baileys), a Meta Cloud API não ecoa de volta
// no webhook as mensagens que nós mesmos enviamos (não existe conceito de "fromMe").
// Envios feitos pela Central (Workspace → /api/mensagens → lib/whatsapp/meta-client.ts)
// já persistem a Mensagem SAIDA/HUMANO diretamente no momento do envio — este módulo
// só precisa lidar com mensagens de cliente (inbound real).
//
// Idempotência: dedupe por (canalWhatsappId, externalMessageId), mesmo padrão de
// lib/whatsapp/agentes/joao.ts e lib/whatsapp/agentes/morgana.ts. Nenhum identificador
// é inventado — mensagem sem id real da Meta é descartada, não gravada sem controle.

import { prisma } from "@/lib/prisma";
import {
  AutorMensagem,
  DirecaoMensagem,
  Prisma,
  StatusMensagem,
  type CanalWhatsapp,
} from "@/app/generated/prisma/client";
import { statusAposNovaMensagemCliente } from "@/lib/conversas/reabertura";
import { variantesTelefoneBR } from "@/lib/whatsapp/telefone";

const INSTANCE_NAME = "taciane-villa";

export async function getCanalTaciane(): Promise<CanalWhatsapp | null> {
  return prisma.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });
}

/**
 * Checa se um evento (mensagem de cliente da Meta) já foi persistido. Usada antes de
 * qualquer gravação para impedir reprocessamento em caso de reentrega do mesmo evento.
 */
export async function mensagemJaProcessada({
  canal,
  externalMessageId,
}: {
  canal: CanalWhatsapp;
  externalMessageId: string;
}): Promise<boolean> {
  const existente = await prisma.mensagem.findFirst({
    where: { canalWhatsappId: canal.id, externalMessageId },
    select: { id: true },
  });
  return Boolean(existente);
}

async function encontrarOuCriarConversa({
  canal,
  telefone,
  nomeContato,
}: {
  canal: CanalWhatsapp;
  telefone: string;
  nomeContato: string;
}) {
  const existente = await prisma.conversa.findFirst({
    where: { telefone: { in: variantesTelefoneBR(telefone) }, instanceName: INSTANCE_NAME },
    orderBy: { updatedAt: "desc" },
  });

  if (existente) {
    if (existente.canalWhatsappId && existente.canalWhatsappId !== canal.id) {
      throw new Error(
        `Conversa ${existente.id} já está vinculada ao canal ${existente.canalWhatsappId}, divergente do canal ${canal.id} resolvido para este evento.`,
      );
    }
    const precisaVincularCanal = !existente.canalWhatsappId;
    // ACRESCENTADO — conversa nasceu sem nome (ex.: criada pelo CRM antes do
    // cliente responder, via "Nova conversa") ou só tinha o placeholder genérico
    // "Cliente". Ao chegar uma mensagem real do cliente com o nome de perfil de
    // verdade, atualiza. Nunca sobrescreve um nome que já não seja esse
    // placeholder — ex.: nome digitado manualmente por um humano no CRM.
    const nomeAtualGenerico = !existente.nomeContato || existente.nomeContato === "Cliente";
    const nomeNovoMelhor = nomeAtualGenerico && Boolean(nomeContato) && nomeContato !== existente.nomeContato;

    if (precisaVincularCanal || nomeNovoMelhor) {
      return prisma.conversa.update({
        where: { id: existente.id },
        data: {
          ...(precisaVincularCanal ? { canalWhatsappId: canal.id } : {}),
          ...(nomeNovoMelhor ? { nomeContato } : {}),
        },
      });
    }
    return existente;
  }

  return prisma.conversa.create({
    data: { instanceName: INSTANCE_NAME, telefone, nomeContato, canalWhatsappId: canal.id },
  });
}

// ─── Mensagem de cliente (inbound real) ────────────────────────────────────────

export async function persistirMensagemCliente({
  canal,
  telefone,
  nomeContato,
  externalMessageId,
  messageType,
  texto,
  rawPayload,
  mediaUrl,
  mimeType,
}: {
  canal: CanalWhatsapp;
  telefone: string;
  nomeContato: string;
  externalMessageId: string;
  messageType: string;
  texto: string;
  rawPayload: unknown;
  // ACRESCENTADO — mídia recebida (imagem/áudio/vídeo/documento) já resolvida pelo
  // webhook via Meta Graph API, ou ausente quando não foi possível obter. Opcionais e
  // aditivos: nunca quebram o fluxo de texto puro existente.
  mediaUrl?: string | null;
  mimeType?: string | null;
}) {
  const conversa = await encontrarOuCriarConversa({ canal, telefone, nomeContato });

  try {
    await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        conteudo: texto || `[${messageType}]`,
        direcao: DirecaoMensagem.ENTRADA,
        autor: AutorMensagem.CLIENTE,
        status: StatusMensagem.RECEBIDA,
        canalWhatsappId: canal.id,
        externalMessageId,
        messageType,
        rawPayload: rawPayload as Prisma.InputJsonValue,
        receivedAt: new Date(),
        mediaUrl: mediaUrl ?? undefined,
        mimeType: mimeType ?? undefined,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Corrida: a checagem de mensagemJaProcessada() e este insert não são atômicos
      // entre si — duas entregas concorrentes do mesmo evento podem passar pela
      // checagem antes de qualquer uma inserir. A constraint composta
      // (canalWhatsappId, externalMessageId) no banco garante que só uma linha é
      // criada; a segunda tentativa cai aqui e é tratada como sucesso idempotente.
      console.info("[agentes/taciane] Corrida concorrente detectada (mensagem de cliente) — já inserida por outra requisição.", {
        externalMessageId,
      });
      return conversa;
    }
    throw err;
  }

  // Ciclo de Atendimento — reabertura automática: PENDENTE/CONCLUIDA voltam para
  // ABERTA ao chegar mensagem real do cliente; SPAM nunca reabre sozinho.
  const novoStatus = statusAposNovaMensagemCliente(conversa.status);
  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date(), ...(novoStatus ? { status: novoStatus } : {}) },
  });
  return conversa;
}

// ─── Status recebido (delivered/read/failed de mensagens que ENVIAMOS) ────────
// ACRESCENTADO — sem isso, uma mensagem que a Meta rejeitou depois de aceitar a
// chamada inicial (ex.: cliente sem opt-in para o modelo, número inválido, etc.)
// ficava para sempre com status ENVIADA no CRM, sem nenhum jeito de saber que na
// verdade não chegou. Mesmo padrão já usado em lib/whatsapp/agentes/joao.ts.
export type MetaStatus = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
};

export async function processarStatusRecebido(status: MetaStatus) {
  const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: status.id } });
  if (!mensagem) return; // Pode ser status de mensagem enviada fora deste fluxo — sem correspondência, ignora.

  if (status.status === "delivered") {
    await prisma.mensagem.update({
      where: { id: mensagem.id },
      data: { status: StatusMensagem.ENTREGUE, deliveredAt: new Date() },
    });
    return;
  }

  if (status.status === "read") {
    await prisma.mensagem.update({
      where: { id: mensagem.id },
      data: { status: StatusMensagem.LIDA, readAt: new Date() },
    });
    return;
  }

  if (status.status === "failed") {
    const erro = status.errors?.[0];
    await prisma.mensagem.update({
      where: { id: mensagem.id },
      data: {
        status: StatusMensagem.ERRO,
        errorCode: erro?.code !== undefined ? String(erro.code) : "FAILED",
        errorMessage: erro?.title ?? "Falha reportada pela Meta.",
      },
    });
  }

  // "sent" já é refletido no momento do envio (meta-client marca ENVIADA); outros
  // valores de status não mapeados são ignorados silenciosamente.
}
