// ARQUIVO: lib/conversas/reabertura.ts
// Ciclo de Atendimento — regra de reabertura automática ao chegar mensagem nova do
// cliente. Usada pelos módulos de persistência de cada canal (maria/joao/morgana/
// taciane, V2, e lib/agentes/joao/crm.ts, V1) no momento em que uma mensagem ENTRADA é
// gravada.
//
// PENDENTE ou CONCLUIDA voltam para ABERTA — nenhuma mensagem real do cliente pode
// ficar escondida atrás de um atendimento "encerrado".
// SPAM NUNCA reabre sozinho — é uma classificação deliberada de "não vale a pena
// atender", só um humano tira uma conversa de Spam (aprovado explicitamente).
// ABERTA não precisa de ação (já é o estado ativo).

import { StatusConversa } from "@/app/generated/prisma/client";

const STATUS_QUE_REABREM = new Set<string>([StatusConversa.PENDENTE, StatusConversa.CONCLUIDA]);

/**
 * Retorna o novo status quando uma mensagem ENTRADA chega, ou null quando o status
 * atual não deve mudar (ABERTA continua ABERTA, SPAM continua SPAM).
 */
export function statusAposNovaMensagemCliente(
  statusAtual: string | null | undefined,
): StatusConversa | null {
  if (!statusAtual) return null;
  return STATUS_QUE_REABREM.has(statusAtual) ? StatusConversa.ABERTA : null;
}
