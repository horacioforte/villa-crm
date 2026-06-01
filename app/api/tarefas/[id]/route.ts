import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  getTarefaByIdWhere,
  serializeTarefa,
  tarefaInclude,
} from "@/lib/tarefas/service";
import type { TipoContato } from "@/app/generated/prisma/client";
import { tarefaPatchSchema } from "@/lib/validations/tarefa";

type TarefaRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: TarefaRouteContext) {
  const authResult = await requirePermission("tarefas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;
  const tarefa = await prisma.tarefa.findFirst({
    where: getTarefaByIdWhere(id, authResult),
    include: tarefaInclude,
  });

  if (!tarefa) {
    return NextResponse.json(
      { message: "Tarefa nao encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(serializeTarefa(tarefa));
}

export async function PATCH(request: Request, context: TarefaRouteContext) {
  const authResult = await requirePermission("tarefas", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = tarefaPatchSchema.parse(await request.json());
    const before = await prisma.tarefa.findFirst({
      where: getTarefaByIdWhere(id, authResult),
      include: tarefaInclude,
    });

    if (!before) {
      return NextResponse.json(
        { message: "Tarefa nao encontrada." },
        { status: 404 },
      );
    }

    let concluidaEm: Date | null | undefined;

    if (data.status === "CONCLUIDA") {
      concluidaEm = new Date();
    } else if (data.status !== undefined) {
      concluidaEm = null;
    }

    const tarefa = await prisma.tarefa.update({
      where: {
        id,
      },
      data: {
        ...data,
        concluidaEm,
        updatedById: authResult.id,
      },
      include: tarefaInclude,
    });

    if (
      data.status === "CONCLUIDA" &&
      before.status !== "CONCLUIDA" &&
      tarefa.oportunidadeId
    ) {
      const tipoContatoMap: Partial<Record<string, TipoContato>> = {
        LIGACAO: "TELEFONE",
        WHATSAPP: "WHATSAPP",
        EMAIL: "EMAIL",
        REUNIAO: "REUNIAO",
        VISITA: "VISITA",
        VISTORIA: "VISITA",
        RETORNO_CLIENTE: "TELEFONE",
        PROPOSTA: "EMAIL",
        CONTRATO: "OUTRO",
        COBRANCA: "TELEFONE",
        OUTRO: "OUTRO",
      };

      await prisma.historicoContato.create({
        data: {
          tipo: tipoContatoMap[tarefa.tipo] ?? "OUTRO",
          resumo: data.resultadoCodigo
            ? `${tarefa.titulo} - ${data.resultadoCodigo}`
            : tarefa.titulo,
          detalhes: data.resultado ?? tarefa.observacoes ?? null,
          oportunidadeId: tarefa.oportunidadeId,
          empresaId: tarefa.empresaId,
          pessoaId: tarefa.pessoaId,
          usuarioId: authResult.id,
          createdById: authResult.id,
          updatedById: authResult.id,
        },
      });
    }

    await auditLog({
      action:
        before.status !== tarefa.status ? "TAREFA_STATUS_CHANGED" : "TAREFA_UPDATED",
      entity: "Tarefa",
      entityId: tarefa.id,
      before,
      after: tarefa,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(serializeTarefa(tarefa));
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
      { message: "Nao foi possivel editar a tarefa." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: TarefaRouteContext) {
  const authResult = await requirePermission("tarefas", "delete", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const before = await prisma.tarefa.findFirst({
      where: getTarefaByIdWhere(id, authResult),
      include: tarefaInclude,
    });

    if (!before) {
      return NextResponse.json(
        { message: "Tarefa nao encontrada." },
        { status: 404 },
      );
    }

    await prisma.tarefa.delete({
      where: {
        id,
      },
    });

    await auditLog({
      action: "TAREFA_DELETED",
      entity: "Tarefa",
      entityId: id,
      before,
      userId: authResult.id,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel excluir a tarefa." },
      { status: 500 },
    );
  }
}
