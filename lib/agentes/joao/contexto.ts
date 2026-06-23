// ARQUIVO: lib/agentes/joao/contexto.ts
// REGRA: nunca remover. Apenas acrescentar.
// Busca o contexto de conversa do João — filtra por instanceName "joao-villa".
// Isolado da Maria: mesmo telefone gera histórico separado.

import { prisma } from "@/lib/prisma";

export async function getContextoJoao(telefone: string): Promise<string> {
  const conversa = await prisma.conversa.findFirst({
    where: { telefone, instanceName: "joao-villa" },
    orderBy: { updatedAt: "desc" },
    include: {
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { conteudo: true, direcao: true, createdAt: true },
      },
    },
  });

  if (!conversa || conversa.mensagens.length === 0) return "";

  return conversa.mensagens
    .reverse()
    .map((m: { direcao: string; conteudo: string }) => `${m.direcao === "ENTRADA" ? "Cliente" : "João"}: ${m.conteudo}`)
    .join("\n");
}
