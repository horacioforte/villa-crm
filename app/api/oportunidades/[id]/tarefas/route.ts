import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission, type AuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getOportunidadeAccessWhere } from "@/lib/propostas/service";
import { serializeTarefa, tarefaInclude } from "@/lib/tarefas/service";
import { tarefaCreateSchema } from "@/lib/validations/tarefa";

type OportunidadeTarefasRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getOportunidade(id: string, authResult: AuthenticatedUser) {
  return prisma.oportunidade.findFirst({
    where: getOportunidadeAccessWhere(id, authResult),
    select: {
      id: true,
      empresaId: true,
      pessoaId: true,
      obraId: true,
      responsavelId: true,
    },
  });
}

export async function GET(
  request: Request,
  context: OportunidadeTarefasRouteContext,
) {
  const authResult = await requirePermission("tarefas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;
  const oportunidade = await getOportunidade(id, authResult);

  if (!oportunidade) {
    return NextResponse.json(
      { message: "Oportunidade nao encontrada." },
      { status: 404 },
    );
  }

  const tarefas = await prisma.tarefa.findMany({
    where: {
      oportunidadeId: id,
    },
    include: tarefaInclude,
    orderBy: [{ status: "asc" }, { dataVencimento: "asc" }],
  });

  return NextResponse.json(tarefas.map(serializeTarefa));
}

export async function POST(
  request: Request,
  context: OportunidadeTarefasRouteContext,
) {
  const authResult = await requirePermission("tarefas", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const oportunidade = await getOportunidade(id, authResult);

    if (!oportunidade) {
      return NextResponse.json(
        { message: "Oportunidade nao encontrada." },
        { status: 404 },
      );
    }

    const data = tarefaCreateSchema.parse(await request.json());
    const tarefa = await prisma.tarefa.create({
      data: {
        ...data,
        oportunidadeId: id,
        empresaId: data.empresaId ?? oportunidade.empresaId,
        pessoaId: data.pessoaId ?? oportunidade.pessoaId,
        obraId: data.obraId ?? oportunidade.obraId,
        responsavelId:
          data.responsavelId ?? oportunidade.responsavelId ?? authResult.id,
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
      metadata: {
        oportunidadeId: id,
      },
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
