// ARQUIVO: app/api/inteligencia/[id]/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Detalhe e atualização de um Dossiê Comercial.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";

// ─── GET — detalhe completo do dossiê ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: params.id },
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
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const dossieAtual = await prisma.dossieComercial.findUnique({
    where: { id: params.id },
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
    where: { id: params.id },
    data,
  });

  await prisma.atualizacaoDossie.create({
    data: {
      dossieId: params.id,
      tipo:     "CAMPO_ATUALIZADO",
      titulo:   "Dossiê atualizado via CRM",
      conteudo: `Campos atualizados manualmente por ${session.user?.name ?? "usuário"}.`,
      agente:   "manual",
      usuarioId: (session.user as { id?: string })?.id ?? null,
    },
  });

  return NextResponse.json({ sucesso: true, dossie: dossieAtualizado });
}
