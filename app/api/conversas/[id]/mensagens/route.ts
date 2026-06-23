// ARQUIVO: app/api/conversas/[id]/mensagens/route.ts
// REGRA: nunca remover. Apenas acrescentar.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;

  const mensagens = await prisma.mensagem.findMany({
    where: { conversaId: id },
    orderBy: { createdAt: "asc" },
    include: {
      autorUsuario: { select: { nome: true } },
    },
  });

  return NextResponse.json(mensagens);
}
