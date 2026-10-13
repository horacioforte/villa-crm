// ARQUIVO: lib/base-nacional/joao/fila-comercial-filtros.ts
// REGRA: nunca remover. Apenas acrescentar.
// Filtros da fila comercial do João (funções puras, sem banco).

import { DECISOES_COMERCIAIS } from "./fila-comercial-rotulos";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
const ler = (p: Params, k: string) => {
  const v = p instanceof URLSearchParams ? p.get(k) : p[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
};
export type FiltrosJoao = { uf?: string; categoria?: string; porte?: string; unidadesMin?: number; unidadesMax?: number; revisao?: string; busca?: string };
export function lerFiltrosJoao(p: Params): FiltrosJoao {
  const n = (k: string) => { const v = Number(ler(p, k)); return Number.isFinite(v) && v > 0 ? v : undefined; };
  const uf = ler(p, "uf")?.toUpperCase();
  const cat = ler(p, "categoria")?.toUpperCase();
  return {
    uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : undefined,
    categoria: cat && ["A", "B", "C"].includes(cat) ? cat : undefined,
    porte: ler(p, "porte") && /^\d{2}$/.test(ler(p, "porte")!) ? ler(p, "porte") : undefined,
    unidadesMin: n("unidadesMin"), unidadesMax: n("unidadesMax"),
    revisao: ler(p, "revisao") && (["AGUARDANDO", "TODAS"].includes(ler(p, "revisao")!) || (DECISOES_COMERCIAIS as readonly string[]).includes(ler(p, "revisao")!)) ? ler(p, "revisao") : undefined,
    busca: ler(p, "busca")?.slice(0, 80),
  };
}
export function qsJoao(f: FiltrosJoao): string {
  const e = Object.entries(f).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return e.length ? `?${e.join("&")}` : "";
}

