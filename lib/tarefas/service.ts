import {
  addDays,
  endOfDay,
  endOfWeek,
  startOfDay,
  startOfWeek,
} from "date-fns";

import type {
  AuthenticatedUser,
} from "@/lib/auth/session";
import type {
  Prisma,
  StatusTarefa,
} from "@/app/generated/prisma/client";

export const tarefaInclude = {
  oportunidade: {
    select: {
      id: true,
      titulo: true,
      status: true,
    },
  },
  empresa: {
    select: {
      id: true,
      razaoSocial: true,
      nomeFantasia: true,
    },
  },
  pessoa: {
    select: {
      id: true,
      nome: true,
    },
  },
  obra: {
    select: {
      id: true,
      nome: true,
    },
  },
  proposta: {
    select: {
      id: true,
      numeroProposta: true,
      versao: true,
      status: true,
    },
  },
  responsavel: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      nome: true,
      email: true,
    },
  },
} as const;

type TarefaWithRelations = Prisma.TarefaGetPayload<{
  include: typeof tarefaInclude;
}>;

const statusAtivos: StatusTarefa[] = ["PENDENTE", "EM_ANDAMENTO"];

export function getTarefaAccessWhere(user: AuthenticatedUser): Prisma.TarefaWhereInput {
  if (user.papel !== "COMERCIAL") {
    return {};
  }

  return {
    OR: [{ responsavelId: user.id }, { createdById: user.id }],
  };
}

export function getTarefaByIdWhere(
  id: string,
  user: AuthenticatedUser,
): Prisma.TarefaWhereInput {
  return {
    id,
    ...getTarefaAccessWhere(user),
  };
}

export function getVirtualStatus(tarefa: {
  status: StatusTarefa;
  dataVencimento: Date;
}) {
  const isAtrasada =
    statusAtivos.includes(tarefa.status) &&
    tarefa.dataVencimento < startOfDay(new Date());

  return isAtrasada ? "ATRASADA" : tarefa.status;
}

export function serializeTarefa<T extends TarefaWithRelations>(tarefa: T) {
  return {
    ...tarefa,
    status: getVirtualStatus(tarefa),
  };
}

function buildPeriodoWhere(periodo: string | null): Prisma.TarefaWhereInput {
  const hoje = new Date();
  const inicioHoje = startOfDay(hoje);
  const fimHoje = endOfDay(hoje);
  const amanha = addDays(inicioHoje, 1);

  if (periodo === "hoje") {
    return {
      dataVencimento: {
        gte: inicioHoje,
        lte: fimHoje,
      },
    };
  }

  if (periodo === "amanha") {
    return {
      dataVencimento: {
        gte: amanha,
        lte: endOfDay(amanha),
      },
    };
  }

  if (periodo === "esta_semana") {
    return {
      dataVencimento: {
        gte: startOfWeek(hoje, { weekStartsOn: 1 }),
        lte: endOfWeek(hoje, { weekStartsOn: 1 }),
      },
    };
  }

  if (periodo === "atrasadas") {
    return {
      status: {
        in: statusAtivos,
      },
      dataVencimento: {
        lt: inicioHoje,
      },
    };
  }

  return {};
}

function buildStatusWhere(status: string | null): Prisma.TarefaWhereInput {
  if (!status || status === "PENDENTE") {
    return {
      status: "PENDENTE",
    };
  }

  if (status === "todas") {
    return {};
  }

  if (status === "ATRASADA") {
    return {
      status: {
        in: statusAtivos,
      },
      dataVencimento: {
        lt: startOfDay(new Date()),
      },
    };
  }

  return {
    status: status as StatusTarefa,
  };
}

export function buildTarefaWhere(
  searchParams: URLSearchParams,
  user: AuthenticatedUser,
): Prisma.TarefaWhereInput {
  const where: Prisma.TarefaWhereInput = {
    AND: [
      getTarefaAccessWhere(user),
      buildStatusWhere(searchParams.get("status")),
      buildPeriodoWhere(searchParams.get("periodo")),
    ],
  };

  const responsavelId = searchParams.get("responsavelId");
  const empresaId = searchParams.get("empresaId");
  const oportunidadeId = searchParams.get("oportunidadeId");
  const prioridade = searchParams.get("prioridade");
  const tipo = searchParams.get("tipo");

  if (responsavelId && responsavelId !== "todas") {
    where.responsavelId = responsavelId;
  }

  if (empresaId && empresaId !== "todas") {
    where.empresaId = empresaId;
  }

  if (oportunidadeId && oportunidadeId !== "todas") {
    where.oportunidadeId = oportunidadeId;
  }

  if (prioridade && prioridade !== "todas") {
    where.prioridade = prioridade as Prisma.EnumPrioridadeTarefaFilter["equals"];
  }

  if (tipo && tipo !== "todas") {
    where.tipo = tipo as Prisma.EnumTipoAtividadeFilter["equals"];
  }

  return where;
}
