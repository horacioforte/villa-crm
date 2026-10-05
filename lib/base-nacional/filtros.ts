// ARQUIVO: lib/base-nacional/filtros.ts
// REGRA: nunca remover. Apenas acrescentar.
// Filtros da Base Nacional de Concreteiras: leitura dos parâmetros da URL e
// montagem do "where" do Prisma. Funções puras (testáveis sem banco).

import type { Prisma } from "@/app/generated/prisma/client";
import {
  CONFIANCAS,
  EQUIPAMENTOS,
  PRIORIDADES,
  SEGMENTO_PARA_ATIVIDADE,
  STATUS_VALIDACAO,
  TIPOS_UNIDADE,
  type Confianca,
  type Equipamento,
  type Prioridade,
  type StatusValidacao,
  type TipoUnidade,
} from "./rotulos";

export const TAMANHOS_PAGINA = [25, 50, 100] as const;
export const TAMANHO_PAGINA_PADRAO = 25;
export const LIMITE_EXPORTACAO = 10_000;

export type FiltrosBase = {
  uf?: string;
  cidade?: string;
  status?: StatusValidacao;
  tipoUnidade?: TipoUnidade;
  confianca?: Confianca;
  segmento?: string;
  busca?: string;
  // v4 (05/10/2026)
  prioridade?: Prioridade;
  /** Equipamento com potencial de VENDA alto ou médio (geral ou em alguma unidade). */
  equipamento?: Equipamento;
};

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function ler(params: Params, chave: string): string | undefined {
  const v = params instanceof URLSearchParams ? params.get(chave) ?? undefined : params[chave];
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t.slice(0, 120) : undefined;
}

function oneOf<T extends string>(valor: string | undefined, lista: readonly T[]): T | undefined {
  return valor && (lista as readonly string[]).includes(valor) ? (valor as T) : undefined;
}

export function lerFiltros(params: Params): FiltrosBase {
  const uf = ler(params, "uf")?.toUpperCase();
  const segmento = ler(params, "segmento")?.toLowerCase();
  return {
    uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : undefined,
    cidade: ler(params, "cidade"),
    status: oneOf(ler(params, "status"), STATUS_VALIDACAO),
    tipoUnidade: oneOf(ler(params, "tipoUnidade"), TIPOS_UNIDADE),
    confianca: oneOf(ler(params, "confianca"), CONFIANCAS),
    segmento: segmento && /^[a-z0-9-]+$/.test(segmento) ? segmento : undefined,
    busca: ler(params, "busca"),
    prioridade: oneOf(ler(params, "prioridade"), PRIORIDADES),
    equipamento: oneOf(ler(params, "equipamento"), EQUIPAMENTOS),
  };
}

export function lerPaginacao(params: Params): { pagina: number; porPagina: number } {
  const pagina = Math.max(1, Math.min(100_000, Number.parseInt(ler(params, "pagina") ?? "1", 10) || 1));
  const pp = Number.parseInt(ler(params, "porPagina") ?? "", 10);
  const porPagina = (TAMANHOS_PAGINA as readonly number[]).includes(pp) ? pp : TAMANHO_PAGINA_PADRAO;
  return { pagina, porPagina };
}

/** Monta o where do Prisma. Filtros de local/tipo valem para QUALQUER unidade da candidata. */
export function montarWhere(f: FiltrosBase): Prisma.ConcreteiraCandidataWhereInput {
  const e: Prisma.ConcreteiraCandidataWhereInput[] = [];

  const unidade: Prisma.ConcreteiraCandidataUnidadeWhereInput = {};
  if (f.uf) unidade.uf = f.uf;
  if (f.cidade) unidade.municipioNome = { equals: f.cidade, mode: "insensitive" };
  if (f.tipoUnidade) unidade.tipoUnidade = f.tipoUnidade;
  if (Object.keys(unidade).length > 0) e.push({ unidades: { some: unidade } });

  if (f.status) e.push({ statusValidacao: f.status });
  if (f.prioridade) e.push({ prioridadeComercial: f.prioridade });
  if (f.equipamento) e.push({ potenciais: { some: { equipamento: f.equipamento, potencialVenda: { in: ["ALTO", "MEDIO"] } } } });
  if (f.confianca) e.push({ confianca: f.confianca });

  if (f.segmento) {
    const ou: Prisma.ConcreteiraCandidataWhereInput[] = [
      { empresa: { is: { segmentos: { some: { segmento: { is: { slug: f.segmento } } } } } } },
    ];
    const atividades = SEGMENTO_PARA_ATIVIDADE[f.segmento];
    if (atividades) ou.push({ tipoAtividade: { in: atividades } });
    e.push({ OR: ou });
  }

  if (f.busca) {
    const termo = f.busca;
    const digitos = termo.replace(/\D/g, "");
    const ou: Prisma.ConcreteiraCandidataWhereInput[] = [
      { razaoSocial: { contains: termo, mode: "insensitive" } },
      { nomeFantasia: { contains: termo, mode: "insensitive" } },
      { municipioMatriz: { contains: termo, mode: "insensitive" } },
      { unidades: { some: { municipioNome: { contains: termo, mode: "insensitive" } } } },
      { unidades: { some: { nomeFantasia: { contains: termo, mode: "insensitive" } } } },
    ];
    if (digitos.length >= 3) {
      if (digitos.length <= 8) ou.push({ cnpjBasico: { startsWith: digitos } });
      ou.push({ unidades: { some: { cnpj: { startsWith: digitos } } } });
    }
    e.push({ OR: ou });
  }

  return e.length > 0 ? { AND: e } : {};
}

export function totalPaginas(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(total / porPagina));
}

/** Monta a query string preservando filtros (para links de paginação e relatórios). */
export function querystring(f: FiltrosBase, extra: Record<string, string | number | undefined> = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) {
    if (v !== undefined && v !== null && String(v) !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Descrição legível dos filtros (vai para PDF, impressão e registro do relatório). */
export function descreverFiltros(f: FiltrosBase, rotulos: { status?: string; tipoUnidade?: string; confianca?: string; segmento?: string; prioridade?: string; equipamento?: string }): string {
  const partes: string[] = [];
  if (f.uf) partes.push(`UF: ${f.uf}`);
  if (f.cidade) partes.push(`Cidade: ${f.cidade}`);
  if (f.status) partes.push(`Situação: ${rotulos.status ?? f.status}`);
  if (f.tipoUnidade) partes.push(`Tipo de unidade: ${rotulos.tipoUnidade ?? f.tipoUnidade}`);
  if (f.confianca) partes.push(`Confiança: ${rotulos.confianca ?? f.confianca}`);
  if (f.segmento) partes.push(`Segmento: ${rotulos.segmento ?? f.segmento}`);
  if (f.busca) partes.push(`Busca: "${f.busca}"`);
  if (f.prioridade) partes.push(`Prioridade: ${rotulos.prioridade ?? f.prioridade}`);
  if (f.equipamento) partes.push(`Potencial de venda: ${rotulos.equipamento ?? f.equipamento}`);
  return partes.length > 0 ? partes.join(" · ") : "Todo o Brasil, sem filtros";
}

/** Tipo do relatório para RelatorioConcreteirasGerado. */
export function tipoRelatorio(f: FiltrosBase): "NACIONAL" | "UF" | "CIDADE" | "STATUS" {
  if (f.cidade) return "CIDADE";
  if (f.uf) return "UF";
  if (f.status) return "STATUS";
  return "NACIONAL";
}
