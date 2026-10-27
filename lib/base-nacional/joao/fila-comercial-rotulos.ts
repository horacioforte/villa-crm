// ARQUIVO: lib/base-nacional/joao/fila-comercial-rotulos.ts
// REGRA: nunca remover. Apenas acrescentar.
// Rótulos da decisão humana da fila comercial do João (sem acesso ao banco; usável em componentes de cliente).

export const DECISOES_COMERCIAIS = ["APROVADO_ABORDAGEM", "PESQUISAR_MELHOR", "CONTATO_INVALIDO", "NAO_PRIORITARIA", "ADIAR"] as const;
export type DecisaoComercial = (typeof DECISOES_COMERCIAIS)[number];
export const DECISAO_COMERCIAL_LABEL: Record<DecisaoComercial, string> = {
  APROVADO_ABORDAGEM: "Aprovado para abordagem",
  PESQUISAR_MELHOR: "Precisa pesquisar melhor",
  CONTATO_INVALIDO: "Contato inválido",
  NAO_PRIORITARIA: "Empresa não prioritária",
  ADIAR: "Adiar",
};

// ─── "Não é concreteira" (um clique na tela do grupo) ─────────────────────────
// Não é valor de enum (sem migration): a rota recebe decisao "NAO_E_CONCRETEIRA" + motivoDescarte; o grupo
// é gravado como NAO_PRIORITARIA e cada candidata passa para o status NAO_E_CONCRETEIRA.
export const DECISAO_NAO_E_CONCRETEIRA = "NAO_E_CONCRETEIRA" as const;
export type TipoAtividadeDescarte = "ARGAMASSA" | "PRE_MOLDADO" | "OUTRA_ATIVIDADE";
export const MOTIVOS_DESCARTE = ["ARGAMASSA", "PRE_MOLDADO", "CONSTRUTORA", "MINERACAO_AREIA", "LOJA_REVENDA", "FECHOU_INATIVA"] as const;
export type MotivoDescarte = (typeof MOTIVOS_DESCARTE)[number];
export const MOTIVO_DESCARTE_LABEL: Record<MotivoDescarte, string> = {
  ARGAMASSA: "Argamassa",
  PRE_MOLDADO: "Pré-moldado",
  CONSTRUTORA: "Construtora",
  MINERACAO_AREIA: "Mineração/areia",
  LOJA_REVENDA: "Loja/revenda",
  FECHOU_INATIVA: "Fechou/inativa",
};
/** Motivo → tipoAtividade gravado em cada candidata do grupo. */
export const MOTIVO_DESCARTE_TIPO_ATIVIDADE: Record<MotivoDescarte, TipoAtividadeDescarte> = {
  ARGAMASSA: "ARGAMASSA",
  PRE_MOLDADO: "PRE_MOLDADO",
  CONSTRUTORA: "OUTRA_ATIVIDADE",
  MINERACAO_AREIA: "OUTRA_ATIVIDADE",
  LOJA_REVENDA: "OUTRA_ATIVIDADE",
  FECHOU_INATIVA: "OUTRA_ATIVIDADE",
};
