// ARQUIVO: lib/base-nacional/cnpj.ts
// REGRA: nunca remover. Apenas acrescentar.
// Base Nacional de Concreteiras — normalização e validação de CNPJ (02/10/2026).
// Usado para casar candidatas com Empresa SEM alterar os CNPJs já gravados.

/** Remove tudo que não é dígito. Retorna null se não sobrar nada. */
export function somenteDigitos(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = valor.replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

/** Normaliza para 14 dígitos (completa zeros à esquerda quando vier com 13 ou 12). */
export function normalizarCnpj(valor: string | null | undefined): string | null {
  const d = somenteDigitos(valor);
  if (!d || d.length > 14 || d.length < 12) return null;
  return d.padStart(14, "0");
}

/** Valida os dígitos verificadores. */
export function cnpjValido(valor: string | null | undefined): boolean {
  const c = normalizarCnpj(valor);
  if (!c || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(c.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(c.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return c.endsWith(`${d1}${d2}`);
}

/** Raiz (8 dígitos) — identifica a empresa; matriz e filiais compartilham a raiz. */
export function raizCnpj(valor: string | null | undefined): string | null {
  const c = normalizarCnpj(valor);
  return c ? c.slice(0, 8) : null;
}

/** Matriz = ordem 0001. */
export function ehMatriz(valor: string | null | undefined): boolean {
  const c = normalizarCnpj(valor);
  return c ? c.slice(8, 12) === "0001" : false;
}

/** Partes do CNPJ para gravação em ReceitaEstabelecimento. */
export function partesCnpj(valor: string): { cnpj: string; cnpjBasico: string; cnpjOrdem: string; cnpjDv: string } {
  const c = normalizarCnpj(valor);
  if (!c) throw new Error("CNPJ inválido para decomposição.");
  return { cnpj: c, cnpjBasico: c.slice(0, 8), cnpjOrdem: c.slice(8, 12), cnpjDv: c.slice(12, 14) };
}

/** Formata 14 dígitos como 00.000.000/0000-00 (apenas exibição). */
export function formatarCnpj(valor: string | null | undefined): string | null {
  const c = normalizarCnpj(valor);
  return c ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : null;
}

/** Normaliza nome para sugestão de correspondência (nunca para fusão automática). */
export function normalizarNomeEmpresa(nome: string | null | undefined): string {
  if (!nome) return "";
  return nome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(ltda|me|epp|eireli|sa|s a|cia|companhia|comercio|industria)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
