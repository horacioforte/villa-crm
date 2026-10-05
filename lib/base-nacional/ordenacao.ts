// ARQUIVO: lib/base-nacional/ordenacao.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ordenação em português, ignorando acentos e maiúsculas (Épsilon fica junto do E).
// Funções puras. Acima de LIMITE_ORDENACAO_ACENTOS a listagem usa a ordem do banco
// (a migration v4 propõe a coluna indexada "nomeOrdenacao" para resolver no banco).

export const LIMITE_ORDENACAO_ACENTOS = 20_000;

const colador = new Intl.Collator("pt-BR", { sensitivity: "base", ignorePunctuation: true, numeric: true });

export function compararTexto(a: string | null | undefined, b: string | null | undefined): number {
  if (!a) return b ? 1 : 0;
  if (!b) return -1;
  return colador.compare(a, b);
}

export function ordenarPorNome<T extends { id: string; razaoSocial: string | null }>(itens: T[]): T[] {
  return [...itens].sort((x, y) => compararTexto(x.razaoSocial, y.razaoSocial) || x.id.localeCompare(y.id));
}

export function ordenarParaRelatorio<T extends { id: string; razaoSocial: string | null; ufMatriz: string | null; municipioMatriz: string | null }>(itens: T[]): T[] {
  return [...itens].sort((x, y) =>
    compararTexto(x.ufMatriz, y.ufMatriz) ||
    compararTexto(x.municipioMatriz, y.municipioMatriz) ||
    compararTexto(x.razaoSocial, y.razaoSocial) ||
    x.id.localeCompare(y.id));
}
