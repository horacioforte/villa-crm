// ARQUIVO: lib/metrics/proposta-vigente.ts
// Regra única (Fase 0) para decidir qual versão de uma Proposta é a "vigente".
// Função pura — não importa Prisma, recebe os dados já buscados.
//
// Regra: uma Proposta pode ter várias PropostaComercial (v1, v2, v3...). Só a
// versão vigente entra em qualquer soma de pipeline. Vigente = a versão marcada
// com ativa=true; se nenhuma estiver marcada, cai para a de maior "versao" dentro
// do mesmo numeroProposta. Nunca soma duas versões do mesmo numeroProposta.

import { PROPOSTA_STATUS_EXCLUIDOS } from "@/lib/metrics/constants";

export type PropostaVigenteInput = {
  numeroProposta: string;
  versao: number;
  ativa: boolean;
  status: string;
  valorTotal: number | string;
};

/**
 * Recebe todas as PropostaComercial de UMA oportunidade (ou de um lote já
 * agrupado por numeroProposta) e devolve apenas as versões vigentes — uma por
 * numeroProposta distinto.
 */
export function selecionarPropostasVigentes<T extends PropostaVigenteInput>(
  propostas: T[],
): T[] {
  const validas = propostas.filter(
    (proposta) => !PROPOSTA_STATUS_EXCLUIDOS.includes(proposta.status as never),
  );

  const ativas = validas.filter((proposta) => proposta.ativa);
  if (ativas.length > 0) {
    return ativas;
  }

  const maiorVersaoPorNumero = validas.reduce((mapa, proposta) => {
    const atual = mapa.get(proposta.numeroProposta);
    if (!atual || proposta.versao > atual.versao) {
      mapa.set(proposta.numeroProposta, proposta);
    }
    return mapa;
  }, new Map<string, T>());

  return Array.from(maiorVersaoPorNumero.values());
}

/** Soma o valorTotal das propostas vigentes (dedup por numeroProposta). */
export function somarPropostasVigentes(propostas: PropostaVigenteInput[]): number {
  return selecionarPropostasVigentes(propostas).reduce(
    (soma, proposta) => soma + Number(proposta.valorTotal),
    0,
  );
}
