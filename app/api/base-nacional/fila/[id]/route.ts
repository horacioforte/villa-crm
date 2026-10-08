// ARQUIVO: app/api/base-nacional/fila/[id]/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Fila de verificação humana: reservar, liberar e DECIDIR uma empresa.
// A decisão grava numa transação (executarPlano): situação + evidência + qualificação + potencial +
// fila concluída + histórico, com responsável e data. Só tabelas da Base Nacional.
// Nunca cria Empresa, Pessoa, Dossiê, Carteira, Oportunidade ou Tarefa; não envia mensagens.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { executarPlano, novoId } from "@/lib/base-nacional/acoes";
import { planejarDecisao } from "@/lib/base-nacional/fila";
import { liberar, reservar } from "@/lib/base-nacional/fila-consulta";
import { podeValidar } from "@/lib/base-nacional/validacao";
import type { Confianca, Prioridade, StatusValidacao, TipoAtividade } from "@/lib/base-nacional/rotulos";

const txt = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, erros: ["Faça login novamente."] }, { status: 401 });
  if (!podeValidar(usuario.papel)) return NextResponse.json({ ok: false, erros: ["Seu perfil não pode usar a fila de verificação."] }, { status: 403 });
  const { id } = await ctx.params;
  let corpo: Record<string, unknown>;
  try { corpo = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, erros: ["Requisição inválida."] }, { status: 400 }); }

  if (corpo.acao === "reservar") {
    const r = await reservar(id, usuario.id);
    return NextResponse.json(r.ok ? { ok: true } : { ok: false, erros: [r.por ? `${r.por} está revisando esta empresa agora.` : "Esta empresa não está aguardando verificação."] }, { status: r.ok ? 200 : 409 });
  }
  if (corpo.acao === "liberar") {
    await liberar(id, usuario.id);
    return NextResponse.json({ ok: true });
  }
  if (corpo.acao !== "decidir") return NextResponse.json({ ok: false, erros: ["Ação desconhecida."] }, { status: 400 });

  const t = await prisma.concreteiraTriagem.findUnique({
    where: { candidataId: id },
    select: {
      situacaoFila: true, emRevisaoPorId: true, emRevisaoDesde: true,
      candidata: {
        select: {
          statusValidacao: true, confianca: true, tipoAtividade: true, primeiraVerificacaoEm: true, prioridadeComercial: true, observacaoComercial: true,
          unidades: { select: { id: true } }, evidencias: { select: { id: true } }, potenciais: { where: { unidadeId: null }, select: { equipamento: true } },
        },
      },
    },
  });
  if (!t) return NextResponse.json({ ok: false, erros: ["Empresa não está na fila de verificação."] }, { status: 404 });
  const c = t.candidata;
  const data = opt(corpo.dataEvidencia);
  const plano = planejarDecisao({
    candidataId: id, usuario: { id: usuario.id, papel: usuario.papel },
    reserva: { emRevisaoPorId: t.emRevisaoPorId, emRevisaoDesde: t.emRevisaoDesde }, situacaoFila: t.situacaoFila,
    atual: {
      status: c.statusValidacao as StatusValidacao, confianca: c.confianca as Confianca | null, tipoAtividade: c.tipoAtividade as TipoAtividade | null,
      primeiraVerificacaoEm: c.primeiraVerificacaoEm, prioridade: c.prioridadeComercial as Prioridade | null, observacaoComercial: c.observacaoComercial,
    },
    equipamentosExistentes: c.potenciais.map(p => p.equipamento), unidades: c.unidades.map(u => u.id), evidencias: c.evidencias.map(e => e.id),
    novosIds: { potencial: () => novoId("pt") },
    pedido: {
      decisao: txt(corpo.decisao), confianca: opt(corpo.confianca), tipoAtividade: opt(corpo.tipoAtividade), justificativa: txt(corpo.justificativa),
      url: opt(corpo.url), tipoFonte: opt(corpo.tipoFonte), tituloEvidencia: opt(corpo.tituloEvidencia), trecho: opt(corpo.trecho),
      dataEvidencia: data ? new Date(`${data}T12:00:00-03:00`) : null,
      potencialCompra: txt(corpo.potencialCompra), equipamentos: Array.isArray(corpo.equipamentos) ? corpo.equipamentos.map(String) : [],
      observacaoComercial: opt(corpo.observacaoComercial), prioridade: opt(corpo.prioridade),
    },
  });
  if (!plano.ok) return NextResponse.json({ ok: false, erros: plano.erros }, { status: 422 });
  try {
    await executarPlano(plano.operacoes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("[base-nacional] falha ao gravar decisão da fila", msg.slice(0, 300));
    return NextResponse.json({ ok: false, erros: [/check constraint|_chk/i.test(msg) ? "O banco recusou a gravação por uma regra de validação." : "Não foi possível gravar. Nada foi alterado."] }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
