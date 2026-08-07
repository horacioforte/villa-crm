export type MelhorProximaAcao = {
  acao: string;
  motivos: string[];
  impacto: string;
  urgencia: "alta" | "media" | "baixa";
  confianca: "alta" | "media" | "baixa";
  naoAgir: string;
};

export type BuildTarefaPayloadInput = {
  acao: string;
  urgencia: "alta" | "media" | "baixa";
  motivos?: string[];
  oportunidadeId?: string | null;
  empresaId?: string | null;
  pessoaId?: string | null;
  dataVencimento?: Date | null;
};

export type TarefaPayloadDraft = {
  titulo: string;
  descricao: string;
  prioridade: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  tipo: "LIGACAO" | "RETORNO_CLIENTE" | "TAREFA_INTERNA";
  dataVencimento: string;
  observacoes: string;
  oportunidadeId?: string | null;
  empresaId?: string | null;
  pessoaId?: string | null;
};

export type BuildMelhorProximaAcaoInput = {
  tarefasVencidas?: number;
  propostasAbertas?: number;
  ultimaMensagemEm?: Date | null;
  ultimaMensagemCliente?: boolean;
  oportunidadeAtiva?: boolean;
};

function diasSemResposta(ultimaMensagemEm?: Date | null) {
  if (!ultimaMensagemEm) return Number.POSITIVE_INFINITY;
  const diffMs = Date.now() - ultimaMensagemEm.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function buildTarefaPayloadFromRecomendacao(
  input: BuildTarefaPayloadInput,
): TarefaPayloadDraft {
  const prioridade = input.urgencia === "alta" ? "ALTA" : input.urgencia === "media" ? "MEDIA" : "BAIXA";
  const tipo = input.acao.includes("follow-up") || input.acao.includes("acompanh") ? "RETORNO_CLIENTE" : "LIGACAO";
  const vencimento = input.dataVencimento ?? new Date(Date.now() + 1000 * 60 * 60 * 24);
  const dataVencimento = vencimento.toISOString().slice(0, 10);

  return {
    titulo:
      input.acao === "Ligue agora"
        ? "Ligar para cliente"
        : input.acao === "Envie um follow-up"
          ? "Enviar follow-up"
          : "Acompanhar oportunidade",
    descricao: `Recomendação do Brain: ${input.acao}`,
    prioridade,
    tipo,
    dataVencimento,
    observacoes: input.motivos?.join(" · ") ?? "Recomendação do Brain",
    oportunidadeId: input.oportunidadeId,
    empresaId: input.empresaId,
    pessoaId: input.pessoaId,
  };
}

export function buildMelhorProximaAcao(input: BuildMelhorProximaAcaoInput): MelhorProximaAcao {
  const tarefasVencidas = input.tarefasVencidas ?? 0;
  const propostasAbertas = input.propostasAbertas ?? 0;
  const semResposta = diasSemResposta(input.ultimaMensagemEm);
  const ultimaMensagemCliente = input.ultimaMensagemCliente ?? false;
  const oportunidadeAtiva = input.oportunidadeAtiva ?? true;

  if (!oportunidadeAtiva) {
    return {
      acao: "Reative a oportunidade",
      motivos: ["a oportunidade encontra-se inativa"],
      impacto: "recupera o relacionamento e reativa o pipeline",
      urgencia: "alta",
      confianca: "alta",
      naoAgir: "sem ação, a oportunidade tende a ficar parada e perder ritmo",
    };
  }

  if (tarefasVencidas > 0) {
    return {
      acao: "Ligue agora",
      motivos: ["existe uma tarefa vencida", "a oportunidade precisa de atenção imediata"],
      impacto: "evita perder o ritmo da negociação",
      urgencia: "alta",
      confianca: "alta",
      naoAgir: "sem contato, o risco de perda aumenta rapidamente",
    };
  }

  if (propostasAbertas > 0 && semResposta >= 4) {
    return {
      acao: "Envie um follow-up",
      motivos: ["a proposta permanece aberta sem resposta", "há mais de 4 dias sem retorno"],
      impacto: "aumenta a chance de avanço sem perder o contato",
      urgencia: "alta",
      confianca: "media",
      naoAgir: "sem follow-up, a proposta pode virar inação e o cliente esquecer o negócio",
    };
  }

  if (ultimaMensagemCliente === false && semResposta >= 2) {
    return {
      acao: "Reative o contato",
      motivos: ["há atividade comercial sem resposta recente"],
      impacto: "mantém o relacionamento vivo e evita o esfriamento",
      urgencia: "media",
      confianca: "media",
      naoAgir: "sem reativação, a oportunidade pode esfriar em poucos dias",
    };
  }

  return {
    acao: "Mantenha o acompanhamento",
    motivos: ["a oportunidade está em andamento", "não há sinais críticos no momento"],
    impacto: "preserva a continuidade sem gerar ruído",
    urgencia: "baixa",
    confianca: "baixa",
    naoAgir: "sem ação, a oportunidade segue em observação e pode perder impulso",
  };
}
