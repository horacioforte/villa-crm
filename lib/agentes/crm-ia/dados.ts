// ARQUIVO: lib/agentes/crm-ia/dados.ts
// REGRA: nunca remover. Apenas acrescentar.
// Funções de consulta ao banco de dados para o CRM IA.

import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

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
  id,
  status,
  canalOrigem,
  tipoServico,
  temperatura,
  responsavelId,
  limite = 20,
}: {
  id?: string;
  status?: string;
  canalOrigem?: string;
  tipoServico?: string;
  temperatura?: string;
  responsavelId?: string;
  limite?: number;
} = {}) {
  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      ativa: true,
      ...(id ? { id } : {}),
      ...(status ? { status: status as any } : {}),
      ...(canalOrigem ? { canalOrigem: canalOrigem as any } : {}),
      ...(tipoServico ? { tipoServico: tipoServico as any } : {}),
      ...(temperatura ? { temperatura: temperatura as any } : {}),
      ...(responsavelId ? { responsavelId } : {}),
    },
    include: {
      empresa: { select: { razaoSocial: true, cidade: true, estado: true } },
      pessoa: { select: { nome: true, cargo: true } },
      obra: { select: { nome: true } },
      // Inclui tarefas e histórico apenas quando buscando por ID específico (evita query pesada na listagem geral)
      ...(id ? {
        tarefas: {
          select: { titulo: true, tipo: true, status: true, dataVencimento: true, resultado: true, resultadoCodigo: true, responsavel: { select: { nome: true } } },
          orderBy: { dataVencimento: "desc" as const },
        },
        historicos: {
          select: { tipo: true, resumo: true, detalhes: true, dataContato: true, usuario: { select: { nome: true } } },
          orderBy: { dataContato: "desc" as const },
        },
      } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limite,
  });

  return oportunidades.map((o: any) => ({
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
    ...(id ? {
      tarefas: (o.tarefas ?? []).map((t: any) => ({
        titulo: t.titulo,
        tipo: t.tipo,
        status: t.status,
        data: t.dataVencimento,
        resultado: t.resultado,
        resultadoCodigo: t.resultadoCodigo,
        responsavel: t.responsavel?.nome,
      })),
      historicosContato: (o.historicos ?? []).map((h: any) => ({
        tipo: h.tipo,
        resumo: h.resumo,
        detalhes: h.detalhes,
        data: h.dataContato,
        usuario: h.usuario?.nome,
      })),
    } : {}),
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
  responsavelId,
  limite = 20,
}: {
  status?: string;
  responsavelId?: string;
  limite?: number;
} = {}) {
  const where: Record<string, any> = {};
  if (status) {
    where.status = status as any;
  } else {
    where.status = { in: ["PENDENTE", "EM_ANDAMENTO", "ATRASADA"] };
  }
  if (responsavelId) where.responsavelId = responsavelId;

  const tarefas = await prisma.tarefa.findMany({
    where,
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
  diasParadaMinima,
  limite = 20,
}: {
  status?: string;
  diasParadaMinima?: number;
  limite?: number;
} = {}) {
  const where: Record<string, any> = {};
  if (status) where.status = status as any;
  if (diasParadaMinima) {
    const corte = new Date(Date.now() - diasParadaMinima * 24 * 60 * 60 * 1000);
    where.updatedAt = { lt: corte };
  }

  const agora = Date.now();
  const propostas = await prisma.propostaComercial.findMany({
    where,
    include: {
      oportunidade: {
        include: {
          empresa: { select: { razaoSocial: true, estado: true } },
          pessoa: { select: { nome: true, telefone: true, whatsapp: true } },
          responsavel: { select: { nome: true } },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: limite,
  });

  return propostas.map((p) => ({
    id: p.id,
    numero: p.numeroProposta,
    versao: p.versao,
    status: p.status,
    valorTotal: p.valorTotal,
    validade: p.validadeProposta,
    validadeVencida: new Date(p.validadeProposta) < new Date(),
    diasParada: Math.floor((agora - new Date(p.updatedAt).getTime()) / 86400000),
    empresa: p.oportunidade?.empresa?.razaoSocial,
    estado: p.oportunidade?.empresa?.estado,
    contato: p.oportunidade?.pessoa?.nome,
    contatoTelefone: p.oportunidade?.pessoa?.whatsapp ?? p.oportunidade?.pessoa?.telefone,
    responsavel: p.oportunidade?.responsavel?.nome,
    templateUtilizado: p.templateUtilizado,
    criadaEm: p.createdAt,
    atualizadaEm: p.updatedAt,
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

// ─── Buscar Usuário por Email (para permissões) ───────────────────────────────

export async function buscarUsuarioPorEmail(email: string) {
  return prisma.usuario.findUnique({
    where: { email },
    select: { id: true, papel: true, nome: true },
  });
}

// ─── Pessoas (Contatos) ────────────────────────────────────────────────────────

export async function buscarPessoas({
  nome,
  empresaNome,
  cargo,
  telefone,
  limite = 20,
}: {
  nome?: string;
  empresaNome?: string;
  cargo?: string;
  telefone?: string;
  limite?: number;
} = {}) {
  const pessoas = await prisma.pessoa.findMany({
    where: {
      ativa: true,
      ...(nome ? { nome: { contains: nome, mode: "insensitive" } } : {}),
      ...(cargo ? { cargo: { contains: cargo, mode: "insensitive" } } : {}),
      ...(telefone
        ? { OR: [{ telefone: { contains: telefone } }, { whatsapp: { contains: telefone } }] }
        : {}),
      ...(empresaNome
        ? { empresa: { razaoSocial: { contains: empresaNome, mode: "insensitive" } } }
        : {}),
    },
    include: {
      empresa: { select: { razaoSocial: true, cidade: true, estado: true } },
      historicos: {
        orderBy: { dataContato: "desc" },
        take: 1,
        select: { dataContato: true, tipo: true, resumo: true },
      },
    },
    orderBy: { nome: "asc" },
    take: limite,
  });

  return pessoas.map((p) => ({
    id: p.id,
    nome: p.nome,
    cargo: p.cargo,
    email: p.email,
    telefone: p.telefone,
    whatsapp: p.whatsapp,
    tipo: p.tipo,
    influencia: p.influenciaDecisao,
    relacionamento: p.nivelRelacionamento,
    empresa: p.empresa?.razaoSocial,
    cidade: p.empresa?.cidade,
    estado: p.empresa?.estado,
    ultimoContato: p.historicos[0]?.dataContato ?? null,
    ultimoContatoTipo: p.historicos[0]?.tipo ?? null,
    ultimoContatoResumo: p.historicos[0]?.resumo ?? null,
  }));
}

// ─── Atividades (Histórico de Contato) ───────────────────────────────────────

export async function buscarAtividades({
  empresaId,
  oportunidadeId,
  pessoaId,
  tipo,
  diasAtras = 30,
  limite = 20,
}: {
  empresaId?: string;
  oportunidadeId?: string;
  pessoaId?: string;
  tipo?: string;
  diasAtras?: number;
  limite?: number;
} = {}) {
  const dataInicio = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);

  const historicos = await prisma.historicoContato.findMany({
    where: {
      dataContato: { gte: dataInicio },
      ...(empresaId ? { empresaId } : {}),
      ...(oportunidadeId ? { oportunidadeId } : {}),
      ...(pessoaId ? { pessoaId } : {}),
      ...(tipo ? { tipo: tipo as any } : {}),
    },
    include: {
      empresa: { select: { razaoSocial: true } },
      oportunidade: { select: { titulo: true } },
      pessoa: { select: { nome: true } },
      usuario: { select: { nome: true } },
    },
    orderBy: { dataContato: "desc" },
    take: limite,
  });

  return historicos.map((h) => ({
    id: h.id,
    tipo: h.tipo,
    resumo: h.resumo,
    detalhes: h.detalhes,
    data: h.dataContato,
    proximoContato: h.proximoContato,
    empresa: h.empresa?.razaoSocial,
    oportunidade: h.oportunidade?.titulo,
    pessoa: h.pessoa?.nome,
    realizadoPor: h.usuario?.nome,
  }));
}

// ─── Atualizar Etapa da Oportunidade ─────────────────────────────────────────

export async function atualizarEtapaOportunidade({
  oportunidadeId,
  novoStatus,
  motivo,
  usuarioId,
}: {
  oportunidadeId: string;
  novoStatus: string;
  motivo?: string;
  usuarioId?: string;
}) {
  const before = await prisma.oportunidade.findUnique({
    where: { id: oportunidadeId },
    select: { id: true, titulo: true, status: true, motivoPerda: true },
  });

  const atualizada = await prisma.oportunidade.update({
    where: { id: oportunidadeId },
    data: {
      status: novoStatus as any,
      ...(motivo && novoStatus === "PERDIDA" ? { motivoPerda: motivo } : {}),
      ...(novoStatus === "GANHA" ? { fechadaEm: new Date() } : {}),
    },
    select: { id: true, titulo: true, status: true, motivoPerda: true },
  });

  await auditLog({
    action:
      before?.status !== atualizada.status
        ? "OPORTUNIDADE_STATUS_CHANGED"
        : "OPORTUNIDADE_UPDATED",
    entity: "Oportunidade",
    entityId: atualizada.id,
    before,
    after: atualizada,
    userId: usuarioId ?? null,
    metadata: { origem: "CRM_IA" },
  });

  return atualizada;
}

// ─── Alterar Responsável ──────────────────────────────────────────────────────

export async function alterarResponsavel({
  oportunidadeId,
  responsavelId,
  usuarioId,
}: {
  oportunidadeId: string;
  responsavelId: string;
  usuarioId?: string;
}) {
  const before = await prisma.oportunidade.findUnique({
    where: { id: oportunidadeId },
    select: { id: true, titulo: true, responsavelId: true, responsavel: { select: { nome: true } } },
  });

  const atualizada = await prisma.oportunidade.update({
    where: { id: oportunidadeId },
    data: { responsavelId },
    include: { responsavel: { select: { nome: true } } },
  });

  await auditLog({
    action: "OPORTUNIDADE_RESPONSAVEL_ALTERADO",
    entity: "Oportunidade",
    entityId: atualizada.id,
    before,
    after: {
      id: atualizada.id,
      titulo: atualizada.titulo,
      responsavelId: atualizada.responsavelId,
      responsavel: atualizada.responsavel,
    },
    userId: usuarioId ?? null,
    metadata: { origem: "CRM_IA" },
  });

  return {
    id: atualizada.id,
    titulo: atualizada.titulo,
    novoResponsavel: atualizada.responsavel?.nome,
  };
}

// ─── Agendar Visita ───────────────────────────────────────────────────────────

export async function agendarVisita({
  titulo,
  descricao,
  dataHora,
  empresaId,
  oportunidadeId,
  pessoaId,
}: {
  titulo: string;
  descricao?: string;
  dataHora: string;
  empresaId?: string;
  oportunidadeId?: string;
  pessoaId?: string;
}) {
  const tarefa = await prisma.tarefa.create({
    data: {
      titulo,
      descricao: descricao ?? null,
      tipo: "VISITA",
      prioridade: "ALTA",
      status: "PENDENTE",
      dataVencimento: new Date(dataHora),
      empresaId: empresaId ?? null,
      oportunidadeId: oportunidadeId ?? null,
      pessoaId: pessoaId ?? null,
    },
    select: { id: true, titulo: true, dataVencimento: true },
  });
  return tarefa;
}

// ─── Criar Lembrete ───────────────────────────────────────────────────────────

export async function criarLembrete({
  titulo,
  descricao,
  dataHora,
  empresaId,
  oportunidadeId,
}: {
  titulo: string;
  descricao?: string;
  dataHora: string;
  empresaId?: string;
  oportunidadeId?: string;
}) {
  const lembrete = await prisma.tarefa.create({
    data: {
      titulo,
      descricao: descricao ?? null,
      tipo: "TAREFA_INTERNA",
      prioridade: "MEDIA",
      status: "PENDENTE",
      dataVencimento: new Date(dataHora),
      empresaId: empresaId ?? null,
      oportunidadeId: oportunidadeId ?? null,
    },
    select: { id: true, titulo: true, dataVencimento: true },
  });
  return lembrete;
}

// ─── Dossiês da Central de Inteligência ──────────────────────────────────────

export async function buscarDossies({
  status,
  prioridade,
  segmento,
  cidade,
  estado,
  prontos = false,
  fonteLinkedin = false,
  limite = 20,
}: {
  status?: string;
  prioridade?: string;
  segmento?: string;
  cidade?: string;
  estado?: string;
  prontos?: boolean;
  fonteLinkedin?: boolean;
  limite?: number;
} = {}) {
  const where: Record<string, any> = {
    status: { not: "ARQUIVADO" },
  };

  if (status) where.status = status as any;
  else if (prontos) where.status = "PRONTO_PARA_ASSUMIR";
  if (prioridade) where.prioridade = prioridade;
  if (segmento) where.segmento = { contains: segmento, mode: "insensitive" };
  if (cidade) where.cidade = { contains: cidade, mode: "insensitive" };
  if (estado) where.estado = estado;
  if (fonteLinkedin) where.fonteInformacao = { startsWith: "LinkedIn", mode: "insensitive" };

  const dossies = await prisma.dossieComercial.findMany({
    where,
    include: {
      empresa: { select: { razaoSocial: true } },
    },
    orderBy: [{ status: "asc" }, { score: "desc" }, { updatedAt: "desc" }],
    take: limite,
  });

  return dossies.map((d) => ({
    id: d.id,
    titulo: d.titulo,
    status: d.status,
    score: d.score,
    completude: d.completude,
    prioridade: d.prioridade,
    segmento: d.segmento,
    cidade: d.cidade,
    estado: d.estado,
    clienteFinal: d.clienteFinal,
    empresa: d.empresa?.razaoSocial ?? null,
    missaoAtual: d.missaoAtual,
    fonteInformacao: d.fonteInformacao ?? null,
    linkFonte: d.linkFonte ?? null,
    totalDecisores: d.totalDecisores,
    totalEmpresas: d.totalEmpresas,
    totalNoticias: d.totalNoticias,
    totalAtualizacoes: d.totalAtualizacoes,
    proximaAcao: d.proximaAcaoSugerida,
    atualizadoEm: d.updatedAt,
  }));
}

// ─── Criar Dossiê (solicitação manual da equipe) ─────────────────────────────

export async function criarDossie({
  titulo,
  tipo = "OBRA",
  segmento,
  cidade,
  estado,
  clienteFinal,
  resumo,
  missaoInicial,
  prioridade = "MEDIA",
  usuarioId,
}: {
  titulo: string;
  tipo?: string;
  segmento?: string;
  cidade?: string;
  estado?: string;
  clienteFinal?: string;
  resumo?: string;
  missaoInicial?: string;
  prioridade?: string;
  usuarioId?: string;
}) {
  const dossie = await prisma.dossieComercial.create({
    data: {
      titulo,
      origem: "MANUAL",
      tipo: (tipo as any) ?? "OBRA",
      status: "INVESTIGANDO",
      segmento: segmento ?? null,
      cidade: cidade ?? null,
      estado: estado ?? null,
      clienteFinal: clienteFinal ?? null,
      resumo: resumo ?? null,
      missaoAtual: missaoInicial ?? "Investigação solicitada pela equipe comercial — levantar decisores, contatos e potencial da obra/empresa.",
      prioridade: prioridade ?? "MEDIA",
      fonteInformacao: "Solicitado por Horácio",
      score: 0,
      completude: 0,
    },
    select: { id: true, titulo: true, status: true, missaoAtual: true },
  });

  await auditLog({
    action: "DOSSIE_CRIADO",
    entity: "DossieComercial",
    entityId: dossie.id,
    before: null,
    after: dossie,
    userId: usuarioId ?? null,
    metadata: { origem: "CRM_IA_MANUAL" },
  });

  return {
    id: dossie.id,
    titulo: dossie.titulo,
    status: dossie.status,
    missaoAtual: dossie.missaoAtual,
    urlDossie: `/inteligencia/${dossie.id}`,
  };
}

// ─── Gerar Relatório Visual ───────────────────────────────────────────────────

const CORES_VILLA = [
  "#1A2E5A", "#1E4FAB", "#2563EB", "#3B82F6", "#60A5FA",
  "#F59E0B", "#EF4444", "#10B981", "#8B5CF6", "#EC4899",
  "#14B8A6", "#93C5FD",
];

function gerarCores(n: number): string[] {
  return Array.from({ length: n }, (_, i) => CORES_VILLA[i % CORES_VILLA.length]);
}

export interface DadosRelatorio {
  titulo: string;
  tipoGrafico: "bar" | "pie" | "doughnut";
  labels: string[];
  datasets: Array<{ label: string; data: number[]; backgroundColor?: string[] }>;
  descricao?: string;
  tipoSaida?: "pdf" | "excel" | "powerpoint";
  // Campos para relatórios ricos
  tabela?: string[][];
  colunas?: string[];
  conclusoes?: string[];
  recomendacoes?: string[];
  periodo?: string;
  filtros?: string;
}

export async function gerarRelatorio({
  tipo,
  titulo,
  tipoSaida,
  filtroStatus,
  oportunidadeId,
}: {
  tipo: string;
  titulo?: string;
  tipoSaida?: string;
  filtroStatus?: string;
  oportunidadeId?: string;
}): Promise<DadosRelatorio> {
  switch (tipo) {
    case "oportunidades_por_status":
    case "pipeline": {
      const grupos = await prisma.oportunidade.groupBy({
        by: ["status"],
        where: { ativa: true },
        _count: { id: true },
      });
      const labels = grupos.map((g) => g.status);
      const data = grupos.map((g) => g._count.id);
      return {
        titulo: titulo ?? "Pipeline de Vendas — Oportunidades por Status",
        tipoGrafico: "bar",
        labels,
        datasets: [{ label: "Quantidade", data, backgroundColor: gerarCores(labels.length) }],
        descricao: `Total: ${data.reduce((a, b) => a + b, 0)} oportunidades ativas`,
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "oportunidades_por_valor": {
      const grupos = await prisma.oportunidade.groupBy({
        by: ["status"],
        where: { ativa: true },
        _sum: { potencialOportunidade: true },
      });
      const labels = grupos.map((g) => g.status);
      const data = grupos.map((g) =>
        Math.round(parseFloat((g._sum.potencialOportunidade ?? 0).toString()) / 1000)
      );
      return {
        titulo: titulo ?? "Oportunidades por Status — Valor Potencial (R$ mil)",
        tipoGrafico: "bar",
        labels,
        datasets: [{ label: "Valor (R$ mil)", data, backgroundColor: gerarCores(labels.length) }],
        descricao: `Valor total potencial: R$ ${data.reduce((a, b) => a + b, 0).toLocaleString("pt-BR")} mil`,
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "origem_leads": {
      const grupos = await prisma.oportunidade.groupBy({
        by: ["canalOrigem"],
        where: { ativa: true },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      });
      const labels = grupos.map((g) => g.canalOrigem ?? "Não informado");
      const data = grupos.map((g) => g._count.id);
      return {
        titulo: titulo ?? "Origem dos Leads",
        tipoGrafico: "pie",
        labels,
        datasets: [{ label: "Leads", data, backgroundColor: gerarCores(labels.length) }],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "propostas_por_status": {
      const grupos = await prisma.propostaComercial.groupBy({
        by: ["status"],
        _count: { id: true },
      });
      const labels = grupos.map((g) => g.status);
      const data = grupos.map((g) => g._count.id);
      return {
        titulo: titulo ?? "Propostas por Status",
        tipoGrafico: "doughnut",
        labels,
        datasets: [{ label: "Propostas", data, backgroundColor: gerarCores(labels.length) }],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "equipamentos_por_status": {
      const grupos = await prisma.equipamento.groupBy({
        by: ["status"],
        _count: { id: true },
      });
      const labels = grupos.map((g) => g.status);
      const data = grupos.map((g) => g._count.id);
      return {
        titulo: titulo ?? "Frota por Status",
        tipoGrafico: "doughnut",
        labels,
        datasets: [{ label: "Equipamentos", data, backgroundColor: gerarCores(labels.length) }],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "tarefas_pendentes": {
      const tarefas = await prisma.tarefa.findMany({
        where: { status: { in: ["PENDENTE", "EM_ANDAMENTO", "ATRASADA"] } },
        include: {
          empresa: { select: { razaoSocial: true } },
          oportunidade: { select: { titulo: true } },
        },
        orderBy: { dataVencimento: "asc" },
        take: 30,
      });
      const porStatus = ["PENDENTE", "EM_ANDAMENTO", "ATRASADA"];
      const labels = porStatus;
      const data = porStatus.map((s) => tarefas.filter((t) => t.status === s).length);
      const colunas = ["Tarefa", "Tipo", "Status", "Vencimento", "Empresa"];
      const tabela = tarefas.map((t) => [
        t.titulo,
        t.tipo,
        t.status,
        t.dataVencimento ? new Date(t.dataVencimento).toLocaleDateString("pt-BR") : "—",
        t.empresa?.razaoSocial ?? "—",
      ]);
      return {
        titulo: titulo ?? "Tarefas Pendentes e em Andamento",
        tipoGrafico: "bar",
        labels,
        datasets: [{ label: "Tarefas", data, backgroundColor: gerarCores(labels.length) }],
        descricao: `Total: ${tarefas.length} tarefas abertas`,
        colunas,
        tabela,
        conclusoes: [
          `${data[2]} tarefas estão atrasadas e exigem atenção imediata.`,
          `${data[0] + data[1]} tarefas estão dentro do prazo.`,
        ],
        recomendacoes: [
          "Priorize as tarefas atrasadas antes de criar novas.",
          "Atribua responsáveis claros para cada tarefa pendente.",
        ],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "propostas_paradas": {
      const propostas = await prisma.propostaComercial.findMany({
        where: { status: { in: ["ENVIADA", "AGUARDANDO_APROVACAO"] } },
        include: {
          oportunidade: {
            include: { empresa: { select: { razaoSocial: true, estado: true } } },
          },
        },
        orderBy: { updatedAt: "asc" },
        take: 30,
      });
      const labels = propostas.map((p) => p.oportunidade?.empresa?.razaoSocial ?? p.id.slice(0, 8));
      const data = propostas.map(() => 1);
      const colunas = ["Proposta", "Status", "Empresa", "Estado", "Última atualização"];
      const tabela = propostas.map((p) => [
        p.numeroProposta ?? "—",
        p.status,
        p.oportunidade?.empresa?.razaoSocial ?? "—",
        p.oportunidade?.empresa?.estado ?? "—",
        new Date(p.updatedAt).toLocaleDateString("pt-BR"),
      ]);
      return {
        titulo: titulo ?? "Propostas Paradas — Aguardando Resposta",
        tipoGrafico: "bar",
        labels: ["Enviadas", "Aguardando Aprovação"],
        datasets: [{
          label: "Propostas",
          data: [
            propostas.filter((p) => p.status === "ENVIADA").length,
            propostas.filter((p) => p.status === "AGUARDANDO_APROVACAO").length,
          ],
          backgroundColor: gerarCores(2),
        }],
        descricao: `${propostas.length} propostas aguardando resposta do cliente`,
        colunas,
        tabela,
        conclusoes: [
          `${propostas.length} propostas estão paradas sem resposta do cliente.`,
          "Propostas sem follow-up após 7 dias têm 60% menos chance de fechamento.",
        ],
        recomendacoes: [
          "Entre em contato com cada cliente listado acima hoje.",
          "Estabeleça um prazo de validade claro para cada proposta.",
          "Considere enviar um resumo executivo simplificado para reacender o interesse.",
        ],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "clientes_sem_contato": {
      const limite30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const empresas = await prisma.empresa.findMany({
        where: {
          ativa: true,
          oportunidades: {
            some: {
              ativa: true,
              status: { notIn: ["GANHA", "PERDIDA"] },
              updatedAt: { lt: limite30Dias },
            },
          },
        },
        include: {
          oportunidades: {
            where: { ativa: true, status: { notIn: ["GANHA", "PERDIDA"] } },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { status: true, updatedAt: true, titulo: true },
          },
        },
        take: 30,
      });
      const colunas = ["Empresa", "Última oportunidade", "Status", "Dias sem contato"];
      const tabela = empresas.map((e) => {
        const op = e.oportunidades[0];
        const dias = op ? Math.floor((Date.now() - new Date(op.updatedAt).getTime()) / 86400000) : 0;
        return [e.razaoSocial, op?.titulo ?? "—", op?.status ?? "—", `${dias} dias`];
      });
      return {
        titulo: titulo ?? "Clientes Sem Contato Há +30 Dias",
        tipoGrafico: "bar",
        labels: empresas.map((e) => e.razaoSocial.slice(0, 20)),
        datasets: [{
          label: "Dias sem contato",
          data: empresas.map((e) => {
            const op = e.oportunidades[0];
            return op ? Math.floor((Date.now() - new Date(op.updatedAt).getTime()) / 86400000) : 0;
          }),
          backgroundColor: gerarCores(empresas.length),
        }],
        descricao: `${empresas.length} clientes com oportunidades abertas há mais de 30 dias sem atualização`,
        colunas,
        tabela,
        conclusoes: [
          `${empresas.length} clientes com oportunidades ativas há mais de 30 dias sem atualização.`,
          "Clientes não contatados por mais de 60 dias têm alta probabilidade de buscar concorrentes.",
        ],
        recomendacoes: [
          "Priorize os clientes com maior tempo sem contato.",
          "Crie uma tarefa de follow-up para cada empresa da lista.",
          "Considere uma campanha de reengajamento para clientes inativos.",
        ],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "resumo_executivo": {
      const [pipeline, propostas, tarefas, equipamentos, origem] = await Promise.all([
        prisma.oportunidade.groupBy({ by: ["status"], where: { ativa: true }, _count: { id: true } }),
        prisma.propostaComercial.groupBy({ by: ["status"], _count: { id: true } }),
        prisma.tarefa.count({ where: { status: { in: ["PENDENTE", "EM_ANDAMENTO", "ATRASADA"] } } }),
        prisma.equipamento.groupBy({ by: ["status"], _count: { id: true } }),
        prisma.oportunidade.groupBy({
          by: ["canalOrigem"], where: { ativa: true }, _count: { id: true },
          orderBy: { _count: { id: "desc" } }, take: 5,
        }),
      ]);
      const totalOps = pipeline.reduce((a, g) => a + g._count.id, 0);
      const totalPropostas = propostas.reduce((a, g) => a + g._count.id, 0);
      const disponivéis = equipamentos.find((e) => e.status === "DISPONIVEL")?._count.id ?? 0;
      const locados = equipamentos.find((e) => e.status === "LOCADO")?._count.id ?? 0;
      const labels = pipeline.map((g) => g.status);
      const data = pipeline.map((g) => g._count.id);
      return {
        titulo: titulo ?? "Resumo Executivo — Visão Geral do CRM",
        tipoGrafico: "bar",
        labels,
        datasets: [{ label: "Oportunidades", data, backgroundColor: gerarCores(labels.length) }],
        descricao: `${totalOps} oportunidades ativas · ${totalPropostas} propostas · ${tarefas} tarefas abertas`,
        conclusoes: [
          `Pipeline total: ${totalOps} oportunidades ativas em andamento.`,
          `Propostas: ${totalPropostas} propostas no sistema.`,
          `Frota: ${locados} equipamentos locados, ${disponivéis} disponíveis.`,
          `Tarefas: ${tarefas} tarefas abertas exigem atenção.`,
          `Canal líder: ${origem[0]?.canalOrigem ?? "—"} com ${origem[0]?._count.id ?? 0} leads.`,
        ],
        recomendacoes: [
          "Revisar oportunidades paradas há mais de 15 dias no pipeline.",
          "Acompanhar propostas enviadas sem resposta.",
          "Garantir que todos os equipamentos disponíveis estejam ativamente ofertados.",
        ],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "lista_contatos": {
      const pessoas = await prisma.pessoa.findMany({
        where: { ativa: true },
        include: {
          empresa: { select: { razaoSocial: true, cidade: true, estado: true } },
          historicos: {
            orderBy: { dataContato: "desc" },
            take: 1,
            select: { dataContato: true, tipo: true },
          },
        },
        orderBy: { nome: "asc" },
        take: 100,
      });
      const colunas = ["Nome", "Cargo", "Empresa", "Telefone / WhatsApp", "E-mail", "Último Contato"];
      const tabela = pessoas.map((p) => [
        p.nome,
        p.cargo ?? "—",
        p.empresa?.razaoSocial ?? "—",
        p.whatsapp ?? p.telefone ?? "—",
        p.email ?? "—",
        p.historicos[0]?.dataContato
          ? new Date(p.historicos[0].dataContato).toLocaleDateString("pt-BR")
          : "Sem registro",
      ]);
      // Gráfico de contatos por tipo de influência (apenas para o PDF)
      const porTipo: Record<string, number> = {};
      pessoas.forEach((p) => {
        const t = p.tipo ?? "Não classificado";
        porTipo[t] = (porTipo[t] ?? 0) + 1;
      });
      const labels = Object.keys(porTipo);
      const data = Object.values(porTipo);
      return {
        titulo: titulo ?? "Lista de Contatos — Nome, Cargo e Telefone",
        tipoGrafico: "doughnut",
        labels,
        datasets: [{ label: "Contatos", data, backgroundColor: gerarCores(labels.length) }],
        descricao: `${pessoas.length} contatos cadastrados no CRM`,
        colunas,
        tabela,
        conclusoes: [
          `Total de ${pessoas.length} contatos ativos no CRM.`,
          `${pessoas.filter((p) => p.whatsapp || p.telefone).length} possuem telefone/WhatsApp registrado.`,
          `${pessoas.filter((p) => p.email).length} possuem e-mail cadastrado.`,
        ],
        recomendacoes: [
          "Mantenha os telefones sempre atualizados para agilizar o contato.",
          "Registre o histórico de cada interação para rastrear o relacionamento.",
        ],
        tipoSaida: (tipoSaida as any) ?? "excel",
      };
    }

    case "oportunidades_por_etapa": {
      const statusAlvo = (filtroStatus ?? "PROPOSTA_ENVIADA") as any;
      const statusLabels: Record<string, string> = {
        NOVA: "Nova",
        PRE_QUALIFICADA: "Pré-qualificada",
        EM_ATENDIMENTO: "Em Atendimento",
        PROPOSTA_ENVIADA: "Proposta Enviada",
        NEGOCIACAO: "Negociação",
        GANHA: "Ganha",
        PERDIDA: "Perdida",
      };
      const etapaLabel = statusLabels[statusAlvo] ?? statusAlvo;

      const opsList = await prisma.oportunidade.findMany({
        where: { ativa: true, status: statusAlvo },
        include: {
          empresa: { select: { razaoSocial: true, cidade: true, estado: true } },
          pessoa: { select: { nome: true, telefone: true, whatsapp: true } },
          responsavel: { select: { nome: true } },
          propostas: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { numeroProposta: true, valorTotal: true, validadeProposta: true, status: true, updatedAt: true },
          },
        },
        orderBy: [{ potencialOportunidade: "desc" }, { updatedAt: "asc" }],
      });

      const totalPotencial = opsList.reduce(
        (a, o) => a + parseFloat((o.potencialOportunidade ?? 0).toString()),
        0,
      );
      const agora = Date.now();

      const porTemperatura: Record<string, number> = { QUENTE: 0, MEDIA: 0, FRIA: 0, "Sem info": 0 };
      opsList.forEach((o) => {
        const t = o.temperatura ?? "Sem info";
        porTemperatura[t] = (porTemperatura[t] ?? 0) + 1;
      });
      const tempLabels = Object.keys(porTemperatura).filter((k) => porTemperatura[k] > 0);
      const tempData = tempLabels.map((k) => porTemperatura[k]);

      const colunas = ["Empresa", "Oportunidade", "Temperatura", "Valor Potencial", "Dias na Etapa", "Responsável", "Contato", "WhatsApp"];
      const tabela = opsList.map((o) => {
        const diasNaEtapa = Math.floor((agora - new Date(o.updatedAt).getTime()) / 86400000);
        return [
          o.empresa?.razaoSocial ?? "—",
          o.titulo,
          o.temperatura ?? "—",
          o.potencialOportunidade
            ? `R$ ${Number(o.potencialOportunidade).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
            : "—",
          `${diasNaEtapa} dias`,
          o.responsavel?.nome ?? "—",
          o.pessoa?.nome ?? "—",
          o.pessoa?.whatsapp ?? o.pessoa?.telefone ?? "—",
        ];
      });

      const paradas = opsList.filter((o) => {
        const dias = Math.floor((agora - new Date(o.updatedAt).getTime()) / 86400000);
        return dias > 7;
      });

      return {
        titulo: titulo ?? `Oportunidades — Etapa: ${etapaLabel}`,
        tipoGrafico: "bar",
        labels: tempLabels,
        datasets: [{ label: "Qtd por Temperatura", data: tempData, backgroundColor: ["#EF4444", "#F59E0B", "#3B82F6", "#9CA3AF"] }],
        descricao: `${opsList.length} oportunidades na etapa ${etapaLabel} · Potencial: R$ ${Math.round(totalPotencial / 1000).toLocaleString("pt-BR")} mil`,
        colunas,
        tabela,
        conclusoes: [
          `${opsList.length} oportunidades estão na etapa "${etapaLabel}".`,
          `Potencial total de fechamento: R$ ${Math.round(totalPotencial / 1000).toLocaleString("pt-BR")} mil.`,
          `${paradas.length} oportunidades estão paradas há mais de 7 dias sem atualização.`,
        ],
        recomendacoes: [
          `Entre em contato com todos os clientes da etapa "${etapaLabel}" nos próximos 2 dias.`,
          "Priorize as oportunidades QUENTE — têm maior probabilidade de fechamento.",
          "Para oportunidades paradas há mais de 15 dias, considere ligar diretamente ao decisor.",
          "Registre o próximo passo de cada uma no CRM para manter o pipeline vivo.",
        ],
        filtros: `Etapa: ${etapaLabel}`,
        periodo: new Date().toLocaleDateString("pt-BR"),
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "oportunidades_quentes": {
      const quentes = await prisma.oportunidade.findMany({
        where: {
          ativa: true,
          temperatura: "QUENTE",
          status: { notIn: ["GANHA", "PERDIDA"] },
        },
        include: {
          empresa: { select: { razaoSocial: true, cidade: true, estado: true } },
          pessoa: { select: { nome: true, telefone: true, whatsapp: true } },
          responsavel: { select: { nome: true } },
        },
        orderBy: [{ potencialOportunidade: "desc" }, { updatedAt: "desc" }],
        take: 50,
      });
      const totalPotencial = quentes.reduce(
        (a, o) => a + parseFloat((o.potencialOportunidade ?? 0).toString()),
        0,
      );
      const porStatus: Record<string, number> = {};
      quentes.forEach((o) => {
        const s = o.status ?? "Outros";
        porStatus[s] = (porStatus[s] ?? 0) + 1;
      });
      const statusLabels = Object.keys(porStatus);
      const statusData = statusLabels.map((s) => porStatus[s]);
      const colunas = ["Cliente / Empresa", "Oportunidade", "Etapa", "Valor Potencial", "Responsável", "Contato", "WhatsApp / Telefone"];
      const tabela = quentes.map((o) => [
        o.empresa?.razaoSocial ?? "—",
        o.titulo,
        o.status,
        o.potencialOportunidade
          ? `R$ ${Number(o.potencialOportunidade).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
          : "—",
        o.responsavel?.nome ?? "—",
        o.pessoa?.nome ?? "—",
        o.pessoa?.whatsapp ?? o.pessoa?.telefone ?? "—",
      ]);
      return {
        titulo: titulo ?? "Oportunidades Mais Quentes — Prioridade de Fechamento",
        tipoGrafico: "bar",
        labels: statusLabels,
        datasets: [{ label: "Oportunidades Quentes", data: statusData, backgroundColor: gerarCores(statusLabels.length) }],
        descricao: `${quentes.length} oportunidades quentes ativas · Potencial total: R$ ${Math.round(totalPotencial / 1000).toLocaleString("pt-BR")} mil`,
        colunas,
        tabela,
        conclusoes: [
          `${quentes.length} oportunidades estão classificadas como QUENTE e merecem atenção imediata do time comercial.`,
          `Potencial total de fechamento: R$ ${Math.round(totalPotencial / 1000).toLocaleString("pt-BR")} mil.`,
          quentes.length > 0
            ? `Oportunidade de maior valor: ${quentes[0].titulo} (${quentes[0].empresa?.razaoSocial ?? "—"}).`
            : "Nenhuma oportunidade quente no momento.",
        ],
        recomendacoes: [
          "Entre em contato com todas as oportunidades quentes dentro de 24 horas.",
          "Priorize as que já têm proposta enviada — estão mais próximas do fechamento.",
          "Para oportunidades sem proposta, agende uma visita ou reunião ainda esta semana.",
          "Registre o próximo passo de cada oportunidade no CRM para manter o pipeline vivo.",
        ],
        periodo: new Date().toLocaleDateString("pt-BR"),
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "dossies_inteligencia": {
      const dossies = await prisma.dossieComercial.findMany({
        where: { status: { not: "ARQUIVADO" } },
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        take: 50,
      });
      const porSegmento: Record<string, number> = {};
      dossies.forEach((d) => {
        const seg = d.segmento ?? "Outros";
        porSegmento[seg] = (porSegmento[seg] ?? 0) + 1;
      });
      const segLabels = Object.keys(porSegmento).sort((a, b) => porSegmento[b] - porSegmento[a]);
      const segData = segLabels.map((s) => porSegmento[s]);
      const urgentes = dossies.filter((d) => d.prioridade === "URGENTE" || d.score >= 90);
      const linkedin = dossies.filter((d) => (d.fonteInformacao ?? "").startsWith("LinkedIn"));
      const colunas = ["Dossiê / Empresa", "Segmento", "Score", "Prioridade", "Status", "Completude", "Fonte"];
      const tabela = dossies.slice(0, 30).map((d) => [
        d.titulo ?? d.clienteFinal ?? "—",
        d.segmento ?? "—",
        String(d.score ?? 0),
        d.prioridade ?? "—",
        d.status,
        `${d.completude ?? 0}%`,
        (d.fonteInformacao ?? "").startsWith("LinkedIn") ? "LinkedIn" : "Web/Radar",
      ]);
      return {
        titulo: titulo ?? "Relatório de Inteligência Comercial — João Hunter IA",
        tipoGrafico: "bar",
        labels: segLabels.slice(0, 10),
        datasets: [{ label: "Dossiês por Segmento", data: segData.slice(0, 10), backgroundColor: gerarCores(10) }],
        descricao: `${dossies.length} dossiês ativos · ${urgentes.length} com score ≥ 90 · ${linkedin.length} descobertos via LinkedIn`,
        colunas,
        tabela,
        conclusoes: [
          `João Hunter IA mapeou ${dossies.length} oportunidades ativas na Central de Inteligência.`,
          `${urgentes.length} dossiês com score ≥ 90 merecem atenção prioritária do time comercial.`,
          `${linkedin.length} oportunidades foram descobertas via LinkedIn (movimentação de pessoal, publicações de obras).`,
          `Segmentos mais representados: ${segLabels.slice(0, 3).join(", ")}.`,
          `Completude média: ${Math.round(dossies.reduce((a, d) => a + (d.completude ?? 0), 0) / (dossies.length || 1))}% — o loop de investigação continua enriquecendo os dossiês diariamente.`,
        ],
        recomendacoes: [
          "Priorize os dossiês com score ≥ 90 e 'Assumir' os mais maduros para transformá-los em oportunidades ativas.",
          "Dossiês com completude > 70% já têm decisores e contexto suficiente para abordagem comercial.",
          "Para os descobertos via LinkedIn, use as sugestões de mensagem do relatório diário do João para o primeiro contato.",
        ],
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    case "historico_oportunidade": {
      // Busca por ID direto ou pelo nome/título
      const op = await prisma.oportunidade.findFirst({
        where: oportunidadeId
          ? { id: oportunidadeId }
          : { ativa: true, titulo: { contains: filtroStatus ?? "", mode: "insensitive" } },
        include: {
          empresa: { select: { razaoSocial: true, cidade: true, estado: true } },
          pessoa: { select: { nome: true, cargo: true, telefone: true, whatsapp: true, email: true } },
          obra: { select: { nome: true } },
          responsavel: { select: { nome: true } },
          tarefas: {
            include: { responsavel: { select: { nome: true } } },
            orderBy: { dataVencimento: "desc" },
          },
          historicos: {
            include: { usuario: { select: { nome: true } } },
            orderBy: { dataContato: "desc" },
          },
        },
      });

      if (!op) {
        return {
          titulo: "Histórico não encontrado",
          tipoGrafico: "bar",
          labels: [],
          datasets: [],
          descricao: "Oportunidade não encontrada. Verifique o nome ou ID.",
          tipoSaida: (tipoSaida as any) ?? "pdf",
        };
      }

      // Monta linha do tempo unificada: tarefas + histórico de contatos
      type Evento = { data: Date; tipo: string; descricao: string; resultado: string; responsavel: string };
      const eventos: Evento[] = [];

      for (const t of op.tarefas) {
        eventos.push({
          data: new Date(t.dataVencimento),
          tipo: `Tarefa — ${t.tipo}`,
          descricao: t.titulo,
          resultado: t.resultado ?? t.resultadoCodigo ?? (t.status === "CONCLUIDA" ? "Concluída" : t.status),
          responsavel: t.responsavel?.nome ?? "—",
        });
      }

      for (const h of op.historicos) {
        eventos.push({
          data: new Date(h.dataContato),
          tipo: `Contato — ${h.tipo}`,
          descricao: h.resumo,
          resultado: h.detalhes ?? "—",
          responsavel: h.usuario?.nome ?? "—",
        });
      }

      eventos.sort((a, b) => b.data.getTime() - a.data.getTime());

      const concluidas = op.tarefas.filter((t) => t.status === "CONCLUIDA").length;
      const pendentes = op.tarefas.filter((t) => ["PENDENTE", "EM_ANDAMENTO"].includes(t.status)).length;

      const colunas = ["Data", "Tipo", "Descrição", "Resultado / Detalhe", "Responsável"];
      const tabela = eventos.map((e) => [
        e.data.toLocaleDateString("pt-BR"),
        e.tipo,
        e.descricao,
        e.resultado,
        e.responsavel,
      ]);

      return {
        titulo: titulo ?? `Histórico Completo — ${op.titulo}`,
        tipoGrafico: "bar",
        labels: ["Tarefas concluídas", "Pendentes", "Contatos registrados"],
        datasets: [{
          label: "Atividades",
          data: [concluidas, pendentes, op.historicos.length],
          backgroundColor: ["#10B981", "#F59E0B", "#6366F1"],
        }],
        descricao: `Oportunidade: ${op.titulo} | Empresa: ${op.empresa?.razaoSocial ?? "—"} | Contato: ${op.pessoa?.nome ?? "—"} | Status: ${op.status} | Temperatura: ${op.temperatura ?? "—"} | Responsável: ${op.responsavel?.nome ?? "—"}`,
        colunas,
        tabela,
        conclusoes: [
          `${eventos.length} eventos registrados no total.`,
          `${concluidas} tarefas concluídas e ${pendentes} ainda em aberto.`,
          `${op.historicos.length} contatos manuais registrados no histórico.`,
          op.tarefas.find((t) => ["PENDENTE", "EM_ANDAMENTO"].includes(t.status))
            ? `Próxima ação: ${op.tarefas.find((t) => ["PENDENTE", "EM_ANDAMENTO"].includes(t.status))?.titulo}`
            : "Nenhuma próxima ação definida — crie uma tarefa agora.",
        ],
        recomendacoes: [
          "Use este histórico para retomar o contexto antes de ligar ou visitar o cliente.",
          "Registre sempre o resultado de cada contato para manter o histórico completo.",
          op.temperatura === "FRIA" ? "Oportunidade fria — considere uma abordagem diferenciada para reativar o interesse." : "",
        ].filter(Boolean),
        filtros: `ID: ${op.id}`,
        periodo: new Date().toLocaleDateString("pt-BR"),
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
    }

    default:
      return {
        titulo: titulo ?? "Relatório",
        tipoGrafico: "bar",
        labels: [],
        datasets: [],
        descricao: `Tipo "${tipo}" não suportado`,
        tipoSaida: (tipoSaida as any) ?? "pdf",
      };
  }
}
