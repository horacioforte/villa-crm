// ARQUIVO: app/api/base-nacional/joao/relatorio/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Fila comercial do João em Excel/PDF e registro de impressão (RelatorioConcreteirasGerado, tipo "JOAO").

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { lerFiltrosJoao, listarFilaJoao, type FiltrosJoao } from "@/lib/base-nacional/joao/fila-comercial";
import { colunasJoao, descreverFiltrosJoao, gerarXlsxJoao } from "@/lib/base-nacional/joao/relatorio-joao";
import { gerarPdfBase } from "@/lib/base-nacional/pdf";

export const dynamic = "force-dynamic";

async function registrar(f: FiltrosJoao, formato: string, total: number, usuarioId: string) {
  const u = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
  return prisma.relatorioConcreteirasGerado.create({
    data: { tipo: "JOAO", formato, filtros: { ...f, descricao: descreverFiltrosJoao(f) } as never, totalRegistros: total, geradoPorId: u?.id ?? null },
    select: { id: true, geradoEm: true },
  });
}

export async function GET(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ message: "Autenticacao obrigatoria." }, { status: 401 });
  const url = new URL(request.url);
  const formato = url.searchParams.get("formato");
  if (formato !== "xlsx" && formato !== "pdf") return NextResponse.json({ message: "Formato inválido (use xlsx ou pdf)." }, { status: 400 });
  const f = lerFiltrosJoao(url.searchParams);
  const { linhas } = await listarFilaJoao(f);
  const reg = await registrar(f, formato === "xlsx" ? "XLSX" : "PDF", linhas.length, usuario.id);
  const hoje = new Date().toISOString().slice(0, 10);
  if (formato === "xlsx") {
    const ids = linhas.flatMap(l => l.candidataIds);
    const grupoDe = new Map(linhas.flatMap(l => l.candidataIds.map(id => [id, l.nome] as const)));
    const empDe = new Map(linhas.flatMap(l => l.empresas.map(e => [e.id, e.nomeFantasia || e.razaoSocial] as const)));
    const [pessoas, contatos] = await Promise.all([
      prisma.concreteiraCandidataPessoa.findMany({ where: { candidataId: { in: ids }, ativo: true, situacao: { not: "INVALIDO" }, fonte: "RECEITA_FEDERAL" }, select: { candidataId: true, nome: true, funcao: true, fonte: true, confianca: true, linkedinUrl: true, fonteUrl: true } }),
      prisma.concreteiraCandidataContato.findMany({ where: { candidataId: { in: ids }, ativo: true, situacao: { not: "INVALIDO" }, tipo: { in: ["TELEFONE", "WHATSAPP", "EMAIL", "LINKEDIN"] } }, select: { candidataId: true, tipo: true, valor: true, descricao: true, fonte: true, confianca: true, situacao: true, fonteUrl: true } }),
    ]);
    const buf = gerarXlsxJoao(linhas, {
      pessoas: pessoas.map(p => ({ grupo: grupoDe.get(p.candidataId) ?? "", empresa: empDe.get(p.candidataId) ?? "", nome: p.nome, cargo: p.funcao, fonte: p.fonte, confianca: p.confianca, linkedin: p.linkedinUrl, fonteUrl: p.fonteUrl })),
      contatos: contatos.map(k => ({ grupo: grupoDe.get(k.candidataId) ?? "", empresa: empDe.get(k.candidataId) ?? "", tipo: k.tipo, valor: k.valor, descricao: k.descricao, fonte: k.fonte, confianca: k.confianca, situacao: k.situacao, fonteUrl: k.fonteUrl })),
    }, { descricao: descreverFiltrosJoao(f), relatorioId: reg.id, geradoEm: reg.geradoEm });
    return new Response(new Uint8Array(buf), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fila-comercial-joao-${f.uf ?? "brasil"}-${hoje}.xlsx"`,
    } });
  }
  const buf = await gerarPdfBase({ linhas, colunas: colunasJoao, total: linhas.length, relatorioId: reg.id, geradoEm: reg.geradoEm,
    filtros: `Fila comercial do João — ${descreverFiltrosJoao(f)}. Contatos são gerais da empresa. Nenhum contato foi feito.` });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="fila-comercial-joao-${f.uf ?? "brasil"}-${hoje}.pdf"` } });
}

export async function POST(request: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ message: "Autenticacao obrigatoria." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const f = lerFiltrosJoao(new URLSearchParams(typeof body.query === "string" ? body.query.replace(/^\?/, "") : ""));
  const { linhas } = await listarFilaJoao(f);
  const reg = await registrar(f, "IMPRESSAO", linhas.length, usuario.id);
  return NextResponse.json({ id: reg.id, geradoEm: reg.geradoEm });
}
