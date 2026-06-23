// ARQUIVO: app/api/campanhas/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Lista campanhas e retorna métricas agregadas do João.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agente = searchParams.get("agente") ?? "joao-villa";
  const campanhaId = searchParams.get("campanhaId");

  // Métricas gerais do agente (ou filtra por campanha)
  const whereProspect = {
    agente,
    ...(campanhaId ? { campanhaId } : {}),
  };

  const [
    total,
    abordados,
    responderam,
    interessados,
    qualificados,
    oportunidadesCriadas,
    descartados,
    campanhas,
  ] = await Promise.all([
    prisma.prospect.count({ where: whereProspect }),
    prisma.prospect.count({ where: { ...whereProspect, status: { in: ["ABORDADO", "RESPONDEU", "INTERESSADO", "QUALIFICADO", "OPORTUNIDADE_CRIADA"] } } }),
    prisma.prospect.count({ where: { ...whereProspect, status: { in: ["RESPONDEU", "INTERESSADO", "QUALIFICADO", "OPORTUNIDADE_CRIADA"] } } }),
    prisma.prospect.count({ where: { ...whereProspect, status: { in: ["INTERESSADO", "QUALIFICADO", "OPORTUNIDADE_CRIADA"] } } }),
    prisma.prospect.count({ where: { ...whereProspect, status: { in: ["QUALIFICADO", "OPORTUNIDADE_CRIADA"] } } }),
    prisma.prospect.count({ where: { ...whereProspect, status: "OPORTUNIDADE_CRIADA" } }),
    prisma.prospect.count({ where: { ...whereProspect, status: "DESCARTADO" } }),
    prisma.campanha.findMany({
      where: { agente },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        _count: { select: { prospects: true } },
      },
    }),
  ]);

  return NextResponse.json({
    metricas: {
      total,
      abordados,
      responderam,
      interessados,
      qualificados,
      oportunidadesCriadas,
      descartados,
      taxaResposta: total > 0 ? Math.round((responderam / total) * 100) : 0,
      taxaInteresse: total > 0 ? Math.round((interessados / total) * 100) : 0,
      taxaConversao: total > 0 ? Math.round((oportunidadesCriadas / total) * 100) : 0,
    },
    campanhas,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { nome, descricao, tipo, mensagemInicial } = body;

  if (!nome) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const campanha = await prisma.campanha.create({
    data: {
      nome,
      descricao: descricao ?? null,
      mensagemInicial: mensagemInicial ?? null,
      agente: "joao-villa",
      tipo: tipo ?? "WHATSAPP",
      status: "ATIVA",
      createdById: user.id,
    },
  });

  return NextResponse.json(campanha, { status: 201 });
}
