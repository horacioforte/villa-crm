// ARQUIVO: lib/whatsapp/agentes/morgana.ts
// Fase 2 — Central de Atendimento WhatsApp. Camada de persistência Conversa/Mensagem
// para a Morgana (Evolution API).
//
// Morgana é uma vendedora HUMANA — este módulo NUNCA importa nem chama nenhuma função
// de IA (analisarMensagem, handlers de Maria/João, etc.). Não existe, propositalmente,
// nenhum caminho de código aqui que gere uma resposta automática. Isso é uma garantia
// arquitetural, verificada por teste (morgana.test.ts): o arquivo não referencia nada
// de lib/agentes/*.
//
// Idempotência: dedupe por (canalWhatsappId, externalMessageId), mesmo padrão de
// lib/whatsapp/agentes/joao.ts e lib/whatsapp/agentes/maria.ts. Nenhum identificador é
// inventado — mensagem sem id real da Evolution é descartada, não gravada sem controle.
//
// ─── Reconciliação de eco fromMe (envio pela Central vs. eco do webhook) ──────────
// Quando a Morgana manda mensagem pela Central (POST /api/mensagens), a Evolution
// devolve na hora um key.id — esse id já é persistido como externalMessageId no
// momento do envio (ver app/api/mensagens/route.ts). Pouco depois, a Evolution também
// entrega esse mesmo envio de volta via webhook (messages.upsert com key.fromMe=true),
// com o MESMO key.id. Como o id já bate, mensagemJaProcessada() identifica que já foi
// gravada e reconciliarOuCriarMensagemHumana() não cria uma segunda linha — só confirma.
//
// Fallback (id não capturado no envio — ex.: resposta da Evolution não trouxe key.id
// por qualquer motivo): reconciliarOuCriarMensagemHumana() procura uma Mensagem SAIDA/
// HUMANO desta mesma conversa, ainda sem externalMessageId, com o MESMO conteúdo,
// criada nos últimos RECONCILIACAO_JANELA_MS — se achar, é o eco do envio pela Central
// que não capturou id na hora; anexa o externalMessageId a essa linha existente, não
// cria nova. Se não achar nenhuma candidata, é genuinamente uma mensagem que a Morgana
// mandou direto pelo celular dela (fora da Central) — cria uma Mensagem nova.

import { prisma } from "@/lib/prisma";
import {
  AutorMensagem,
  DirecaoMensagem,
  Prisma,
  StatusMensagem,
  type CanalWhatsapp,
} from "@/app/generated/prisma/client";
import { statusAposNovaMensagemCliente } from "@/lib/conversas/reabertura";

const INSTANCE_NAME = "morgana-villa";

// Janela de correlação por conteúdo para o fallback de reconciliação — só usada quando
// o envio pela Central não conseguiu capturar o key.id da Evolution na hora.
const RECONCILIACAO_JANELA_MS = 2 * 60 * 1000;

export async function getCanalMorgana(): Promise<CanalWhatsapp | null> {
  return prisma.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });
}

/**
 * Checa se um evento (mensagem da Evolution, cliente OU eco fromMe já reconciliado)
 * já foi persistido. Usada antes de qualquer gravação para impedir reprocessamento em
 * caso de reentrega do mesmo evento.
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
      console.info("[agentes/morgana] Corrida concorrente detectada (mensagem de cliente) — já inserida por outra requisição.", {
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

// ─── Mensagem humana (fromMe — Central ou celular direto) ─────────────────────

export async function reconciliarOuCriarMensagemHumana({
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
  // Já reconciliada/gravada antes (reentrega do mesmo evento) — nada a fazer.
  const jaProcessada = await mensagemJaProcessada({ canal, externalMessageId });
  if (jaProcessada) {
    console.info("[agentes/morgana] Eco fromMe já reconciliado — ignorado.", { externalMessageId });
    return { criouNova: false, reconciliouExistente: false };
  }

  const conversa = await encontrarOuCriarConversa({ canal, telefone, nomeContato });

  // Fallback: procura um envio recente pela Central para esta conversa, com o mesmo
  // conteúdo, que ainda não tem externalMessageId (a Evolution não devolveu key.id no
  // momento do envio). Se achar, é o eco desse envio — não é mensagem nova.
  const candidataParaReconciliar = await prisma.mensagem.findFirst({
    where: {
      conversaId: conversa.id,
      direcao: DirecaoMensagem.SAIDA,
      autor: AutorMensagem.HUMANO,
      externalMessageId: null,
      conteudo: texto,
      createdAt: { gte: new Date(Date.now() - RECONCILIACAO_JANELA_MS) },
    },
    orderBy: { createdAt: "asc" },
  });

  if (candidataParaReconciliar) {
    try {
      await prisma.mensagem.update({
        where: { id: candidataParaReconciliar.id },
        data: { externalMessageId },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Corrida: outra requisição já reconciliou (ou criou) esta mesma mensagem
        // entre a busca acima e este update — sucesso idempotente, não erro.
        console.info("[agentes/morgana] Corrida concorrente na reconciliação — já resolvida por outra requisição.", {
          externalMessageId,
        });
        return { criouNova: false, reconciliouExistente: false };
      }
      throw err;
    }

    await prisma.conversa.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: new Date() } });
    return { criouNova: false, reconciliouExistente: true };
  }

  // Nenhuma candidata local — mensagem genuinamente enviada pelo celular da Morgana,
  // fora da Central. Cria a Mensagem para o Workspace refletir o que aconteceu de fato.
  try {
    await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        conteudo: texto || `[${messageType}]`,
        direcao: DirecaoMensagem.SAIDA,
        autor: AutorMensagem.HUMANO,
        status: StatusMensagem.ENVIADA,
        canalWhatsappId: canal.id,
        externalMessageId,
        messageType,
        rawPayload: rawPayload as Prisma.InputJsonValue,
        receivedAt: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      console.info("[agentes/morgana] Corrida concorrente detectada (mensagem fromMe direta) — já inserida por outra requisição.", {
        externalMessageId,
      });
      return { criouNova: false, reconciliouExistente: false };
    }
    throw err;
  }

  await prisma.conversa.update({ where: { id: conversa.id }, data: { ultimaMensagemEm: new Date() } });
  return { criouNova: true, reconciliouExistente: false };
}
