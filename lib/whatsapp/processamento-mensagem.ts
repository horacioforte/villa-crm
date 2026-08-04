// ARQUIVO: lib/whatsapp/processamento-mensagem.ts
// Fase 2 — Etapa 3. Estado persistente de processamento de Mensagem
// (NAO_APLICAVEL → PENDENTE → PROCESSANDO → PROCESSADA / ERRO_PROCESSAMENTO).
//
// Fecha o risco de mensagem recebida e abandonada: se o processo for interrompido
// entre PENDENTE e PROCESSADA, a linha fica visivelmente presa em PROCESSANDO — ver
// scripts/diagnostico-mensagens-travadas.ts. A aquisição é sempre por UPDATE
// condicional atômico (nunca leitura seguida de escrita separada), então duas
// execuções concorrentes nunca processam a mesma mensagem ao mesmo tempo.

import { prisma } from "@/lib/prisma";
import { ProcessamentoMensagemStatus } from "@/app/generated/prisma/client";
import { EnvioMetaError, CanalInvalidoError } from "./meta-client";

export const PROCESSAMENTO_MAX_TENTATIVAS = Number(process.env.WHATSAPP_PROCESSAMENTO_MAX_TENTATIVAS ?? 3);
export const PROCESSAMENTO_TRAVADO_MINUTOS = Number(process.env.WHATSAPP_PROCESSAMENTO_TRAVADO_MINUTOS ?? 5);

export class LimiteDeTentativasExcedidoError extends Error {
  constructor(mensagemId: string, tentativas: number) {
    super(
      `Mensagem ${mensagemId} já teve ${tentativas} tentativa(s) de processamento — atingiu o limite (${PROCESSAMENTO_MAX_TENTATIVAS}). Requer revisão humana antes de tentar de novo.`,
    );
    this.name = "LimiteDeTentativasExcedidoError";
  }
}

/**
 * Adquire uma Mensagem para processamento de forma atômica via UPDATE condicional:
 * só uma execução concorrente consegue transicionar de um status elegível para
 * PROCESSANDO (a cláusula WHERE inclui o status esperado — se outra execução já
 * mudou o status entre a leitura de tentativas e este UPDATE, o count vem 0 e
 * devolvemos null, nunca processamos a mesma mensagem duas vezes em paralelo).
 *
 * Retorna null se: mensagem não existe, ou não estava em um status elegível
 * (já sendo processada por outra execução, ou já concluída).
 * Lança LimiteDeTentativasExcedidoError se o número de tentativas já esgotou o limite
 * configurado — nesse caso a mensagem não é adquirida, fica parada, aguardando
 * decisão humana.
 */
export async function adquirirParaProcessamento(
  mensagemId: string,
  { statusElegiveis = [ProcessamentoMensagemStatus.PENDENTE] }: { statusElegiveis?: ProcessamentoMensagemStatus[] } = {},
) {
  const atual = await prisma.mensagem.findUnique({
    where: { id: mensagemId },
    select: { processamentoTentativas: true },
  });
  if (!atual) return null;

  if (atual.processamentoTentativas >= PROCESSAMENTO_MAX_TENTATIVAS) {
    throw new LimiteDeTentativasExcedidoError(mensagemId, atual.processamentoTentativas);
  }

  const resultado = await prisma.mensagem.updateMany({
    where: { id: mensagemId, processamentoStatus: { in: statusElegiveis } },
    data: {
      processamentoStatus: ProcessamentoMensagemStatus.PROCESSANDO,
      processamentoTentativas: { increment: 1 },
      processamentoAtualizadoEm: new Date(),
    },
  });

  // count !== 1 significa que o WHERE não bateu no momento do UPDATE — outra
  // execução já adquiriu a mensagem entre a leitura acima e agora, ou o status
  // não era mais elegível. Nunca dá pra essa condição ser "meio adquirida".
  if (resultado.count !== 1) return null;

  return prisma.mensagem.findUniqueOrThrow({ where: { id: mensagemId } });
}

export async function marcarProcessada(mensagemId: string) {
  const agora = new Date();
  await prisma.mensagem.update({
    where: { id: mensagemId },
    data: {
      processamentoStatus: ProcessamentoMensagemStatus.PROCESSADA,
      processamentoAtualizadoEm: agora,
      processadaEm: agora,
      processamentoErroCodigo: null,
      processamentoErro: null,
    },
  });
}

export async function marcarErroProcessamento(mensagemId: string, err: unknown) {
  const { codigo, mensagem } = classificarErroProcessamento(err);
  await prisma.mensagem.update({
    where: { id: mensagemId },
    data: {
      processamentoStatus: ProcessamentoMensagemStatus.ERRO_PROCESSAMENTO,
      processamentoErroCodigo: codigo,
      processamentoErro: mensagem,
      processamentoAtualizadoEm: new Date(),
    },
  });
}

// Redação defensiva: mesmo que um erro interno inclua acidentalmente algo com
// formato de token/segredo (não deveria — meta-client já sanitiza os seus), nunca
// persiste isso no campo de erro.
function redigirSegredos(texto: string): string {
  return texto
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/sk-ant-[A-Za-z0-9-]+/gi, "[REDACTED]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[REDACTED]");
}

function classificarErroProcessamento(err: unknown): { codigo: string; mensagem: string } {
  if (err instanceof EnvioMetaError) {
    return { codigo: err.errorCode, mensagem: redigirSegredos(err.message) };
  }
  if (err instanceof CanalInvalidoError) {
    return { codigo: "CANAL_INVALIDO", mensagem: redigirSegredos(err.message) };
  }
  if (err instanceof Error) {
    return { codigo: "ERRO_INTERNO", mensagem: redigirSegredos(err.message) };
  }
  return { codigo: "ERRO_DESCONHECIDO", mensagem: "Erro desconhecido durante o processamento." };
}
