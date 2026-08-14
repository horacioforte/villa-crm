// ARQUIVO: app/api/maria/metrica/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Retorna lista detalhada de leads para cada métrica da página Maria.

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { CanalOrigem, StatusOportunidade, TipoContato } from "@/app/generated/prisma/client";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffMinutes(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function tempoRelativo(minutos: number) {
  if (minutos < 60) return `${minutos} min atrás`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h atrás`;
  return `${Math.floor(horas / 24)}d atrás`;
}

const TEMP_LABEL: Record<string, string> = {
  QUENTE: "🔥 Quente",
  MEDIA: "🟡 Média",
  FRIA: "🔵 Fria",
};

export async function GET(request: NextRequest) {
  const authResult = await requirePermission("relatorios", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const tipo = request.nextUrl.searchParams.get("tipo");
  const agora = new Date();
  const hoje = startOfDay(agora);

  // Base de oportunidades de Maria (site + whatsapp + email)
  const baseWhere = {
    ativa: true,
    OR: [
      { canalOrigem: { in: [CanalOrigem.SITE, CanalOrigem.OUTROS] } },
      { historicos: { some: { tipo: { in: [TipoContato.EMAIL, TipoContato.WHATSAPP] } } } },
    ],
  };

  const baseSelect = {
    id: true,
    titulo: true,
    status: true,
    temperatura: true,
    canalOrigem: true,
    createdAt: true,
    pessoaId: true,
    empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cidade: true } },
    pessoa: { select: { nome: true, whatsapp: true, telefone: true } },
    historicos: {
      where: { tipo: { in: [TipoContato.WHATSAPP, TipoContato.EMAIL, TipoContato.OUTRO] } },
      orderBy: { createdAt: "desc" as const },
      take: 1,
      select: { createdAt: true, resumo: true },
    },
  };

  // Helper: busca a conversa mais recente para um conjunto de oportunidades.
  // Tenta os dois caminhos: oportunidadeId (vínculo direto) e pessoaId (fallback).
  // Retorna mapa keyed por oportunidade.id → conversaId.
  async function getConversaIdMap(
    oportunidades: { id: string; pessoaId: string | null }[]
  ): Promise<Map<string, string>> {
    if (oportunidades.length === 0) return new Map();
    const oportunidadeIds = oportunidades.map((o) => o.id);
    const pessoaIds = oportunidades.map((o) => o.pessoaId).filter((id): id is string => !!id);

    const orClause: object[] = [{ oportunidadeId: { in: oportunidadeIds } }];
    if (pessoaIds.length > 0) orClause.push({ pessoaId: { in: pessoaIds } });

    const conversas = await prisma.conversa.findMany({
      where: { status: { not: "SPAM" }, OR: orClause },
      select: { id: true, pessoaId: true, oportunidadeId: true },
      orderBy: { ultimaMensagemEm: "desc" },
    });

    // Índices separados para priorizar o vínculo direto
    const byOportunidade = new Map<string, string>();
    const byPessoa = new Map<string, string>();
    for (const c of conversas) {
      if (c.oportunidadeId && !byOportunidade.has(c.oportunidadeId))
        byOportunidade.set(c.oportunidadeId, c.id);
      if (c.pessoaId && !byPessoa.has(c.pessoaId))
        byPessoa.set(c.pessoaId, c.id);
    }

    const result = new Map<string, string>(); // key = oportunidade.id
    for (const o of oportunidades) {
      const cId =
        byOportunidade.get(o.id) ??
        (o.pessoaId ? byPessoa.get(o.pessoaId) : undefined);
      if (cId) result.set(o.id, cId);
    }
    return result;
  }

  try {
    if (tipo === "novos-leads-hoje") {
      const leads = await prisma.oportunidade.findMany({
        where: { ...baseWhere, createdAt: { gte: hoje } },
        select: baseSelect,
        orderBy: { createdAt: "desc" },
      });
      const conversaMap = await getConversaIdMap(leads.map((o) => ({ id: o.id, pessoaId: o.pessoaId })));

      return NextResponse.json(leads.map((o) => ({
        id: o.id,
        nome: o.pessoa?.nome ?? "—",
        empresa: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
        empresaId: o.empresa.id,
        cidade: o.empresa.cidade ?? "—",
        telefone: o.pessoa?.whatsapp ?? o.pessoa?.telefone ?? "—",
        temperatura: TEMP_LABEL[o.temperatura ?? ""] ?? "—",
        info: `Chegou ${tempoRelativo(diffMinutes(o.createdAt, agora))}`,
        status: o.status,
        conversaId: conversaMap.get(o.id) ?? null,
      })));
    }

    if (tipo === "conversas-ativas") {
      const leads = await prisma.oportunidade.findMany({
        where: { ...baseWhere, status: { in: ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO"] as StatusOportunidade[] } },
        select: baseSelect,
        orderBy: { createdAt: "desc" },
      });
      const conversaMap = await getConversaIdMap(leads.map((o) => ({ id: o.id, pessoaId: o.pessoaId })));

      return NextResponse.json(leads.map((o) => ({
        id: o.id,
        nome: o.pessoa?.nome ?? "—",
        empresa: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
        empresaId: o.empresa.id,
        cidade: o.empresa.cidade ?? "—",
        telefone: o.pessoa?.whatsapp ?? o.pessoa?.telefone ?? "—",
        temperatura: TEMP_LABEL[o.temperatura ?? ""] ?? "—",
        info: o.historicos[0]
          ? `Último contato ${tempoRelativo(diffMinutes(o.historicos[0].createdAt, agora))}`
          : `Sem contato — lead há ${tempoRelativo(diffMinutes(o.createdAt, agora))}`,
        status: o.status,
        conversaId: conversaMap.get(o.id) ?? null,
      })));
    }

    if (tipo === "aguardando-resposta") {
      const [leads, tarefas] = await Promise.all([
        prisma.oportunidade.findMany({
          where: { ...baseWhere, status: { in: ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO"] as StatusOportunidade[] } },
          select: baseSelect,
          orderBy: { createdAt: "desc" },
        }),
        prisma.tarefa.findMany({
          where: { tipo: "WHATSAPP", status: "PENDENTE" },
          select: {
            id: true, titulo: true, dataVencimento: true, prioridade: true,
            empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cidade: true } },
            pessoa: { select: { nome: true, whatsapp: true, telefone: true } },
          },
          orderBy: { dataVencimento: "asc" },
        }),
      ]);

      const conversaMap = await getConversaIdMap(leads.map((o) => ({ id: o.id, pessoaId: o.pessoaId })));

      const leadsItems = leads.map((o) => {
        const ultimoContato = o.historicos[0]?.createdAt ?? o.createdAt;
        const minutos = diffMinutes(ultimoContato, agora);
        return {
          id: o.id,
          nome: o.pessoa?.nome ?? "—",
          empresa: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
          empresaId: o.empresa.id,
          cidade: o.empresa.cidade ?? "—",
          telefone: o.pessoa?.whatsapp ?? o.pessoa?.telefone ?? "—",
          temperatura: TEMP_LABEL[o.temperatura ?? ""] ?? "—",
          info: `Parado há ${tempoRelativo(minutos)}`,
          status: o.status,
          minutosParado: minutos,
          tipo: "lead" as const,
          conversaId: conversaMap.get(o.id) ?? null,
        };
      });

      const tarefasItems = tarefas.map((t) => ({
        id: t.id,
        nome: t.pessoa?.nome ?? "—",
        empresa: t.empresa?.nomeFantasia ?? t.empresa?.razaoSocial ?? "—",
        empresaId: t.empresa?.id ?? null,
        cidade: t.empresa?.cidade ?? "—",
        telefone: t.pessoa?.whatsapp ?? t.pessoa?.telefone ?? "—",
        temperatura: "—",
        info: t.dataVencimento
          ? t.dataVencimento < agora ? `⚠️ Venceu ${tempoRelativo(diffMinutes(t.dataVencimento, agora))}` : `Vence em breve`
          : "Follow-up pendente",
        status: "TAREFA",
        minutosParado: t.dataVencimento ? diffMinutes(t.dataVencimento, agora) : 0,
        tipo: "tarefa" as const,
      }));

      return NextResponse.json(
        [...leadsItems, ...tarefasItems].sort((a, b) => b.minutosParado - a.minutosParado)
      );
    }

    if (tipo === "qualificados-hoje") {
      const leads = await prisma.oportunidade.findMany({
        where: { ...baseWhere, createdAt: { gte: hoje }, status: { notIn: ["NOVA", "PERDIDA"] as StatusOportunidade[] } },
        select: baseSelect,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(leads.map((o) => ({
        id: o.id,
        nome: o.pessoa?.nome ?? "—",
        empresa: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
        empresaId: o.empresa.id,
        cidade: o.empresa.cidade ?? "—",
        telefone: o.pessoa?.whatsapp ?? o.pessoa?.telefone ?? "—",
        temperatura: TEMP_LABEL[o.temperatura ?? ""] ?? "—",
        info: `Status: ${o.status}`,
        status: o.status,
      })));
    }

    if (tipo === "followups-pendentes") {
      const tarefas = await prisma.tarefa.findMany({
        where: { tipo: "WHATSAPP", status: "PENDENTE" },
        select: {
          id: true, titulo: true, dataVencimento: true, prioridade: true,
          empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true, cidade: true } },
          pessoa: { select: { nome: true, whatsapp: true, telefone: true } },
          oportunidade: { select: { titulo: true } },
        },
        orderBy: { dataVencimento: "asc" },
      });

      return NextResponse.json(tarefas.map((t) => ({
        id: t.id,
        nome: t.pessoa?.nome ?? "—",
        empresa: t.empresa?.nomeFantasia ?? t.empresa?.razaoSocial ?? "—",
        empresaId: t.empresa?.id ?? null,
        cidade: t.empresa?.cidade ?? "—",
        telefone: t.pessoa?.whatsapp ?? t.pessoa?.telefone ?? "—",
        temperatura: "—",
        info: t.dataVencimento && t.dataVencimento < agora
          ? `⚠️ Atrasado ${tempoRelativo(diffMinutes(t.dataVencimento, agora))}`
          : "Pendente",
        status: "TAREFA",
        titulo: t.titulo,
      })));
    }

    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  } catch (err) {
    console.error("[API_MARIA_METRICA]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
