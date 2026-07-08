// ARQUIVO: app/api/agent/dossie/[id]/noticia/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// João registra uma notícia, insight ou atualização de monitoramento no dossiê.
// Funciona mesmo após o dossiê ser assumido (tipo=MONITORAMENTO).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: {
    titulo: string;
    conteudo: string;
    fonte?: string;
    link?: string;
    tipo?: string; // NOTICIA_ENCONTRADA | MONITORAMENTO | CAMPO_ATUALIZADO
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  if (!body.titulo?.trim() || !body.conteudo?.trim()) {
    return NextResponse.json({ error: "titulo e conteudo são obrigatórios." }, { status: 400 });
  }

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, oportunidadeId: true },
  });
  if (!dossie) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });

  // Dossiê assumido → tipo MONITORAMENTO automaticamente
  const tipo = dossie.status === "ASSUMIDO"
    ? "MONITORAMENTO"
    : (body.tipo ?? "NOTICIA_ENCONTRADA");

  await prisma.$transaction([
    prisma.atualizacaoDossie.create({
      data: {
        dossieId:      params.id,
        tipo:          tipo as "NOTICIA_ENCONTRADA" | "MONITORAMENTO" | "CAMPO_ATUALIZADO",
        titulo:        body.titulo,
        conteudo:      body.conteudo,
        fonte:         body.fonte   ?? null,
        link:          body.link    ?? null,
        agente:        "joao-radar",
        // Se dossiê assumido, vincula à oportunidade para aparecer na aba Inteligência
        oportunidadeId: dossie.oportunidadeId ?? null,
      },
    }),
    prisma.dossieComercial.update({
      where: { id: params.id },
      data: {
        totalNoticias:    { increment: 1 },
        totalAtualizacoes: { increment: 1 },
        ultimaAtividade:  new Date(),
      },
    }),
  ]);

  return NextResponse.json({
    sucesso:          true,
    tipo,
    monitoramento:    dossie.status === "ASSUMIDO",
    oportunidadeId:   dossie.oportunidadeId,
  }, { status: 201 });
}
