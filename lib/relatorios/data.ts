import {
  StatusOportunidade,
  StatusPropostaComercial,
  type Prisma,
} from "@/app/generated/prisma/client";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type FormatoRelatorio = "json" | "xlsx" | "pdf";

const statusPropostaExcluidos = [
  StatusPropostaComercial.CANCELADA,
  StatusPropostaComercial.REJEITADA,
] as StatusPropostaComercial[];

export function parseFormato(value: string | null): FormatoRelatorio {
  return value === "xlsx" || value === "pdf" ? value : "json";
}

function parseDateParam(value: string | null, endOfDay = false) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return date;
}

function oportunidadeAccessWhere(user: AuthenticatedUser) {
  return user.papel === "COMERCIAL"
    ? {
        OR: [{ responsavelId: user.id }, { createdById: user.id }],
      }
    : {};
}

export function buildOportunidadeWhere(
  searchParams: URLSearchParams,
  user: AuthenticatedUser,
): Prisma.OportunidadeWhereInput {
  const dataInicio = parseDateParam(searchParams.get("dataInicio"));
  const dataFim = parseDateParam(searchParams.get("dataFim"), true);
  const status = searchParams.get("status");
  const responsavelId = searchParams.get("responsavelId");

  return {
    ativa: true,
    ...oportunidadeAccessWhere(user),
    ...(status ? { status: status as StatusOportunidade } : {}),
    ...(user.papel !== "COMERCIAL" && responsavelId ? { responsavelId } : {}),
    ...(dataInicio || dataFim
      ? {
          createdAt: {
            ...(dataInicio ? { gte: dataInicio } : {}),
            ...(dataFim ? { lte: dataFim } : {}),
          },
        }
      : {}),
  };
}

export function buildPropostaWhere(
  searchParams: URLSearchParams,
  user: AuthenticatedUser,
): Prisma.PropostaComercialWhereInput {
  const dataInicio = parseDateParam(searchParams.get("dataInicio"));
  const dataFim = parseDateParam(searchParams.get("dataFim"), true);
  const status = searchParams.get("status");
  const templateUtilizado = searchParams.get("templateUtilizado");
  const responsavelId = searchParams.get("responsavelId");

  return {
    ...(status ? { status: status as StatusPropostaComercial } : {}),
    ...(templateUtilizado ? { templateUtilizado } : {}),
    ...(dataInicio || dataFim
      ? {
          createdAt: {
            ...(dataInicio ? { gte: dataInicio } : {}),
            ...(dataFim ? { lte: dataFim } : {}),
          },
        }
      : {}),
    oportunidade: {
      is: {
        ativa: true,
        ...oportunidadeAccessWhere(user),
        ...(user.papel !== "COMERCIAL" && responsavelId ? { responsavelId } : {}),
      },
    },
  };
}

export async function getRelatorioOportunidades(
  searchParams: URLSearchParams,
  user: AuthenticatedUser,
) {
  const oportunidades = await prisma.oportunidade.findMany({
    where: buildOportunidadeWhere(searchParams, user),
    orderBy: { createdAt: "desc" },
    include: {
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      obra: { select: { nome: true, cidade: true, estado: true } },
      pessoa: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      equipamento: { select: { nome: true, codigo: true } },
      propostas: {
        select: {
          numeroProposta: true,
          versao: true,
          ativa: true,
          status: true,
          valorTotal: true,
        },
        orderBy: [{ numeroProposta: "asc" }, { versao: "desc" }],
      },
      _count: { select: { propostas: true } },
    },
  });

  return oportunidades.map((oportunidade) => {
    const propostasValidas = oportunidade.propostas.filter(
      (proposta) => !statusPropostaExcluidos.includes(proposta.status),
    );
    const ativas = propostasValidas.filter((proposta) => proposta.ativa);
    const propostasParaSoma =
      ativas.length > 0
        ? ativas
        : Array.from(
            propostasValidas
              .reduce((mapa, proposta) => {
                const atual = mapa.get(proposta.numeroProposta);
                if (!atual || proposta.versao > atual.versao) {
                  mapa.set(proposta.numeroProposta, proposta);
                }
                return mapa;
              }, new Map<string, (typeof propostasValidas)[number]>())
              .values(),
          );

    return {
      id: oportunidade.id,
      titulo: oportunidade.titulo,
      status: oportunidade.status,
      tipo: oportunidade.tipo,
      tipoServico: oportunidade.tipoServico,
      temperatura: oportunidade.temperatura,
      potencialOportunidade: oportunidade.potencialOportunidade,
      valorProposto:
        Math.round(
          propostasParaSoma.reduce(
            (soma, proposta) => soma + Number(proposta.valorTotal),
            0,
          ) * 100,
        ) / 100,
      valorContrato: oportunidade.valorContrato,
      canalOrigem: oportunidade.canalOrigem,
      previsaoFechamento: oportunidade.previsaoFechamento,
      fechadaEm: oportunidade.fechadaEm,
      createdAt: oportunidade.createdAt,
      empresa: oportunidade.empresa,
      obra: oportunidade.obra,
      pessoa: oportunidade.pessoa,
      responsavel: oportunidade.responsavel,
      equipamento: oportunidade.equipamento,
      _totalPropostas: oportunidade._count.propostas,
    };
  });
}

export async function getRelatorioPropostas(
  searchParams: URLSearchParams,
  user: AuthenticatedUser,
) {
  return prisma.propostaComercial.findMany({
    where: buildPropostaWhere(searchParams, user),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      numeroProposta: true,
      versao: true,
      ativa: true,
      status: true,
      templateUtilizado: true,
      valorTotal: true,
      validadeProposta: true,
      createdAt: true,
      oportunidade: {
        select: {
          titulo: true,
          empresa: { select: { razaoSocial: true, nomeFantasia: true } },
          obra: { select: { nome: true, cidade: true, estado: true } },
          responsavel: { select: { nome: true } },
        },
      },
      criadoPor: { select: { nome: true } },
    },
  });
}

export async function getRelatorioPipeline(user: AuthenticatedUser) {
  const accessWhere = oportunidadeAccessWhere(user);
  const hoje = new Date();
  const meses = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - index), 1);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    return { start, end };
  });

  const [
    oportunidades,
    oportunidadesPorStatusRaw,
    propostas,
    propostasPorStatusRaw,
    topClientesRaw,
  ] = await Promise.all([
    prisma.oportunidade.findMany({
      where: { ativa: true, ...accessWhere },
      select: {
        status: true,
        potencialOportunidade: true,
        valorContrato: true,
        createdAt: true,
      },
    }),
    prisma.oportunidade.groupBy({
      by: ["status"],
      where: { ativa: true, ...accessWhere },
      _count: { _all: true },
      _sum: { potencialOportunidade: true },
    }),
    prisma.propostaComercial.findMany({
      where: {
        ativa: true,
        status: { notIn: statusPropostaExcluidos },
        oportunidade: { is: { ativa: true, ...accessWhere } },
      },
      select: {
        status: true,
        valorTotal: true,
        createdAt: true,
        oportunidade: {
          select: {
            id: true,
            empresa: { select: { razaoSocial: true, nomeFantasia: true } },
          },
        },
      },
    }),
    prisma.propostaComercial.groupBy({
      by: ["status"],
      where: {
        ativa: true,
        status: { notIn: statusPropostaExcluidos },
        oportunidade: { is: { ativa: true, ...accessWhere } },
      },
      _count: { _all: true },
      _sum: { valorTotal: true },
    }),
    prisma.propostaComercial.findMany({
      where: {
        ativa: true,
        status: { notIn: statusPropostaExcluidos },
        oportunidade: { is: { ativa: true, ...accessWhere } },
      },
      select: {
        valorTotal: true,
        oportunidade: {
          select: {
            id: true,
            empresa: { select: { razaoSocial: true, nomeFantasia: true } },
          },
        },
      },
    }),
  ]);

  const topClientesMap = topClientesRaw.reduce(
    (mapa, proposta) => {
      const empresa =
        proposta.oportunidade.empresa.nomeFantasia ??
        proposta.oportunidade.empresa.razaoSocial;
      const atual = mapa.get(empresa) ?? {
        empresa,
        valorProposto: 0,
        oportunidades: new Set<string>(),
      };
      atual.valorProposto += Number(proposta.valorTotal);
      atual.oportunidades.add(proposta.oportunidade.id);
      mapa.set(empresa, atual);
      return mapa;
    },
    new Map<
      string,
      { empresa: string; valorProposto: number; oportunidades: Set<string> }
    >(),
  );

  return {
    totalPotencial: oportunidades.reduce(
      (soma, oportunidade) =>
        soma + Number(oportunidade.potencialOportunidade ?? 0),
      0,
    ),
    totalProposto: propostas.reduce(
      (soma, proposta) => soma + Number(proposta.valorTotal),
      0,
    ),
    totalContratado: oportunidades
      .filter((oportunidade) => oportunidade.status === StatusOportunidade.GANHA)
      .reduce(
        (soma, oportunidade) => soma + Number(oportunidade.valorContrato ?? 0),
        0,
      ),
    oportunidadesPorStatus: oportunidadesPorStatusRaw.map((item) => ({
      status: item.status,
      quantidade: item._count._all,
      valorPotencial: Number(item._sum.potencialOportunidade ?? 0),
    })),
    propostasPorStatus: propostasPorStatusRaw.map((item) => ({
      status: item.status,
      quantidade: item._count._all,
      valorTotal: Number(item._sum.valorTotal ?? 0),
    })),
    topClientes: Array.from(topClientesMap.values())
      .map((item) => ({
        empresa: item.empresa,
        valorProposto: Math.round(item.valorProposto * 100) / 100,
        quantidadeOportunidades: item.oportunidades.size,
      }))
      .sort((a, b) => b.valorProposto - a.valorProposto)
      .slice(0, 5),
    evolucaoMensal: meses.map(({ start, end }) => {
      const label = new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        year: "2-digit",
      })
        .format(start)
        .replace(".", "");

      return {
        mes: label,
        oportunidadesCriadas: oportunidades.filter(
          (oportunidade) =>
            oportunidade.createdAt >= start && oportunidade.createdAt <= end,
        ).length,
        propostasGeradas: propostas.filter(
          (proposta) => proposta.createdAt >= start && proposta.createdAt <= end,
        ).length,
        valorProposto: propostas
          .filter((proposta) => proposta.createdAt >= start && proposta.createdAt <= end)
          .reduce((soma, proposta) => soma + Number(proposta.valorTotal), 0),
      };
    }),
  };
}
