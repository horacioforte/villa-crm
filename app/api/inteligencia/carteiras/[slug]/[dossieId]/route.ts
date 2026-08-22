import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const slugsPermitidos = new Set([
  "mcmv",
  "construtoras-brasil",
  "concreteiras",
  "pre-moldados",
  "revendas-caminhoes",
]);

const slugToCarteira = {
  mcmv: "MCMV",
  "construtoras-brasil": "CONSTRUTORA_BRASIL",
  concreteiras: "CONCRETEIRAS",
  "pre-moldados": "PRE_MOLDADOS",
  "revendas-caminhoes": "REVENDAS_CAMINHOES",
} as const;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string; dossieId: string }> },
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { slug, dossieId } = await context.params;
  if (!slugsPermitidos.has(slug)) {
    return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
  }

  const carteira = slugToCarteira[slug as keyof typeof slugToCarteira];

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const existing = await prisma.dossieCarteira.findUnique({
    where: { dossieId_carteira: { dossieId, carteira } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Dossiê não vinculado a esta carteira." }, { status: 404 });
  }

  const data: Record<string, unknown> = { ultimaAtualizacao: new Date() };

  if ("status" in body && typeof body.status === "string") data.status = body.status;
  if ("principalSinal" in body) data.principalSinal = body.principalSinal ?? null;
  if ("proximaAcao" in body) data.proximaAcao = body.proximaAcao ?? null;
  if ("observacoes" in body) data.observacoes = body.observacoes ?? null;
  if ("score" in body && typeof body.score === "number") data.score = body.score;
  if ("decisores" in body && typeof body.decisores === "number") data.decisores = body.decisores;
  if ("emCampanha" in body && typeof body.emCampanha === "boolean") data.emCampanha = body.emCampanha;
  if ("interessado" in body && typeof body.interessado === "boolean") data.interessado = body.interessado;
  if ("ultimaInvestigacao" in body) data.ultimaInvestigacao = body.ultimaInvestigacao ? new Date(String(body.ultimaInvestigacao)) : null;

  if (data.status === "EM_CAMPANHA") data.emCampanha = true;
  if (data.status === "INTERESSADO") data.interessado = true;

  const updated = await prisma.dossieCarteira.update({
    where: { dossieId_carteira: { dossieId, carteira } },
    data,
  });

  return NextResponse.json({ ok: true, item: updated });
}
