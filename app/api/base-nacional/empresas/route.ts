// ARQUIVO: app/api/base-nacional/empresas/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Busca SOMENTE LEITURA de Empresas existentes do CRM para o vínculo manual (máx. 10).
// Não cria nem altera Empresa.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ empresas: [] }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ empresas: [] });
  const digitos = q.replace(/\D/g, "");
  const empresas = await prisma.empresa.findMany({
    where: {
      OR: [
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
        ...(digitos.length >= 5 ? [{ cnpj: { contains: digitos } }] : []),
      ],
    },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, cidade: true, estado: true },
    orderBy: { razaoSocial: "asc" },
    take: 10,
  });
  return NextResponse.json({ empresas });
}
