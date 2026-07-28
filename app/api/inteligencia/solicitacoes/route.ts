// ARQUIVO: app/api/inteligencia/solicitacoes/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Cria dossiê marcado como "Solicitado por Horácio" via formulário direto.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  let body: {
    titulo: string;
    cidade?: string;
    estado?: string;
    segmento?: string;
    clienteFinal?: string;
    resumo?: string;
    missaoInicial?: string;
    prioridade?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "Título obrigatório." }, { status: 400 });
  }

  const dossie = await prisma.dossieComercial.create({
    data: {
      titulo:          body.titulo.trim(),
      origem:          "MANUAL",
      tipo:            "OBRA",
      status:          "INVESTIGANDO",
      segmento:        body.segmento?.trim() || null,
      cidade:          body.cidade?.trim() || null,
      estado:          body.estado?.trim().toUpperCase() || null,
      clienteFinal:    body.clienteFinal?.trim() || null,
      resumo:          body.resumo?.trim() || null,
      missaoAtual:     body.missaoInicial?.trim() ||
                       "Investigação solicitada por Horácio — levantar decisores, contatos e potencial da obra/empresa.",
      prioridade:      (body.prioridade as any) ?? "MEDIA",
      fonteInformacao: "Solicitado por Horácio",
      score:           0,
      completude:      0,
    },
    select: { id: true, titulo: true },
  });

  return NextResponse.json({ id: dossie.id, titulo: dossie.titulo });
}
