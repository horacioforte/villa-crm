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

import { prisma } from "@/lib/prisma";

// ─── Tipos de dados para a função de formatação pura ─────────────────────────

export type MensagemJoao = {
  direcao: string;
  conteudo: string;
};

export type DossieContexto = {
  titulo: string;
  missaoAtual: string | null;
  score: number | null;
  completude: number | null;
};

// ─── Formatação pura (testável sem banco) ────────────────────────────────────

/**
 * Formata o contexto completo do João a partir de dados já recuperados do banco.
 * Função pura: não acessa banco, não tem efeitos colaterais — testável diretamente.
 * Ordem: mensagens da sessão (cronológica) → dossiê em andamento (se houver).
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
    if (dossie.missaoAtual) linhas.push(`Missão atual: ${dossie.missaoAtual}`);
    if (dossie.score !== null) linhas.push(`Score: ${dossie.score}/100`);
    if (dossie.completude !== null) linhas.push(`Completude: ${dossie.completude}%`);
  }

  return linhas.join("\n").trim();
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

  // ── [ACRESCENTADO 14/11/2026] Memória investigativa — dossiê vinculado ────
  // Busca o DossieComercial mais recente onde este telefone consta como decisor.
  // Permite que o João saiba que já há investigação em andamento para este contato
  // e não recomece a conversa do zero nem duplique esforço.
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
        missaoAtual: true,
        score: true,
        completude: true,
      },
    });
    if (dossieDb) {
      dossie = {
        titulo: dossieDb.titulo,
        missaoAtual: dossieDb.missaoAtual ?? null,
        score: dossieDb.score ?? null,
        completude: dossieDb.completude ?? null,
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
