// ARQUIVO: lib/base-nacional/receita/filtro.ts
// REGRA: nunca remover. Apenas acrescentar.
// Filtro de CNAE da Base Nacional de Concreteiras — funções puras, sem I/O.
// Entra se o CNAE principal OU algum CNAE secundário estiver na lista de alvo.

import { CNAES_CONCRETO_USINADO } from "../receita-tabelas";

export { CNAES_CONCRETO_USINADO };

/** O estabelecimento entra no filtro (CNAE principal ou secundário é alvo). */
export function estabelecimentoNoFiltro(
  cnaePrincipal: string,
  cnaesSecundarios: readonly string[],
  alvos: ReadonlySet<string> = CNAES_CONCRETO_USINADO,
): boolean {
  return alvos.has(cnaePrincipal) || cnaesSecundarios.some(c => alvos.has(c));
}

/** O CNAE alvo aparece como PRINCIPAL deste estabelecimento específico (não apenas secundário). */
export function cnaeAlvoComoPrincipal(cnaePrincipal: string, alvos: ReadonlySet<string> = CNAES_CONCRETO_USINADO): boolean {
  return alvos.has(cnaePrincipal);
}
