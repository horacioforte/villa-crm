// ARQUIVO: lib/whatsapp/agentes/maria.ts
// Fase 2 — camada aditiva de persistência Conversa/Mensagem para a Maria (Meta Cloud API).
//
// Este módulo NUNCA chama IA, nunca envia WhatsApp e nunca grava efeito comercial
// (Pessoa/Empresa/HistoricoContato/Oportunidade/Tarefa) — isso continua sendo
// responsabilidade exclusiva de lib/agentes/maria/handler.ts e lib/agentes/maria/crm.ts,
// chamados sem nenhuma alteração por app/api/webhook/whatsapp/maria/route.ts.
//
// Só grava o espelho da conversa para o Workspace Comercial (CanalWhatsapp → Conversa →
// Mensagem), atrás da feature flag WHATSAPP_MARIA_CONVERSAS_V2 — ver o roteamento em
// app/api/webhook/whatsapp/maria/route.ts. Mesmo padrão de idempotência de
// lib/whatsapp/agentes/joao.ts: dedupe por (canalWhatsappId, externalMessageId), sem
// inventar identificador quando ausente.

import { prisma } from "@/lib/prisma";
import {
  AutorMensagem,
  DirecaoMensagem,
  Prisma,
  ProcessamentoMensagemStatus,
  StatusMensagem,
  type CanalWhatsapp,
} from "@/app/generated/prisma/client";
import { statusAposNovaMensagemCliente } from "@/lib/conversas/reabertura";

const INSTANCE_NAME = "maria-villa";

export async function getCanalMaria(): Promise<CanalWhatsapp | null> {
  return prisma.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });
}

/**
 * Checa se um evento (mensagem da Meta) já foi persistido por este módulo.
 * Deve ser chamada ANTES de disparar IA/envio/CRM — permite ao chamador pular o
 * reprocessamento inteiro em caso de reentrega do mesmo evento pela Meta, evitando
 * uma segunda resposta real ao cliente.
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

/**
 * Persiste a mensagem de entrada (cliente) e, em seguida, a de saída (resposta da
 * Maria que JÁ foi enviada por enviarWhatsappMeta antes desta função ser chamada) —
 * nunca dispara um novo envio, só registra o que já aconteceu de verdade.
 *
 * Chamado depois que todo o fluxo comercial (IA + envio + CRM) já terminou com
 * sucesso, por isso a mensagem de entrada nasce PROCESSADA (não PENDENTE) — ao
 * contrário do fluxo do João V2, aqui não há um estado intermediário a acompanhar.
 *
 * Idempotência de gravação: se `externalMessageId` já existir para este canal (corrida
 * concorrente que passou pela checagem de mensagemJaProcessada ao mesmo tempo), o
 * insert colide com a constraint composta (canalWhatsappId, externalMessageId) — a
 * segunda tentativa é tratada como sucesso idempotente, não como erro.
 */
export async function persistirConversaMaria({
  canal,
  telefone,
  nomeContato,
  externalMessageId,
  messageType,
  textoCliente,
  rawPayload,
  textoResposta,
}: {
  canal: CanalWhatsapp;
  telefone: string;
  nomeContato: string;
  externalMessageId: string;
  messageType: string;
  textoCliente: string;
  rawPayload: unknown;
  textoResposta: string;
}) {
  const conversa = await encontrarOuCriarConversa({ canal, telefone, nomeContato });

  try {
    await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        conteudo: textoCliente || `[${messageType}]`,
        direcao: DirecaoMensagem.ENTRADA,
        autor: AutorMensagem.CLIENTE,
        status: StatusMensagem.RECEBIDA,
        canalWhatsappId: canal.id,
        externalMessageId,
        messageType,
        rawPayload: rawPayload as Prisma.InputJsonValue,
        receivedAt: new Date(),
        processamentoStatus: ProcessamentoMensagemStatus.PROCESSADA,
        processadaEm: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.info("[agentes/maria] Corrida concorrente detectada — mensagem já inserida por outra requisição.", {
        externalMessageId,
      });
      return conversa;
    }
    throw err;
  }

  await prisma.mensagem.create({
    data: {
      conversaId: conversa.id,
      conteudo: textoResposta,
      direcao: DirecaoMensagem.SAIDA,
      autor: AutorMensagem.IA,
      status: StatusMensagem.ENVIADA,
      canalWhatsappId: canal.id,
    },
  });

  // Ciclo de Atendimento — reabertura automática: PENDENTE/CONCLUIDA voltam para
  // ABERTA ao chegar mensagem real do cliente; SPAM nunca reabre sozinho. Resposta
  // automática da IA (acima) nunca conta como atendimento humano.
  const novoStatus = statusAposNovaMensagemCliente(conversa.status);
  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date(), ...(novoStatus ? { status: novoStatus } : {}) },
  });

  return conversa;
}
