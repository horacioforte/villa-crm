// ARQUIVO: app/api/inteligencia/[id]/descartar/route.ts
// REGRA: nunca remover. Apenas acrescentar.

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const usuario = { id: authResult.id, name: authResult.nome };

  let body: { motivo?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  if (!body.motivo?.trim()) {
    return NextResponse.json({ error: "Motivo é obrigatório para arquivar um dossiê." }, { status: 400 });
  }

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!dossie) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });
  if (dossie.status === "ASSUMIDO") {
    return NextResponse.json({ error: "Dossiê já assumido não pode ser arquivado." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.dossieComercial.update({
      where: { id: params.id },
      data: {
        status:         "ARQUIVADO",
        motivoDescarte: body.motivo,
        ultimaAtividade: new Date(),
      },
    }),
    prisma.atualizacaoDossie.create({
      data: {
        dossieId:  params.id,
        tipo:      "ANALISE_MORGANA",
        titulo:    "Dossiê arquivado",
        conteudo:  `Arquivado por ${usuario?.name ?? "usuário"}. Motivo: ${body.motivo}`,
        agente:    "morgana",
        usuarioId: usuario?.id ?? null,
      },
    }),
  ]);

  return NextResponse.json({ sucesso: true, mensagem: "Dossiê arquivado." });
}
