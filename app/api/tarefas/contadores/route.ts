import { addDays, startOfDay } from "date-fns";
import { NextResponse } from "next/server";

import type { Prisma } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getTarefaAccessWhere, isTarefaGestor } from "@/lib/tarefas/service";

export async function GET(request: Request) {
  const authResult = await requirePermission("tarefas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const responsavelId = searchParams.get("responsavelId");
  const gestor = isTarefaGestor(authResult);
  const hoje = startOfDay(new Date());
  const amanha = addDays(hoje, 1);
  const depoisDeAmanha = addDays(amanha, 1);
  const accessWhere = getTarefaAccessWhere(authResult);
  const responsavelWhere: Prisma.TarefaWhereInput =
    gestor && responsavelId && responsavelId !== "todas"
      ? { responsavelId }
      : {};
  const baseWhere: Prisma.TarefaWhereInput = {
    AND: [accessWhere, responsavelWhere],
  };

  const [atrasadas, diaAtual, diaAmanha, concluidas] = await Promise.all([
    prisma.tarefa.count({
      where: {
        AND: [
          baseWhere,
          { status: { not: "CONCLUIDA" }, dataVencimento: { lt: hoje } },
        ],
      },
    }),
    prisma.tarefa.count({
      where: {
        AND: [
          baseWhere,
          {
            status: { not: "CONCLUIDA" },
            dataVencimento: { gte: hoje, lt: amanha },
          },
        ],
      },
    }),
    prisma.tarefa.count({
      where: {
        AND: [
          baseWhere,
          {
            status: { not: "CONCLUIDA" },
            dataVencimento: { gte: amanha, lt: depoisDeAmanha },
          },
        ],
      },
    }),
    prisma.tarefa.count({
      where: {
        AND: [baseWhere, { status: "CONCLUIDA", concluidaEm: { gte: hoje } }],
      },
    }),
  ]);

  return NextResponse.json({
    atrasadas,
    hoje: diaAtual,
    amanha: diaAmanha,
    concluidas,
  });
}
