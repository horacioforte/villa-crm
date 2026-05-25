import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { obraPatchSchema } from "@/lib/validations/obra";

type ObraRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: ObraRouteContext) {
  const authResult = await requirePermission("obras", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const obra = await prisma.obra.findFirst({
    where: {
      id,
      ativa: true,
    },
    include: {
      empresa: true,
      responsavel: true,
      oportunidades: true,
      _count: {
        select: {
          oportunidades: true,
        },
      },
    },
  });

  if (!obra) {
    return NextResponse.json(
      { message: "Obra nao encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(obra);
}

export async function PATCH(request: Request, context: ObraRouteContext) {
  const authResult = await requirePermission("obras", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = obraPatchSchema.parse(await request.json());
    const before = await prisma.obra.findUnique({ where: { id } });

    const obra = await prisma.obra.update({
      where: {
        id,
      },
      data: {
        ...data,
        updatedById: authResult.id,
      },
      include: {
        empresa: true,
        _count: {
          select: {
            oportunidades: true,
          },
        },
      },
    });

    await auditLog({
      action: "OBRA_UPDATED",
      entity: "Obra",
      entityId: obra.id,
      before,
      after: obra,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(obra);
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
      { message: "Nao foi possivel editar a obra." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: ObraRouteContext) {
  const authResult = await requirePermission("obras", "delete", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const before = await prisma.obra.findUnique({ where: { id } });
    const obra = await prisma.obra.update({
      where: {
        id,
      },
      data: {
        ativa: false,
        updatedById: authResult.id,
      },
    });

    await auditLog({
      action: "OBRA_DEACTIVATED",
      entity: "Obra",
      entityId: obra.id,
      before,
      after: obra,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(obra);
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel desativar a obra." },
      { status: 500 },
    );
  }
}
