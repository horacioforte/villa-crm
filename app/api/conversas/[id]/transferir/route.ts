// ARQUIVO: app/api/conversas/[id]/transferir/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Transfere uma conversa para outro atendente e registra histórico.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { paraUsuarioId, motivo } = await req.json().catch(() => ({}));
  if (!paraUsuarioId) {
    return NextResponse.json({ error: "paraUsuarioId é obrigatório." }, { status: 400 });
  }

  const conversa = await prisma.conversa.findUnique({ where: { id: params.id } });
  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  // Registra a transferência no histórico
  await prisma.conversaTransferencia.create({
    data: {
      conversaId: conversa.id,
      deUsuarioId: conversa.atendidoPorId ?? null,
      paraUsuarioId,
      feitoPorId: user.id,
      motivo: motivo ?? null,
    },
  });

  // Atualiza o atendente responsável
  const conversaAtualizada = await prisma.conversa.update({
    where: { id: conversa.id },
    data: { atendidoPorId: paraUsuarioId },
    include: {
      atendidoPor: { select: { id: true, nome: true } },
    },
  });

  return NextResponse.json(conversaAtualizada);
}
