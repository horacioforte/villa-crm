// ARQUIVO: lib/agentes/joao/contexto.ts
// REGRA: nunca remover. Apenas acrescentar.
// Busca o contexto de conversa do João — filtra por instanceName "joao-villa".
// Isolado da Maria: mesmo telefone gera histórico separado.
// ACRESCENTADO (14/11/2026 — Memória Inteligente v1):
//   - take aumentado de 6 para 10 mensagens: conversas de prospecção tendem a ser mais longas.
//   - Memória investigativa de dossiê: se já existe um DossieComercial vinculado a este
//     telefone (via DecisorDossie), inclui o título, missão atual e score no contexto para
//     que o João saiba que há investigação em andamento e não duplique esforço.
//   - formatarContextoJoao(): função pura extraída para ser testável sem banco.
// ACRESCENTADO (14/11/2026 — Memória Investigativa v2):
//   - Memória investigativa ampliada: inclui evidências confirmadas/fortes, movimentações
//     recentes, próxima ação sugerida e resumo do dossiê — João passa a ter contexto
//     investigativo completo, não apenas título e missão.
//   - Limite total de 5000 chars para o contexto do João (preserva desempenho do LLM).
//   - Falhas nas novas consultas nunca derrubam o fluxo — são capturadas e logadas.
//   - REGRA DE ISOLAMENTO: não altera investigador de Carteiras nem mistura Radar e Carteiras.
// ACRESCENTADO (15/11/2026 — Memória de Longo Prazo v1):
//   - EvidenciaContexto e MovimentacaoContexto agora incluem data opcional para exibição.
//   - formatarContextoJoao() mostra data das evidências e movimentações (ex: "10/08/2026").
//   - getContextoJoao() passa dataColeta/dataInformacao das evidências e createdAt das movimentações.

import { prisma } from "@/lib/prisma";

// ─── Tipos de dados para a função de formatação pura ─────────────────────────

export type MensagemJoao = {
  direcao: string;
  conteudo: string;
};

// [ACRESCENTADO 14/11/2026 v2] Evidência de dossiê para contexto do João
// [ATUALIZADO 15/11/2026 v3] data opcional para exibição temporal
export type EvidenciaContexto = {
  titulo: string;
  descricao: string | null;
  fonteTipo: string;    // ex: "OFICIAL", "REDE_SOCIAL", "MIDIA"
  fonteNome: string | null;
  confianca: string;    // "CONFIRMADA" | "FORTE" | "PROVAVEL" | "SINAL"
  data: Date | null;    // dataColeta ou dataInformacao — para exibição temporal
};

// [ACRESCENTADO 14/11/2026 v2] Movimentação de dossiê para contexto do João
// [ATUALIZADO 15/11/2026 v3] data opcional para exibição temporal
export type MovimentacaoContexto = {
  titulo: string;
  descricao: string | null;
  tipo: string;         // ex: "NOVA_OBRA", "CONTRATACAO_EM_ANDAMENTO"
  data: Date | null;    // createdAt da movimentação — para exibição temporal
};

export type DossieContexto = {
  titulo: string;
  resumo: string | null;                  // [ACRESCENTADO v2]
  missaoAtual: string | null;
  proximaAcaoSugerida: string | null;     // [ACRESCENTADO v2]
  score: number | null;
  completude: number | null;
  evidencias: EvidenciaContexto[];        // [ACRESCENTADO v2]
  movimentacoes: MovimentacaoContexto[];  // [ACRESCENTADO v2]
};

// ─── Formatação pura (testável sem banco) ────────────────────────────────────

// Rótulos legíveis para confiança de evidências
const CONFIANCA_LABEL: Record<string, string> = {
  CONFIRMADA: "CONFIRMADA",
  FORTE: "FORTE",
  PROVAVEL: "PROVÁVEL",
  SINAL: "SINAL",
};

// Rótulos legíveis para tipo de movimentação (principais)
const MOVIMENTACAO_LABEL: Record<string, string> = {
  NOVA_OBRA: "Nova obra detectada",
  NOVO_EMPREENDIMENTO: "Novo empreendimento",
  MOBILIZACAO_INICIADA: "Mobilização iniciada",
  CONCRETAGEM: "Concretagem em andamento",
  EXPANSAO: "Expansão detectada",
  NOVA_UNIDADE: "Nova unidade",
  CONTRATACAO_EM_ANDAMENTO: "Contratação em andamento",
  MUDANCA_EXECUTIVO: "Mudança de executivo",
  COMPRA_EQUIPAMENTO: "Compra de equipamento",
  VENDA_EQUIPAMENTO: "Venda de equipamento",
  SINAL_DE_MERCADO: "Sinal de mercado",
};

/**
 * Formata o contexto completo do João a partir de dados já recuperados do banco.
 * Função pura: não acessa banco, não tem efeitos colaterais — testável diretamente.
 * Ordem: mensagens da sessão (cronológica) → dossiê investigativo completo (se houver).
 * Limite total: 5000 chars.
 */
export function formatarContextoJoao({
  mensagens,
  dossie,
}: {
  mensagens: MensagemJoao[];
  dossie: DossieContexto | null;
}): string {
  const linhas: string[] = [];

  // Bloco 1 — histórico de mensagens da sessão atual
  if (mensagens.length > 0) {
    linhas.push(
      ...mensagens.map(
        (m) => `${m.direcao === "ENTRADA" ? "Cliente" : "João"}: ${m.conteudo}`,
      ),
    );
  }

  // Bloco 2 — dossiê investigativo em andamento (memória entre sessões)
  if (dossie) {
    linhas.push("");
    linhas.push("── Investigação em andamento ──");
    linhas.push(`Dossiê: ${dossie.titulo}`);

    // Resumo da obra/empresa (se disponível)
    if (dossie.resumo) linhas.push(`Resumo: ${dossie.resumo}`);

    // Missão atual e próxima ação
    if (dossie.missaoAtual) linhas.push(`Missão atual: ${dossie.missaoAtual}`);
    if (dossie.proximaAcaoSugerida) linhas.push(`Próxima ação: ${dossie.proximaAcaoSugerida}`);

    // Score e completude
    if (dossie.score !== null || dossie.completude !== null) {
      const partes: string[] = [];
      if (dossie.score !== null) partes.push(`Score: ${dossie.score}/100`);
      if (dossie.completude !== null) partes.push(`Completude: ${dossie.completude}%`);
      linhas.push(partes.join(" | "));
    }

    // [ACRESCENTADO v2] Evidências confirmadas e fortes
    // [ATUALIZADO v3] Inclui data quando disponível
    const evidenciasRelevantes = dossie.evidencias.filter(
      (e) => e.confianca === "CONFIRMADA" || e.confianca === "FORTE" || e.confianca === "PROVAVEL",
    );
    if (evidenciasRelevantes.length > 0) {
      linhas.push("");
      linhas.push("Informações confirmadas/evidências:");
      for (const ev of evidenciasRelevantes) {
        const fonte = ev.fonteNome ? `(${ev.fonteNome})` : `(${ev.fonteTipo})`;
        const label = CONFIANCA_LABEL[ev.confianca] ?? ev.confianca;
        const dataStr = ev.data ? ` — data: ${ev.data.toLocaleDateString("pt-BR")}` : "";
        const desc = ev.descricao ? ` — ${ev.descricao}` : "";
        linhas.push(`- [${label}] ${ev.titulo} ${fonte}${dataStr}${desc}`);
      }
    }

    // Sinais (evidências menos consolidadas, mas relevantes)
    const sinais = dossie.evidencias.filter((e) => e.confianca === "SINAL");
    if (sinais.length > 0) {
      linhas.push("");
      linhas.push("Sinais de mercado:");
      for (const ev of sinais) {
        const fonte = ev.fonteNome ? `(${ev.fonteNome})` : `(${ev.fonteTipo})`;
        const dataStr = ev.data ? ` — data: ${ev.data.toLocaleDateString("pt-BR")}` : "";
        const desc = ev.descricao ? ` — ${ev.descricao}` : "";
        linhas.push(`- ${ev.titulo} ${fonte}${dataStr}${desc}`);
      }
    }

    // [ACRESCENTADO v2] Movimentações recentes
    // [ATUALIZADO v3] Inclui data quando disponível
    if (dossie.movimentacoes.length > 0) {
      linhas.push("");
      linhas.push("Movimentações recentes:");
      for (const mov of dossie.movimentacoes) {
        const tipo = MOVIMENTACAO_LABEL[mov.tipo] ?? mov.tipo;
        const dataStr = mov.data ? ` — data: ${mov.data.toLocaleDateString("pt-BR")}` : "";
        const desc = mov.descricao ? ` — ${mov.descricao}` : "";
        linhas.push(`- ${tipo}: ${mov.titulo}${dataStr}${desc}`);
      }
    }
  }

  return linhas.join("\n").trim().slice(0, 5000);
}

// ─── Busca principal ──────────────────────────────────────────────────────────

export async function getContextoJoao(telefone: string): Promise<string> {
  // ── Mensagens da sessão atual ─────────────────────────────────────────────
  // [ALTERADO 14/11/2026] take: 6 → take: 10 para cobrir conversas de prospecção mais longas.
  const conversa = await prisma.conversa.findFirst({
    where: { telefone, instanceName: "joao-villa" },
    orderBy: { updatedAt: "desc" },
    include: {
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { conteudo: true, direcao: true, createdAt: true },
      },
    },
  });

  const mensagens: MensagemJoao[] =
    conversa && conversa.mensagens.length > 0
      ? conversa.mensagens.slice().reverse()
      : [];

  // ── [ACRESCENTADO 14/11/2026 v1+v2] Memória investigativa — dossiê vinculado ────
  // Busca o DossieComercial mais recente onde este telefone consta como decisor.
  // v1: título, missão, score, completude.
  // v2: evidências (ativas, mais recentes), movimentações (ativas, mais recentes),
  //     resumo e próxima ação sugerida — contexto investigativo completo.
  // REGRA: apenas dossiês do fluxo normal (Radar/abordagem). Não altera Carteiras.
  let dossie: DossieContexto | null = null;
  try {
    const dossieDb = await prisma.dossieComercial.findFirst({
      where: {
        decisores: {
          some: { telefone },
        },
      },
      orderBy: { ultimaAtividade: "desc" },
      select: {
        titulo: true,
        resumo: true,
        missaoAtual: true,
        proximaAcaoSugerida: true,
        score: true,
        completude: true,
        // [ACRESCENTADO v2] Evidências ativas — máximo 5, mais recentes primeiro
        // [ATUALIZADO v3] Inclui dataColeta para exibição temporal
        evidencias: {
          where: { estado: "ATIVA" },
          orderBy: { dataColeta: "desc" },
          take: 5,
          select: {
            titulo: true,
            descricao: true,
            fonteTipo: true,
            fonteNome: true,
            confianca: true,
            dataColeta: true,
          },
        },
        // [ACRESCENTADO v2] Movimentações ativas — máximo 5, mais recentes primeiro
        // [ATUALIZADO v3] Inclui createdAt para exibição temporal
        movimentacoes: {
          where: { status: "ATIVA" },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            titulo: true,
            descricao: true,
            tipo: true,
            createdAt: true,
          },
        },
      },
    });
    if (dossieDb) {
      dossie = {
        titulo: dossieDb.titulo,
        resumo: dossieDb.resumo ?? null,
        missaoAtual: dossieDb.missaoAtual ?? null,
        proximaAcaoSugerida: dossieDb.proximaAcaoSugerida ?? null,
        score: dossieDb.score ?? null,
        completude: dossieDb.completude ?? null,
        // [ATUALIZADO v3] Mapeia dataColeta para o campo `data` do tipo
        evidencias: (dossieDb.evidencias ?? []).map((ev) => ({
          titulo: ev.titulo,
          descricao: ev.descricao ?? null,
          fonteTipo: ev.fonteTipo as string,
          fonteNome: ev.fonteNome ?? null,
          confianca: ev.confianca as string,
          data: ev.dataColeta ?? null,
        })),
        // [ATUALIZADO v3] Mapeia createdAt para o campo `data` do tipo
        movimentacoes: (dossieDb.movimentacoes ?? []).map((mov) => ({
          titulo: mov.titulo,
          descricao: mov.descricao ?? null,
          tipo: mov.tipo as string,
          data: mov.createdAt ?? null,
        })),
      };
    }
  } catch (err) {
    // Falha na leitura do dossiê nunca derruba o fluxo principal
    console.error("[joao/contexto] Erro ao ler dossiê vinculado:", err);
  }
  // ── [FIM DA ADIÇÃO] ─────────────────────────────────────────────────────────

  if (mensagens.length === 0 && !dossie) return "";

  return formatarContextoJoao({ mensagens, dossie });
}
