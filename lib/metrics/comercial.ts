// ARQUIVO: lib/metrics/comercial.ts
// Camada central de métricas comerciais — Fase 0 (Governança dos Indicadores).
// Fonte única de verdade para Pipeline Potencial, Proposto, Contratado, funil e
// taxa de conversão. Dashboard, Kanban, Relatórios, Saúde Comercial, BI e CRM IA
// devem consumir estas funções em vez de reimplementar a fórmula.
//
// Regras (aprovadas em 17/08/2026):
// - Pipeline Potencial: soma de potencialOportunidade em oportunidades ABERTAS
//   (ver PIPELINE_ABERTO_STATUSES). GANHA, PERDIDA e PRE_QUALIFICADA ficam fora.
// - Pipeline Proposto: soma das propostas vigentes (campo `ativa`, com fallback
//   para a maior versão do mesmo numeroProposta) — nunca soma duas versões da
//   mesma proposta independente. Não é restrito por status da oportunidade
//   (mesma convenção já usada no Dashboard e em lib/relatorios/data.ts).
// - Pipeline Contratado: soma de valorContrato em oportunidades GANHA, por
//   fechadaEm quando um período é informado.
// - Investimento do empreendimento (inteligência de mercado, ex.: os R$ 11 bi
//   de um projeto encontrado pelo João) mora em DossieComercial.valorEstimado e
//   NUNCA é somado a nenhum destes indicadores.

import {
  type PapelUsuario,
  type Prisma,
  StatusOportunidade,
  StatusPropostaComercial,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PIPELINE_ABERTO_STATUSES,
  PROPOSTA_STATUS_EXCLUIDOS,
} from "@/lib/metrics/constants";
import {
  selecionarPropostasVigentes,
  type PropostaVigenteInput,
} from "@/lib/metrics/proposta-vigente";

export type MetricsUser = { id: string; papel: PapelUsuario };

export type PeriodoFiltro = {
  dataInicio?: Date;
  dataFim?: Date;
};

export type PipelineFiltros = PeriodoFiltro & {
  responsavelId?: string;
  empresaId?: string;
  tipo?: "LOCACAO" | "EQUIPAMENTO_USADO";
  user?: MetricsUser;
};

const propostaStatusExcluidosPrisma =
  PROPOSTA_STATUS_EXCLUIDOS as unknown as StatusPropostaComercial[];

/** Mesmo padrão de escopo por papel já usado em lib/relatorios/data.ts e no Dashboard. */
export function oportunidadeAccessWhere(
  user?: MetricsUser,
): Prisma.OportunidadeWhereInput {
  if (!user || user.papel !== "COMERCIAL") {
    return {};
  }

  return {
    OR: [{ responsavelId: user.id }, { createdById: user.id }],
  };
}

function buildOportunidadeWhere(
  filtros: PipelineFiltros,
  extra: Prisma.OportunidadeWhereInput = {},
): Prisma.OportunidadeWhereInput {
  return {
    ativa: true,
    ...oportunidadeAccessWhere(filtros.user),
    ...(filtros.responsavelId ? { responsavelId: filtros.responsavelId } : {}),
    ...(filtros.empresaId ? { empresaId: filtros.empresaId } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? {
          createdAt: {
            ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
            ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
          },
        }
      : {}),
    ...extra,
  };
}

/** Pipeline Potencial: soma de potencialOportunidade em estágios abertos. */
export async function getPipelinePotencial(
  filtros: PipelineFiltros = {},
): Promise<{ total: number; quantidade: number }> {
  const where = buildOportunidadeWhere(filtros, {
    status: { in: PIPELINE_ABERTO_STATUSES as StatusOportunidade[] },
    potencialOportunidade: { not: null },
  });

  const [aggregate, quantidade] = await Promise.all([
    prisma.oportunidade.aggregate({ where, _sum: { potencialOportunidade: true } }),
    prisma.oportunidade.count({ where }),
  ]);

  return {
    total: Number(aggregate._sum.potencialOportunidade ?? 0),
    quantidade,
  };
}

/**
 * Pipeline Proposto: soma das propostas vigentes ligadas a oportunidades no
 * escopo informado. Não restringe por status da oportunidade — uma proposta
 * vigente continua "proposta" mesmo que o negócio já tenha fechado ou sido
 * perdido; Potencial, Proposto e Contratado são leituras independentes.
 */
export async function getPipelineProposto(
  filtros: PipelineFiltros = {},
): Promise<{ total: number; quantidade: number }> {
  const oportunidadeWhere = buildOportunidadeWhere(filtros);

  const propostas = await prisma.propostaComercial.findMany({
    where: {
      status: { notIn: propostaStatusExcluidosPrisma },
      oportunidade: { is: oportunidadeWhere },
    },
    select: {
      numeroProposta: true,
      versao: true,
      ativa: true,
      status: true,
      valorTotal: true,
    },
  });

  const vigentes = selecionarPropostasVigentes(
    propostas as unknown as PropostaVigenteInput[],
  );

  return {
    total: vigentes.reduce((soma, proposta) => soma + Number(proposta.valorTotal), 0),
    quantidade: vigentes.length,
  };
}

/**
 * Pipeline Contratado: soma de valorContrato em oportunidades GANHA. O período,
 * quando informado, filtra por fechadaEm (não por createdAt — uma oportunidade
 * pode ter sido criada num mês e fechada em outro).
 */
export async function getPipelineContratado(
  filtros: PipelineFiltros = {},
): Promise<{ total: number; quantidade: number }> {
  const where: Prisma.OportunidadeWhereInput = {
    ativa: true,
    ...oportunidadeAccessWhere(filtros.user),
    ...(filtros.responsavelId ? { responsavelId: filtros.responsavelId } : {}),
    ...(filtros.empresaId ? { empresaId: filtros.empresaId } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    status: StatusOportunidade.GANHA,
    valorContrato: { not: null },
    ...(filtros.dataInicio || filtros.dataFim
      ? {
          fechadaEm: {
            ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
            ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
          },
        }
      : {}),
  };

  const [aggregate, quantidade] = await Promise.all([
    prisma.oportunidade.aggregate({ where, _sum: { valorContrato: true } }),
    prisma.oportunidade.count({ where }),
  ]);

  return {
    total: Number(aggregate._sum.valorContrato ?? 0),
    quantidade,
  };
}

/** Funil por estágio: quantidade + valor potencial, todos os status (para visão completa). */
export async function getFunilPorEstagio(filtros: PipelineFiltros = {}) {
  const where = buildOportunidadeWhere(filtros);

  const grupos = await prisma.oportunidade.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
    _sum: { potencialOportunidade: true },
  });

  return grupos.map((grupo) => ({
    status: grupo.status,
    quantidade: grupo._count._all,
    valorPotencial: Number(grupo._sum.potencialOportunidade ?? 0),
    aberto: (PIPELINE_ABERTO_STATUSES as string[]).includes(grupo.status),
  }));
}

/**
 * Ganhos, perdas e taxa de conversão de um período.
 * Fórmula: taxaConversao = GANHA / (GANHA + PERDIDA), ambos com fechadaEm no período.
 * Oportunidades ainda abertas no fim do período não entram no denominador.
 */
export async function getGanhosPerdas(filtros: PipelineFiltros = {}) {
  const periodoWhere: Prisma.OportunidadeWhereInput =
    filtros.dataInicio || filtros.dataFim
      ? {
          fechadaEm: {
            ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
            ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
          },
        }
      : {};

  const baseWhere: Prisma.OportunidadeWhereInput = {
    ativa: true,
    ...oportunidadeAccessWhere(filtros.user),
    ...(filtros.responsavelId ? { responsavelId: filtros.responsavelId } : {}),
    ...(filtros.empresaId ? { empresaId: filtros.empresaId } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...periodoWhere,
  };

  const [ganhas, perdidas] = await Promise.all([
    prisma.oportunidade.aggregate({
      where: { ...baseWhere, status: StatusOportunidade.GANHA },
      _count: { _all: true },
      _sum: { valorContrato: true },
    }),
    prisma.oportunidade.aggregate({
      where: { ...baseWhere, status: StatusOportunidade.PERDIDA },
      _count: { _all: true },
      _sum: { potencialOportunidade: true },
    }),
  ]);

  const totalDecididas = ganhas._count._all + perdidas._count._all;

  return {
    ganhas: { quantidade: ganhas._count._all, valor: Number(ganhas._sum.valorContrato ?? 0) },
    perdidas: { quantidade: perdidas._count._all, valor: Number(perdidas._sum.potencialOportunidade ?? 0) },
    taxaConversao: totalDecididas > 0 ? ganhas._count._all / totalDecididas : 0,
  };
}

/**
 * Proposta vigente de UMA oportunidade — versão canônica única. Substitui a
 * lógica anterior (createdAt desc, sem checar `ativa`) usada em
 * lib/propostas/utils.ts e nos includes de /api/oportunidades.
 */
export async function getPropostaVigenteDaOportunidade(
  oportunidadeId: string,
): Promise<{ valorTotal: number; numeroProposta: string; status: StatusPropostaComercial } | null> {
  const propostas = await prisma.propostaComercial.findMany({
    where: {
      oportunidadeId,
      status: { notIn: propostaStatusExcluidosPrisma },
    },
    select: {
      numeroProposta: true,
      versao: true,
      ativa: true,
      status: true,
      valorTotal: true,
    },
  });

  const [vigente] = selecionarPropostasVigentes(propostas as unknown as PropostaVigenteInput[]).sort(
    (a, b) => b.versao - a.versao,
  );

  if (!vigente) return null;

  return {
    valorTotal: Number(vigente.valorTotal),
    numeroProposta: vigente.numeroProposta,
    status: vigente.status as StatusPropostaComercial,
  };
}
