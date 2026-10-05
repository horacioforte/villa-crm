// ARQUIVO: lib/base-nacional/historico.ts
// REGRA: nunca remover. Apenas acrescentar.
// Tradução do histórico da Base Nacional para linguagem simples (função pura).
// Os valores já chegam mascarados do banco (telefone/e-mail nunca completos no histórico).

import {
  EQUIPAMENTO_LABEL, NIVEL_LABEL, PRIORIDADE_LABEL, SITUACAO_VERIFICACAO_LABEL, TIPO_CONTATO_LABEL, TIPO_UNIDADE_LABEL, PAPEL_PESSOA_LABEL,
} from "./rotulos";

const DICIONARIO: Record<string, string> = {
  ...EQUIPAMENTO_LABEL, ...NIVEL_LABEL, ...SITUACAO_VERIFICACAO_LABEL, ...TIPO_UNIDADE_LABEL, ...PAPEL_PESSOA_LABEL,
};

/** Troca códigos (BOMBA_LANCA, NAO_VERIFICADO, ALTO...) pelos rótulos, sem tocar no resto do texto. */
export function traduzirCodigos(texto: string | null | undefined): string | null {
  if (!texto) return texto ?? null;
  return texto.replace(/\b[A-Z][A-Z_]{2,}\b/g, cod => DICIONARIO[cod] ?? cod);
}

export function rotuloCampoHistorico(campo: string | null | undefined): string | null {
  if (!campo) return null;
  const [tipo, resto] = campo.split(":");
  const contato = (c?: string) => (c && TIPO_CONTATO_LABEL[c as keyof typeof TIPO_CONTATO_LABEL]) || c || "";
  switch (tipo) {
    case "contato": return `Contato (${contato(resto)})`;
    case "situacao": return `Verificação do contato (${contato(resto)})`;
    case "inativacao": return resto === "pessoa" ? "Inativação de pessoa" : `Inativação de contato (${contato(resto)})`;
    case "pessoa": return "Pessoa";
    case "prioridadeComercial": return "Prioridade comercial";
    case "observacaoComercial": return "Observação comercial";
    case "tipoUnidade": return "Tipo de unidade";
    case "empresaId": return "Empresa no CRM";
    case "evidencia": return "Evidência";
    default: return traduzirCodigos(campo);
  }
}

/** Texto de antes/depois. Para vínculo com Empresa, os ids viram "vinculada"/"sem vínculo". */
export function valoresHistorico(h: { campo: string | null; valorAnterior: string | null; valorNovo: string | null }) {
  if (h.campo === "empresaId") {
    return { antes: h.valorAnterior ? "vinculada" : "sem vínculo", depois: h.valorNovo ? "vinculada" : "sem vínculo" };
  }
  const pr = (v: string | null) => (v && PRIORIDADE_LABEL[v as keyof typeof PRIORIDADE_LABEL]) || v;
  const tr = (v: string | null) => (h.campo === "prioridadeComercial" ? pr(v) : traduzirCodigos(v));
  return { antes: tr(h.valorAnterior), depois: tr(h.valorNovo) };
}
