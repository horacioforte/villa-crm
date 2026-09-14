export type AttentionCard = {
  id: "prioridades" | "novas-descobertas" | "novos-decisores" | "sem-atualizacao";
  label: string;
  value: number;
  hint: string;
  emoji: string;
};

export type RadarHealth = {
  investigando: number;
  aguardandoValidacao: number;
  emAnalise: number;
  maisPesquisa: number;
  prontoParaAssumir: number;
  assumido: number;
  semAtualizacao15Dias: number;
  emRisco: number;
};

export type RecentFinding = {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  time: string;
  dossieId: string;
  dossieTitle: string;
  createdAt: string;
};

const HOURS_24 = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const diff = Date.now() - new Date(iso).getTime();
  return diff / 86_400_000;
}

export function buildAttentionCards(
  dossies: Array<{ status?: string | null; prioridade?: string | null; updatedAt?: string | null }>,
  kpis: { inteligencia?: { descobertas?: number; novosDecisores?: number }; acao?: { esquecidos?: number } } = {},
): AttentionCard[] {
  const pronto = dossies.filter((d) => d.status === "PRONTO_PARA_ASSUMIR").length;
  const altaSemAtualizacao = dossies.filter((d) => d.prioridade === "ALTA" && daysSince(d.updatedAt) > 7).length;
  const novasDescobertas = kpis.inteligencia?.descobertas ?? 0;
  const novosDecisores = kpis.inteligencia?.novosDecisores ?? 0;
  const semAtualizacao = kpis.acao?.esquecidos ?? dossies.filter((d) => daysSince(d.updatedAt) > 15).length;

  return [
    {
      id: "prioridades",
      label: "Prioridades hoje",
      value: pronto + altaSemAtualizacao,
      hint: "Dossiês com ação imediata",
      emoji: "🔥",
    },
    {
      id: "novas-descobertas",
      label: "Novas descobertas",
      value: novasDescobertas,
      hint: "Descobertas em 24h",
      emoji: "🆕",
    },
    {
      id: "novos-decisores",
      label: "Novos decisores",
      value: novosDecisores,
      hint: "Decisores mapeados",
      emoji: "👤",
    },
    {
      id: "sem-atualizacao",
      label: "Sem atualização",
      value: semAtualizacao,
      hint: "Sem movimentação +15d",
      emoji: "⚠",
    },
  ];
}

export function buildRadarHealth(dossies: Array<{ status?: string | null; updatedAt?: string | null; prioridade?: string | null }>): RadarHealth {
  const agora = Date.now();
  const semAtualizacao15Dias = dossies.filter((d) => {
    const diff = agora - new Date(d.updatedAt ?? Date.now()).getTime();
    return diff > 15 * 86_400_000;
  }).length;

  const emRisco = dossies.filter((d) => d.prioridade === "ALTA" && daysSince(d.updatedAt) > 7).length;

  return {
    investigando: dossies.filter((d) => d.status === "INVESTIGANDO").length,
    aguardandoValidacao: dossies.filter((d) => d.status === "AGUARDANDO_VALIDACAO").length,
    emAnalise: dossies.filter((d) => d.status === "EM_ANALISE").length,
    maisPesquisa: dossies.filter((d) => d.status === "PEDIR_MAIS_PESQUISA").length,
    prontoParaAssumir: dossies.filter((d) => d.status === "PRONTO_PARA_ASSUMIR").length,
    assumido: dossies.filter((d) => d.status === "ASSUMIDO").length,
    semAtualizacao15Dias,
    emRisco,
  };
}

export function buildRecentFindings(feed: Array<{ id?: string; categoria?: string; titulo?: string; dossieId?: string; dossieTitulo?: string; createdAt?: string }>): RecentFinding[] {
  const relevantes = new Set(["Decisor", "Empresa", "Notícia", "Missão", "Obra", "Dossiê"]);

  return feed
    .filter((item) => {
      if (!item.createdAt) return false;
      const age = Date.now() - new Date(item.createdAt).getTime();
      return age <= HOURS_24 && relevantes.has(item.categoria ?? "");
    })
    .slice(0, 10)
    .map((item) => ({
      id: item.id ?? `${item.dossieId ?? "finding"}-${item.createdAt ?? Date.now()}`,
      category: item.categoria ?? "Atualização",
      title: item.titulo ?? item.dossieTitulo ?? "Atualização relevante",
      subtitle: item.dossieTitulo ?? "Dossiê comercial",
      time: item.createdAt ?? new Date().toISOString(),
      dossieId: item.dossieId ?? "",
      dossieTitle: item.dossieTitulo ?? "Dossiê",
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}
