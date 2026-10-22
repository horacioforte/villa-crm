// ARQUIVO: lib/base-nacional/rotulos-site.ts
// REGRA: nunca remover. Apenas acrescentar.
// Traduz o que o robô encontrou no "site provável" (domínio do e-mail da Receita Federal,
// um PALPITE — nunca um site confirmado só por existir) para um selo em português.
// Valores reais de ConcreteiraTriagem.roboResumo.conclusaoSite — ver lib/base-nacional/robo/site.ts
// (ConclusaoSite) e lib/base-nacional/robo/executar.ts ("SEM_DOMINIO" | "NAO_VISITADO").

export type ChaveConclusaoSite =
  | "CONCRETO_NO_SITE"
  | "CONCRETO_FRACO_NO_SITE"
  | "OUTRA_ATIVIDADE_NO_SITE"
  | "SITE_DE_TERCEIRO"
  | "SEM_CONCLUSAO"
  | "SEM_CONCLUSAO_VAZIO" // caso especial: SEM_CONCLUSAO sem nenhuma página lida (site vazio/fora do ar)
  | "SEM_DOMINIO"
  | "NAO_VISITADO";

export const CONCLUSAO_SITE_LABEL: Record<ChaveConclusaoSite, string> = {
  CONCRETO_NO_SITE: "site confirma concreto",
  CONCRETO_FRACO_NO_SITE: "site cita concreto (fraco)",
  OUTRA_ATIVIDADE_NO_SITE: "site mostra outra atividade",
  SITE_DE_TERCEIRO: "parece site de contador/terceiro",
  SEM_CONCLUSAO_VAZIO: "site vazio ou fora do ar",
  SEM_CONCLUSAO: "site sem conclusão",
  SEM_DOMINIO: "robô ainda não visitou",
  NAO_VISITADO: "robô ainda não visitou",
};

export const CONCLUSAO_SITE_COR: Record<ChaveConclusaoSite, string> = {
  CONCRETO_NO_SITE: "bg-emerald-100 text-emerald-700",
  CONCRETO_FRACO_NO_SITE: "bg-amber-100 text-amber-700",
  OUTRA_ATIVIDADE_NO_SITE: "bg-slate-100 text-slate-600",
  SITE_DE_TERCEIRO: "bg-red-100 text-red-700",
  SEM_CONCLUSAO_VAZIO: "bg-red-100 text-red-700",
  SEM_CONCLUSAO: "bg-slate-100 text-slate-600",
  SEM_DOMINIO: "bg-slate-100 text-slate-500",
  NAO_VISITADO: "bg-slate-100 text-slate-500",
};

/**
 * Decide o selo certo a partir de conclusaoSite + se o robô leu alguma página.
 * SEM_CONCLUSAO com nenhuma página lida vira "site vazio ou fora do ar" (o robô tentou e não
 * achou nada pra ler); SEM_CONCLUSAO com páginas lidas vira "site sem conclusão" (leu, mas os
 * termos não bateram em nada). Sem conclusaoSite (robô nunca rodou) cai em "não visitou".
 */
export function rotuloConclusaoSite(
  conclusaoSite: string | null | undefined,
  paginas: string[] | null | undefined,
): { chave: ChaveConclusaoSite; texto: string; cor: string } {
  const paginasLidas = Boolean(paginas && paginas.length > 0);
  let chave = (conclusaoSite || "NAO_VISITADO") as ChaveConclusaoSite;
  if (chave === "SEM_CONCLUSAO" && !paginasLidas) chave = "SEM_CONCLUSAO_VAZIO";
  if (!CONCLUSAO_SITE_LABEL[chave]) chave = "NAO_VISITADO";
  return { chave, texto: CONCLUSAO_SITE_LABEL[chave], cor: CONCLUSAO_SITE_COR[chave] };
}
