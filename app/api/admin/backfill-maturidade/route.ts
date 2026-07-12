// ARQUIVO: app/api/admin/backfill-maturidade/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Backfill one-shot: percorre todos os DossieComercial e calcula/salva
// maturidadeComercial para registros existentes que ainda estão em 0.
// Auth: Bearer AGENT_API_KEY (mesma chave do João).
// Execução: POST /api/admin/backfill-maturidade
// Parâmetro opcional: { forcar: true } para recalcular TODOS (não só os zerados).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcularMaturidadeComercial } from "@/lib/inteligencia/completude";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let forcar = false;
  try {
    const body = await req.json();
    forcar = body?.forcar === true;
  } catch {
    // body vazio → ok, usa padrão (só zerados)
  }

  // Busca dossiês: só zerados (padrão) ou todos (forcar: true)
  const where = forcar ? {} : { maturidadeComercial: 0 };

  const dossies = await prisma.dossieComercial.findMany({
    where,
    select: {
      id:             true,
      epc:            true,
      epcm:           true,
      construtora:    true,
      licenciamento:  true,
      valorEstimado:  true,
      decisores: {
        select: {
          nome:      true,
          telefone:  true,
          email:     true,
          linkedin:  true,
        },
      },
    },
  });

  let atualizados = 0;
  let erros = 0;

  for (const d of dossies) {
    try {
      const maturidadeComercial = calcularMaturidadeComercial(d, d.decisores);

      // Só salva se o valor mudou (evita writes desnecessários)
      await prisma.dossieComercial.update({
        where: { id: d.id },
        data:  { maturidadeComercial },
      });
      atualizados++;
    } catch {
      erros++;
    }
  }

  return NextResponse.json({
    sucesso:     true,
    total:       dossies.length,
    atualizados,
    erros,
    forcar,
    mensagem:    `Backfill concluído: ${atualizados} de ${dossies.length} dossiês atualizados.`,
  });
}
