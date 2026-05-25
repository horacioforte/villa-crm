import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { contatoSchema } from "@/lib/validations/contato";

export async function GET(request: Request) {
  const authResult = await requirePermission("contatos", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const contatos = await prisma.pessoa.findMany({
    where: {
      ativa: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      empresa: true,
    },
  });

  return NextResponse.json(contatos);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("contatos", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = contatoSchema.parse(await request.json());

    const contato = await prisma.pessoa.create({
      data: {
        ...data,
        createdById: authResult.id,
        updatedById: authResult.id,
      },
      include: {
        empresa: true,
      },
    });

    await auditLog({
      action: "CONTATO_CREATED",
      entity: "Pessoa",
      entityId: contato.id,
      after: contato,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(contato, { status: 201 });
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
      { message: "Nao foi possivel criar o contato." },
      { status: 500 },
    );
  }
}
