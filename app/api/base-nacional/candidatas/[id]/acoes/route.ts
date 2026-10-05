// ARQUIVO: app/api/base-nacional/candidatas/[id]/acoes/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Único ponto de GRAVAÇÃO da tela da Base Nacional. Cada ação:
//   1) confere o usuário (ADMIN, GERENTE ou COMERCIAL);
//   2) lê o estado atual SOMENTE das tabelas da Base Nacional (e confere se a Empresa existe, sem alterá-la);
//   3) gera o plano com as funções puras de lib/base-nacional/validacao.ts;
//   4) grava tudo numa transação com histórico obrigatório.
// Nunca cria Empresa, Pessoa, Dossiê, Carteira, Oportunidade ou Tarefa. Não aciona João, Maria, WhatsApp, e-mail ou cron.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { executarPlano, novoId } from "@/lib/base-nacional/acoes";
import {
  planejarAlteracao, planejarContato, planejarDesvinculo, planejarEvidencia, planejarInativacaoContato, planejarInativacaoPessoa,
  planejarPessoa, planejarPotencial, planejarQualificacao, planejarSituacaoContato, planejarVinculo, podeValidar, type Resultado,
} from "@/lib/base-nacional/validacao";
import type { Equipamento, NivelPotencial, PapelPessoa, Prioridade, SituacaoVerificacao, StatusValidacao, TipoContato, TipoUnidade, Confianca, TipoAtividade } from "@/lib/base-nacional/rotulos";

type Corpo = Record<string, unknown>;
const txt = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const opt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, erros: ["Faça login novamente."] }, { status: 401 });
  if (!podeValidar(usuario.papel)) return NextResponse.json({ ok: false, erros: ["Seu perfil não pode alterar a Base Nacional."] }, { status: 403 });
  const u = { id: usuario.id, papel: usuario.papel };

  const { id } = await ctx.params;
  let corpo: Corpo;
  try { corpo = (await req.json()) as Corpo; } catch { return NextResponse.json({ ok: false, erros: ["Requisição inválida."] }, { status: 400 }); }

  const c = await prisma.concreteiraCandidata.findUnique({
    where: { id },
    select: {
      id: true, statusValidacao: true, confianca: true, tipoAtividade: true, primeiraVerificacaoEm: true, empresaId: true,
      prioridadeComercial: true, observacaoComercial: true,
      unidades: { select: { id: true, tipoUnidade: true } },
      evidencias: { select: { id: true } },
    },
  });
  if (!c) return NextResponse.json({ ok: false, erros: ["Candidata não encontrada."] }, { status: 404 });
  const status = c.statusValidacao as StatusValidacao;
  const unidades = c.unidades.map(x => x.id);

  let plano: Resultado;
  switch (txt(corpo.acao)) {
    case "validar":
      plano = planejarAlteracao({
        candidataId: id, usuario: u, primeiraVerificacaoEm: c.primeiraVerificacaoEm,
        atual: { status, confianca: c.confianca as Confianca | null, tipoAtividade: c.tipoAtividade as TipoAtividade | null },
        pedido: {
          status: (opt(corpo.status) ?? undefined) as StatusValidacao | undefined,
          confianca: (opt(corpo.confianca) as Confianca | null) ?? null,
          tipoAtividade: (opt(corpo.tipoAtividade) as TipoAtividade | null) ?? null,
          justificativa: txt(corpo.justificativa),
        },
      });
      break;
    case "tipoUnidade": {
      const un = c.unidades.find(x => x.id === txt(corpo.unidadeId));
      if (!un) return NextResponse.json({ ok: false, erros: ["Unidade não pertence a esta candidata."] }, { status: 422 });
      plano = planejarAlteracao({
        candidataId: id, usuario: u, primeiraVerificacaoEm: c.primeiraVerificacaoEm,
        atual: { status, confianca: c.confianca as Confianca | null, tipoAtividade: c.tipoAtividade as TipoAtividade | null },
        pedido: { justificativa: txt(corpo.justificativa), unidade: { id: un.id, tipoAtual: un.tipoUnidade as TipoUnidade, tipoNovo: txt(corpo.tipoUnidade) as TipoUnidade } },
      });
      break;
    }
    case "evidencia": {
      const data = opt(corpo.dataEvidencia);
      plano = planejarEvidencia({
        candidataId: id, statusAtual: status, usuario: u,
        pedido: { tipoFonte: txt(corpo.tipoFonte), titulo: txt(corpo.titulo), url: opt(corpo.url), trecho: opt(corpo.trecho),
          confianca: opt(corpo.confianca), observacao: opt(corpo.observacao), dataEvidencia: data ? new Date(`${data}T12:00:00-03:00`) : null },
      });
      break;
    }
    case "vincular": {
      const empresaId = txt(corpo.empresaId);
      const existe = empresaId ? await prisma.empresa.count({ where: { id: empresaId } }) : 0; // somente leitura
      plano = planejarVinculo({
        candidataId: id, statusAtual: status, empresaId, candidataJaVinculadaA: c.empresaId, empresaExiste: existe > 0,
        confirmado: corpo.confirmado === true, justificativa: txt(corpo.justificativa), usuario: u,
      });
      break;
    }
    case "desvincular":
      plano = planejarDesvinculo({ candidataId: id, statusAtual: status, empresaAtualId: c.empresaId, justificativa: txt(corpo.justificativa), usuario: u });
      break;
    case "qualificar":
      plano = planejarQualificacao({
        candidataId: id, statusAtual: status, usuario: u,
        atual: { prioridade: c.prioridadeComercial as Prioridade | null, observacao: c.observacaoComercial },
        pedido: { prioridade: (opt(corpo.prioridade) as Prioridade | null) ?? null, observacao: opt(corpo.observacao), justificativa: txt(corpo.justificativa) },
      });
      break;
    case "contato": {
      const ativos = await prisma.concreteiraCandidataContato.findMany({ where: { candidataId: id, ativo: true }, select: { tipo: true, valorNormalizado: true } });
      plano = planejarContato({
        candidataId: id, statusAtual: status, novoId: novoId("ct"), unidadesDaCandidata: unidades, usuario: u,
        chavesAtivas: ativos.map(a => `${a.tipo}:${a.valorNormalizado}`),
        pedido: { tipo: txt(corpo.tipo) as TipoContato, valor: txt(corpo.valor), descricao: opt(corpo.descricao), unidadeId: opt(corpo.unidadeId),
          principal: corpo.principal === true, situacao: (opt(corpo.situacao) ?? undefined) as SituacaoVerificacao | undefined, fonte: opt(corpo.fonte), fonteUrl: opt(corpo.fonteUrl) },
      });
      break;
    }
    case "situacaoContato":
    case "inativarContato": {
      const ct = await prisma.concreteiraCandidataContato.findFirst({ where: { id: txt(corpo.contatoId), candidataId: id } });
      if (!ct) return NextResponse.json({ ok: false, erros: ["Contato não encontrado nesta candidata."] }, { status: 404 });
      const contato = { id: ct.id, tipo: ct.tipo as TipoContato, valor: ct.valor, ativo: ct.ativo, situacao: ct.situacao as SituacaoVerificacao };
      plano = corpo.acao === "inativarContato"
        ? planejarInativacaoContato({ candidataId: id, statusAtual: status, contato, motivo: txt(corpo.motivo), usuario: u })
        : planejarSituacaoContato({ candidataId: id, statusAtual: status, contato, situacao: txt(corpo.situacao) as SituacaoVerificacao, usuario: u });
      break;
    }
    case "pessoa": {
      const ativas = await prisma.concreteiraCandidataPessoa.findMany({ where: { candidataId: id, ativo: true }, select: { emailNormalizado: true, whatsappNormalizado: true } });
      plano = planejarPessoa({
        candidataId: id, statusAtual: status, novoId: novoId("ps"), usuario: u,
        emailsAtivos: ativas.map(a => a.emailNormalizado).filter((x): x is string => Boolean(x)),
        whatsappsAtivos: ativas.map(a => a.whatsappNormalizado).filter((x): x is string => Boolean(x)),
        pedido: {
          nome: txt(corpo.nome), funcao: opt(corpo.funcao), papeis: (Array.isArray(corpo.papeis) ? corpo.papeis : []).map(String) as PapelPessoa[],
          telefone: opt(corpo.telefone), whatsapp: opt(corpo.whatsapp), email: opt(corpo.email), linkedinUrl: opt(corpo.linkedinUrl),
          fonte: opt(corpo.fonte), fonteUrl: opt(corpo.fonteUrl), situacao: (opt(corpo.situacao) ?? undefined) as SituacaoVerificacao | undefined, observacao: opt(corpo.observacao),
        },
      });
      break;
    }
    case "inativarPessoa": {
      const ps = await prisma.concreteiraCandidataPessoa.findFirst({ where: { id: txt(corpo.pessoaId), candidataId: id }, select: { id: true, nome: true, ativo: true } });
      if (!ps) return NextResponse.json({ ok: false, erros: ["Pessoa não encontrada nesta candidata."] }, { status: 404 });
      plano = planejarInativacaoPessoa({ candidataId: id, statusAtual: status, pessoa: ps, motivo: txt(corpo.motivo), usuario: u });
      break;
    }
    case "potencial": {
      const equipamento = txt(corpo.equipamento) as Equipamento;
      const unidadeId = opt(corpo.unidadeId);
      const ex = await prisma.concreteiraPotencialEquipamento.findFirst({
        where: { candidataId: id, equipamento: equipamento as never, unidadeId: unidadeId ?? null },
        select: { id: true, potencialVenda: true, interesseLocacao: true, quantidadeEstimada: true },
      });
      const qtd = opt(corpo.quantidadeEstimada);
      plano = planejarPotencial({
        candidataId: id, statusAtual: status, novoId: novoId("pt"), usuario: u, unidadesDaCandidata: unidades,
        evidenciasDaCandidata: c.evidencias.map(e => e.id),
        existente: ex ? { id: ex.id, potencialVenda: ex.potencialVenda as NivelPotencial, interesseLocacao: ex.interesseLocacao as NivelPotencial, quantidadeEstimada: ex.quantidadeEstimada } : null,
        pedido: { equipamento, unidadeId, descricaoOutro: opt(corpo.descricaoOutro),
          potencialVenda: txt(corpo.potencialVenda) as NivelPotencial, interesseLocacao: txt(corpo.interesseLocacao) as NivelPotencial,
          quantidadeEstimada: qtd === null ? null : Number(qtd), evidenciaId: opt(corpo.evidenciaId), observacao: opt(corpo.observacao) },
      });
      break;
    }
    default:
      return NextResponse.json({ ok: false, erros: ["Ação desconhecida."] }, { status: 400 });
  }

  if (!plano.ok) return NextResponse.json({ ok: false, erros: plano.erros }, { status: 422 });
  try {
    await executarPlano(plano.operacoes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const amigavel = /Unique constraint|unico|_key/i.test(msg) ? "Registro duplicado: já existe um cadastro ativo igual."
      : /check constraint|_chk/i.test(msg) ? "O banco recusou a gravação por uma regra de validação."
      : "Não foi possível gravar. Nada foi alterado.";
    console.error("[base-nacional] falha ao gravar ação", corpo.acao, msg.slice(0, 300));
    return NextResponse.json({ ok: false, erros: [amigavel] }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

