// ARQUIVO: lib/base-nacional/municipios-receita.ts
// REGRA: nunca remover. Apenas acrescentar.
// Tradução do código de município da Receita Federal (NÃO é o código IBGE de 7 dígitos).
//
// PENDÊNCIA CONHECIDA (registrada em 07/10/2026): a Receita Federal não publica, na
// mesma pasta de Dados Abertos do CNPJ, uma tabela oficial de correspondência
// "código RFB → código IBGE". Por isso `municipioCodigoIbge` em ReceitaEstabelecimento
// e ConcreteiraCandidataUnidade só é preenchido quando essa correspondência oficial for
// localizada; até lá, fica null e o nome/UF ficam disponíveis mesmo assim (a UF vem do
// próprio campo "uf" do registro da Receita, nunca desta tabela — a tabela oficial de
// municípios da Receita só tem código→nome, sem UF).

import { MUNICIPIO_RFB } from "./municipios-receita.generated";

export { MUNICIPIO_RFB };

/** Nome do município pelo código RFB. Aceita com ou sem zeros à esquerda ("2531" ou "1"). */
export function nomeMunicipioReceita(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  const d = codigo.replace(/\D/g, "");
  if (!d) return null;
  return MUNICIPIO_RFB[d] ?? MUNICIPIO_RFB[d.padStart(4, "0")] ?? null;
}

/**
 * Correspondência RFB → IBGE: AINDA NÃO implementada (pendência oficial, ver acima).
 * Mantida como função explícita para que o importador sempre passe por aqui — no dia em
 * que uma tabela oficial for localizada, só este arquivo precisa ser alterado.
 */
export function municipioCodigoIbge(_codigoReceita: string | null | undefined, _uf: string | null | undefined): string | null {
  return null;
}
