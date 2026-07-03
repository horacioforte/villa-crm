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
}: {
  tipo: string;
  titulo?: string;
  tipoSaida?: string;
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
