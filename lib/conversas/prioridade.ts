// ARQUIVO: lib/conversas/prioridade.ts
// Ciclo de Atendimento — prioridade (Normal/Atenção/Urgente) é sempre relativa ao
// tempo de espera por resposta HUMANA (ver lib/conversas/aguardando-resposta.ts).
// Não existe prioridade quando a conversa não está aguardando resposta — nesse caso
// getPrioridadeAguardando() retorna null, e a UI não deve exibir nenhum badge.

export type PrioridadeConversa = "urgente" | "atencao" | "normal";

export type PrioridadeConversaInfo = {
  prioridade: PrioridadeConversa;
  label: string;
  cor: string;
};

const MINUTO_EM_MS = 60 * 1000;
const HORA_EM_MS = 60 * MINUTO_EM_MS;

// Thresholds centralizados — únicas constantes que precisam mudar para recalibrar a
// prioridade. Aprovados: 0–30min Normal, >30min–4h Atenção, >4h Urgente.
export const LIMIAR_ATENCAO_MS = 30 * MINUTO_EM_MS;
export const LIMIAR_URGENTE_MS = 4 * HORA_EM_MS;

/**
 * Prioridade calculada a partir de `aguardandoRespostaDesde` (ver
 * calcularAguardandoRespostaDesde). Retorna null quando a conversa não está
 * aguardando resposta — nesse caso não existe prioridade para exibir.
 */
export function getPrioridadeAguardando(
  aguardandoRespostaDesde: string | Date | null | undefined,
  agora: number = Date.now(),
): PrioridadeConversaInfo | null {
  if (!aguardandoRespostaDesde) return null;

  const idadeMs = agora - new Date(aguardandoRespostaDesde).getTime();

  if (idadeMs > LIMIAR_URGENTE_MS) {
    return { prioridade: "urgente", label: "Urgente", cor: "bg-red-100 text-red-700" };
  }
  if (idadeMs > LIMIAR_ATENCAO_MS) {
    return { prioridade: "atencao", label: "Atenção", cor: "bg-amber-100 text-amber-700" };
  }
  return { prioridade: "normal", label: "Normal", cor: "bg-zinc-100 text-zinc-600" };
}

type ConversaOrdenavel = {
  aguardandoRespostaDesde?: string | Date | null;
  ultimaMensagemEm?: string | Date | null;
};

/**
 * Ordenação do Ciclo de Atendimento:
 *   1) conversas aguardando resposta primeiro, por prioridade (urgente > atenção > normal);
 *      dentro da mesma faixa, quem espera há mais tempo aparece primeiro (mais urgente
 *      dentro da própria faixa).
 *   2) conversas que não estão aguardando resposta (já respondida, ou
 *      Pendente/Concluída/Spam) vêm depois, ordenadas por ultimaMensagemEm DESC —
 *      mesmo critério de recência de antes, para esse grupo.
 * Regra explícita, não depende da estabilidade do Array.sort nem da ordenação prévia
 * vinda da API.
 */
export function ordenarConversasPorPrioridade<T extends ConversaOrdenavel>(conversas: T[]) {
  const rank = { urgente: 0, atencao: 1, normal: 2 } as const;

  return [...conversas].sort((a, b) => {
    const pa = getPrioridadeAguardando(a.aguardandoRespostaDesde);
    const pb = getPrioridadeAguardando(b.aguardandoRespostaDesde);

    const rankA = pa ? rank[pa.prioridade] : 3;
    const rankB = pb ? rank[pb.prioridade] : 3;
    if (rankA !== rankB) return rankA - rankB;

    if (pa && pb) {
      // Mesma faixa, ambas aguardando: espera mais longa primeiro (ASC por data de início).
      const desdeA = new Date(a.aguardandoRespostaDesde as string | Date).getTime();
      const desdeB = new Date(b.aguardandoRespostaDesde as string | Date).getTime();
      return desdeA - desdeB;
    }

    // Nenhuma das duas está aguardando: mais recente primeiro (DESC).
    const dataA = a.ultimaMensagemEm ? new Date(a.ultimaMensagemEm).getTime() : 0;
    const dataB = b.ultimaMensagemEm ? new Date(b.ultimaMensagemEm).getTime() : 0;
    return dataB - dataA;
  });
}
