// ARQUIVO: lib/agentes/maria/contexto.ts
// REGRA: nunca remover. Apenas acrescentar.
// Busca e formata o contexto de conversa para a Maria (histórico CRM + oportunidades abertas).
// ACRESCENTADO (14/11/2026 — Memória Inteligente v1):
//   - Lê as últimas 10 mensagens da sessão atual (Conversa/Mensagem, instanceName "maria-villa")
//     para que a Maria não perca o fio da conversa entre turnos dentro da mesma sessão.
//   - Requer WHATSAPP_MARIA_CONVERSAS_V2=true para que as mensagens sejam gravadas;
//     se a flag estiver desligada ou não existirem registros, o bloco de sessão fica vazio
//     e o comportamento é idêntico ao anterior.
//   - Se a Pessoa não estiver no CRM mas a sessão tiver mensagens, retorna só o bloco de sessão.
//   - Ordem do contexto: mensagens da sessão atual → oportunidade aberta → histórico CRM.
// ACRESCENTADO (15/11/2026 — Memória de Longo Prazo v1):
//   - HistoricoContexto agora inclui dataContato para exibir a data/tempo do histórico.
//   - formatarDataHistorico(): formata data legível com referência relativa (ex: "3 meses atrás").
//   - formatarContextoMaria() exibe data no cabeçalho de cada histórico antigo.
//   - Query do banco já buscava dataContato — agora é passado para a camada de formatação.

import { prisma } from "@/lib/prisma";
import { TipoContato, StatusOportunidade } from "@/app/generated/prisma/client";

// ─── Tipos de dados para a função de formatação pura ─────────────────────────

export type MensagemSessao = {
  direcao: string;
  conteudo: string;
};

export type OportunidadeContexto = {
  titulo: string;
  tipoServico: string | null;
  descricao: string | null;
};

export type HistoricoContexto = {
  resumo: string;
  detalhes: string | null;
  // [ACRESCENTADO 15/11/2026 — Memória de Longo Prazo v1]
  dataContato: Date | null;
};

// ─── Formatação de data relativa ─────────────────────────────────────────────
// [ACRESCENTADO 15/11/2026 — Memória de Longo Prazo v1]

/**
 * Formata uma data de histórico com referência relativa legível.
 * Ex: "[14/08/2026 — 3 meses atrás]", "[ontem]", "[14/11/2026 — hoje]"
 * Permite que a Maria saiba imediatamente se é um contato recente ou antigo.
 */
export function formatarDataHistorico(dataContato: Date | null): string {
  if (!dataContato) return "";
  const data = dataContato.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const diasAtras = Math.floor(
    (Date.now() - dataContato.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diasAtras === 0) return `[${data} — hoje]`;
  if (diasAtras === 1) return `[${data} — ontem]`;
  if (diasAtras < 7) return `[${data} — ${diasAtras} dias atrás]`;
  if (diasAtras < 30) return `[${data} — ${Math.floor(diasAtras / 7)} semana(s) atrás]`;
  if (diasAtras < 60) return `[${data} — 1 mês atrás]`;
  const meses = Math.floor(diasAtras / 30);
  return `[${data} — ${meses} meses atrás]`;
}

// ─── Formatação pura (testável sem banco) ────────────────────────────────────

/**
 * Formata o contexto completo da Maria a partir de dados já recuperados do banco.
 * Função pura: não acessa banco, não tem efeitos colaterais — testável diretamente.
 * Ordem: mensagens da sessão atual → oportunidade aberta → histórico CRM (antigas → novas).
 * Limite total: 3000 chars (preserva o comportamento original).
 * [ATUALIZADO 15/11/2026] Histórico inclui data/tempo relativo para memória de longo prazo.
 */
export function formatarContextoMaria({
  mensagensSessao,
  oportunidade,
  historicos,
}: {
  mensagensSessao: MensagemSessao[];
  oportunidade: OportunidadeContexto | null;
  historicos: HistoricoContexto[];
}): string {
  // Bloco 1 — sessão atual (mais imediato, mais relevante)
  const linhasSessao: string[] =
    mensagensSessao.length > 0
      ? [
          "Histórico recente desta conversa (sessão atual):",
          ...mensagensSessao.map(
            (m) => `${m.direcao === "ENTRADA" ? "Cliente" : "Maria"}: ${m.conteudo}`,
          ),
        ]
      : [];

  // Bloco 2 — oportunidade aberta no CRM
  const linhasOportunidade: (string | null)[] = oportunidade
    ? [
        "Oportunidade aberta existente:",
        `- Titulo: ${oportunidade.titulo}`,
        oportunidade.tipoServico ? `- Tipo: ${oportunidade.tipoServico}` : null,
        oportunidade.descricao ? `- Descricao: ${oportunidade.descricao}` : null,
      ]
    : [];

  // Bloco 3 — histórico de sessões passadas (HistoricoContato, cronológico)
  // [ATUALIZADO 15/11/2026] Inclui data/tempo relativo no cabeçalho de cada histórico
  const linhasHistorico: string[] = historicos
    .slice()
    .reverse()
    .map((h) => {
      const dataLabel = formatarDataHistorico(h.dataContato);
      const cabecalho = dataLabel ? `${dataLabel} ${h.resumo}` : `- ${h.resumo}`;
      return [cabecalho, h.detalhes ?? null].filter(Boolean).join("\n");
    });

  return [
    ...linhasSessao,
    ...linhasOportunidade.filter(Boolean),
    ...linhasHistorico,
  ]
    .join("\n")
    .slice(0, 3000);
}

// ─── Busca principal ──────────────────────────────────────────────────────────

export async function getContextoConversa(telefone: string): Promise<string> {
  // ── [ACRESCENTADO 14/11/2026] Mensagens da sessão atual (instanceName "maria-villa") ──
  // Mesmo padrão de getContextoJoao() — take aumentado para 10 para cobrir conversas
  // mais longas. Se WHATSAPP_MARIA_CONVERSAS_V2 estiver desligada e não houver registros,
  // `conversa` será null e linhasSessao ficará vazio — comportamento 100% backward-compatible.
  let mensagensSessao: MensagemSessao[] = [];
  try {
    const conversa = await prisma.conversa.findFirst({
      where: { telefone, instanceName: "maria-villa" },
      orderBy: { updatedAt: "desc" },
      include: {
        mensagens: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { conteudo: true, direcao: true, createdAt: true },
        },
      },
    });
    if (conversa && conversa.mensagens.length > 0) {
      // Reverte para ordem cronológica (mais antigas primeiro → mais recentes no fim)
      mensagensSessao = conversa.mensagens.slice().reverse();
    }
  } catch (err) {
    // Falha na leitura da sessão nunca derruba o fluxo principal
    console.error("[maria/contexto] Erro ao ler mensagens de sessão:", err);
  }
  // ── [FIM DA ADIÇÃO] ─────────────────────────────────────────────────────────

  const pessoa = await prisma.pessoa.findFirst({
    where: {
      OR: [{ whatsapp: telefone }, { telefone }],
    },
    select: {
      id: true,
      historicos: {
        where: {
          tipo: TipoContato.WHATSAPP,
        },
        orderBy: {
          dataContato: "desc",
        },
        take: 6,
        select: {
          resumo: true,
          detalhes: true,
          dataContato: true,
        },
      },
      oportunidades: {
        where: {
          ativa: true,
          status: {
            notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          titulo: true,
          descricao: true,
          tipoServico: true,
        },
      },
    },
  });

  if (!pessoa) {
    // ── [ACRESCENTADO 14/11/2026] Se não há Pessoa mas há sessão, retorna a sessão ──
    // Comportamento anterior: retornava "" para contatos novos que ainda não estão no CRM.
    // Novo comportamento: retorna as mensagens da sessão atual se houver — a Pessoa é
    // criada pelo fluxo de CRM após a primeira mensagem, então na segunda mensagem da
    // mesma sessão ela já existe; mas no caso de lag de DB ou primeira reentrada, este
    // bloco garante que o contexto não fica vazio.
    if (mensagensSessao.length > 0) {
      return formatarContextoMaria({ mensagensSessao, oportunidade: null, historicos: [] });
    }
    return "";
  }

  const oportunidade = pessoa.oportunidades[0] ?? null;
  // [ATUALIZADO 15/11/2026] dataContato já está na query (estava no select, agora também no tipo)
  const historicos: HistoricoContexto[] = pessoa.historicos.map((h) => ({
    resumo: h.resumo,
    detalhes: h.detalhes ?? null,
    dataContato: h.dataContato ?? null,
  }));

  return formatarContextoMaria({ mensagensSessao, oportunidade, historicos });
}
