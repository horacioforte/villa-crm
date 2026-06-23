// ARQUIVO: app/api/conversas/route.ts
// REGRA: nunca remover. Apenas acrescentar.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // ABERTA | PENDENTE | CONCLUIDA
  const instance = searchParams.get("instance"); // maria-villa | joao-villa | ...
  const busca = searchParams.get("busca");

  const conversas = await prisma.conversa.findMany({
    where: {
      ...(status ? { status: status as "ABERTA" | "PENDENTE" | "CONCLUIDA" | "SPAM" } : {}),
      ...(instance ? { instanceName: instance } : {}),
      ...(busca
        ? {
            OR: [
              { nomeContato: { contains: busca, mode: "insensitive" } },
              { telefone: { contains: busca } },
            ],
          }
        : {}),
    },
    orderBy: [
      { ultimaMensagemEm: "desc" },
      { createdAt: "desc" },
    ],
    take: 100,
    include: {
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          conteudo: true,
          direcao: true,
          createdAt: true,
        },
      },
      atendidoPor: { select: { nome: true } },
    },
  });

  return NextResponse.json(conversas);
}
