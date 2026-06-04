import { NextResponse } from "next/server";

import {
  PapelUsuario,
  StatusOportunidade,
  StatusPropostaComercial,
  StatusTarefa,
  type Prisma,
} from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const openOpportunityStatuses = [
  StatusOportunidade.NOVA,
  StatusOportunidade.EM_ATENDIMENTO,
  StatusOportunidade.PROPOSTA_ENVIADA,
  StatusOportunidade.NEGOCIACAO,
];
const activeTaskStatuses = [StatusTarefa.PENDENTE, StatusTarefa.EM_ANDAMENTO];
const activeTaskStatusSet = new Set<StatusTarefa>(activeTaskStatuses);

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function differenceInDays(from: Date, to = new Date()) {
  const oneDay = 1000 * 60 * 60 * 24;
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / oneDay));
}

function getPeriodRange(periodo: string | null) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  if (periodo === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (periodo === "90d") {
    start.setDate(start.getDate() - 90);
  } else {
    start.setDate(start.getDate() - 30);
  }
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

function getPreviousRange(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return { previousStart, previousEnd };
}

function getAccessWhere(authResult: { id: string; papel: PapelUsuario }) {
  return authResult.papel === PapelUsuario.COMERCIAL
    ? { OR: [{ responsavelId: authResult.id }, { createdById: authResult.id }] }
    : {};
}

function buildOpportunityWhere(
  searchParams: URLSearchParams,
  authResult: { id: string; papel: PapelUsuario },
): Prisma.OportunidadeWhereInput {
  const vendedorId = searchParams.get("vendedorId");
  const gerenteId = searchParams.get("gerenteId");
  const filialId = searchParams.get("filialId");
  const accessWhere = getAccessWhere(authResult);
  const responsavelId =
    authResult.papel === PapelUsuario.COMERCIAL
      ? authResult.id
      : vendedorId || gerenteId || undefined;
  const filters: Prisma.OportunidadeWhereInput[] = [];

  if (Object.keys(accessWhere).length > 0) {
    filters.push(accessWhere);
  }

  if (filialId) {
    filters.push({
      OR: [
        { empresa: { filialId } },
        { obra: { filialId } },
        { responsavel: { filialId } },
      ],
    });
  }

  return {
    ativa: true,
    status: { in: openOpportunityStatuses },
    ...(responsavelId ? { responsavelId } : {}),
    ...(filters.length > 0 ? { AND: filters } : {}),
  };
}

function getCompanyName(item: {
  empresa: { razaoSocial: string; nomeFantasia: string | null };
}) {
  return item.empresa.nomeFantasia ?? item.empresa.razaoSocial;
}

function getNullableCompanyName(item: {
  empresa: { razaoSocial: string; nomeFantasia: string | null } | null;
}) {
  return item.empresa
    ? (item.empresa.nomeFantasia ?? item.empresa.razaoSocial)
    : "Sem empresa";
}

function getHealthColor(days: number) {
  if (days <= 5) return "verde";
  if (days <= 10) return "amarelo";
  return "vermelho";
}

function getOperationalHealth(score: number) {
  if (score >= 85) {
    return { status: "excelente", label: "Excelente", color: "verde" };
  }

  if (score >= 65) {
    return { status: "atencao", label: "Atenção", color: "amarelo" };
  }

  return { status: "critico", label: "Crítico", color: "vermelho" };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const authResult =
    cronSecret && authHeader === `Bearer ${cronSecret}`
      ? { id: "cron", papel: PapelUsuario.ADMIN }
      : await requirePermission("relatorios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const hoje = startOfToday();
  const { start, end } = getPeriodRange(searchParams.get("periodo"));
  const { previousStart, previousEnd } = getPreviousRange(start, end);
  const oportunidadeWhere = buildOpportunityWhere(searchParams, authResult);
  const tarefaWhereBase: Prisma.TarefaWhereInput = {
    ...(authResult.papel === PapelUsuario.COMERCIAL
      ? { responsavelId: authResult.id }
      : {}),
    ...(searchParams.get("vendedorId") && authResult.papel !== PapelUsuario.COMERCIAL
      ? { responsavelId: searchParams.get("vendedorId") ?? undefined }
      : {}),
    ...(searchParams.get("filialId")
      ? {
          OR: [
            { empresa: { filialId: searchParams.get("filialId") ?? undefined } },
            { obra: { filialId: searchParams.get("filialId") ?? undefined } },
            { responsavel: { filialId: searchParams.get("filialId") ?? undefined } },
          ],
        }
      : {}),
  };

  const [
    usuarios,
    filiais,
    oportunidadesAbertas,
    tarefasVencidas,
    tarefasPeriodo,
    propostasEnviadas,
  ] = await Promise.all([
    prisma.usuario.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        papel: true,
        filialId: true,
        filial: { select: { id: true, nome: true } },
      },
    }),
    prisma.filial.findMany({
      where: { ativa: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.oportunidade.findMany({
      where: oportunidadeWhere,
      orderBy: { updatedAt: "asc" },
      include: {
        empresa: { select: { razaoSocial: true, nomeFantasia: true } },
        obra: { select: { nome: true } },
        responsavel: { select: { id: true, nome: true } },
        tarefas: {
          orderBy: { dataVencimento: "asc" },
          select: {
            id: true,
            titulo: true,
            status: true,
            dataVencimento: true,
            concluidaEm: true,
            responsavel: { select: { id: true, nome: true } },
          },
        },
        historicos: {
          orderBy: { dataContato: "desc" },
          take: 1,
          select: {
            dataContato: true,
            tipo: true,
            resumo: true,
          },
        },
        propostas: {
          where: {
            status: {
              in: [
                StatusPropostaComercial.ENVIADA,
                StatusPropostaComercial.APROVADA,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, status: true },
        },
      },
    }),
    prisma.tarefa.findMany({
      where: {
        ...tarefaWhereBase,
        status: { in: activeTaskStatuses },
        dataVencimento: { lt: hoje },
      },
      orderBy: { dataVencimento: "asc" },
      include: {
        responsavel: { select: { id: true, nome: true } },
        empresa: { select: { razaoSocial: true, nomeFantasia: true } },
        oportunidade: { select: { id: true, titulo: true } },
      },
    }),
    prisma.tarefa.findMany({
      where: {
        ...tarefaWhereBase,
        createdAt: { gte: start, lte: end },
      },
      select: {
        status: true,
        concluidaEm: true,
        createdAt: true,
        responsavel: { select: { id: true, nome: true } },
      },
    }),
    prisma.propostaComercial.findMany({
      where: {
        status: StatusPropostaComercial.ENVIADA,
        createdAt: {
          lt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
        oportunidade: { is: oportunidadeWhere },
      },
      include: {
        oportunidade: {
          include: {
            empresa: { select: { razaoSocial: true, nomeFantasia: true } },
            obra: { select: { nome: true } },
            responsavel: { select: { id: true, nome: true } },
            historicos: {
              orderBy: { dataContato: "desc" },
              take: 1,
              select: { dataContato: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const oportunidadesSemProximaAcao = oportunidadesAbertas
    .filter((oportunidade) => {
      const temProximaTarefa = oportunidade.tarefas.some(
        (tarefa) =>
          activeTaskStatusSet.has(tarefa.status) &&
          tarefa.dataVencimento >= hoje,
      );

      return !oportunidade.responsavelId || !temProximaTarefa;
    })
    .map((oportunidade) => ({
      id: oportunidade.id,
      titulo: oportunidade.titulo,
      cliente: getCompanyName(oportunidade),
      obra: oportunidade.obra?.nome ?? null,
      responsavel: oportunidade.responsavel?.nome ?? "Sem responsável",
      motivo: !oportunidade.responsavelId
        ? "Sem responsável definido"
        : "Sem tarefa futura",
    }));
  const oportunidadesSemResponsavel = oportunidadesAbertas
    .filter((oportunidade) => !oportunidade.responsavelId)
    .map((oportunidade) => ({
      id: oportunidade.id,
      titulo: oportunidade.titulo,
      cliente: getCompanyName(oportunidade),
      obra: oportunidade.obra?.nome ?? null,
    }));
  const tarefasVencidasPorUsuario = usuarios
    .filter((usuario) => usuario.papel !== PapelUsuario.OPERACIONAL)
    .map((usuario) => ({
      usuarioId: usuario.id,
      nome: usuario.nome,
      quantidade: tarefasVencidas.filter(
        (tarefa) => tarefa.responsavel?.id === usuario.id,
      ).length,
    }));
  const tarefasVencidasLista = tarefasVencidas.map((tarefa) => ({
    id: tarefa.id,
    titulo: tarefa.titulo,
    cliente: getNullableCompanyName(tarefa),
    oportunidade: tarefa.oportunidade?.titulo ?? null,
    responsavel: tarefa.responsavel?.nome ?? "Sem responsável",
    vencimento: tarefa.dataVencimento,
    diasVencida: differenceInDays(tarefa.dataVencimento),
  }));
  const propostasAguardandoRetorno = propostasEnviadas
    .filter((proposta) => {
      const ultimaInteracao =
        proposta.oportunidade.historicos[0]?.dataContato ?? proposta.createdAt;

      return differenceInDays(ultimaInteracao) > 5;
    })
    .map((proposta) => {
      const ultimaInteracao =
        proposta.oportunidade.historicos[0]?.dataContato ?? proposta.createdAt;

      return {
        id: proposta.id,
        numeroProposta: proposta.numeroProposta,
        cliente: getCompanyName(proposta.oportunidade),
        obra: proposta.oportunidade.obra?.nome ?? null,
        valor: Number(proposta.valorTotal),
        responsavel:
          proposta.oportunidade.responsavel?.nome ?? "Sem responsável",
        diasSemContato: differenceInDays(ultimaInteracao),
      };
    });
  const diasSemInteracao = oportunidadesAbertas
    .map((oportunidade) => {
      const datas = [
        oportunidade.historicos[0]?.dataContato,
        oportunidade.propostas[0]?.createdAt,
        ...oportunidade.tarefas
          .filter((tarefa) => tarefa.concluidaEm)
          .map((tarefa) => tarefa.concluidaEm),
      ].filter(Boolean) as Date[];
      const ultimaInteracao =
        datas.sort((a, b) => b.getTime() - a.getTime())[0] ?? oportunidade.createdAt;
      const dias = differenceInDays(ultimaInteracao);

      return {
        id: oportunidade.id,
        titulo: oportunidade.titulo,
        cliente: getCompanyName(oportunidade),
        responsavel: oportunidade.responsavel?.nome ?? "Sem responsável",
        dias,
        cor: getHealthColor(dias),
        ultimaInteracao,
      };
    })
    .sort((a, b) => b.dias - a.dias);
  const tarefasPorUsuario = usuarios
    .filter((usuario) => usuario.papel !== PapelUsuario.OPERACIONAL)
    .map((usuario) => {
      const tarefas = tarefasPeriodo.filter(
        (tarefa) => tarefa.responsavel?.id === usuario.id,
      );
      const concluidas = tarefas.filter(
        (tarefa) => tarefa.status === StatusTarefa.CONCLUIDA || tarefa.concluidaEm,
      ).length;

      return {
        usuarioId: usuario.id,
        nome: usuario.nome,
        criadas: tarefas.length,
        concluidas,
        taxa: tarefas.length ? Math.round((concluidas / tarefas.length) * 100) : 0,
      };
    });
  const oportunidadesComCadencia = oportunidadesAbertas.filter(
    (oportunidade) =>
      oportunidade.tarefas.some(
        (tarefa) =>
          activeTaskStatusSet.has(tarefa.status) &&
          tarefa.dataVencimento >= hoje,
      ) || (oportunidade.historicos[0]?.dataContato && differenceInDays(oportunidade.historicos[0].dataContato) <= 5),
  ).length;
  const cumprimentoCadencia = oportunidadesAbertas.length
    ? Math.round((oportunidadesComCadencia / oportunidadesAbertas.length) * 100)
    : 100;
  const oportunidadesForaCadencia =
    oportunidadesAbertas.length - oportunidadesComCadencia;
  const taxaConclusaoGeral = tarefasPeriodo.length
    ? Math.round(
        (tarefasPeriodo.filter(
          (tarefa) => tarefa.status === StatusTarefa.CONCLUIDA || tarefa.concluidaEm,
        ).length /
          tarefasPeriodo.length) *
          100,
      )
    : 0;
  const saudeScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          (oportunidadesSemProximaAcao.length /
            Math.max(oportunidadesAbertas.length, 1)) *
            30 -
          (tarefasVencidas.length / Math.max(tarefasPeriodo.length, 1)) * 25 -
          (propostasAguardandoRetorno.length /
            Math.max(propostasEnviadas.length, 1)) *
            20 -
          ((100 - cumprimentoCadencia) / 100) * 25,
      ),
    ),
  );
  const [oportunidadesBaseAnterior, tarefasPeriodoAnterior, tarefasVencidasAnterior, propostasSemRetornoAnterior] =
    await Promise.all([
      prisma.oportunidade.findMany({
        where: {
          ...oportunidadeWhere,
          createdAt: { lte: previousEnd },
        },
        select: {
          responsavelId: true,
          tarefas: {
            select: {
              status: true,
              dataVencimento: true,
            },
          },
          historicos: {
            where: { dataContato: { lte: previousEnd } },
            orderBy: { dataContato: "desc" },
            take: 1,
            select: { dataContato: true },
          },
        },
      }),
      prisma.tarefa.findMany({
        where: {
          ...tarefaWhereBase,
          createdAt: { gte: previousStart, lte: previousEnd },
        },
        select: { status: true, concluidaEm: true },
      }),
      prisma.tarefa.count({
        where: {
          ...tarefaWhereBase,
          status: { in: activeTaskStatuses },
          dataVencimento: { lt: previousEnd },
        },
      }),
      prisma.propostaComercial.count({
        where: {
          status: StatusPropostaComercial.ENVIADA,
          createdAt: {
            lt: new Date(previousEnd.getTime() - 5 * 24 * 60 * 60 * 1000),
          },
          oportunidade: { is: oportunidadeWhere },
        },
      }),
    ]);
  const oportunidadesSemProximaAcaoAnterior = oportunidadesBaseAnterior.filter(
    (oportunidade) => {
      const temProximaTarefa = oportunidade.tarefas.some(
        (tarefa) =>
          activeTaskStatusSet.has(tarefa.status) &&
          tarefa.dataVencimento >= previousEnd,
      );

      return !oportunidade.responsavelId || !temProximaTarefa;
    },
  ).length;
  const oportunidadesCadenciaAnterior = oportunidadesBaseAnterior.filter(
    (oportunidade) =>
      oportunidade.tarefas.some(
        (tarefa) =>
          activeTaskStatusSet.has(tarefa.status) &&
          tarefa.dataVencimento >= previousEnd,
      ) ||
      (oportunidade.historicos[0]?.dataContato &&
        differenceInDays(oportunidade.historicos[0].dataContato, previousEnd) <= 5),
  ).length;
  const cumprimentoCadenciaAnterior = oportunidadesBaseAnterior.length
    ? Math.round(
        (oportunidadesCadenciaAnterior / oportunidadesBaseAnterior.length) * 100,
      )
    : 100;
  const taxaConclusaoAnterior = tarefasPeriodoAnterior.length
    ? Math.round(
        (tarefasPeriodoAnterior.filter(
          (tarefa) => tarefa.status === StatusTarefa.CONCLUIDA || tarefa.concluidaEm,
        ).length /
          tarefasPeriodoAnterior.length) *
          100,
      )
    : 0;
  const seriesLabels = Array.from({ length: 6 }, (_, index) => {
    const bucketStart = new Date(start);
    const bucketSize = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 6));
    bucketStart.setTime(start.getTime() + bucketSize * index);
    const bucketEnd = new Date(
      index === 5 ? end.getTime() : start.getTime() + bucketSize * (index + 1) - 1,
    );

    return { start: bucketStart, end: bucketEnd };
  });
  const [oportunidadesSerie, tarefasSerie, propostasSerie] = await Promise.all([
    prisma.oportunidade.findMany({
      where: {
        ...oportunidadeWhere,
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true },
    }),
    prisma.tarefa.findMany({
      where: {
        ...tarefaWhereBase,
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true, concluidaEm: true, status: true },
    }),
    prisma.propostaComercial.findMany({
      where: {
        status: StatusPropostaComercial.ENVIADA,
        createdAt: { gte: start, lte: end },
        oportunidade: { is: oportunidadeWhere },
      },
      select: { createdAt: true },
    }),
  ]);
  const series = seriesLabels.map((bucket) => {
    const label = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(bucket.start);
    const tarefasBucket = tarefasSerie.filter(
      (tarefa) => tarefa.createdAt >= bucket.start && tarefa.createdAt <= bucket.end,
    );
    const tarefasConcluidas = tarefasBucket.filter(
      (tarefa) => tarefa.status === StatusTarefa.CONCLUIDA || tarefa.concluidaEm,
    ).length;

    return {
      periodo: label,
      oportunidades: oportunidadesSerie.filter(
        (oportunidade) =>
          oportunidade.createdAt >= bucket.start && oportunidade.createdAt <= bucket.end,
      ).length,
      tarefasConcluidas,
      cadencia: tarefasBucket.length
        ? Math.round((tarefasConcluidas / tarefasBucket.length) * 100)
        : 0,
      propostasSemRetorno: propostasSerie.filter(
        (proposta) =>
          proposta.createdAt >= bucket.start &&
          proposta.createdAt <= bucket.end &&
          differenceInDays(proposta.createdAt) > 5,
      ).length,
    };
  });

  return NextResponse.json({
    filtros: {
      vendedores: usuarios
        .filter((usuario) => usuario.papel === PapelUsuario.COMERCIAL)
        .map((usuario) => ({ id: usuario.id, nome: usuario.nome })),
      gerentes: usuarios
        .filter((usuario) => usuario.papel === PapelUsuario.GERENTE)
        .map((usuario) => ({ id: usuario.id, nome: usuario.nome })),
      filiais,
    },
    indicadores: {
      oportunidadesAbertas: oportunidadesAbertas.length,
      oportunidadesSemProximaAcao: oportunidadesSemProximaAcao.length,
      tarefasVencidas: tarefasVencidas.length,
      propostasAguardandoRetorno: propostasAguardandoRetorno.length,
      oportunidadesSemResponsavel: oportunidadesSemResponsavel.length,
      cumprimentoCadencia,
      oportunidadesDentroCadencia: oportunidadesComCadencia,
      oportunidadesForaCadencia,
      taxaConclusaoTarefas: taxaConclusaoGeral,
      saudeGeral: {
        score: saudeScore,
        ...getOperationalHealth(saudeScore),
      },
    },
    comparativo: [
      {
        indicador: "Oportunidades abertas",
        anterior: oportunidadesBaseAnterior.length,
        atual: oportunidadesAbertas.length,
      },
      {
        indicador: "Sem próxima ação",
        anterior: oportunidadesSemProximaAcaoAnterior,
        atual: oportunidadesSemProximaAcao.length,
      },
      {
        indicador: "Tarefas vencidas",
        anterior: tarefasVencidasAnterior,
        atual: tarefasVencidas.length,
      },
      {
        indicador: "Cumprimento da cadência",
        anterior: cumprimentoCadenciaAnterior,
        atual: cumprimentoCadencia,
        sufixo: "%",
      },
      {
        indicador: "Conclusão de tarefas",
        anterior: taxaConclusaoAnterior,
        atual: taxaConclusaoGeral,
        sufixo: "%",
      },
      {
        indicador: "Propostas sem retorno",
        anterior: propostasSemRetornoAnterior,
        atual: propostasAguardandoRetorno.length,
      },
    ],
    series,
    listas: {
      oportunidadesSemProximaAcao,
      oportunidadesSemResponsavel,
      tarefasVencidasPorUsuario,
      tarefasVencidas: tarefasVencidasLista,
      propostasAguardandoRetorno,
      diasSemInteracao,
      tarefasPorUsuario,
    },
  });
}
