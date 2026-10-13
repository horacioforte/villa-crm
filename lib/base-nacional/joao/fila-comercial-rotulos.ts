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
