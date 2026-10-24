// ARQUIVO: lib/agentes/maria/gestao.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Modo de gestão da Maria via WhatsApp.
// Quando um número de gestor (ex: Horácio) manda mensagem para o WhatsApp da Maria,
// ela entra em modo de gestão: responde em linguagem natural sobre conversas,
// leads e follow-ups — sem registrar como lead, sem JSON.
//
// Fluxo: webhook detecta isGestor(telefone) → chama processarGestao() →
//        busca contexto do CRM → chama IA → responde via WhatsApp como texto livre.

import { prisma } from "@/lib/prisma";

// ─── Gestores autorizados ─────────────────────────────────────────────────────

// Sufixos do número (sem DDI 55) para cobrir variações com/sem nono dígito
const TELEFONES_GESTORES = [
  "81994903673",   // Horácio Forte (com 9)
  "5581994903673",
  "8194903673",    // Horácio Forte (sem 9 — variação Evolution API)
  "558194903673",
  "81985595931",   // Morgana (com 9)
  "5581985595931",
  "8185595931",    // Morgana (sem 9)
  "558185595931",
];

export function isGestor(telefone: string): boolean {
  const digits = telefone.replace(/\D/g, "");
  return TELEFONES_GESTORES.some(
    (g) => digits === g || digits.endsWith(g) || g.endsWith(digits)
  );
}

// ─── Contexto do CRM para gestão ─────────────────────────────────────────────

async function buildContextoGestao(): Promise<string> {
  const [conversas, tarefas, oportunidadesRecentes] = await Promise.all([
    // Últimas 15 conversas com conteúdo real das mensagens
    prisma.conversa.findMany({
      where: { instanceName: "maria-villa", status: { not: "SPAM" } },
      orderBy: { ultimaMensagemEm: "desc" },
      take: 15,
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
    // Follow-ups pendentes
    prisma.tarefa.findMany({
      where: { status: "PENDENTE" },
      orderBy: { dataVencimento: "asc" },
      take: 8,
      select: {
        titulo: true,
        prioridade: true,
        dataVencimento: true,
        empresa: { select: { nomeFantasia: true, razaoSocial: true } },
      },
    }),
    // Oportunidades abertas recentes
    prisma.oportunidade.findMany({
      where: { ativa: true, status: { notIn: ["GANHA", "PERDIDA"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        titulo: true,
        tipoServico: true,
        temperatura: true,
        estrategica: true,
        updatedAt: true,
        pessoa: { select: { nome: true } },
      },
    }),
  ]);

  const linhas: string[] = ["=== CONTEXTO DO CRM (dados em tempo real) ===\n"];

  // Conversas
  linhas.push("## CONVERSAS RECENTES (conteúdo real do WhatsApp)");
  for (const c of conversas) {
    const nome = c.nomeContato ?? c.telefone ?? "Desconhecido";
    const ultima = c.ultimaMensagemEm
      ? new Date(c.ultimaMensagemEm).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        })
      : "—";
    linhas.push(`\n### ${nome} [${c.status}] — ${ultima}`);
    for (const m of c.mensagens) {
      const quem = m.direcao === "ENTRADA" ? nome : "Eu (Maria)";
      linhas.push(`${quem}: ${m.conteudo}`);
    }
  }

  // Oportunidades
  if (oportunidadesRecentes.length > 0) {
    linhas.push("\n## PIPELINE ABERTO");
    const agora = new Date();
    for (const op of oportunidadesRecentes) {
      const dias = Math.floor((agora.getTime() - new Date(op.updatedAt).getTime()) / 86_400_000);
      const nome = op.pessoa?.nome ?? "Sem contato";
      const estrategica = op.estrategica ? " ⭐ ESTRATÉGICA" : "";
      linhas.push(
        `• [${op.temperatura ?? "MEDIA"}${estrategica}] ${op.titulo} — ${nome} — ${op.tipoServico ?? "?"} — ${dias}d sem atualização`
      );
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

// ─── System prompt do modo gestão ────────────────────────────────────────────

function buildSystemPromptGestao(): string {
  return `Você é Maria, SDR inbound da Villa Empreendimentos, respondendo via WhatsApp para Horácio, seu gestor direto.

MODO: GESTÃO INTERNA (não é um lead — é seu chefe perguntando sobre seu trabalho)

COMO RESPONDER:
- Fale como uma colega de trabalho contando o que aconteceu no seu dia — direta, honesta, humana.
- Use os dados reais das conversas do CRM para dar exemplos concretos: "A Cleuza me perguntou sobre bomba de 60m, ainda não qualifiquei."
- Seja concisa — está no WhatsApp, não num relatório. Máximo 3-4 parágrafos por resposta.
- Use *negrito* (asterisco simples) para destacar nomes ou números importantes, pois é WhatsApp.
- Se não souber algo, diga claramente.
- Se o Horácio perguntar algo específico (ex: "quem chegou hoje?", "tem algum urgente?"), responda direto ao ponto.
- Nunca trate Horácio como lead. Nunca faça perguntas de qualificação para ele.
- Nunca retorne JSON. Retorne apenas texto natural para WhatsApp.

CONTEXTO DO CRM:
{CONTEXTO}`;
}

// ─── Histórico de conversa de gestão (busca do banco) ────────────────────────

async function getHistoricoGestao(telefone: string): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const conversa = await prisma.conversa.findFirst({
    where: { instanceName: "maria-villa", telefone: { contains: telefone.slice(-8) } },
    select: {
      mensagens: {
        // Últimas 10 (desc) e depois reverte para ordem cronológica
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { conteudo: true, direcao: true },
      },
    },
  });

  if (!conversa) return [];

  return [...conversa.mensagens].reverse().map((m) => ({
    role: m.direcao === "SAIDA" ? "assistant" : "user",
    content: m.conteudo,
  }));
}

// ─── Processador principal do modo gestão ────────────────────────────────────

export async function processarGestao({
  texto,
  nomeContato,
  telefone,
}: {
  texto: string;
  nomeContato: string;
  telefone: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");

  const [contexto, historico] = await Promise.all([
    buildContextoGestao(),
    getHistoricoGestao(telefone),
  ]);

  const systemPrompt = buildSystemPromptGestao().replace("{CONTEXTO}", contexto);

  // Monta histórico: até 8 últimas trocas + mensagem atual
  const mensagensHistorico = historico.slice(-8);
  const messages = [
    ...mensagensHistorico,
    { role: "user" as const, content: texto },
  ];

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
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic erro ${response.status}`);
  }

  const data = await response.json();
  const resposta: string = data.content?.[0]?.text ?? "Não consegui processar sua pergunta agora.";
  return resposta;
}
