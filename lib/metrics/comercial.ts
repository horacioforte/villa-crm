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
  VALOR_FINANCEIRO_MINIMO_REAL,
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

/**
 * Pipeline Potencial: soma de potencialOportunidade em estágios abertos.
 *
 * Ignora valores abaixo de VALOR_FINANCEIRO_MINIMO_REAL — confirmado em
 * produção (18/08/2026): oportunidades do Radar João apareceram com
 * potencialOportunidade = "1" e "2000", placeholders de digitação, não
 * potencial real.
 */
export async function getPipelinePotencial(
  filtros: PipelineFiltros = {},
): Promise<{ total: number; quantidade: number }> {
  const where = buildOportunidadeWhere(filtros, {
    status: { in: PIPELINE_ABERTO_STATUSES as StatusOportunidade[] },
    potencialOportunidade: { gte: VALOR_FINANCEIRO_MINIMO_REAL },
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
 * Pipeline Proposto: soma das propostas vigentes de oportunidades ABERTAS.
 *
 * CORRIGIDO EM 18/08/2026: a versão anterior não restringia por status da
 * oportunidade. Testado ao vivo e comprovado incorreto — hoje 100% das
 * propostas vigentes em produção pertencem a oportunidades já GANHA/PERDIDA;
 * nenhuma oportunidade aberta tem proposta. Sem esse filtro, "Pipeline
 * Proposto" mostrava dinheiro de negócios já fechados como se fosse "em
 * disputa agora" — exatamente o que a definição oficial do BI Executivo
 * (Villa) exige excluir.
 */
export async function getPipelineProposto(
  filtros: PipelineFiltros = {},
): Promise<{ total: number; quantidade: number }> {
  const oportunidadeWhere = buildOportunidadeWhere(filtros, {
    status: { in: PIPELINE_ABERTO_STATUSES as StatusOportunidade[] },
  });

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

  // Placeholder técnico (ex.: R$ 1) nunca conta como valor financeiro real.
  const vigentes = selecionarPropostasVigentes(
    propostas as unknown as PropostaVigenteInput[],
  ).filter((proposta) => Number(proposta.valorTotal) >= VALOR_FINANCEIRO_MINIMO_REAL);

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

  const [vigente] = selecionarPropostasVigentes(propostas as unknown as PropostaVigenteInput[])
    .filter((proposta) => Number(proposta.valorTotal) >= VALOR_FINANCEIRO_MINIMO_REAL)
    .sort((a, b) => b.versao - a.versao);

  if (!vigente) return null;

  return {
    valorTotal: Number(vigente.valorTotal),
    numeroProposta: vigente.numeroProposta,
    status: vigente.status as StatusPropostaComercial,
  };
}

/** where "estoque atual" — sem filtro de data. Pipeline Potencial/Proposto/funil
 * são fotografias de agora; o filtro de período do BI só faz sentido para
 * métricas de MOVIMENTO (novas, ganhas, perdidas — filtradas por fechadaEm/
 * createdAt na própria função), nunca para "quanto está aberto agora". */
function baseWhereEstoque(filtros: PipelineFiltros): Prisma.OportunidadeWhereInput {
  return {
    ativa: true,
    ...oportunidadeAccessWhere(filtros.user),
    ...(filtros.responsavelId ? { responsavelId: filtros.responsavelId } : {}),
    ...(filtros.empresaId ? { empresaId: filtros.empresaId } : {}),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
  };
}

const PROPOSTA_VIGENTE_APROX: Prisma.PropostaComercialWhereInput = {
  ativa: true,
  valorTotal: { gte: VALOR_FINANCEIRO_MINIMO_REAL },
  status: { notIn: propostaStatusExcluidosPrisma },
};

/**
 * Funil Comercial (Bloco 2 do BI Executivo): Abertas → Com Proposta →
 * Em Negociação → Ganhas no período.
 *
 * Documentação da regra (pedida explicitamente na aprovação): Abertas, Com
 * Proposta e Em Negociação são ESTOQUE — quantas oportunidades estão em cada
 * etapa agora, sem filtro de período. "Ganhas no período" é a única métrica de
 * MOVIMENTO do funil (filtrada por fechadaEm), por isso NÃO vira uma taxa em
 * relação a "Em Negociação" (populações diferentes — testado ao vivo: essa
 * razão chegou a 600% porque "ganhas" acumula histórico e "em negociação" é
 * uma fotografia pequena de agora. As duas ficam lado a lado, sem percentual
 * entre elas). "Com proposta" usa a mesma seleção de vigente de
 * getPipelineProposto (ativa=true com fallback de maior versão), contando
 * oportunidades distintas — por isso os dois números sempre batem.
 */
export async function getFunilComercial(filtros: PipelineFiltros = {}) {
  const where = baseWhereEstoque(filtros);
  const abertoStatuses = PIPELINE_ABERTO_STATUSES as StatusOportunidade[];
  const whereAbertas = { ...where, status: { in: abertoStatuses } };

  const [abertas, propostasAbertas, emNegociacao, ganhasNoPeriodo] = await Promise.all([
    prisma.oportunidade.count({ where: whereAbertas }),
    prisma.propostaComercial.findMany({
      where: {
        status: { notIn: propostaStatusExcluidosPrisma },
        oportunidade: { is: whereAbertas },
      },
      select: {
        oportunidadeId: true,
        numeroProposta: true,
        versao: true,
        ativa: true,
        status: true,
        valorTotal: true,
      },
    }),
    prisma.oportunidade.count({ where: { ...where, status: StatusOportunidade.NEGOCIACAO } }),
    prisma.oportunidade.count({
      where: {
        ...where,
        status: StatusOportunidade.GANHA,
        ...(filtros.dataInicio || filtros.dataFim
          ? {
              fechadaEm: {
                ...(filtros.dataInicio ? { gte: filtros.dataInicio } : {}),
                ...(filtros.dataFim ? { lte: filtros.dataFim } : {}),
              },
            }
          : {}),
      },
    }),
  ]);

  const vigentes = selecionarPropostasVigentes(
    propostasAbertas as unknown as PropostaVigenteInput[],
  ).filter((proposta) => Number(proposta.valorTotal) >= VALOR_FINANCEIRO_MINIMO_REAL);
  const comProposta = new Set(
    vigentes.map((p) => (p as unknown as { oportunidadeId: string }).oportunidadeId),
  ).size;

  return {
    abertas,
    comProposta,
    emNegociacao,
    ganhasNoPeriodo,
    taxaAbertasParaProposta: abertas > 0 ? comProposta / abertas : 0,
    taxaPropostaParaNegociacao: comProposta > 0 ? emNegociacao / comProposta : 0,
  };
}

/**
 * Pipeline por Estágio (Bloco 4): decompõe o Pipeline Proposto (valor das
 * propostas vigentes) pelo estágio da oportunidade — só faz sentido para
 * PROPOSTA_ENVIADA e NEGOCIACAO, os dois estágios onde uma proposta vigente
 * normalmente existe. Inclui ticket médio e quantidade.
 */
export async function getPipelinePorEstagio(filtros: PipelineFiltros = {}) {
  const where = baseWhereEstoque(filtros);

  const propostas = await prisma.propostaComercial.findMany({
    where: {
      status: { notIn: propostaStatusExcluidosPrisma },
      oportunidade: {
        is: { ...where, status: { in: ["PROPOSTA_ENVIADA", "NEGOCIACAO"] as StatusOportunidade[] } },
      },
    },
    select: {
      numeroProposta: true,
      versao: true,
      ativa: true,
      status: true,
      valorTotal: true,
      oportunidade: { select: { status: true } },
    },
  });

  const vigentes = selecionarPropostasVigentes(
    propostas as unknown as (PropostaVigenteInput & { oportunidade: { status: string } })[],
  ).filter((proposta) => Number(proposta.valorTotal) >= VALOR_FINANCEIRO_MINIMO_REAL);

  const porEstagio = (["PROPOSTA_ENVIADA", "NEGOCIACAO"] as const).map((estagio) => {
    const doEstagio = vigentes.filter((p) => p.oportunidade.status === estagio);
    const valor = doEstagio.reduce((soma, p) => soma + Number(p.valorTotal), 0);
    return { estagio, quantidade: doEstagio.length, valor };
  });

  const totalProposto = porEstagio.reduce((soma, e) => soma + e.valor, 0);
  const totalQuantidade = porEstagio.reduce((soma, e) => soma + e.quantidade, 0);

  return {
    porEstagio: porEstagio.map((e) => ({
      ...e,
      percentual: totalProposto > 0 ? e.valor / totalProposto : 0,
    })),
    ticketMedio: totalQuantidade > 0 ? totalProposto / totalQuantidade : 0,
    quantidadeComProposta: totalQuantidade,
  };
}

/**
 * Oportunidades Estratégicas sem Proposta (Bloco 6): marcação manual
 * (Oportunidade.estrategica), abertas, sem nenhuma proposta vigente real.
 * Nunca inclui valor financeiro fictício — a tela decide como exibir "sem
 * proposta" (não mostrar R$ nenhum, nunca um placeholder tipo R$ 1).
 */
export async function getOportunidadesEstrategicasSemProposta(
  filtros: PipelineFiltros = {},
  limite = 5,
) {
  const where = baseWhereEstoque(filtros);
  const abertoStatuses = PIPELINE_ABERTO_STATUSES as StatusOportunidade[];

  return prisma.oportunidade.findMany({
    where: {
      ...where,
      status: { in: abertoStatuses },
      estrategica: true,
      propostas: { none: PROPOSTA_VIGENTE_APROX },
    },
    orderBy: { updatedAt: "asc" },
    take: limite,
    select: {
      id: true,
      titulo: true,
      status: true,
      updatedAt: true,
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      obra: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      tarefas: {
        where: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] } },
        orderBy: { dataVencimento: "asc" },
        take: 1,
        select: { titulo: true, dataVencimento: true },
      },
    },
  });
}

type StatusSnapshot = { at: Date; status: string };

/**
 * Reconstrói, a partir do AuditLog real (nunca fabricado), quantas
 * oportunidades estavam ABERTAS no fim de cada mês desde que o CRM existe.
 *
 * Confirmado em produção (18/08/2026): a oportunidade mais antiga é de
 * 28/05/2026 — hoje isso cobre só ~3 meses reais, não 6. A função devolve
 * exatamente os meses que existem; a tela não deve preencher os meses
 * anteriores com zero (isso pareceria dado real e não é).
 */
export async function getEvolucaoOportunidadesAbertas(filtros: PipelineFiltros = {}) {
  const where = baseWhereEstoque(filtros);
  const abertoStatuses = new Set<string>(PIPELINE_ABERTO_STATUSES as string[]);

  const [oportunidades, eventos] = await Promise.all([
    prisma.oportunidade.findMany({ where, select: { id: true, createdAt: true } }),
    // Filtra por oportunidade dentro do loop abaixo (ids só existem após a
    // primeira query); volume é baixo (centenas de eventos), sem custo real.
    prisma.auditLog.findMany({
      where: {
        entity: "Oportunidade",
        action: { in: ["OPORTUNIDADE_CREATED", "OPORTUNIDADE_STATUS_CHANGED"] },
      },
      select: { entityId: true, action: true, after: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (oportunidades.length === 0) return [];

  const ids = new Set(oportunidades.map((o) => o.id));
  const timelinePorId = new Map<string, StatusSnapshot[]>();
  for (const evento of eventos) {
    if (!evento.entityId || !ids.has(evento.entityId)) continue;
    const status = (evento.after as { status?: string } | null)?.status;
    if (!status) continue;
    const lista = timelinePorId.get(evento.entityId) ?? [];
    lista.push({ at: evento.createdAt, status });
    timelinePorId.set(evento.entityId, lista);
  }

  const inicio = oportunidades.reduce(
    (min, o) => (o.createdAt < min ? o.createdAt : min),
    oportunidades[0].createdAt,
  );
  const hoje = new Date();
  const meses: Array<{ label: string; fimDoMes: Date }> = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  while (cursor <= hoje) {
    const fimDoMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    meses.push({
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
        .format(cursor)
        .replace(".", ""),
      fimDoMes: fimDoMes > hoje ? hoje : fimDoMes,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return meses.map(({ label, fimDoMes }) => {
    let quantidade = 0;
    for (const oportunidade of oportunidades) {
      if (oportunidade.createdAt > fimDoMes) continue;
      const timeline = timelinePorId.get(oportunidade.id) ?? [];
      const ultimaAntes = [...timeline]
        .filter((evt) => evt.at <= fimDoMes)
        .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
      const status = ultimaAntes?.status ?? "NOVA";
      if (abertoStatuses.has(status)) quantidade += 1;
    }
    return { mes: label, quantidade };
  });
}

/**
 * Reconstrói Contratado vs Perdido por mês.
 *
 * A DATA de cada fechamento vem do AuditLog (evento real de transição para
 * GANHA/PERDIDA — não fabricado). O VALOR vem do estado ATUAL da oportunidade
 * no banco, não do snapshot capturado no momento da transição.
 *
 * Motivo (achado ao testar ao vivo em 18/08/2026): o valor do contrato costuma
 * ser preenchido numa edição POSTERIOR à transição de status (ex.: marcar
 * GANHA primeiro, digitar o valor exato do contrato depois, às vezes dias
 * depois) — usar o snapshot da transição em si mostrava R$ 0 em todos os
 * meses, mesmo com contratos reais fechados. O valor atual é o mais correto
 * disponível hoje; a data da transição continua sendo o dado real de quando
 * o negócio fechou.
 */
export async function getEvolucaoResultadoComercial(filtros: PipelineFiltros = {}) {
  const where = baseWhereEstoque(filtros);
  const oportunidades = await prisma.oportunidade.findMany({
    where: { ...where, status: { in: ["GANHA", "PERDIDA"] as StatusOportunidade[] } },
    select: { id: true, status: true, valorContrato: true, potencialOportunidade: true },
  });
  if (oportunidades.length === 0) return [];
  const porId = new Map(oportunidades.map((o) => [o.id, o]));

  const eventos = await prisma.auditLog.findMany({
    where: {
      entity: "Oportunidade",
      action: "OPORTUNIDADE_STATUS_CHANGED",
      entityId: { in: Array.from(porId.keys()) },
    },
    select: { entityId: true, after: true, before: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  type Fechamento = { at: Date; tipo: "GANHA" | "PERDIDA"; valor: number };
  const fechamentosPorOportunidade = new Map<string, Fechamento>();

  for (const evento of eventos) {
    const oportunidade = evento.entityId ? porId.get(evento.entityId) : undefined;
    if (!oportunidade) continue;
    const before = (evento.before as { status?: string } | null)?.status;
    const after = (evento.after as { status?: string } | null)?.status;
    if (!after || before === after) continue;
    if (after !== "GANHA" && after !== "PERDIDA") continue;
    if (after !== oportunidade.status) continue; // ignora transições intermediárias/reaberturas
    // primeira transição para o status final atual
    if (fechamentosPorOportunidade.has(evento.entityId!)) continue;

    const valorAtual =
      oportunidade.status === "GANHA" ? oportunidade.valorContrato : oportunidade.potencialOportunidade;
    const valor = Number(valorAtual ?? 0);
    if (valor < VALOR_FINANCEIRO_MINIMO_REAL) continue;

    fechamentosPorOportunidade.set(evento.entityId!, {
      at: evento.createdAt,
      tipo: oportunidade.status as "GANHA" | "PERDIDA",
      valor,
    });
  }

  const fechamentos = Array.from(fechamentosPorOportunidade.values());
  if (fechamentos.length === 0) return [];

  const inicio = fechamentos.reduce((min, f) => (f.at < min ? f.at : min), fechamentos[0].at);
  const hoje = new Date();
  const meses: Array<{ label: string; ano: number; mes: number }> = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  while (cursor <= hoje) {
    meses.push({
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" })
        .format(cursor)
        .replace(".", ""),
      ano: cursor.getFullYear(),
      mes: cursor.getMonth(),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return meses.map(({ label, ano, mes }) => {
    const doMes = fechamentos.filter((f) => f.at.getFullYear() === ano && f.at.getMonth() === mes);
    return {
      mes: label,
      contratado: doMes.filter((f) => f.tipo === "GANHA").reduce((s, f) => s + f.valor, 0),
      perdido: doMes.filter((f) => f.tipo === "PERDIDA").reduce((s, f) => s + f.valor, 0),
    };
  });
}
