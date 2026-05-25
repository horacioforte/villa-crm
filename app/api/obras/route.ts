import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { obraSchema } from "@/lib/validations/obra";

export async function GET(request: Request) {
  const authResult = await requirePermission("obras", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const obras = await prisma.obra.findMany({
    where: {
      ativa: true,
    },
    orderBy: {
      createdAt: "desc",
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

  return NextResponse.json(obras);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("obras", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = obraSchema.parse(await request.json());

    const obra = await prisma.obra.create({
      data: {
        ...data,
        createdById: authResult.id,
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
      action: "OBRA_CREATED",
      entity: "Obra",
      entityId: obra.id,
      after: obra,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(obra, { status: 201 });
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
      { message: "Nao foi possivel criar a obra." },
      { status: 500 },
    );
  }
}
