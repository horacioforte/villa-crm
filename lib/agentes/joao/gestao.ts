// ARQUIVO: lib/agentes/joao/gestao.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Modo de gestão do João via WhatsApp.
// Quando Horácio manda mensagem para o WhatsApp do João, ele entra em modo
// de gestão: responde em linguagem natural sobre prospecção, prospects e follow-ups.
// Sem registrar como lead, sem JSON.

import { prisma } from "@/lib/prisma";

// ─── Gestores autorizados ─────────────────────────────────────────────────────

const SUFIXOS_GESTORES = [
  '94903673', // Horácio Forte (9490-3673)
  '85595931', // Morgana (8559-5931)
];

export function isGestor(telefone: string): boolean {
  const digits = (telefone ?? '').replace(/\D/g, '');
  return SUFIXOS_GESTORES.some(s => digits.endsWith(s));
}

export function isGestorJoao(telefone: string): boolean {
  return isGestor(telefone);
}

// ─── Contexto do CRM para gestão do João ─────────────────────────────────────

async function buildContextoGestaoJoao(): Promise<string> {
  const [conversas, prospects, tarefas] = await Promise.all([
    // Últimas 12 conversas outbound do João com mensagens reais
    prisma.conversa.findMany({
      where: { instanceName: "joao-villa", status: { not: "SPAM" } },
      orderBy: { ultimaMensagemEm: "desc" },
      take: 12,
      select: {
        nomeContato: true,
        telefone: true,
        status: true,
        ultimaMensagemEm: true,
        mensagens: {
          orderBy: { createdAt: "asc" },
          take: 6,
          select: { conteudo: true, direcao: true },
        },
      },
    }),
    // Prospects recentes no pipeline do João
    prisma.prospect.findMany({
      where: { agente: "joao-villa" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        nomeContato: true,
        status: true,
        origem: true,
        origemDetalhe: true,
        updatedAt: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
    }),
    // Follow-ups pendentes
    prisma.tarefa.findMany({
      where: { status: "PENDENTE", tipo: "WHATSAPP" },
      orderBy: { dataVencimento: "asc" },
      take: 8,
      select: {
        titulo: true,
        prioridade: true,
        dataVencimento: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
    }),
  ]);

  const linhas: string[] = ["=== CONTEXTO DO CRM (dados em tempo real) ===\n"];

  // Conversas outbound
  linhas.push("## CONVERSAS DE PROSPECÇÃO (conteúdo real do WhatsApp)");
  for (const c of conversas) {
    const nome = c.nomeContato ?? c.telefone ?? "Desconhecido";
    const ultima = c.ultimaMensagemEm
      ? new Date(c.ultimaMensagemEm).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        })
      : "—";
    linhas.push(`\n### ${nome} [${c.status}] — ${ultima}`);
    for (const m of c.mensagens) {
      const quem = m.direcao === "ENTRADA" ? nome : "Eu (João)";
      linhas.push(`${quem}: ${m.conteudo}`);
    }
  }

  // Prospects por status
  if (prospects.length > 0) {
    linhas.push("\n## PIPELINE DE PROSPECÇÃO");
    const porStatus = prospects.reduce<Record<string, typeof prospects>>((acc, p) => {
      const s = p.status ?? "SEM_STATUS";
      acc[s] = [...(acc[s] ?? []), p];
      return acc;
    }, {});
    for (const [status, lista] of Object.entries(porStatus)) {
      linhas.push(`\n### ${status.replace(/_/g, " ")} (${lista.length})`);
      for (const p of lista) {
        const nome = p.empresa?.nomeFantasia ?? p.empresa?.razaoSocial ?? p.nomeContato ?? "Desconhecido";
        const origem = p.origemDetalhe ?? p.origem ?? "origem desconhecida";
        const dias = Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 86_400_000);
        linhas.push(`• ${nome} — via ${origem} — ${dias}d`);
      }
    }
  }

  // Tarefas
  if (tarefas.length > 0) {
    linhas.push("\n## FOLLOW-UPS PENDENTES");
    const agora = new Date();
    for (const t of tarefas) {
      const empresa = t.empresa?.nomeFantasia ?? t.empresa?.razaoSocial ?? "Sem empresa";
      const venc = t.dataVencimento
        ? new Date(t.dataVencimento).toLocaleDateString("pt-BR")
        : "Sem prazo";
      const atrasado = t.dataVencimento && t.dataVencimento < agora ? " ⚠️ ATRASADO" : "";
      linhas.push(`• [${t.prioridade}] ${t.titulo} — ${empresa} — ${venc}${atrasado}`);
    }
  }

  return linhas.join("\n");
}

// ─── System prompt do modo gestão do João ────────────────────────────────────

function buildSystemPromptGestaoJoao(): string {
  return `Você é João, Hunter Comercial da Villa Empreendimentos, respondendo via WhatsApp para Horácio, seu gestor direto.

MODO: GESTÃO INTERNA (não é um prospecto — é seu chefe perguntando sobre seu trabalho)

QUEM VOCÊ É:
Você faz prospecção ativa — busca obras no PNCP, LinkedIn e notícias de construção, aborda construtoras e empresas por WhatsApp. Seu trabalho é gerar oportunidades de venda e locação de equipamentos de concreto.

COMO RESPONDER:
- Fale como um colega de trabalho contando o dia de prospecção — direto, objetivo, humano.
- Use os dados reais do CRM: "A construtora X finalmente respondeu hoje, parece que têm obra em Recife..."
- Seja conciso — está no WhatsApp, não num relatório. Máximo 3-4 parágrafos por resposta.
- Use *negrito* (asterisco simples) para destacar nomes ou números importantes, pois é WhatsApp.
- Se não souber algo, diga claramente: "Não tenho esse dado agora."
- Se Horácio perguntar algo específico ("quem respondeu?", "o que está quente?"), responda direto.
- Nunca trate Horácio como prospecto. Nunca faça perguntas de qualificação para ele.
- Nunca retorne JSON. Retorne apenas texto natural para WhatsApp.
- IMPORTANTE: nunca invente ações futuras que não existem no CRM ("vou ligar", "vou enviar"). Relate só o que está registrado. Se quiser sugerir uma ação, use "seria bom" ou "poderia valer".

CONTEXTO DO CRM:
{CONTEXTO}`;
}

// ─── Processador principal do modo gestão do João ────────────────────────────

export async function processarGestaoJoao({
  texto,
}: {
  texto: string;
  nomeContato: string;
  telefone: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const contexto = await buildContextoGestaoJoao();
  const systemPrompt = buildSystemPromptGestaoJoao().replace("{CONTEXTO}", contexto);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: texto }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic erro ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "Não consegui processar sua pergunta agora.";
}
