// ARQUIVO: app/api/usuarios/responsaveis/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Retorna lista leve (id + nome) de usuários ativos para preencher o seletor de Responsável.
// Acessível a qualquer usuário autenticado.

import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, papel: true },
  });

  return NextResponse.json(usuarios);
}
