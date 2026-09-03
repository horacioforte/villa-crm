// ARQUIVO: app/api/midias-sociais/instagram/conteudos/route.ts
// Central de Mídias Sociais — Sprint 2 (Instagram Analytics Real), C4.
// Ver Proposta_Tecnica_Sprint2_Instagram_Analytics.docx, item 15.
//
// Lista paginada de conteúdo Instagram já sincronizado — só lê o Postgres,
// nunca chama a Meta (item 8).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";

const TIPOS_VALIDOS = ["POST", "REEL", "CARROSSEL", "STORY"] as const;
const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 50;

export async function GET(request: Request) {
  const authResult = await requirePermission("midias_sociais", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const tipoParam = searchParams.get("tipo");
  const cursor = searchParams.get("cursor") ?? undefined;
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, LIMITE_MAXIMO) : LIMITE_PADRAO;

  if (tipoParam && !TIPOS_VALIDOS.includes(tipoParam as (typeof TIPOS_VALIDOS)[number])) {
    return NextResponse.json(
      { message: `Tipo inválido. Use um de: ${TIPOS_VALIDOS.join(", ")}.` },
      { status: 400 },
    );
  }

  const conta = await prisma.redeSocialConta.findFirst({
    where: { rede: "INSTAGRAM" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!conta) {
    return NextResponse.json({ data: [], nextCursor: null });
  }

  const conteudos = await prisma.conteudoSocial.findMany({
    where: {
      redeSocialContaId: conta.id,
      ...(tipoParam ? { tipo: tipoParam as (typeof TIPOS_VALIDOS)[number] } : {}),
    },
    orderBy: { publicadoEm: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const temMais = conteudos.length > limit;
  const pagina = temMais ? conteudos.slice(0, limit) : conteudos;

  return NextResponse.json({
    data: pagina,
    nextCursor: temMais ? (pagina[pagina.length - 1]?.id ?? null) : null,
  });
}
