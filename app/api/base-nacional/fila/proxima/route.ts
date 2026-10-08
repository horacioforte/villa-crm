// ARQUIVO: app/api/base-nacional/fila/proxima/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Devolve (e reserva) a próxima empresa livre da fila, respeitando os filtros da tela.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { lerFiltrosFila, liberar, proximaDaFila } from "@/lib/base-nacional/fila-consulta";
import { podeValidar } from "@/lib/base-nacional/validacao";

export async function POST(req: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, erros: ["Faça login novamente."] }, { status: 401 });
  if (!podeValidar(usuario.papel)) return NextResponse.json({ ok: false, erros: ["Seu perfil não pode usar a fila de verificação."] }, { status: 403 });
  const corpo = (await req.json().catch(() => ({}))) as { query?: string; excetoId?: string };
  const filtros = lerFiltrosFila(new URLSearchParams(typeof corpo.query === "string" ? corpo.query.replace(/^\?/, "") : ""));
  if (corpo.excetoId) await liberar(corpo.excetoId, usuario.id);
  const id = await proximaDaFila(filtros, usuario.id, corpo.excetoId);
  return NextResponse.json({ ok: true, id });
}
