import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  buildTarefaWhere,
  serializeTarefa,
  tarefaInclude,
} from "@/lib/tarefas/service";
import { tarefaCreateSchema } from "@/lib/validations/tarefa";

type RelationDefaults = {
  empresaId?: string | null;
  pessoaId?: string | null;
  obraId?: string | null;
  responsavelId?: string | null;
};

async function getRelationDefaults(
  oportunidadeId?: string | null,
): Promise<RelationDefaults> {
  if (!oportunidadeId) {
    return {};
  }

  const oportunidade = await prisma.oportunidade.findUnique({
    where: {
      id: oportunidadeId,
    },
    select: {
      empresaId: true,
      pessoaId: true,
      obraId: true,
      responsavelId: true,
    },
  });

  return oportunidade ?? {};
}

export async function GET(request: Request) {
  const authResult = await requirePermission("tarefas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const tarefas = await prisma.tarefa.findMany({
    where: buildTarefaWhere(searchParams, authResult),
    include: tarefaInclude,
    orderBy: [{ dataVencimento: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tarefas.map(serializeTarefa));
}

export async function POST(request: Request) {
  const authResult = await requirePermission("tarefas", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = tarefaCreateSchema.parse(await request.json());
    const defaults = await getRelationDefaults(data.oportunidadeId);

    const tarefa = await prisma.tarefa.create({
      data: {
        ...data,
        empresaId: data.empresaId ?? defaults.empresaId,
        pessoaId: data.pessoaId ?? defaults.pessoaId,
        obraId: data.obraId ?? defaults.obraId,
        responsavelId:
          data.responsavelId ?? defaults.responsavelId ?? authResult.id,
        createdById: authResult.id,
        updatedById: authResult.id,
      },
      include: tarefaInclude,
    });

    await auditLog({
      action: "TAREFA_CREATED",
      entity: "Tarefa",
      entityId: tarefa.id,
      after: tarefa,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(serializeTarefa(tarefa), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: error.issues[0]?.message ?? "Dados invalidos.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Nao foi possivel criar a tarefa." },
      { status: 500 },
    );
  }
}
