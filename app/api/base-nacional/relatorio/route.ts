// ARQUIVO: app/api/base-nacional/relatorio/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Exportação da Base Nacional de Concreteiras (Excel/PDF) e registro de impressão.
// Única gravação: RelatorioConcreteirasGerado (tabela nova). Não grava AuditLog
// (usa getCurrentUser, que não registra tentativas) nem qualquer tabela antiga.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { linhasParaExportar } from "@/lib/base-nacional/consulta";
import { LIMITE_EXPORTACAO, lerFiltros } from "@/lib/base-nacional/filtros";
import { colunasRelatorio, gerarXlsxBase, registrarRelatorio, rotulosFiltros } from "@/lib/base-nacional/relatorios";
import { gerarPdfBase } from "@/lib/base-nacional/pdf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function nomeSegmento(slug?: string) {
  if (!slug) return undefined;
  const s = await prisma.segmentoEmpresa.findUnique({ where: { slug }, select: { nome: true } });
  return s?.nome ?? slug;
}

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ message: "Autenticacao obrigatoria." }, { status: 401 });

  const url = new URL(request.url);
  const formato = url.searchParams.get("formato");
  if (formato !== "xlsx" && formato !== "pdf") {
    return NextResponse.json({ message: "Formato inválido (use xlsx ou pdf)." }, { status: 400 });
  }

  const filtros = lerFiltros(url.searchParams);
  const { total, linhas } = await linhasParaExportar(filtros, LIMITE_EXPORTACAO);
  const descricao = rotulosFiltros(filtros, await nomeSegmento(filtros.segmento));
  const registro = await registrarRelatorio({
    filtros, formato: formato === "xlsx" ? "XLSX" : "PDF", totalRegistros: total, exportados: linhas.length,
    usuarioId: usuario.id, descricao,
  });
  const hoje = new Date().toISOString().slice(0, 10);

  if (formato === "xlsx") {
    const buffer = gerarXlsxBase(linhas, { descricao, total, relatorioId: registro.id, geradoEm: registro.geradoEm });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="base-nacional-concreteiras-${hoje}.xlsx"`,
      },
    });
  }

  const buffer = await gerarPdfBase({ linhas, colunas: colunasRelatorio, filtros: descricao, total, relatorioId: registro.id, geradoEm: registro.geradoEm });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="base-nacional-concreteiras-${hoje}.pdf"`,
    },
  });
}

/** Registra uma impressão (chamado pelo botão Imprimir antes de abrir o diálogo). */
export async function POST(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ message: "Autenticacao obrigatoria." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const filtros = lerFiltros(new URLSearchParams(typeof body.query === "string" ? body.query : ""));
  const { total, linhas } = await linhasParaExportar(filtros, LIMITE_EXPORTACAO);
  const registro = await registrarRelatorio({
    filtros, formato: "IMPRESSAO", totalRegistros: total, exportados: linhas.length, usuarioId: usuario.id,
    descricao: rotulosFiltros(filtros, await nomeSegmento(filtros.segmento)),
  });
  return NextResponse.json({ id: registro.id, geradoEm: registro.geradoEm });
}
