// ARQUIVO: app/api/inteligencia/exportar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Exporta todos os dossiês não arquivados como CSV (abre no Excel).
// GET /api/inteligencia/exportar
// GET /api/inteligencia/exportar?status=ARQUIVADO  → inclui arquivados
// GET /api/inteligencia/exportar?todos=1           → tudo

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function esc(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v).replace(/\r?\n/g, " ").trim();
  // Escapa aspas duplas e envolve em aspas se contiver vírgula, aspas ou ponto-e-vírgula
  if (s.includes('"') || s.includes(",") || s.includes(";") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const authResult = await requirePermission("inteligencia", "read", req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const todos = searchParams.get("todos") === "1";
  const soStatus = searchParams.get("status"); // ex.: "ARQUIVADO"

  const whereStatus = todos
    ? {}
    : soStatus
    ? { status: soStatus as string }
    : { status: { not: "ARQUIVADO" as const } };

  const dossies = await prisma.dossieComercial.findMany({
    where: whereStatus,
    select: {
      id: true,
      titulo: true,
      status: true,
      score: true,
      completude: true,
      maturidadeComercial: true,
      prioridade: true,
      clienteFinal: true,
      construtora: true,
      epc: true,
      epcm: true,
      cidade: true,
      estado: true,
      segmento: true,
      valorEstimado: true,
      faseObra: true,
      cronograma: true,
      licenciamento: true,
      resumo: true,
      missaoAtual: true,
      proximaAcaoSugerida: true,
      fonteInformacao: true,
      motivoDescarte: true,
      createdAt: true,
      updatedAt: true,
      decisores: { select: { nome: true, cargo: true } },
      _count: { select: { decisores: true, atualizacoes: true } },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
  });

  // Cabeçalho CSV
  const cabecalho = [
    "Título", "Status", "Score", "Completude%", "Maturidade%", "Prioridade",
    "Cliente Final", "Construtora", "EPC", "EPCM",
    "Cidade", "Estado", "Segmento", "Valor Estimado",
    "Fase da Obra", "Cronograma", "Licenciamento",
    "Decisores (#)", "Decisores (nomes)", "Atualizações",
    "Missão Atual", "Próxima Ação", "Fonte",
    "Resumo", "Motivo Descarte",
    "Criado em", "Atualizado em", "ID",
  ].join(";");

  const linhas = dossies.map(d => {
    const decisoresNomes = d.decisores.map(dec => dec.nome ?? "").filter(Boolean).join(", ");
    return [
      esc(d.titulo),
      esc(d.status),
      d.score,
      d.completude,
      d.maturidadeComercial ?? "",
      esc(d.prioridade),
      esc(d.clienteFinal),
      esc(d.construtora),
      esc(d.epc),
      esc(d.epcm),
      esc(d.cidade),
      esc(d.estado),
      esc(d.segmento),
      esc(d.valorEstimado),
      esc(d.faseObra),
      esc(d.cronograma),
      esc(d.licenciamento),
      d._count.decisores,
      esc(decisoresNomes),
      d._count.atualizacoes,
      esc(d.missaoAtual),
      esc(d.proximaAcaoSugerida),
      esc(d.fonteInformacao),
      esc(d.resumo),
      esc(d.motivoDescarte),
      d.createdAt.toISOString().slice(0, 10),
      d.updatedAt.toISOString().slice(0, 10),
      d.id,
    ].join(";");
  });

  const csv = [cabecalho, ...linhas].join("\r\n");
  const dataHoje = new Date().toISOString().slice(0, 10);

  return new NextResponse(
    "﻿" + csv, // BOM UTF-8 para Excel reconhecer acentos
    {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dossies-villa-${dataHoje}.csv"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
