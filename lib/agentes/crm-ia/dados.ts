// ARQUIVO: lib/agentes/crm-ia/dados.ts
// REGRA: nunca remover. Apenas acrescentar.
// Funções de consulta ao banco de dados para o CRM IA.

import { prisma } from "@/lib/prisma";

// ─── Resumo Geral ─────────────────────────────────────────────────────────────

export async function resumoGeral() {
  const [
    totalEmpresas,
    totalOportunidades,
    oportunidadesAbertas,
    totalPropostas,
    tarefasPendentes,
    totalConversas,
    totalEquipamentos,
  ] = await Promise.all([
    prisma.empresa.count({ where: { ativa: true } }),
    prisma.oportunidade.count({ where: { ativa: true } }),
    prisma.oportunidade.count({
      where: {
        ativa: true,
        status: { notIn: ["GANHA", "PERDIDA"] },
      },
    }),
    prisma.propostaComercial.count(),
    prisma.tarefa.count({ where: { status: { in: ["PENDENTE", "EM_ANDAMENTO"] } } }),
    prisma.conversa.count(),
    prisma.equipamento.count(),
  ]);

  return {
    totalEmpresas,
    totalOportunidades,
    oportunidadesAbertas,
    totalPropostas,
    tarefasPendentes,
    totalConversas,
    totalEquipamentos,
  };
}

// ─── Oportunidades ────────────────────────────────────────────────────────────

export async function buscarOportunidades({
  status,
  canalOrigem,
  tipoServico,
  limite = 20,
}: {
  status?: string;
  canalOrigem?: string;
  tipoServico?: string;
  limite?: number;
} = {}) {
  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      ativa: true,
      ...(status ? { status: status as any } : {}),
      ...(canalOrigem ? { canalOrigem: canalOrigem as any } : {}),
      ...(tipoServico ? { tipoServico: tipoServico as any } : {}),
    },
    include: {
      empresa: { select: { razaoSocial: true, cidade: true, estado: true } },
      pessoa: { select: { nome: true, cargo: true } },
      obra: { select: { nome: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limite,
  });

  return oportunidades.map((o) => ({
    id: o.id,
    titulo: o.titulo,
    status: o.status,
    temperatura: o.temperatura,
    tipoServico: o.tipoServico,
    canalOrigem: o.canalOrigem,
    empresa: o.empresa?.razaoSocial,
    cidade: o.empresa?.cidade,
    estado: o.empresa?.estado,
    contato: o.pessoa?.nome,
    obra: o.obra?.nome,
    potencial: o.potencialOportunidade,
    criadaEm: o.createdAt,
    atualizadaEm: o.updatedAt,
  }));
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function buscarPipeline() {
  const grupos = await prisma.oportunidade.groupBy({
    by: ["status"],
    where: { ativa: true },
    _count: { id: true },
  });

  return grupos.map((g) => ({
    status: g.status,
    quantidade: g._count.id,
  }));
}

// ─── Empresas ────────────────────────────────────────────────────────────────

export async function buscarEmpresas({
  estado,
  segmento,
  limite = 20,
}: {
  estado?: string;
  segmento?: string;
  limite?: number;
} = {}) {
  const empresas = await prisma.empresa.findMany({
    where: {
      ativa: true,
      ...(estado ? { estado } : {}),
      ...(segmento ? { segmento: { contains: segmento, mode: "insensitive" } } : {}),
    },
    include: {
      _count: {
        select: { oportunidades: true, obras: true },
      },
    },
    orderBy: { razaoSocial: "asc" },
    take: limite,
  });

  return empresas.map((e) => ({
    id: e.id,
    razaoSocial: e.razaoSocial,
    segmento: e.segmento,
    cidade: e.cidade,
    estado: e.estado,
    oportunidades: e._count.oportunidades,
    obras: e._count.obras,
  }));
}

// ─── Tarefas ──────────────────────────────────────────────────────────────────

export async function buscarTarefas({
  status,
  limite = 20,
}: {
  status?: string;
  limite?: number;
} = {}) {
  const tarefas = await prisma.tarefa.findMany({
    where: {
      ...(status ? { status: status as any } : { status: { in: ["PENDENTE", "EM_ANDAMENTO", "ATRASADA"] } }),
    },
    include: {
      empresa: { select: { razaoSocial: true } },
      oportunidade: { select: { titulo: true } },
      pessoa: { select: { nome: true } },
    },
    orderBy: { dataVencimento: "asc" },
    take: limite,
  });

  return tarefas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    tipo: t.tipo,
    status: t.status,
    prioridade: t.prioridade,
    vencimento: t.dataVencimento,
    empresa: t.empresa?.razaoSocial,
    oportunidade: t.oportunidade?.titulo,
    contato: t.pessoa?.nome,
  }));
}

// ─── Propostas ────────────────────────────────────────────────────────────────

export async function buscarPropostas({
  status,
  limite = 20,
}: {
  status?: string;
  limite?: number;
} = {}) {
  const propostas = await prisma.propostaComercial.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
    },
    include: {
      oportunidade: {
        include: {
          empresa: { select: { razaoSocial: true, estado: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limite,
  });

  return propostas.map((p) => ({
    id: p.id,
    numero: p.numeroProposta,
    versao: p.versao,
    status: p.status,
    empresa: p.oportunidade?.empresa?.razaoSocial,
    estado: p.oportunidade?.empresa?.estado,
    criadaEm: p.createdAt,
  }));
}

// ─── Origem dos Leads ─────────────────────────────────────────────────────────

export async function buscarOrigemLeads() {
  const grupos = await prisma.oportunidade.groupBy({
    by: ["canalOrigem"],
    where: { ativa: true },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return grupos.map((g) => ({
    canal: g.canalOrigem,
    quantidade: g._count.id,
  }));
}

// ─── Equipamentos ─────────────────────────────────────────────────────────────

export async function buscarEquipamentos({
  status,
  tipo,
}: {
  status?: string;
  tipo?: string;
} = {}) {
  const equipamentos = await prisma.equipamento.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(tipo ? { tipo: tipo as any } : {}),
    },
    orderBy: { nome: "asc" },
  });

  return equipamentos.map((e) => ({
    id: e.id,
    nome: e.nome,
    tipo: e.tipo,
    status: e.status,
    modelo: e.modelo,
    ano: e.ano,
  }));
}

// ─── Criar Tarefa ─────────────────────────────────────────────────────────────

export async function criarTarefa({
  titulo,
  descricao,
  tipo,
  prioridade,
  dataVencimento,
  empresaId,
  oportunidadeId,
  pessoaId,
}: {
  titulo: string;
  descricao?: string;
  tipo: string;
  prioridade?: string;
  dataVencimento?: string;
  empresaId?: string;
  oportunidadeId?: string;
  pessoaId?: string;
}) {
  const tarefa = await prisma.tarefa.create({
    data: {
      titulo,
      descricao: descricao ?? null,
      tipo: tipo as any,
      prioridade: (prioridade as any) ?? "MEDIA",
      status: "PENDENTE",
      dataVencimento: dataVencimento ? new Date(dataVencimento) : new Date(Date.now() + 86400000),
      empresaId: empresaId ?? null,
      oportunidadeId: oportunidadeId ?? null,
      pessoaId: pessoaId ?? null,
    },
    select: { id: true, titulo: true },
  });

  return tarefa;
}
