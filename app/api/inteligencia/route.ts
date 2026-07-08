// ARQUIVO: app/api/inteligencia/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// API da Central de Inteligência Comercial — listagem e criação de Dossiês.
// Autenticação via sessão NextAuth (uso interno do CRM).

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";

// ─── GET — listar dossiês com filtros ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = req.nextUrl;
  const status    = searchParams.get("status")   ?? undefined;
  const origem    = searchParams.get("origem")   ?? undefined;
  const tipo      = searchParams.get("tipo")     ?? undefined;
  const segmento  = searchParams.get("segmento") ?? undefined;
  const estado    = searchParams.get("estado")   ?? undefined;
  const prioridade = searchParams.get("prioridade") ?? undefined;
  const scoreMin  = searchParams.get("scoreMin") ? Number(searchParams.get("scoreMin")) : undefined;
  const page      = Number(searchParams.get("page") ?? "1");
  const limit     = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

  const where: Record<string, unknown> = {};
  if (status)    where.status    = status;
  if (origem)    where.origem    = origem;
  if (tipo)      where.tipo      = tipo;
  if (segmento)  where.segmento  = { contains: segmento, mode: "insensitive" };
  if (estado)    where.estado    = estado;
  if (prioridade) where.prioridade = prioridade;
  if (scoreMin !== undefined) where.score = { gte: scoreMin };

  const [total, dossies] = await Promise.all([
    prisma.dossieComercial.count({ where }),
    prisma.dossieComercial.findMany({
      where,
      orderBy: [{ status: "asc" }, { score: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        empresa: { select: { id: true, razaoSocial: true } },
        obra:    { select: { id: true, nome: true } },
        _count:  { select: { decisores: true, empresasRelacionadas: true, atualizacoes: true } },
      },
    }),
  ]);

  return NextResponse.json({ total, page, limit, dossies });
}

// ─── POST — criar novo dossiê manualmente (via CRM, não pelo João) ────────────

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  let body: {
    titulo: string;
    resumo?: string;
    origem?: string;
    tipo?: string;
    segmento?: string;
    cidade?: string;
    estado?: string;
    clienteFinal?: string;
    construtora?: string;
    epc?: string;
    epcm?: string;
    faseObra?: string;
    valorEstimado?: number;
    fonteInformacao?: string;
    linkFonte?: string;
    score?: number;
    prioridade?: string;
    empresaId?: string;
    obraId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });
  }

  const { completude, missaoAtual } = recalcularDossie(body, []);

  const dossie = await prisma.dossieComercial.create({
    data: {
      titulo:         body.titulo,
      resumo:         body.resumo         ?? null,
      origem:         (body.origem as "JOAO_RADAR" | "JOAO_OUTBOUND" | "MANUAL") ?? "MANUAL",
      tipo:           (body.tipo as "OBRA" | "EMPRESA" | "MOVIMENTO_ESTRATEGICO" | "LICENCIAMENTO" | "LEAD") ?? "OBRA",
      segmento:       body.segmento       ?? null,
      cidade:         body.cidade         ?? null,
      estado:         body.estado         ?? null,
      clienteFinal:   body.clienteFinal   ?? null,
      construtora:    body.construtora    ?? null,
      epc:            body.epc            ?? null,
      epcm:           body.epcm           ?? null,
      faseObra:       body.faseObra       ?? null,
      valorEstimado:  body.valorEstimado  ? String(body.valorEstimado) : null,
      fonteInformacao: body.fonteInformacao ?? null,
      linkFonte:      body.linkFonte      ?? null,
      score:          body.score          ?? 0,
      prioridade:     body.prioridade     ?? null,
      completude,
      missaoAtual,
      criadoPorAgente: "manual",
      ultimaAtividade: new Date(),
      empresaId:      body.empresaId      ?? null,
      obraId:         body.obraId         ?? null,
    },
  });

  await prisma.atualizacaoDossie.create({
    data: {
      dossieId: dossie.id,
      tipo:     "CRIACAO",
      titulo:   "Dossiê criado manualmente",
      conteudo: `Dossiê criado manualmente no CRM por ${authResult.nome ?? "usuário"}.`,
      agente:   "manual",
      usuarioId: authResult.id ?? null,
    },
  });

  return NextResponse.json({ sucesso: true, dossieId: dossie.id, dossie }, { status: 201 });
}
