import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authResult = await requirePermission("equipamentos", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const equipamentos = await prisma.equipamento.findMany({
    where: {
      status: "DISPONIVEL",
    },
    orderBy: {
      nome: "asc",
    },
    select: {
      id: true,
      nome: true,
      tipo: true,
      codigo: true,
    },
  });

  return NextResponse.json(
    equipamentos.map((equipamento) => ({
      id: equipamento.id,
      nome: equipamento.nome,
      tipo: equipamento.tipo,
      codigoInterno: equipamento.codigo,
    })),
  );
}
