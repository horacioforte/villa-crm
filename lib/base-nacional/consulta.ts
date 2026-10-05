// ARQUIVO: lib/base-nacional/consulta.ts
// REGRA: nunca remover. Apenas acrescentar.
// Consultas SOMENTE LEITURA da Base Nacional de Concreteiras.
// Paginação no servidor (skip/take) — nunca carrega a base inteira.
// Não lê nem grava Dossiê, Carteira, Oportunidade, Pessoa ou Tarefa.

import { prisma } from "@/lib/prisma";
import { normalizarNomeEmpresa } from "./cnpj";
import { montarWhere, type FiltrosBase } from "./filtros";
import { GRUPO_DESCARTADO, GRUPO_EM_ANALISE } from "./rotulos";
import { LIMITE_ORDENACAO_ACENTOS, ordenarParaRelatorio, ordenarPorNome } from "./ordenacao";

export async function contarResumo() {
  const grupos = await prisma.concreteiraCandidata.groupBy({ by: ["statusValidacao"], _count: { _all: true } });
  const por = Object.fromEntries(grupos.map(g => [g.statusValidacao, g._count._all])) as Record<string, number>;
  const soma = (l: string[]) => l.reduce((a, s) => a + (por[s] ?? 0), 0);
  return {
    total: grupos.reduce((a, g) => a + g._count._all, 0),
    confirmadas: por.CONFIRMADA ?? 0,
    emAnalise: soma(GRUPO_EM_ANALISE),
    descartadas: soma(GRUPO_DESCARTADO),
    semAnalise: por.PENDENTE ?? 0,
  };
}

export async function opcoesFiltro() {
  // Cidades NÃO são carregadas aqui: o filtro usa busca/autocompletar (buscarCidades).
  const [ufs, segmentos] = await Promise.all([
    prisma.concreteiraCandidataUnidade.findMany({
      where: { uf: { not: null } }, distinct: ["uf"], select: { uf: true }, orderBy: { uf: "asc" },
    }),
    prisma.segmentoEmpresa.findMany({ where: { ativo: true }, select: { slug: true, nome: true }, orderBy: { ordem: "asc" } }),
  ]);
  return { ufs: ufs.map(u => u.uf as string), segmentos };
}

/** Autocompletar de cidades: no máximo `limite` resultados, filtrados por UF e texto. */
export async function buscarCidades(uf: string | undefined, termo: string, limite = 20) {
  const linhas = await prisma.concreteiraCandidataUnidade.findMany({
    where: {
      municipioNome: termo ? { contains: termo, mode: "insensitive" } : { not: null },
      ...(uf ? { uf } : {}),
    },
    distinct: ["municipioNome", "uf"],
    select: { municipioNome: true, uf: true },
    orderBy: [{ municipioNome: "asc" }],
    take: limite,
  });
  return linhas.map(l => ({ cidade: l.municipioNome as string, uf: l.uf }));
}

const selectLinha = {
  id: true,
  cnpjBasico: true,
  cnpjMatriz: true,
  razaoSocial: true,
  nomeFantasia: true,
  ufMatriz: true,
  municipioMatriz: true,
  statusValidacao: true,
  tipoAtividade: true,
  confianca: true,
  ultimaVerificacaoEm: true,
  totalUnidades: true,
  totalUnidadesAtivas: true,
  empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
  _count: { select: { evidencias: true, unidades: true } },
} as const;

export type LinhaCandidata = Awaited<ReturnType<typeof listarCandidatas>>["linhas"][number];

export async function listarCandidatas(f: FiltrosBase, pagina: number, porPagina: number) {
  const where = montarWhere(f);
  const total = await prisma.concreteiraCandidata.count({ where });
  let linhas;
  if (total <= LIMITE_ORDENACAO_ACENTOS) {
    // Ordenação correta com acentos: busca só id + nome dos resultados, ordena e pagina.
    const chaves = await prisma.concreteiraCandidata.findMany({ where, select: { id: true, razaoSocial: true } });
    const ids = ordenarPorNome(chaves).slice((pagina - 1) * porPagina, pagina * porPagina).map(c => c.id);
    const porId = new Map((await prisma.concreteiraCandidata.findMany({ where: { id: { in: ids } }, select: selectLinha })).map(l => [l.id, l]));
    linhas = ids.map(id => porId.get(id)).filter((l): l is NonNullable<typeof l> => Boolean(l));
  } else {
    linhas = await prisma.concreteiraCandidata.findMany({
      where,
      select: selectLinha,
      orderBy: [{ razaoSocial: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    });
  }
  const tipos = linhas.length
    ? await prisma.concreteiraCandidataUnidade.groupBy({
        by: ["candidataId", "tipoUnidade"],
        where: { candidataId: { in: linhas.map(l => l.id) } },
        _count: { _all: true },
      })
    : [];
  const tiposPor = new Map<string, Array<{ tipo: string; n: number }>>();
  for (const t of tipos) {
    const arr = tiposPor.get(t.candidataId) ?? [];
    arr.push({ tipo: t.tipoUnidade, n: t._count._all });
    tiposPor.set(t.candidataId, arr);
  }
  return {
    total,
    linhas: linhas.map(l => ({ ...l, tiposUnidade: tiposPor.get(l.id) ?? [] })),
  };
}

/** Linhas para exportação (limitadas; nunca a base inteira sem filtro além do limite). */
export async function linhasParaExportar(f: FiltrosBase, limite: number) {
  const where = montarWhere(f);
  const [total, linhas] = await Promise.all([
    prisma.concreteiraCandidata.count({ where }),
    prisma.concreteiraCandidata.findMany({
      where, select: selectLinha, orderBy: [{ ufMatriz: "asc" }, { municipioMatriz: "asc" }, { razaoSocial: "asc" }], take: limite,
    }),
  ]);
  return { total, linhas: ordenarParaRelatorio(linhas) };
}

export async function fichaCandidata(id: string) {
  const c = await prisma.concreteiraCandidata.findUnique({
    where: { id },
    include: {
      unidades: { orderBy: [{ isMatriz: "desc" }, { cnpj: "asc" }] },
      evidencias: { orderBy: { coletadoEm: "desc" }, include: { registradoPor: { select: { nome: true } } } },
      historico: { orderBy: { createdAt: "desc" }, include: { usuario: { select: { nome: true } } } },
      empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, cidade: true, estado: true } },
      empresaSugerida: { select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, cidade: true, estado: true } },
      validadoPor: { select: { nome: true } },
    },
  });
  if (!c) return null;

  const [registrosReceita, mudancas] = await Promise.all([
    prisma.receitaEstabelecimento.findMany({
      where: { cnpjBasico: c.cnpjBasico },
      include: { competencia: { select: { competencia: true } } },
      orderBy: [{ cnpj: "asc" }],
    }),
    prisma.receitaMudanca.findMany({
      where: { cnpjBasico: c.cnpjBasico },
      include: { competencia: { select: { competencia: true } }, competenciaAnterior: { select: { competencia: true } } },
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);
  const competencias = [...new Set(registrosReceita.map(r => r.competencia.competencia))].sort().reverse();

  return { c, registrosReceita, competencias, mudancas, correspondencias: await correspondenciasPossiveis(c) };
}

/**
 * Possíveis Empresas correspondentes no CRM — SOMENTE sugestão, nunca grava nada.
 * 1º por CNPJ (normalizado, mesma raiz); 2º por nome normalizado + UF.
 */
async function correspondenciasPossiveis(c: { cnpjBasico: string; razaoSocial: string | null; nomeFantasia: string | null; ufMatriz: string | null }) {
  const porCnpj = await prisma.$queryRaw<Array<{ id: string; razaoSocial: string; nomeFantasia: string | null; cnpj: string | null; cidade: string | null; estado: string | null }>>`
    SELECT id, "razaoSocial", "nomeFantasia", cnpj, cidade, estado FROM "Empresa"
    WHERE cnpj IS NOT NULL AND left(regexp_replace(cnpj, '\\D', '', 'g'), 8) = ${c.cnpjBasico}
    LIMIT 5`;
  const chave = normalizarNomeEmpresa(c.nomeFantasia || c.razaoSocial).split(" ").filter(p => p.length >= 4)[0];
  const porNome = chave
    ? await prisma.empresa.findMany({
        where: {
          OR: [{ razaoSocial: { contains: chave, mode: "insensitive" } }, { nomeFantasia: { contains: chave, mode: "insensitive" } }],
        },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, cidade: true, estado: true },
        take: 5,
      })
    : [];
  const vistos = new Set(porCnpj.map(e => e.id));
  return [
    ...porCnpj.map(e => ({ ...e, criterio: "CNPJ (mesma raiz)" })),
    ...porNome.filter(e => !vistos.has(e.id)).map(e => ({ ...e, criterio: e.estado && e.estado === c.ufMatriz ? "Nome + mesma UF" : "Nome parecido" })),
  ];
}
