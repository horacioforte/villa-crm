// ARQUIVO: app/api/admin/diagnostico-duplicatas/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Rota de diagnóstico — encontra dossiês em investigação que também aparecem
// em oportunidades abertas (duplicatas ou inconsistências de João).
// Acesso: apenas ADMIN. Resultado: JSON com os casos encontrados.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // 1. Dossiês ainda investigando MAS com oportunidadeId direto (inconsistência de status)
  const inconsistentesStatus = await prisma.dossieComercial.findMany({
    where: {
      status: { notIn: ["ASSUMIDO", "ARQUIVADO"] },
      oportunidadeId: { not: null },
    },
    select: {
      id: true,
      titulo: true,
      status: true,
      score: true,
      oportunidade: { select: { id: true, titulo: true, status: true } },
    },
    orderBy: { score: "desc" },
  });

  // 2. Dossiês ASSUMIDO sem link de oportunidade (assumido mas sem registro)
  const assumidoSemLink = await prisma.dossieComercial.findMany({
    where: { status: "ASSUMIDO", oportunidadeId: null },
    select: { id: true, titulo: true, score: true, updatedAt: true },
    orderBy: { score: "desc" },
  });

  // 3. Oportunidades abertas que têm dossiês ainda em investigação vinculados
  //    (via relação N:N Oportunidade.dossies[])
  const oportunidadesComDossiesAtivos = await prisma.oportunidade.findMany({
    where: {
      status: { notIn: ["PERDIDA"] },
      dossies: {
        some: {
          status: { notIn: ["ASSUMIDO", "ARQUIVADO"] },
        },
      },
    },
    select: {
      id: true,
      titulo: true,
      status: true,
      dossies: {
        where: { status: { notIn: ["ASSUMIDO", "ARQUIVADO"] } },
        select: { id: true, titulo: true, status: true, score: true, completude: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 4. Resumo de totais
  const totais = {
    dossiesTotalAtivos: await prisma.dossieComercial.count({
      where: { status: { notIn: ["ARQUIVADO"] } },
    }),
    oportunidadesAbertas: await prisma.oportunidade.count({
      where: { status: { notIn: ["PERDIDA"] } },
    }),
    dossiésAssumidos: await prisma.dossieComercial.count({
      where: { status: "ASSUMIDO" },
    }),
  };

  return NextResponse.json({
    resumo: totais,
    inconsistentesStatus,        // dossiês investigando + oportunidadeId set
    assumidoSemLink,             // assumidos sem oportunidade vinculada
    oportunidadesComDossiesAtivos, // oportunidade aberta + dossie ainda investigando
    geradoEm: new Date().toISOString(),
  });
}
