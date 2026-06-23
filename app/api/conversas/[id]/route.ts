// ARQUIVO: app/api/conversas/[id]/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Retorna uma conversa com todas as mensagens para exibição no CRM.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  _req: NextRequest,
  context: any
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;

  const conversa = await prisma.conversa.findUnique({
    where: { id },
    include: {
      mensagens: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          conteudo: true,
          direcao: true,
          autor: true,
          createdAt: true,
        },
      },
      atendidoPor: { select: { nome: true } },
      pessoa: { select: { id: true, nome: true } },
      empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
    },
  });

  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });

  return NextResponse.json(conversa);
}
