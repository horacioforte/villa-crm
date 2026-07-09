// ARQUIVO: app/api/inteligencia/[id]/timeline/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Retorna todas as atualizações do dossiê em ordem cronológica.

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

  const atualizacoes = await prisma.atualizacaoDossie.findMany({
    where:   { dossieId: id },
    orderBy: { createdAt: "desc" },
    take:    limit,
  });

  return NextResponse.json({ total: atualizacoes.length, atualizacoes });
}
