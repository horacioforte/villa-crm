// ARQUIVO: app/api/agent/dossies/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// João consulta os dossiês abertos para saber o que investigar esta semana.
// Auth: Bearer AGENT_API_KEY (machine-to-machine).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function GET(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "INVESTIGANDO,PEDIR_MAIS_PESQUISA,AGUARDANDO_VALIDACAO";
  const statusList = status.split(",").map(s => s.trim());

  const dossies = await prisma.dossieComercial.findMany({
    where: {
      status: { in: statusList as ("INVESTIGANDO" | "AGUARDANDO_VALIDACAO" | "EM_ANALISE" | "PEDIR_MAIS_PESQUISA" | "PRONTO_PARA_ASSUMIR" | "ASSUMIDO" | "ARQUIVADO")[] },
    },
    orderBy: [{ completude: "asc" }, { score: "desc" }],
    select: {
      id:              true,
      titulo:          true,
      resumo:          true,
      status:          true,
      origem:          true,
      segmento:        true,
      cidade:          true,
      estado:          true,
      clienteFinal:    true,
      construtora:     true,
      epc:             true,
      epcm:            true,
      faseObra:        true,
      valorEstimado:   true,
      score:           true,
      completude:      true,
      missaoAtual:     true,
      fonteInformacao: true,
      linkFonte:       true,
      totalDecisores:  true,
      updatedAt:       true,
      decisores: {
        select: { nome: true, cargo: true, telefone: true, email: true, linkedin: true },
      },
    },
  });

  return NextResponse.json({
    total: dossies.length,
    dossies,
    instrucao: "Para cada dossiê: pesquise com base na missaoAtual. Use PATCH /api/agent/dossie/{id} para enriquecer.",
  });
}
