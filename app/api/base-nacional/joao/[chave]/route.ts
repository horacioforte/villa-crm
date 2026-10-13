// ARQUIVO: app/api/base-nacional/joao/[chave]/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Grava a decisão humana da fila comercial do João (perfis que validam). Não envia mensagem nem inicia contato.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { DECISOES_COMERCIAIS, decidirGrupoJoao, type DecisaoComercial } from "@/lib/base-nacional/joao/fila-comercial";
import { podeValidar } from "@/lib/base-nacional/validacao";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ chave: string }> }) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, erros: ["Autenticação obrigatória."] }, { status: 401 });
  if (!podeValidar(usuario.papel)) return NextResponse.json({ ok: false, erros: ["Seu perfil não pode registrar decisões."] }, { status: 403 });
  const { chave } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { decisao?: string; observacao?: string; contatosInvalidos?: unknown };
  if (!body.decisao || !(DECISOES_COMERCIAIS as readonly string[]).includes(body.decisao)) return NextResponse.json({ ok: false, erros: ["Escolha uma decisão."] }, { status: 400 });
  const ids = Array.isArray(body.contatosInvalidos) ? body.contatosInvalidos.filter((x): x is string => typeof x === "string") : [];
  const r = await decidirGrupoJoao({ chave: decodeURIComponent(chave), decisao: body.decisao as DecisaoComercial, observacao: typeof body.observacao === "string" ? body.observacao.slice(0, 2000) : null, contatosInvalidos: ids, usuarioId: usuario.id });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
