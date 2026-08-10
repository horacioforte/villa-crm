// ARQUIVO: app/api/inteligencia/[id]/desvincular/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Desvíncula a oportunidade de um dossiê assumido e volta o status para PRONTO_PARA_ASSUMIR.
// Usado pela Morgana/Horacio quando a oportunidade criada pelo João foi apagada ou é inválida.

import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Somente ADMIN (Horacio) e GERENTE (Morgana) podem desvincular
  const authResult = await requirePermission("inteligencia", "create", req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id },
    select: { id: true, status: true, titulo: true, oportunidadeId: true },
  });

  if (!dossie) {
    return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });
  }

  if (dossie.status !== "ASSUMIDO") {
    return NextResponse.json({ error: "Dossiê não está assumido — nada a desvincular." }, { status: 400 });
  }

  await prisma.dossieComercial.update({
    where: { id },
    data: {
      oportunidadeId:  null,
      status:          "PRONTO_PARA_ASSUMIR",
      ultimaAtividade: new Date(),
    },
  });

  await prisma.atualizacaoDossie.create({
    data: {
      dossieId: id,
      tipo:     "CAMPO_ATUALIZADO",
      titulo:   "Oportunidade desvinculada",
      conteudo: `${authResult.nome ?? "Usuário"} desvinculou a oportunidade deste dossiê e redefiniu o status para "Pronto para assumir". Oportunidade anterior: ${dossie.oportunidadeId ?? "—"}.`,
      agente:   "comercial",
      usuarioId: authResult.id ?? null,
    },
  });

  await auditLog({
    action:   "DOSSIE_DESVINCULADO",
    entity:   "DossieComercial",
    entityId: id,
    after:    { status: "PRONTO_PARA_ASSUMIR", oportunidadeId: null },
    request:  req,
  });

  return NextResponse.json({
    sucesso:  true,
    mensagem: "Dossiê desvinculado. Status redefinido para Pronto para assumir.",
  });
}
