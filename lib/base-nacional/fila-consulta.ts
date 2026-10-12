// ARQUIVO: lib/base-nacional/fila-consulta.ts
// REGRA: nunca remover. Apenas acrescentar.
// Consultas e reserva da fila de verificação humana (servidor). Lê e grava SOMENTE tabelas da
// Base Nacional. A reserva usa UPDATE condicional (atômico) para impedir dupla revisão simultânea.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { RESERVA_MINUTOS } from "./fila";
import { CLASSES_TRIAGEM, type ClasseTriagem } from "./triagem";
import { NIVEIS_POTENCIAL, type NivelPotencial } from "./rotulos";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
const ler = (p: Params, k: string) => {
  const v = p instanceof URLSearchParams ? p.get(k) : p[k];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
};

export const SITUACOES_FILA_FILTRO = ["AGUARDANDO", "CONCLUIDA", "DISPENSADA_TRIAGEM", "TODAS"] as const;
export type FiltrosFila = {
  uf?: string; prioridade?: "A" | "B"; local?: "interior" | "capital"; classificacao?: ClasseTriagem; potencial?: NivelPotencial;
  situacao: (typeof SITUACOES_FILA_FILTRO)[number]; origem?: "robo"; busca?: string;
};

export function lerFiltrosFila(p: Params): FiltrosFila {
  const uf = ler(p, "uf")?.toUpperCase();
  const pr = ler(p, "prioridade");
  const lo = ler(p, "local");
  const cl = ler(p, "classificacao");
  const po = ler(p, "potencial");
  const si = ler(p, "situacao");
  return {
    uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : undefined,
    prioridade: pr === "A" || pr === "B" ? pr : undefined,
    local: lo === "interior" || lo === "capital" ? lo : undefined,
    classificacao: (CLASSES_TRIAGEM as readonly string[]).includes(cl ?? "") ? (cl as ClasseTriagem) : undefined,
    potencial: (NIVEIS_POTENCIAL as readonly string[]).includes(po ?? "") ? (po as NivelPotencial) : undefined,
    situacao: (SITUACOES_FILA_FILTRO as readonly string[]).includes(si ?? "") ? (si as FiltrosFila["situacao"]) : "AGUARDANDO",
    origem: ler(p, "origem") === "robo" ? "robo" : undefined,
    busca: ler(p, "busca")?.slice(0, 80),
  };
}

export function qsFila(f: FiltrosFila, extra: Record<string, string | number | undefined> = {}): string {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v !== undefined && v !== "" && !(k === "situacao" && v === "AGUARDANDO")) s.set(k, String(v));
  const t = s.toString();
  return t ? `?${t}` : "";
}

export function whereFila(f: FiltrosFila, semSituacao = false): Prisma.ConcreteiraTriagemWhereInput {
  const w: Prisma.ConcreteiraTriagemWhereInput = {};
  if (f.uf) w.uf = f.uf;
  if (f.prioridade) w.prioridadeReceita = f.prioridade;
  if (f.local) w.interior = f.local === "interior";
  if (f.classificacao) w.classificacao = f.classificacao;
  if (f.potencial) w.potencialCompra = f.potencial;
  if (!semSituacao && f.situacao !== "TODAS") w.situacaoFila = f.situacao;
  if (f.origem === "robo") w.sugestaoRobo = "PROVAVEL_PELO_SITE";
  if (f.busca) {
    const d = f.busca.replace(/\D/g, "");
    w.candidata = {
      OR: [
        { razaoSocial: { contains: f.busca, mode: "insensitive" } },
        { nomeFantasia: { contains: f.busca, mode: "insensitive" } },
        ...(d.length >= 8 ? [{ cnpjBasico: d.slice(0, 8) }] : []),
      ],
    };
  }
  return w;
}

const limiteReserva = () => new Date(Date.now() - RESERVA_MINUTOS * 60_000);

/** Progresso: verificadas, em revisão agora, restantes (livres) e dispensadas pela triagem. */
export async function progressoFila(f: FiltrosFila) {
  const base = whereFila(f, true);
  const [verificadas, aguardando, emRevisao, dispensadas] = await Promise.all([
    prisma.concreteiraTriagem.count({ where: { ...base, situacaoFila: "CONCLUIDA" } }),
    prisma.concreteiraTriagem.count({ where: { ...base, situacaoFila: "AGUARDANDO" } }),
    prisma.concreteiraTriagem.count({ where: { ...base, situacaoFila: "AGUARDANDO", emRevisaoPorId: { not: null }, emRevisaoDesde: { gte: limiteReserva() } } }),
    prisma.concreteiraTriagem.count({ where: { ...base, situacaoFila: "DISPENSADA_TRIAGEM" } }),
  ]);
  return { verificadas, pendentes: aguardando, emRevisao, restantes: aguardando - emRevisao, dispensadas, total: verificadas + aguardando + dispensadas };
}

/** Fila por estado (contagens). */
export async function filasPorEstado() {
  const g = await prisma.concreteiraTriagem.groupBy({ by: ["uf", "situacaoFila"], _count: { _all: true } });
  const m = new Map<string, { uf: string; aguardando: number; concluidas: number; dispensadas: number }>();
  for (const x of g) {
    const uf = x.uf ?? "—";
    if (!m.has(uf)) m.set(uf, { uf, aguardando: 0, concluidas: 0, dispensadas: 0 });
    const r = m.get(uf)!;
    if (x.situacaoFila === "AGUARDANDO") r.aguardando += x._count._all;
    else if (x.situacaoFila === "CONCLUIDA") r.concluidas += x._count._all;
    else r.dispensadas += x._count._all;
  }
  return [...m.values()].sort((a, b) => b.aguardando - a.aguardando || a.uf.localeCompare(b.uf));
}

export const selectLinhaFila = {
  candidataId: true, classificacao: true, pontuacao: true, uf: true, municipio: true, interior: true, prioridadeReceita: true,
  situacaoFila: true, motivoFila: true, sugestaoRobo: true, potencialCompra: true, emRevisaoPorId: true, emRevisaoDesde: true,
  concluidaEm: true, roboExecutadoEm: true,
  emRevisaoPor: { select: { nome: true } },
  concluidaPor: { select: { nome: true } },
  candidata: { select: { razaoSocial: true, nomeFantasia: true, cnpjMatriz: true, cnpjBasico: true, statusValidacao: true, confianca: true, totalUnidadesAtivas: true } },
} satisfies Prisma.ConcreteiraTriagemSelect;

export async function listarFila(f: FiltrosFila, limite = 50, pular = 0) {
  const where = whereFila(f);
  const [total, linhas] = await Promise.all([
    prisma.concreteiraTriagem.count({ where }),
    prisma.concreteiraTriagem.findMany({ where, select: selectLinhaFila, orderBy: [{ pontuacao: "desc" }, { candidataId: "asc" }], take: limite, skip: pular }),
  ]);
  return { total, linhas };
}

/** Reserva atômica: só reserva se estiver livre, vencida ou já for do mesmo usuário. */
export async function reservar(candidataId: string, usuarioId: string): Promise<{ ok: boolean; por?: string | null }> {
  const r = await prisma.concreteiraTriagem.updateMany({
    where: {
      candidataId, situacaoFila: "AGUARDANDO",
      OR: [{ emRevisaoPorId: null }, { emRevisaoPorId: usuarioId }, { emRevisaoDesde: { lt: limiteReserva() } }],
    },
    data: { emRevisaoPorId: usuarioId, emRevisaoDesde: new Date() },
  });
  if (r.count === 1) return { ok: true };
  const t = await prisma.concreteiraTriagem.findUnique({ where: { candidataId }, select: { situacaoFila: true, emRevisaoPor: { select: { nome: true } } } });
  return { ok: false, por: t?.situacaoFila === "AGUARDANDO" ? t.emRevisaoPor?.nome ?? "outra pessoa" : null };
}

export async function liberar(candidataId: string, usuarioId: string) {
  await prisma.concreteiraTriagem.updateMany({ where: { candidataId, emRevisaoPorId: usuarioId }, data: { emRevisaoPorId: null, emRevisaoDesde: null } });
}

/** Próxima empresa livre da fila (pula a atual e as reservadas por outros) e já a reserva. */
export async function proximaDaFila(f: FiltrosFila, usuarioId: string, excetoId?: string): Promise<string | null> {
  const where: Prisma.ConcreteiraTriagemWhereInput = {
    ...whereFila({ ...f, situacao: "AGUARDANDO" }),
    ...(excetoId ? { candidataId: { not: excetoId } } : {}),
    AND: [{ OR: [{ emRevisaoPorId: null }, { emRevisaoPorId: usuarioId }, { emRevisaoDesde: { lt: limiteReserva() } }] }],
  };
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const c = await prisma.concreteiraTriagem.findFirst({ where, select: { candidataId: true }, orderBy: [{ pontuacao: "desc" }, { candidataId: "asc" }], skip: tentativa });
    if (!c) return null;
    if ((await reservar(c.candidataId, usuarioId)).ok) return c.candidataId;
  }
  return null;
}

/** Tudo o que a tela de revisão mostra sobre uma empresa. */
export async function fichaFila(candidataId: string) {
  const t = await prisma.concreteiraTriagem.findUnique({
    where: { candidataId },
    select: {
      ...selectLinhaFila, sinais: true, roboResumo: true, versaoRegra: true,
      candidata: {
        select: {
          id: true, razaoSocial: true, nomeFantasia: true, cnpjMatriz: true, cnpjBasico: true, porte: true, naturezaJuridica: true, capitalSocial: true,
          municipioMatriz: true, ufMatriz: true, statusValidacao: true, confianca: true, tipoAtividade: true, justificativa: true,
          primeiraVerificacaoEm: true, prioridadeComercial: true, observacaoComercial: true, totalUnidades: true, totalUnidadesAtivas: true,
          unidades: { select: { id: true, cnpj: true, isMatriz: true, ativa: true, nomeFantasia: true, municipioNome: true, uf: true, cnaePrincipal: true, cnaesSecundarios: true, cnaeAlvoComoPrincipal: true }, orderBy: [{ isMatriz: "desc" }, { cnpj: "asc" }] },
          evidencias: { select: { id: true, tipoFonte: true, titulo: true, url: true, trecho: true, coletadoEm: true, confianca: true, agente: true }, orderBy: { coletadoEm: "desc" }, take: 20 },
          contatos: { where: { ativo: true }, select: { tipo: true, valor: true, fonteUrl: true }, take: 20 },
          potenciais: { select: { equipamento: true, potencialVenda: true } },
          vinculosOrigem: {
            select: { tipo: true, chaveMascarada: true, forca: true, candidataRelacionada: { select: { id: true, razaoSocial: true, nomeFantasia: true, statusValidacao: true, ufMatriz: true, municipioMatriz: true } } },
            orderBy: { forca: "asc" }, take: 20,
          },
        },
      },
    },
  });
  return t;
}
