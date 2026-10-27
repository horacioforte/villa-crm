// ARQUIVO: app/api/inteligencia/exportar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Exporta todos os dossiês não arquivados como CSV (abre no Excel).
// GET /api/inteligencia/exportar
// GET /api/inteligencia/exportar?todos=1  → inclui arquivados
// GET /api/inteligencia/exportar?status=ARQUIVADO → só arquivados

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Prisma, StatusDossie } from "@/app/generated/prisma/client";

function esc(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v).replace(/\r?\n/g, " ").trim();
  if (s.includes('"') || s.includes(";")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const authResult = await requirePermission("inteligencia", "read", req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const todos = searchParams.get("todos") === "1";
  const soStatus = searchParams.get("status");

  let where: Prisma.DossieComercialWhereInput = {};
  if (!todos) {
    if (soStatus && Object.values(StatusDossie).includes(soStatus as StatusDossie)) {
      where = { status: soStatus as StatusDossie };
    } else {
      where = { status: { not: "ARQUIVADO" } };
    }
  }

  const dossies = await prisma.dossieComercial.findMany({
    where,
    include: {
      decisores: { select: { nome: true, cargo: true } },
      _count: { select: { decisores: true, atualizacoes: true } },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
  });

  const cabecalho = [
    "Titulo", "Status", "Score", "Completude%", "Maturidade%", "Prioridade",
    "Cliente Final", "Construtora", "EPC", "EPCM",
    "Cidade", "Estado", "Segmento", "Valor Estimado (R$)",
    "Fase da Obra", "Cronograma", "Licenciamento",
    "Decisores (#)", "Decisores (nomes)", "Atualizacoes",
    "Missao Atual", "Proxima Acao", "Fonte",
    "Resumo", "Motivo Descarte",
    "Criado em", "Atualizado em", "ID",
  ].join(";");

  const linhas = dossies.map(d => {
    const decisoresNomes = d.decisores
      .map(dec => dec.nome ?? "")
      .filter(Boolean)
      .join(", ");
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
      d.valorEstimado != null ? d.valorEstimado.toString() : "",
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
