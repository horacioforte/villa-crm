import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authResult = await requirePermission("relatorios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const estados = await prisma.obra.findMany({
    where: {
      estado: { not: null },
      oportunidades:
        authResult.papel === "COMERCIAL"
          ? {
              some: {
                OR: [
                  { responsavelId: authResult.id },
                  { createdById: authResult.id },
                ],
              },
            }
          : undefined,
    },
    select: { estado: true },
    distinct: ["estado"],
    orderBy: { estado: "asc" },
  });

  return NextResponse.json({
    estados: estados.map((item) => item.estado).filter(Boolean),
  });
}
