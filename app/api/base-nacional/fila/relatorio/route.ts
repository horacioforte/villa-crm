// ARQUIVO: app/api/base-nacional/fila/relatorio/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Andamento da fila de verificação em Excel/PDF e registro de impressão (RelatorioConcreteirasGerado, tipo "FILA").

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { lerFiltrosFila, listarFila, progressoFila, type FiltrosFila } from "@/lib/base-nacional/fila-consulta";
import { colunasFila, gerarXlsxFila } from "@/lib/base-nacional/fila-relatorio";
import { gerarPdfBase } from "@/lib/base-nacional/pdf";

export const dynamic = "force-dynamic";
const LIMITE = 5000;

function descrever(f: FiltrosFila) {
  const p = [f.uf ? `UF ${f.uf}` : "Todas as UFs", f.prioridade ? `Prioridade ${f.prioridade}` : null, f.local ?? null,
    f.classificacao ?? null, f.potencial ? `potencial ${f.potencial}` : null, `fila: ${f.situacao}`].filter(Boolean);
  return p.join(" · ");
}
async function registrar(f: FiltrosFila, formato: string, total: number, exportados: number, usuarioId: string) {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
  return prisma.relatorioConcreteirasGerado.create({
    data: { tipo: "FILA", formato, filtros: { ...f, descricao: descrever(f), exportados } as never, totalRegistros: total, geradoPorId: u?.id ?? null },
    select: { id: true, geradoEm: true },
  });
}

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ message: "Autenticacao obrigatoria." }, { status: 401 });
  const url = new URL(request.url);
  const formato = url.searchParams.get("formato");
  if (formato !== "xlsx" && formato !== "pdf") return NextResponse.json({ message: "Formato inválido (use xlsx ou pdf)." }, { status: 400 });
  const f = lerFiltrosFila(url.searchParams);
  const [{ total, linhas }, progresso] = await Promise.all([listarFila(f, LIMITE), progressoFila(f)]);
  const reg = await registrar(f, formato === "xlsx" ? "XLSX" : "PDF", total, linhas.length, usuario.id);
  const hoje = new Date().toISOString().slice(0, 10);
  if (formato === "xlsx") {
    const buf = gerarXlsxFila(linhas, { descricao: descrever(f), progresso, relatorioId: reg.id, geradoEm: reg.geradoEm });
    return new Response(new Uint8Array(buf), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fila-verificacao-${f.uf ?? "brasil"}-${hoje}.xlsx"`,
    } });
  }
  const buf = await gerarPdfBase({
    linhas, colunas: colunasFila, total, relatorioId: reg.id, geradoEm: reg.geradoEm,
    filtros: `${descrever(f)} — verificadas ${progresso.verificadas} · pendentes ${progresso.pendentes} · restantes ${progresso.restantes} · dispensadas ${progresso.dispensadas}`,
  });
  return new Response(new Uint8Array(buf), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="fila-verificacao-${f.uf ?? "brasil"}-${hoje}.pdf"`,
  } });
}

export async function POST(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ message: "Autenticacao obrigatoria." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const f = lerFiltrosFila(new URLSearchParams(typeof body.query === "string" ? body.query.replace(/^\?/, "") : ""));
  const { total, linhas } = await listarFila(f, LIMITE);
  const reg = await registrar(f, "IMPRESSAO", total, linhas.length, usuario.id);
  return NextResponse.json({ id: reg.id, geradoEm: reg.geradoEm });
}
