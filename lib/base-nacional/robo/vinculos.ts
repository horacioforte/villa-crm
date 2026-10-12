// ARQUIVO: lib/base-nacional/robo/vinculos.ts
// REGRA: nunca remover. Apenas acrescentar.
// Robô gratuito — vínculos entre candidatas por telefone, e-mail, domínio, endereço e raiz de CNPJ.
// Função pura. Só aponta a relação (com a chave mascarada); NUNCA copia classificação entre empresas.
// Chaves compartilhadas por muitas empresas (típico de escritório de contabilidade) viram vínculo FRACO.

import { dominioDeEmail } from "./site";

export type TipoVinculo = "TELEFONE" | "EMAIL" | "DOMINIO" | "ENDERECO" | "RAIZ_CNPJ";
export type ForcaVinculo = "ALTA" | "MEDIA" | "BAIXA";

export type ContatoReceita = {
  candidataId: string;
  cnpjBasico: string;
  telefones: string[];
  emails: string[];
  enderecos: Array<{ cep?: string | null; logradouro?: string | null; numero?: string | null }>;
};

export type VinculoEncontrado = { a: string; b: string; tipo: TipoVinculo; chaveMascarada: string; forca: ForcaVinculo; tamanhoGrupo: number };

/** Acima deste número de empresas com a mesma chave, o vínculo é considerado fraco (contador, condomínio, etc.). */
export const LIMITE_GRUPO_FORTE = 3;
export const LIMITE_GRUPO_IGNORAR = 15;

export function normalizarFone(v: string): string | null {
  const d = v.replace(/\D/g, "");
  if (d.length < 10 || d.length > 11) return null;
  if (/^(\d)\1+$/.test(d) || /^\d{2}0{8,9}$/.test(d) || /^\d{2}(\d)\1{7,8}$/.test(d)) return null;
  return d;
}
export function mascararChave(tipo: TipoVinculo, chave: string): string {
  if (tipo === "TELEFONE") return `(${chave.slice(0, 2)}) ****-${chave.slice(-2)}`;
  if (tipo === "EMAIL") { const [u, d] = chave.split("@"); return `${u.slice(0, 2)}***@${d}`; }
  if (tipo === "ENDERECO") return `CEP ${chave.slice(0, 5)}-*** (mesmo logradouro e número)`;
  return chave; // domínio e raiz de CNPJ são dados empresariais públicos
}
function normEndereco(e: { cep?: string | null; logradouro?: string | null; numero?: string | null }): string | null {
  const cep = (e.cep ?? "").replace(/\D/g, "");
  const num = (e.numero ?? "").replace(/\D/g, "");
  const log = (e.logradouro ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cep.length !== 8 || !num || num === "0" || log.length < 4) return null; // "S/N" e zona rural não identificam endereço
  return `${cep}|${log}|${num}`;
}

export function encontrarVinculos(lista: ContatoReceita[]): VinculoEncontrado[] {
  const grupos = new Map<string, Set<string>>(); // "TIPO|chave" -> candidatas
  const add = (tipo: TipoVinculo, chave: string | null, id: string) => {
    if (!chave) return;
    const k = `${tipo}|${chave}`;
    if (!grupos.has(k)) grupos.set(k, new Set());
    grupos.get(k)!.add(id);
  };
  for (const c of lista) {
    for (const t of c.telefones) add("TELEFONE", normalizarFone(t), c.candidataId);
    for (const e of c.emails) {
      const em = e.trim().toLowerCase();
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(em)) add("EMAIL", em, c.candidataId);
      add("DOMINIO", dominioDeEmail(em), c.candidataId);
    }
    for (const en of c.enderecos) add("ENDERECO", normEndereco(en), c.candidataId);
    add("RAIZ_CNPJ", c.cnpjBasico, c.candidataId);
  }
  const out: VinculoEncontrado[] = [];
  for (const [k, ids] of grupos) {
    if (ids.size < 2 || ids.size > LIMITE_GRUPO_IGNORAR) continue;
    const [tipo, chave] = k.split("|", 2) as [TipoVinculo, string];
    const base: ForcaVinculo = tipo === "EMAIL" || tipo === "DOMINIO" || tipo === "RAIZ_CNPJ" ? "ALTA" : tipo === "TELEFONE" ? "MEDIA" : "BAIXA";
    const forca: ForcaVinculo = ids.size > LIMITE_GRUPO_FORTE ? "BAIXA" : base;
    const arr = [...ids].sort();
    for (const a of arr) for (const b of arr) if (a !== b) out.push({ a, b, tipo, chaveMascarada: mascararChave(tipo, chave), forca, tamanhoGrupo: ids.size });
  }
  // Um e-mail igual já implica domínio igual: evita duplicar o vínculo de domínio para o mesmo par.
  const comEmail = new Set(out.filter(v => v.tipo === "EMAIL").map(v => `${v.a}|${v.b}`));
  return out.filter(v => !(v.tipo === "DOMINIO" && comEmail.has(`${v.a}|${v.b}`)));
}
