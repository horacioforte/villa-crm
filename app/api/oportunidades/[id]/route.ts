import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
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
      historicos: true,
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

    const oportunidade = await prisma.oportunidade.update({
      where: {
        id,
      },
      data: {
        ...data,
        updatedById: authResult.id,
      },
      include: {
        empresa: true,
        pessoa: true,
        obra: true,
        responsavel: true,
        equipamento: true,
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

    return NextResponse.json(oportunidade);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Dados invalidos.",
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
