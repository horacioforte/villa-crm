import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { contatoPatchSchema } from "@/lib/validations/contato";

type ContatoRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: ContatoRouteContext) {
  const authResult = await requirePermission("contatos", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const contato = await prisma.pessoa.findFirst({
    where: {
      id,
      ativa: true,
    },
    include: {
      empresa: true,
      obrasResponsavel: true,
      oportunidades: true,
      historicos: true,
    },
  });

  if (!contato) {
    return NextResponse.json(
      { message: "Contato nao encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(contato);
}

export async function PATCH(request: Request, context: ContatoRouteContext) {
  const authResult = await requirePermission("contatos", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = contatoPatchSchema.parse(await request.json());
    const before = await prisma.pessoa.findUnique({ where: { id } });

    const contato = await prisma.pessoa.update({
      where: {
        id,
      },
      data: {
        ...data,
        updatedById: authResult.id,
      },
      include: {
        empresa: true,
      },
    });

    await auditLog({
      action: "CONTATO_UPDATED",
      entity: "Pessoa",
      entityId: contato.id,
      before,
      after: contato,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(contato);
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
      { message: "Nao foi possivel editar o contato." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: ContatoRouteContext) {
  const authResult = await requirePermission("contatos", "delete", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const before = await prisma.pessoa.findUnique({ where: { id } });
    const contato = await prisma.pessoa.update({
      where: {
        id,
      },
      data: {
        ativa: false,
        updatedById: authResult.id,
      },
    });

    await auditLog({
      action: "CONTATO_DEACTIVATED",
      entity: "Pessoa",
      entityId: contato.id,
      before,
      after: contato,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(contato);
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel desativar o contato." },
      { status: 500 },
    );
  }
}
