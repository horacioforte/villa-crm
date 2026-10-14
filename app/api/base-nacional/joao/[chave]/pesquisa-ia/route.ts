// ARQUIVO: app/api/base-nacional/joao/[chave]/pesquisa-ia/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Pesquisa assistida por IA (Claude ou OpenAI, busca web) para grupos B e C da fila comercial
// do João. DESLIGADA por padrão — só responde quando pesquisaIaAtiva() (JOAO_PESQUISA_IA_ATIVA=
// true + provedor configurado). Nunca grava pessoa/contato: devolve o JSON pronto para revisão
// humana e posterior `joao-enriquecer.ts --importar-web`. Não envia mensagem, não liga.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { pesquisaIaAtiva, provedorConfigurado } from "@/lib/base-nacional/joao/pesquisa-ia-config";
import { clientePorProvedor } from "@/lib/base-nacional/joao/pesquisa-ia-provedores";
import { executarPesquisaIA } from "@/lib/base-nacional/joao/pesquisa-ia-executar";
import type { EntradaPesquisaIA } from "@/lib/base-nacional/joao/pesquisa-ia";
import { podeValidar } from "@/lib/base-nacional/validacao";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ chave: string }> }) {
  if (!pesquisaIaAtiva()) return NextResponse.json({ ok: false, erros: ["Módulo de pesquisa com IA está desligado."] }, { status: 403 });
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, erros: ["Autenticação obrigatória."] }, { status: 401 });
  if (!podeValidar(usuario.papel)) return NextResponse.json({ ok: false, erros: ["Seu perfil não pode usar a pesquisa com IA."] }, { status: 403 });

  const { chave } = await ctx.params;
  const grupo = await prisma.joaoEnriquecimentoGrupo.findUnique({ where: { chave: decodeURIComponent(chave) }, select: { chave: true, nome: true, candidataIds: true, dominios: true, categoriaComercial: true, indicadores: true } });
  if (!grupo) return NextResponse.json({ ok: false, erros: ["Grupo não encontrado."] }, { status: 404 });
  if (grupo.categoriaComercial !== "B" && grupo.categoriaComercial !== "C") {
    return NextResponse.json({ ok: false, erros: ["Pesquisa com IA só está disponível para grupos B e C."] }, { status: 400 });
  }

  const empresas = await prisma.concreteiraCandidata.findMany({ where: { id: { in: grupo.candidataIds } }, select: { razaoSocial: true, nomeFantasia: true, ufMatriz: true, municipioMatriz: true } });
  const nomesEmpresa = empresas.flatMap(e => [e.razaoSocial, e.nomeFantasia]).filter((x): x is string => Boolean(x));
  const ind = (grupo.indicadores ?? {}) as { ufs?: string[] };
  const principal = empresas[0];
  const cidadeUf = [principal?.municipioMatriz, principal?.ufMatriz ?? ind.ufs?.[0]].filter(Boolean).join("/") || "UF não identificada";

  const entrada: EntradaPesquisaIA = { nome: grupo.nome, cidadeUf, dominio: grupo.dominios[0] ?? null };
  const provedor = provedorConfigurado();
  if (!provedor) return NextResponse.json({ ok: false, erros: ["Nenhum provedor configurado (JOAO_PESQUISA_IA_PROVEDOR)."] }, { status: 403 });

  try {
    const r = await executarPesquisaIA({ grupoChave: grupo.chave, entrada, nomesEmpresa, cliente: clientePorProvedor(provedor) });
    if (!r.ok) return NextResponse.json({ ok: false, erros: [r.motivo] }, { status: 429 });
    return NextResponse.json({ ok: true, doCache: r.doCache, provedor, entradaImportarWeb: r.entradaImportarWeb, rejeitados: r.rejeitados });
  } catch (e) {
    return NextResponse.json({ ok: false, erros: [`Falha na pesquisa: ${e instanceof Error ? e.message : "erro desconhecido"}`] }, { status: 502 });
  }
}
