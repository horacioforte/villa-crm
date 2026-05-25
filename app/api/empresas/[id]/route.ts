import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { empresaPatchSchema } from "@/lib/validations/empresa";

type EmpresaRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: EmpresaRouteContext) {
  const authResult = await requirePermission("empresas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const empresa = await prisma.empresa.findFirst({
    where: {
      id,
      ativa: true,
    },
    include: {
      pessoas: true,
      obras: true,
      oportunidades: true,
      _count: {
        select: {
          obras: true,
          oportunidades: true,
        },
      },
    },
  });

  if (!empresa) {
    return NextResponse.json(
      { message: "Empresa nao encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(empresa);
}

export async function PATCH(request: Request, context: EmpresaRouteContext) {
  const authResult = await requirePermission("empresas", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = empresaPatchSchema.parse(await request.json());
    const before = await prisma.empresa.findUnique({ where: { id } });

    const empresa = await prisma.empresa.update({
      where: {
        id,
      },
      data: {
        ...data,
        updatedById: authResult.id,
      },
      include: {
        _count: {
          select: {
            obras: true,
            oportunidades: true,
          },
        },
      },
    });

    await auditLog({
      action: "EMPRESA_UPDATED",
      entity: "Empresa",
      entityId: empresa.id,
      before,
      after: empresa,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(empresa);
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
      { message: "Nao foi possivel editar a empresa." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: EmpresaRouteContext) {
  const authResult = await requirePermission("empresas", "delete", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const before = await prisma.empresa.findUnique({ where: { id } });
    const empresa = await prisma.empresa.update({
      where: {
        id,
      },
      data: {
        ativa: false,
        updatedById: authResult.id,
      },
    });

    await auditLog({
      action: "EMPRESA_DEACTIVATED",
      entity: "Empresa",
      entityId: empresa.id,
      before,
      after: empresa,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(empresa);
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel desativar a empresa." },
      { status: 500 },
    );
  }
}
