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
    where: { telefone, instanceName: INSTANCE_NAME },
    orderBy: { updatedAt: "desc" },
  });

  if (existente) {
    if (existente.canalWhatsappId && existente.canalWhatsappId !== canal.id) {
      throw new Error(
        `Conversa ${existente.id} já está vinculada ao canal ${existente.canalWhatsappId}, divergente do canal ${canal.id} resolvido para este evento.`,
      );
    }
    if (!existente.canalWhatsappId) {
      return prisma.conversa.update({
        where: { id: existente.id },
        data: { canalWhatsappId: canal.id, nomeContato },
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
}: {
  canal: CanalWhatsapp;
  telefone: string;
  nomeContato: string;
  externalMessageId: string;
  messageType: string;
  texto: string;
  rawPayload: unknown;
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

  await prisma.conversa.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: new Date() } });
  return conversa;
}
