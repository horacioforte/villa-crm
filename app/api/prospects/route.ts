// ARQUIVO: app/api/prospects/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Lista e cria prospects do João (outbound).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const agente = searchParams.get("agente");
  const campanhaId = searchParams.get("campanhaId");
  const busca = searchParams.get("busca");

  const prospects = await prisma.prospect.findMany({
    where: {
      ...(status ? { status: status as "PROSPECTADO" | "ABORDADO" | "RESPONDEU" | "INTERESSADO" | "QUALIFICADO" | "OPORTUNIDADE_CRIADA" | "DESCARTADO" } : {}),
      ...(agente ? { agente } : {}),
      ...(campanhaId ? { campanhaId } : {}),
      ...(busca
        ? {
            OR: [
              { nomeContato: { contains: busca, mode: "insensitive" } },
              { telefone: { contains: busca } },
              { email: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      pessoa: { select: { nome: true } },
      campanha: { select: { nome: true } },
      oportunidade: { select: { titulo: true, status: true } },
      interacoes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { tipo: true, createdAt: true },
      },
    },
  });

  return NextResponse.json(prospects);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { telefone, nomeContato, email, origem, origemDetalhe, campanhaId, empresaId, pessoaId } = body;

  if (!telefone && !email) {
    return NextResponse.json({ error: "Informe telefone ou email." }, { status: 400 });
  }

  const prospect = await prisma.prospect.create({
    data: {
      agente: "joao-villa",
      status: "PROSPECTADO",
      telefone: telefone ?? null,
      nomeContato: nomeContato ?? null,
      email: email ?? null,
      origem: origem ?? "manual",
      origemDetalhe: origemDetalhe ?? null,
      campanhaId: campanhaId ?? null,
      empresaId: empresaId ?? null,
      pessoaId: pessoaId ?? null,
    },
  });

  return NextResponse.json(prospect, { status: 201 });
}
