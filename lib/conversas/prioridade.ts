export type PrioridadeConversa = "urgente" | "sem-resposta" | "normal";

export type PrioridadeConversaInfo = {
  prioridade: PrioridadeConversa;
  label: string;
  cor: string;
};

type ConversaPrioridadeInput = {
  status?: string | null;
  ultimaMensagemEm?: string | Date | null;
  atendidoPorId?: string | null;
  mensagens?: Array<{ direcao?: string; createdAt?: string | Date | null }>;
};

const HORA_EM_MS = 60 * 60 * 1000;
const LIMIAR_URGENCIA_MS = 24 * HORA_EM_MS;
const LIMIAR_SEM_RESPOSTA_MS = 24 * HORA_EM_MS;

export function getConversaPrioridade(conversa: ConversaPrioridadeInput): PrioridadeConversaInfo {
  if (!conversa.ultimaMensagemEm) {
    return { prioridade: "normal", label: "Normal", cor: "bg-zinc-100 text-zinc-600" };
  }

  const ultimaMensagemEm = new Date(conversa.ultimaMensagemEm).getTime();
  const agora = Date.now();
  const idadeMs = agora - ultimaMensagemEm;
  const ultimaMsg = conversa.mensagens?.[0];
  const veioDoCliente = ultimaMsg?.direcao === "ENTRADA";

  if (!conversa.atendidoPorId && idadeMs >= LIMIAR_URGENCIA_MS) {
    return { prioridade: "urgente", label: "Urgente", cor: "bg-red-100 text-red-700" };
  }

  if (veioDoCliente && idadeMs >= LIMIAR_SEM_RESPOSTA_MS) {
    return { prioridade: "sem-resposta", label: "Sem resposta", cor: "bg-amber-100 text-amber-700" };
  }

  return { prioridade: "normal", label: "Normal", cor: "bg-zinc-100 text-zinc-600" };
}

// Regra explícita: prioridade primeiro, ultimaMensagemEm DESC como desempate — não
// depende da estabilidade do Array.sort nem da ordenação prévia vinda da API.
export function ordenarConversasPorPrioridade<T extends ConversaPrioridadeInput>(conversas: T[]) {
  return [...conversas].sort((a, b) => {
    const pa = getConversaPrioridade(a);
    const pb = getConversaPrioridade(b);
    const rank = { urgente: 0, "sem-resposta": 1, normal: 2 };
    const diferencaPrioridade = rank[pa.prioridade] - rank[pb.prioridade];
    if (diferencaPrioridade !== 0) return diferencaPrioridade;

    const dataA = a.ultimaMensagemEm ? new Date(a.ultimaMensagemEm).getTime() : 0;
    const dataB = b.ultimaMensagemEm ? new Date(b.ultimaMensagemEm).getTime() : 0;
    return dataB - dataA;
  });
}
