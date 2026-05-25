import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { empresaSchema } from "@/lib/validations/empresa";

export async function GET(request: Request) {
  const authResult = await requirePermission("empresas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const empresas = await prisma.empresa.findMany({
    where: {
      ativa: true,
    },
    orderBy: {
      createdAt: "desc",
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

  return NextResponse.json(empresas);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("empresas", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = empresaSchema.parse(await request.json());

    const empresa = await prisma.empresa.create({
      data: {
        ...data,
        createdById: authResult.id,
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
      action: "EMPRESA_CREATED",
      entity: "Empresa",
      entityId: empresa.id,
      after: empresa,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(empresa, { status: 201 });
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
      { message: "Nao foi possivel criar a empresa." },
      { status: 500 },
    );
  }
}
