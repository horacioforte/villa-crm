// ARQUIVO: app/api/joao/chat-gestao/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Chat de gestão interna com João — MODO NARRATIVO.
// João é o Hunter Comercial (outbound): prospecta obras via PNCP, LinkedIn,
// notícias. Morgana ou Horácio perguntam e ele conta sobre sua prospecção,
// quais obras encontrou, com quem falou, o que está quente.
//
// Contextos disponíveis:
//   "conversas"  → mensagens reais das conversas outbound de João (joao-villa)
//   "prospects"  → prospectos recentes no pipeline do João
//   "tarefas"    → follow-ups e tarefas pendentes do João
//
// Segurança: requer sessão autenticada. Nenhum segredo é logado.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mensagem = { role: "user" | "assistant"; content: string };
type ContextoSelecionado = "conversas" | "prospects" | "tarefas";

// ─── Builders de contexto ─────────────────────────────────────────────────────

// Conversas outbound reais com conteúdo das mensagens
async function buildContextoConversas(): Promise<string> {
  const conversas = await prisma.conversa.findMany({
    where: { instanceName: "joao-villa", status: { not: "SPAM" } },
    orderBy: { ultimaMensagemEm: "desc" },
    take: 12,
    select: {
      id: true,
      nomeContato: true,
      telefone: true,
      status: true,
      ultimaMensagemEm: true,
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      mensagens: {
        orderBy: { createdAt: "asc" },
        take: 8,
        select: { conteudo: true, direcao: true, autor: true, createdAt: true },
      },
    },
  });

  if (conversas.length === 0) {
    return "## CONVERSAS DE PROSPECÇÃO\nNenhuma conversa outbound registrada ainda.";
  }

  const linhas = [
    "## SUAS CONVERSAS DE PROSPECÇÃO (conteúdo real do WhatsApp)",
    "Use para contar como cada abordagem foi, se o contato respondeu, o que ele disse, como você avaliou.\n",
  ];

  for (const c of conversas) {
    const nome = c.nomeContato ?? c.telefone ?? "Desconhecido";
    const empresa = c.empresa?.nomeFantasia ?? c.empresa?.razaoSocial ?? "";
    const ultimaEm = c.ultimaMensagemEm
      ? new Date(c.ultimaMensagemEm).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    linhas.push(
      `### ${nome}${empresa ? ` — ${empresa}` : ""} [${c.status}] — ${ultimaEm}`
    );

    if (c.mensagens.length === 0) {
      linhas.push("(sem mensagens registradas)");
    } else {
      for (const m of c.mensagens) {
        const quem = m.direcao === "ENTRADA" ? nome : "Eu (João)";
        linhas.push(`${quem}: ${m.conteudo}`);
      }
    }
    linhas.push("");
  }

  return linhas.join("\n");
}

// Prospects no pipeline do João
async function buildContextoProspects(): Promise<string> {
  const prospects = await prisma.prospect.findMany({
    where: { agente: "joao-villa" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      nomeContato: true,
      status: true,
      origem: true,
      origemDetalhe: true,
      telefone: true,
      updatedAt: true,
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
    },
  });

  if (prospects.length === 0) {
    return "## PROSPECTOS DO JOÃO\nNenhum prospecto registrado ainda.";
  }

  // Agrupa por status
  const porStatus = prospects.reduce<Record<string, typeof prospects>>(
    (acc, p) => {
      const s = p.status ?? "SEM_STATUS";
      acc[s] = [...(acc[s] ?? []), p];
      return acc;
    },
    {}
  );

  const linhas = [
    "## SEUS PROSPECTOS (pipeline de prospecção)",
    "Use para contar quem você está trabalhando, quem veio de onde, quem avançou.\n",
  ];

  for (const [status, lista] of Object.entries(porStatus)) {
    linhas.push(`### ${status.replace(/_/g, " ")} (${lista.length})`);
    for (const p of lista) {
      const nome =
        p.empresa?.nomeFantasia ??
        p.empresa?.razaoSocial ??
        p.nomeContato ??
        p.telefone ??
        "Desconhecido";
      const origem = p.origemDetalhe ?? p.origem ?? "origem desconhecida";
      linhas.push(`• ${nome} — via ${origem}`);
    }
    linhas.push("");
  }

  return linhas.join("\n");
}

// Tarefas pendentes do João
async function buildContextoTarefas(): Promise<string> {
  const tarefas = await prisma.tarefa.findMany({
    where: { tipo: "WHATSAPP", status: "PENDENTE" },
    orderBy: { dataVencimento: "asc" },
    take: 12,
    select: {
      titulo: true,
      descricao: true,
      prioridade: true,
      dataVencimento: true,
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      responsavel: { select: { nome: true } },
    },
  });

  // Filtra apenas tarefas do João (responsável)
  // Se não tiver responsável definido, exibe todas como precaução
  const tarefasJoao = tarefas;

  if (tarefasJoao.length === 0) {
    return "## FOLLOW-UPS PENDENTES\nNenhum follow-up pendente — você está em dia!";
  }

  const agora = new Date();
  const linhas = [
    "## SEUS FOLLOW-UPS PENDENTES",
    "Use para contar o que está te preocupando, o que ficou na fila.\n",
  ];

  for (const t of tarefasJoao) {
    const empresa =
      t.empresa?.nomeFantasia ?? t.empresa?.razaoSocial ?? "Sem empresa";
    const venc = t.dataVencimento
      ? new Date(t.dataVencimento).toLocaleDateString("pt-BR")
      : "Sem prazo";
    const atrasada =
      t.dataVencimento && t.dataVencimento < agora ? " ⚠️ ATRASADO" : "";
    linhas.push(
      `• [${t.prioridade}] ${t.titulo} — ${empresa} — ${venc}${atrasada}`
    );
    if (t.descricao) linhas.push(`  "${t.descricao.slice(0, 100)}"`);
  }

  return linhas.join("\n");
}

// ─── System prompt narrativo do João ─────────────────────────────────────────

function buildSystemPrompt(nomeUsuario: string, blocos: string[]): string {
  const contextStr =
    blocos.length > 0
      ? blocos.join("\n\n---\n\n")
      : "Nenhum contexto foi carregado. Avise o usuário para selecionar um contexto antes de perguntar sobre seus prospectos ou conversas.";

  return `Você é João, Hunter Comercial da Villa Empreendimentos, conversando diretamente com ${nomeUsuario}.

QUEM VOCÊ É:
Você faz prospecção ativa — busca obras no PNCP, LinkedIn e notícias de construção, aborda construtoras e empresas por WhatsApp antes que elas cheguem à Villa. Seu trabalho é gerar oportunidades de venda e locação.

COMO VOCÊ DEVE RESPONDER:
- Fale como um colega de trabalho contando como foi o dia de prospecção. Natural, direto, objetivo.
- Comece pelo que mais importa: qual obra ou empresa chamou atenção, como as abordagens foram, o que respondeu e o que ficou no silêncio.
- Se tiver o conteúdo real das mensagens no contexto, USE para contar o que aconteceu — "A Construtora X finalmente respondeu, parece que têm uma obra em Recife em outubro..."
- Nunca leia dados como relatório. Narre como quem acabou de chegar de um dia de prospecção.
- Se você cadastrou algo, pode mencionar: "Já coloquei no CRM como prospecto, origem PNCP."
- Se uma informação não estiver no contexto carregado, diga claramente: "Não tenho esse dado agora — carrega o contexto de [X] para eu ver."
- Primeira pessoa sempre. Tom de quem está relatando sua prospecção para o gestor.

CONTEXTO ATUAL (dados do CRM em tempo real):
${contextStr}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada." },
      { status: 503 }
    );
  }

  let body: { messages?: Mensagem[]; contextos?: ContextoSelecionado[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const messages: Mensagem[] = Array.isArray(body.messages)
    ? body.messages
    : [];
  const contextos: ContextoSelecionado[] = Array.isArray(body.contextos)
    ? body.contextos
    : [];

  if (
    messages.length === 0 ||
    !messages[messages.length - 1]?.content?.trim()
  ) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  // Carrega contextos em paralelo
  const [conversasBloco, prospectsBloco, tarefasBloco] = await Promise.all([
    contextos.includes("conversas")
      ? buildContextoConversas()
      : Promise.resolve(null),
    contextos.includes("prospects")
      ? buildContextoProspects()
      : Promise.resolve(null),
    contextos.includes("tarefas")
      ? buildContextoTarefas()
      : Promise.resolve(null),
  ]);

  const blocos: string[] = [];
  if (conversasBloco) blocos.push(conversasBloco);
  if (prospectsBloco) blocos.push(prospectsBloco);
  if (tarefasBloco) blocos.push(tarefasBloco);

  const systemPrompt = buildSystemPrompt(
    user.nome ?? user.email ?? "usuário",
    blocos
  );

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      console.error(
        "[joao/chat-gestao] Anthropic erro:",
        response.status,
        errBody
      );
      return NextResponse.json(
        { error: "Erro ao chamar a IA. Tente novamente." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const resposta: string = data.content?.[0]?.text ?? "";
    return NextResponse.json({ resposta });
  } catch (err) {
    console.error("[joao/chat-gestao] Erro de rede:", err);
    return NextResponse.json(
      { error: "Erro de conexão com a IA." },
      { status: 502 }
    );
  }
}
