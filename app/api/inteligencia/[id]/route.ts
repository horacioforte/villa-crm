// ARQUIVO: app/api/inteligencia/[id]/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Detalhe e atualização de um Dossiê Comercial.

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";

// ─── GET — detalhe completo do dossiê ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth(_req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: id },
    include: {
      empresa:             { select: { id: true, razaoSocial: true, cidade: true, estado: true } },
      obra:                { select: { id: true, nome: true, cidade: true, estado: true } },
      oportunidade:        { select: { id: true, titulo: true, status: true } },
      assumidoPor:         { select: { id: true, nome: true } },
      decisores:           { orderBy: { createdAt: "asc" } },
      empresasRelacionadas: { orderBy: { papel: "asc" } },
      atualizacoes:        { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!dossie) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });

  return NextResponse.json(dossie);
}

// ─── PATCH — atualizar campos do dossiê (via CRM, não pelo João) ──────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const dossieAtual = await prisma.dossieComercial.findUnique({
    where: { id: id },
    include: { decisores: { select: { nome: true, telefone: true, email: true, linkedin: true } } },
  });
  if (!dossieAtual) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // Campos que podem ser atualizados pela UI
  const camposPermitidos = [
    "titulo", "resumo", "segmento", "status", "prioridade",
    "cidade", "estado", "clienteFinal", "construtora", "epc", "epcm",
    "consorcio", "faseObra", "cronograma", "licenciamento",
    "valorEstimado", "volumeConcreto", "equipamentosSugeridos",
    "campanhasSugerida", "proximaAcaoSugerida", "concorrentes",
    "fornecedores", "concreteiras", "fonteInformacao", "linkFonte",
    "score", "missaoAtual", "empresaId", "obraId",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const campo of camposPermitidos) {
    if (campo in body) data[campo] = body[campo];
  }

  // Recalcula completude com dados mesclados
  const dadosMesclados = { ...dossieAtual, ...data };
  const { completude, missaoAtual } = recalcularDossie(dadosMesclados, dossieAtual.decisores);
  data.completude = completude;
  // Só atualiza missão se não foi enviada manualmente
  if (!("missaoAtual" in body)) data.missaoAtual = missaoAtual;
  data.ultimaAtividade = new Date();

  const dossieAtualizado = await prisma.dossieComercial.update({
    where: { id: id },
    data,
  });

  await prisma.atualizacaoDossie.create({
    data: {
      dossieId: id,
      tipo:     "CAMPO_ATUALIZADO",
      titulo:   "Dossiê atualizado via CRM",
      conteudo: `Campos atualizados manualmente por ${authResult.nome ?? "usuário"}.`,
      agente:   "manual",
      usuarioId: authResult.id ?? null,
    },
  });

  return NextResponse.json({ sucesso: true, dossie: dossieAtualizado });
}
