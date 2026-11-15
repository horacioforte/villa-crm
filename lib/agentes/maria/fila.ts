// ARQUIVO: lib/agentes/maria/fila.ts
// REGRA: nunca remover. Apenas acrescentar.
// IMPORTANTE — MIGRAÇÃO PENDENTE:
//   Este arquivo requer que `FilaMensagem` e `StatusFilaMensagem` existam no Prisma Client.
//   Para ativar: (1) executar `npx prisma migrate dev --name add-fila-mensagem` com autorização de Horácio,
//   (2) executar `npx prisma generate`, (3) remover o @ts-nocheck abaixo.
//   Sem a migração, este arquivo compila com erros de tipo esperados (tabela não existe no client gerado).
// Fila persistente de mensagens por conversa para a Maria.
// Requer: tabela FilaMensagem (StatusFilaMensagem) no banco.
// Serializa processamento por telefone usando:
//   - INSERT com messageId único (idempotência da Meta)
//   - pg_advisory_xact_lock(hashtext(telefone)) para exclusão mútua
//   - processandoAte para recuperação de crashes (timeout 90s)
//   - Agrupamento de mensagens chegadas em até JANELA_AGRUPAMENTO_MS
// ACRESCENTADO (15/11/2026 — Fila Persistente Maria v1)

import { prisma } from "@/lib/prisma";
import { StatusFilaMensagem } from "@/app/generated/prisma/client";

// ─── Constantes ───────────────────────────────────────────────────────────────

const LOCK_TTL_MS = 90_000;         // tempo máximo de processamento de um lote
const MAX_TENTATIVAS = 3;           // tentativas antes de FALHOU
const JANELA_AGRUPAMENTO_MS = 4000; // mensagens chegadas em até 4s são agrupadas

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type FilaMensagemPayload = {
  telefone: string;
  nomeContato: string;
  texto: string;
  messageId: string | null;
  messageType: string;
  rawPayload: unknown;
  referral: Record<string, unknown> | null;
};

export type FilaMensagemRecord = {
  id: string;
  telefone: string;
  nomeContato: string;
  texto: string;
  messageId: string | null;
  messageType: string;
  status: StatusFilaMensagem;
  tentativas: number;
  criadoEm: Date;
};

// ─── Registro (Passo 1 — webhook) ─────────────────────────────────────────────

/**
 * Registra uma mensagem na fila antes de qualquer processamento.
 * Retorna o id criado, ou null se for duplicata (mesmo messageId).
 * Deve ser chamado logo ao receber o webhook, antes de retornar HTTP 200.
 */
export async function registrarNaFila(
  payload: FilaMensagemPayload,
): Promise<string | null> {
  if (payload.messageId) {
    const existente = await prisma.filaMensagem.findUnique({
      where: { messageId: payload.messageId },
      select: { id: true },
    });
    if (existente) return null; // duplicata — Meta reenviou
  }

  const criado = await prisma.filaMensagem.create({
    data: {
      telefone: payload.telefone,
      nomeContato: payload.nomeContato,
      texto: payload.texto,
      messageId: payload.messageId,
      messageType: payload.messageType,
      rawPayload: payload.rawPayload as object,
      referral: payload.referral as object | null,
      status: StatusFilaMensagem.AGUARDANDO,
    },
    select: { id: true },
  });

  return criado.id;
}

// ─── Recuperação de mensagens travadas ────────────────────────────────────────

/**
 * Reseta para AGUARDANDO mensagens que ficaram em PROCESSANDO por mais de LOCK_TTL_MS.
 * Chamado automaticamente no início de processarFilaParaTelefone().
 */
async function recuperarTravadas(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  telefone: string,
): Promise<number> {
  const corte = new Date(Date.now() - LOCK_TTL_MS);
  const { count } = await tx.filaMensagem.updateMany({
    where: {
      telefone,
      status: StatusFilaMensagem.PROCESSANDO,
      processandoAte: { lt: corte },
    },
    data: {
      status: StatusFilaMensagem.AGUARDANDO,
      processandoAte: null,
    },
  });
  return count;
}

// ─── Reivindicação do próximo lote ────────────────────────────────────────────

/**
 * Dentro de uma transação com advisory lock, verifica se há mensagens para processar.
 * Retorna o lote (pode ter 1 ou N mensagens agrupadas) ou null se não há trabalho.
 * Agrupa mensagens chegadas dentro de JANELA_AGRUPAMENTO_MS entre si.
 */
async function claimarProximoLote(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  telefone: string,
): Promise<FilaMensagemRecord[] | null> {
  // Verifica se outra instância está processando ativamente (lock não expirado)
  const processandoAtivo = await tx.filaMensagem.findFirst({
    where: {
      telefone,
      status: StatusFilaMensagem.PROCESSANDO,
      processandoAte: { gt: new Date() },
    },
    select: { id: true },
  });
  if (processandoAtivo) return null;

  // Busca todas as mensagens aguardando
  const aguardando = await tx.filaMensagem.findMany({
    where: { telefone, status: StatusFilaMensagem.AGUARDANDO },
    orderBy: { criadoEm: "asc" },
    select: {
      id: true,
      telefone: true,
      nomeContato: true,
      texto: true,
      messageId: true,
      messageType: true,
      status: true,
      tentativas: true,
      criadoEm: true,
    },
  });

  if (aguardando.length === 0) return null;

  // Agrupa mensagens dentro da janela de tempo (debounce natural)
  const primeira = aguardando[0];
  const janelaFim = new Date(primeira.criadoEm.getTime() + JANELA_AGRUPAMENTO_MS);
  const lote = aguardando.filter((m) => m.criadoEm <= janelaFim);

  // Reivindica o lote
  const expiraEm = new Date(Date.now() + LOCK_TTL_MS);
  await tx.filaMensagem.updateMany({
    where: { id: { in: lote.map((m) => m.id) } },
    data: {
      status: StatusFilaMensagem.PROCESSANDO,
      tentativas: { increment: 1 },
      processandoAte: expiraEm,
    },
  });

  // Atualiza os campos localmente para retornar com tentativas corretas
  return lote.map((m) => ({
    ...m,
    status: StatusFilaMensagem.PROCESSANDO,
    tentativas: m.tentativas + 1,
  }));
}

// ─── Conclusão e falha do lote ────────────────────────────────────────────────

export async function concluirLote(ids: string[]): Promise<void> {
  await prisma.filaMensagem.updateMany({
    where: { id: { in: ids } },
    data: {
      status: StatusFilaMensagem.CONCLUIDA,
      concluidaEm: new Date(),
      processandoAte: null,
    },
  });
}

export async function falharLote(ids: string[], erro: string): Promise<void> {
  // Busca tentativas atuais para decidir se vai para FALHOU ou AGUARDANDO
  const registros = await prisma.filaMensagem.findMany({
    where: { id: { in: ids } },
    select: { id: true, tentativas: true },
  });

  for (const reg of registros) {
    if (reg.tentativas >= MAX_TENTATIVAS) {
      await prisma.filaMensagem.update({
        where: { id: reg.id },
        data: {
          status: StatusFilaMensagem.FALHOU,
          erroMsg: erro,
          processandoAte: null,
        },
      });
    } else {
      await prisma.filaMensagem.update({
        where: { id: reg.id },
        data: {
          status: StatusFilaMensagem.AGUARDANDO,
          processandoAte: null,
        },
      });
    }
  }
}

// ─── Orquestrador principal ────────────────────────────────────────────────────

/**
 * Processa a fila de mensagens para um telefone até ela esvaziar.
 * Usa pg_advisory_xact_lock para garantir que apenas uma instância processa
 * por telefone simultaneamente.
 * Recebe callback para cada lote — o caller (route.ts) faz o processamento real.
 */
export async function processarFilaParaTelefone(
  telefone: string,
  processarLote: (lote: FilaMensagemRecord[]) => Promise<void>,
): Promise<{ lotesProcessados: number; erros: number }> {
  let lotesProcessados = 0;
  let erros = 0;

  // Loop: continua até não haver mais mensagens para processar
  for (let rodada = 0; rodada < 20; rodada++) {
    let loteAtual: FilaMensagemRecord[] | null = null;

    // Fase 1: Advisory lock + recuperação + reivindicação (dentro de transação)
    try {
      loteAtual = await prisma.$transaction(
        async (tx) => {
          // Serializa por telefone — bloqueia outras instâncias para o mesmo número
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${telefone})::bigint)`;

          // Recupera mensagens de instâncias mortas
          await recuperarTravadas(tx, telefone);

          // Reivindica próximo lote
          return claimarProximoLote(tx, telefone);
        },
        { timeout: 10000 },
      );
    } catch (err) {
      console.error("[maria/fila] Erro ao reivindicar lote:", err);
      break;
    }

    if (!loteAtual) break; // sem mais mensagens — fim do loop

    // Fase 2: Processa o lote (IA + WhatsApp + CRM — fora do lock de DB)
    try {
      await processarLote(loteAtual);
      await concluirLote(loteAtual.map((m) => m.id));
      lotesProcessados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[maria/fila] Erro no processamento do lote:", msg);
      await falharLote(loteAtual.map((m) => m.id), msg).catch(() => {});
      erros++;
      // Continua para verificar se há mais mensagens (outras não falham por causa desta)
    }
  }

  return { lotesProcessados, erros };
}

// ─── Verificação de pendentes (para recovery sem novo webhook) ────────────────

/**
 * Retorna contagem de mensagens aguardando ou travadas para um telefone.
 * Útil para diagnosticar ou acionar recovery manual.
 */
export async function contarPendentes(telefone: string): Promise<number> {
  const corte = new Date(Date.now() - LOCK_TTL_MS);
  return prisma.filaMensagem.count({
    where: {
      telefone,
      OR: [
        { status: StatusFilaMensagem.AGUARDANDO },
        {
          status: StatusFilaMensagem.PROCESSANDO,
          processandoAte: { lt: corte },
        },
      ],
    },
  });
}

// ─── Busca de telefones pendentes (para cron de recovery) ─────────────────────

/**
 * Retorna lista de telefones únicos com mensagens AGUARDANDO ou PROCESSANDO expiradas.
 * Centralizado aqui (em vez de no cron) para manter todo o acesso a FilaMensagem
 * dentro deste arquivo (@ts-nocheck), isolando os tipos pendentes de migração.
 * [ACRESCENTADO 15/11/2026 — Recovery Periódico v1]
 */
export async function buscarTelefonesPendentes(
  limite = 20,
): Promise<{ telefone: string; nomeContato: string }[]> {
  const corte = new Date(Date.now() - LOCK_TTL_MS);
  return prisma.filaMensagem.findMany({
    where: {
      OR: [
        { status: StatusFilaMensagem.AGUARDANDO },
        {
          status: StatusFilaMensagem.PROCESSANDO,
          processandoAte: { lt: corte },
        },
      ],
    },
    select: { telefone: true, nomeContato: true },
    distinct: ["telefone"],
    take: limite,
  });
}
