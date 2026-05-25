import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { oportunidadeSchema } from "@/lib/validations/oportunidade";

export async function GET(request: Request) {
  const authResult = await requirePermission("oportunidades", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      ativa: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      empresa: true,
      pessoa: true,
      obra: true,
      responsavel: true,
      equipamento: true,
    },
  });

  return NextResponse.json(oportunidades);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("oportunidades", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = oportunidadeSchema.parse(await request.json());

    const oportunidade = await prisma.oportunidade.create({
      data: {
        ...data,
        createdById: authResult.id,
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
      action: "OPORTUNIDADE_CREATED",
      entity: "Oportunidade",
      entityId: oportunidade.id,
      after: oportunidade,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(oportunidade, { status: 201 });
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
      { message: "Nao foi possivel criar a oportunidade." },
      { status: 500 },
    );
  }
}
