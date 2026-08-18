// ARQUIVO: lib/bi-executivo/periodo.ts
// Resolução de período do BI Executivo — usado pela página e pela geração de PDF,
// para os dois nunca divergirem sobre o que significa "últimos 30 dias" etc.

export type PeriodoBI = "7d" | "30d" | "90d" | "ano" | "custom";

export function resolvePeriodo(searchParams: {
  periodo?: string;
  dataInicio?: string;
  dataFim?: string;
}): { inicio: Date; fim: Date; label: string; periodo: PeriodoBI } {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);

  const periodo = (searchParams.periodo as PeriodoBI) ?? "30d";

  if (periodo === "custom" && searchParams.dataInicio && searchParams.dataFim) {
    const inicio = new Date(searchParams.dataInicio);
    inicio.setHours(0, 0, 0, 0);
    const fimCustom = new Date(searchParams.dataFim);
    fimCustom.setHours(23, 59, 59, 999);
    return {
      inicio,
      fim: fimCustom,
      label: `${inicio.toLocaleDateString("pt-BR")} a ${fimCustom.toLocaleDateString("pt-BR")}`,
      periodo,
    };
  }

  if (periodo === "ano") {
    const inicio = new Date(fim.getFullYear(), 0, 1);
    return { inicio, fim, label: `Ano de ${fim.getFullYear()}`, periodo };
  }

  const dias = periodo === "7d" ? 7 : periodo === "90d" ? 90 : 30;
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - dias);
  inicio.setHours(0, 0, 0, 0);
  return { inicio, fim, label: `Últimos ${dias} dias`, periodo };
}

export function resolveTipo(
  tipo: string | undefined,
): "LOCACAO" | "EQUIPAMENTO_USADO" | undefined {
  return tipo === "LOCACAO" || tipo === "EQUIPAMENTO_USADO" ? tipo : undefined;
}
