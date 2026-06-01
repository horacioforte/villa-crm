export type TipoFeedbackValue = "BUG" | "SUGESTAO";
export type StatusFeedbackValue =
  | "RECEBIDO"
  | "EM_ANALISE"
  | "IMPLEMENTADO"
  | "DESCARTADO";

export const tipoFeedbackConfig: Record<
  TipoFeedbackValue,
  { label: string; className: string; emoji: string }
> = {
  BUG: {
    label: "Bug / Erro",
    className: "bg-red-50 text-red-700",
    emoji: "🐛",
  },
  SUGESTAO: {
    label: "Sugestao",
    className: "bg-blue-50 text-blue-700",
    emoji: "💡",
  },
};

export const statusFeedbackConfig: Record<
  StatusFeedbackValue,
  { label: string; className: string }
> = {
  RECEBIDO: {
    label: "Recebido",
    className: "bg-zinc-100 text-[#667085]",
  },
  EM_ANALISE: {
    label: "Em analise",
    className: "bg-amber-100 text-amber-700",
  },
  IMPLEMENTADO: {
    label: "Implementado",
    className: "bg-emerald-100 text-emerald-700",
  },
  DESCARTADO: {
    label: "Descartado",
    className: "bg-red-100 text-red-700",
  },
};

export const feedbackAreas = [
  { value: "GERAL", label: "Geral" },
  { value: "Dashboard", label: "Dashboard" },
  { value: "Kanban / Oportunidades", label: "Kanban / Oportunidades" },
  { value: "Tarefas", label: "Tarefas" },
  { value: "Propostas", label: "Propostas" },
  { value: "Empresas / Contatos", label: "Empresas / Contatos" },
  { value: "Obras", label: "Obras" },
  { value: "Configuracoes", label: "Configuracoes" },
] as const;
