import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { Prisma } from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { equipamentoPatchSchema } from "@/lib/validations/equipamento";

type EquipamentoRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const equipamentoSelect = {
  id: true,
  codigo: true,
  nome: true,
  tipo: true,
  status: true,
  marca: true,
  modelo: true,
  ano: true,
  numeroSerie: true,
  valorLocacao: true,
  valorM3: true,
  volumeMinimoM3: true,
  valorVenda: true,
  observacoes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EquipamentoSelect;

function serializeEquipamento(equipamento: Prisma.EquipamentoGetPayload<{
  select: typeof equipamentoSelect;
}>) {
  return {
    ...equipamento,
    codigoInterno: equipamento.codigo,
    valorLocacao: equipamento.valorLocacao?.toString() ?? null,
    valorM3: equipamento.valorM3 ?? null,
    volumeMinimoM3: equipamento.volumeMinimoM3 ?? null,
    valorVenda: equipamento.valorVenda?.toString() ?? null,
  };
}

export async function GET(request: Request, context: EquipamentoRouteContext) {
  const authResult = await requirePermission("equipamentos", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const equipamento = await prisma.equipamento.findUnique({
    where: {
      id,
    },
    select: equipamentoSelect,
  });

  if (!equipamento) {
    return NextResponse.json(
      { message: "Equipamento nao encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(serializeEquipamento(equipamento));
}

export async function PATCH(request: Request, context: EquipamentoRouteContext) {
  const authResult = await requirePermission("equipamentos", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = equipamentoPatchSchema.parse(await request.json());
    const before = await prisma.equipamento.findUnique({ where: { id } });

    if (!before) {
      return NextResponse.json(
        { message: "Equipamento nao encontrado." },
        { status: 404 },
      );
    }

    const equipamento = await prisma.equipamento.update({
      where: {
        id,
      },
      data: {
        ...data,
        updatedById: authResult.id,
      },
      select: equipamentoSelect,
    });

    await auditLog({
      action: "EQUIPAMENTO_UPDATED",
      entity: "Equipamento",
      entityId: equipamento.id,
      before,
      after: equipamento,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(serializeEquipamento(equipamento));
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

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ja existe um equipamento com este codigo." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Nao foi possivel editar o equipamento." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: EquipamentoRouteContext) {
  const authResult = await requirePermission("equipamentos", "delete", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const before = await prisma.equipamento.findUnique({ where: { id } });

    if (!before) {
      return NextResponse.json(
        { message: "Equipamento nao encontrado." },
        { status: 404 },
      );
    }

    const equipamento = await prisma.equipamento.update({
      where: {
        id,
      },
      data: {
        status: "INATIVO",
        updatedById: authResult.id,
      },
      select: equipamentoSelect,
    });

    await auditLog({
      action: "EQUIPAMENTO_DEACTIVATED",
      entity: "Equipamento",
      entityId: equipamento.id,
      before,
      after: equipamento,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(serializeEquipamento(equipamento));
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel desativar o equipamento." },
      { status: 500 },
    );
  }
}
