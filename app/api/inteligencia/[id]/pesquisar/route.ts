// ARQUIVO: app/api/inteligencia/[id]/pesquisar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Morgana pede mais pesquisa: atualiza status e cria tarefa para o João investigar.

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PrioridadeTarefa, StatusTarefa, TipoAtividade } from "@/app/generated/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const usuario = { id: authResult.id, name: authResult.nome };

  let body: { instrucao?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: id },
    select: { id: true, titulo: true, status: true, missaoAtual: true },
  });
  if (!dossie) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });

  const instrucao = body.instrucao?.trim() || dossie.missaoAtual || "Aprofundar investigação do dossiê.";

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(8, 0, 0, 0);

  await prisma.$transaction([
    prisma.dossieComercial.update({
      where: { id: id },
      data: {
        status:         "PEDIR_MAIS_PESQUISA",
        ultimaAtividade: new Date(),
      },
    }),
    prisma.atualizacaoDossie.create({
      data: {
        dossieId:  id,
        tipo:      "SOLICITACAO_PESQUISA",
        titulo:    "Mais pesquisa solicitada",
        conteudo:  `${usuario?.name ?? "Morgana"} solicitou mais pesquisa: ${instrucao}`,
        agente:    "morgana",
        usuarioId: usuario?.id ?? null,
      },
    }),
    prisma.tarefa.create({
      data: {
        titulo:        `[João] Pesquisar: ${dossie.titulo}`,
        descricao:     `Dossiê ${id}.\n\nMissão: ${instrucao}`,
        tipo:          TipoAtividade.TAREFA_INTERNA,
        prioridade:    PrioridadeTarefa.ALTA,
        status:        StatusTarefa.PENDENTE,
        dataVencimento: amanha,
      },
    }),
  ]);

  return NextResponse.json({
    sucesso: true,
    mensagem: "Solicitação de pesquisa registrada. Tarefa criada para o João.",
  });
}
