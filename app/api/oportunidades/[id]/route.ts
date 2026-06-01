import { NextResponse } from "next/server";
import { ZodError } from "zod";

import type { Prisma } from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getValorPropostaAtiva } from "@/lib/propostas/utils";
import { criarTarefaAutomatica } from "@/lib/tarefas/automaticas";
import { oportunidadePatchSchema } from "@/lib/validations/oportunidade";

type OportunidadeRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: OportunidadeRouteContext,
) {
  const authResult = await requirePermission("oportunidades", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const oportunidade = await prisma.oportunidade.findFirst({
    where: {
      id,
      ativa: true,
    },
    include: {
      empresa: true,
      pessoa: true,
      obra: true,
      responsavel: true,
      equipamento: true,
      propostas: {
        where: {
          status: {
            in: ["ENVIADA", "APROVADA", "ACEITA"],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          valorTotal: true,
          status: true,
        },
      },
      historicos: true,
      tarefas: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!oportunidade) {
    return NextResponse.json(
      { message: "Oportunidade nao encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(oportunidade);
}

export async function PATCH(
  request: Request,
  context: OportunidadeRouteContext,
) {
  const authResult = await requirePermission("oportunidades", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = oportunidadePatchSchema.parse(await request.json());
    const before = await prisma.oportunidade.findUnique({ where: { id } });
    const updateData: Prisma.OportunidadeUncheckedUpdateInput = {
      ...data,
      updatedById: authResult.id,
    };

    if (data.status === "GANHA" && !data.valorContrato) {
      const valorPropostaAtiva = await getValorPropostaAtiva(id);

      if (valorPropostaAtiva !== null) {
        updateData.valorContrato = valorPropostaAtiva;
      }
    }

    if (data.status === "GANHA" && before?.status !== "GANHA" && !before?.fechadaEm) {
      updateData.fechadaEm = new Date();
    }

    const oportunidade = await prisma.oportunidade.update({
      where: {
        id,
      },
      data: updateData,
      include: {
        empresa: true,
        pessoa: true,
        obra: true,
        responsavel: true,
        equipamento: true,
        propostas: {
          where: {
            status: {
              in: ["ENVIADA", "APROVADA", "ACEITA"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            valorTotal: true,
            status: true,
          },
        },
        tarefas: {
          select: {
            status: true,
          },
        },
      },
    });

    await auditLog({
      action:
        before?.status !== oportunidade.status
          ? "OPORTUNIDADE_STATUS_CHANGED"
          : "OPORTUNIDADE_UPDATED",
      entity: "Oportunidade",
      entityId: oportunidade.id,
      before,
      after: oportunidade,
      userId: authResult.id,
      request,
    });

    if (before?.status !== oportunidade.status && oportunidade.status === "GANHA") {
      await criarTarefaAutomatica(
        "OPORTUNIDADE_GANHA",
        oportunidade.id,
        oportunidade.responsavelId,
        authResult.id,
      );
    }

    return NextResponse.json(oportunidade);
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
      { message: "Nao foi possivel editar a oportunidade." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: OportunidadeRouteContext,
) {
  const authResult = await requirePermission("oportunidades", "delete", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const before = await prisma.oportunidade.findUnique({ where: { id } });
    const oportunidade = await prisma.oportunidade.update({
      where: {
        id,
      },
      data: {
        ativa: false,
        updatedById: authResult.id,
      },
    });

    await auditLog({
      action: "OPORTUNIDADE_DEACTIVATED",
      entity: "Oportunidade",
      entityId: oportunidade.id,
      before,
      after: oportunidade,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(oportunidade);
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel excluir a oportunidade." },
      { status: 500 },
    );
  }
}
