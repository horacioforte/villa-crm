// ARQUIVO: app/api/inteligencia/[id]/timeline/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Retorna todas as atualizações do dossiê em ordem cronológica.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

  const atualizacoes = await prisma.atualizacaoDossie.findMany({
    where:   { dossieId: params.id },
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  return NextResponse.json({ total: atualizacoes.length, atualizacoes });
}
