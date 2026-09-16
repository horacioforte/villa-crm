// ARQUIVO: app/api/maria/chat-gestao/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Chat de gestão interna com Maria — MODO NARRATIVO.
// Morgana ou Horácio perguntam e Maria responde como colega de trabalho,
// contando sobre seu dia, suas conversas, seus leads — não reportando métricas.
//
// Contextos disponíveis (selecionados pelo usuário na UI):
//   "conversas" → mensagens reais das conversas de hoje (quem disse o quê)
//   "leads"     → fila inteligente e recomendações de ação
//   "tarefas"   → follow-ups e tarefas de WhatsApp pendentes
//   "metricas"  → visão geral do dia (para quando perguntarem números)
//
// Segurança: requer sessão autenticada. Nenhum segredo é logado.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getMariaInteligenciaAtendimento } from "@/lib/maria/dados";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mensagem = { role: "user" | "assistant"; content: string };
type ContextoSelecionado = "conversas" | "leads" | "tarefas" | "metricas";

// ─── Builders de contexto ─────────────────────────────────────────────────────

// Conversas reais com conteúdo das mensagens — base da narrativa
async function buildContextoConversas(): Promise<string> {
  const conversas = await prisma.conversa.findMany({
    where: { instanceName: "maria-villa", status: { not: "SPAM" } },
    orderBy: { ultimaMensagemEm: "desc" },
    take: 12,
    select: {
      id: true,
      nomeContato: true,
      telefone: true,
      status: true,
      ultimaMensagemEm: true,
      mensagens: {
        orderBy: { createdAt: "asc" },
        take: 8, // mais mensagens por conversa para ter contexto real
        select: { conteudo: true, direcao: true, autor: true, createdAt: true },
      },
    },
  });

  if (conversas.length === 0) {
    return "## CONVERSAS DE HOJE\nNenhuma conversa registrada ainda.";
  }

  const linhas = ["## SUAS CONVERSAS RECENTES (conteúdo real do WhatsApp)"];
  linhas.push("Use este material para contar o que aconteceu com cada pessoa, como ela pareceu, o que ficou em aberto.\n");

  for (const c of conversas) {
    const nome = c.nomeContato ?? c.telefone ?? "Desconhecido";
    const ultimaEm = c.ultimaMensagemEm
      ? new Date(c.ultimaMensagemEm).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    linhas.push(`### ${nome} [${c.status}] — última msg: ${ultimaEm}`);

    if (c.mensagens.length === 0) {
      linhas.push("(sem mensagens registradas)");
    } else {
      for (const m of c.mensagens) {
        const quem = m.direcao === "ENTRADA" ? `${nome}` : "Eu (Maria)";
        linhas.push(`${quem}: ${m.conteudo}`);
      }
    }
    linhas.push("");
  }

  return linhas.join("\n");
}

// Leads e fila de prioridades
function buildContextoLeads(
  dados: Awaited<ReturnType<typeof getMariaInteligenciaAtendimento>>
): string {
  const fila = dados.filaInteligente;
  const rec = dados.recomendacoes;

  const linhas = [
    "## LEADS QUE PRECISAM DE ATENÇÃO",
    "Use para contar quais leads estão na sua cabeça, quem está quente, quem esfriou.\n",
    ...fila.map(
      (l) =>
        `${l.icone} ${l.empresa} — ${l.titulo} (prioridade: ${l.prioridade})`
    ),
    "",
    "## O QUE O SISTEMA ESTÁ SUGERINDO",
    ...rec.map((r) => `• ${r.titulo} — ${r.motivo}`),
  ];

  return linhas.join("\n");
}

// Tarefas pendentes
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
    },
  });

  if (tarefas.length === 0) {
    return "## FOLLOW-UPS PENDENTES\nNenhum follow-up pendente — você está em dia! 🎉";
  }

  const agora = new Date();
  const linhas = [
    "## SEUS FOLLOW-UPS PENDENTES",
    "Use para contar o que está na sua lista, o que está te preocupando.\n",
  ];

  for (const t of tarefas) {
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

// Visão geral numérica — opcional, para quando perguntarem números
function buildContextoMetricas(
  dados: Awaited<ReturnType<typeof getMariaInteligenciaAtendimento>>
): string {
  const m = dados.metricas;
  const r = dados.resumoDia;

  const linhas = [
    "## VISÃO GERAL DO DIA (números — use só se perguntarem)",
    `Novos leads hoje: ${m.novosLeadsHoje}`,
    `Conversas ativas: ${m.conversasAtivas}`,
    `Aguardando resposta: ${m.aguardandoResposta}`,
    `Follow-ups pendentes: ${m.followupsPendentes}`,
    `Leads atendidos hoje: ${r.leadsAtendidos}`,
    `Receita potencial ativa: R$ ${r.receitaPotencial.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
  ];

  return linhas.join("\n");
}

// ─── System prompt narrativo ──────────────────────────────────────────────────

function buildSystemPrompt(nomeUsuario: string, blocos: string[]): string {
  const contextStr =
    blocos.length > 0
      ? blocos.join("\n\n---\n\n")
      : "Nenhum contexto foi carregado. Avise o usuário para selecionar um contexto antes de perguntar sobre seus leads ou conversas.";

  return `Você é Maria, SDR da Villa Empreendimentos, conversando diretamente com ${nomeUsuario}.

COMO VOCÊ DEVE RESPONDER:
- Fale como uma colega de trabalho contando como foi o dia. Natural, direto, humano.
- Comece pelo que mais importa: as pessoas, as conversas, o que ficou em aberto.
- Se tiver o conteúdo real das mensagens no contexto, USE para contar o que aconteceu — "A Ana da Construtora X me perguntou sobre prazo, parece interessada mas ainda não definiu datas..."
- Nunca leia métricas em voz alta como se fosse um relatório. Se perguntarem números, dê — mas sempre com contexto humano.
- Se você cadastrou algo numa oportunidade, pode mencionar naturalmente: "Eu já registrei no CRM, coloquei como lead quente."
- Se uma informação não estiver no contexto carregado, diga claramente: "Não tenho esse dado agora — carrega o contexto de [X] para eu ver."
- Primeira pessoa sempre. Tom de quem trabalhou o dia e quer contar como foi.

CONTEXTO ATUAL (dados do CRM em tempo real):
${contextStr}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

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

  const messages: Mensagem[] = Array.isArray(body.messages) ? body.messages : [];
  const contextos: ContextoSelecionado[] = Array.isArray(body.contextos)
    ? body.contextos
    : [];

  if (messages.length === 0 || !messages[messages.length - 1]?.content?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  // Carrega contextos em paralelo
  const [dadosMaria, conversasBloco, tarefasBloco] = await Promise.all([
    contextos.includes("leads") || contextos.includes("metricas")
      ? getMariaInteligenciaAtendimento()
      : Promise.resolve(null),
    contextos.includes("conversas") ? buildContextoConversas() : Promise.resolve(null),
    contextos.includes("tarefas") ? buildContextoTarefas() : Promise.resolve(null),
  ]);

  const blocos: string[] = [];
  if (conversasBloco) blocos.push(conversasBloco);
  if (dadosMaria && contextos.includes("leads")) blocos.push(buildContextoLeads(dadosMaria));
  if (tarefasBloco) blocos.push(tarefasBloco);
  if (dadosMaria && contextos.includes("metricas")) blocos.push(buildContextoMetricas(dadosMaria));

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
      console.error("[maria/chat-gestao] Anthropic erro:", response.status, errBody);
      return NextResponse.json(
        { error: "Erro ao chamar a IA. Tente novamente." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const resposta: string = data.content?.[0]?.text ?? "";
    return NextResponse.json({ resposta });
  } catch (err) {
    console.error("[maria/chat-gestao] Erro de rede:", err);
    return NextResponse.json({ error: "Erro de conexão com a IA." }, { status: 502 });
  }
}
