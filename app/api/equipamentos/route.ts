import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { Prisma } from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { equipamentoSchema } from "@/lib/validations/equipamento";

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

function calcularValorLocacao(valorM3?: number | null, volumeMinimoM3?: number | null) {
  return valorM3 && volumeMinimoM3 ? valorM3 * volumeMinimoM3 : null;
}

export async function GET(request: Request) {
  const authResult = await requirePermission("equipamentos", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const status = searchParams.get("status");
  const listarTodos = scope === "cadastro" || status === "todos";

  const equipamentos = await prisma.equipamento.findMany({
    where: listarTodos
      ? undefined
      : {
          status: "DISPONIVEL",
        },
    orderBy: {
      nome: "asc",
    },
    select: equipamentoSelect,
  });

  return NextResponse.json(equipamentos.map(serializeEquipamento));
}

export async function POST(request: Request) {
  const authResult = await requirePermission("equipamentos", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = equipamentoSchema.parse(await request.json());
    const valorLocacao = calcularValorLocacao(data.valorM3, data.volumeMinimoM3);

    const equipamento = await prisma.equipamento.create({
      data: {
        ...data,
        valorLocacao,
        filialId: authResult.filialId ?? undefined,
        createdById: authResult.id,
        updatedById: authResult.id,
      },
      select: equipamentoSelect,
    });

    await auditLog({
      action: "EQUIPAMENTO_CREATED",
      entity: "Equipamento",
      entityId: equipamento.id,
      after: equipamento,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(serializeEquipamento(equipamento), { status: 201 });
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
      { message: "Nao foi possivel criar o equipamento." },
      { status: 500 },
    );
  }
}
