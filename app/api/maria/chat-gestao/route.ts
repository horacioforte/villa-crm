// ARQUIVO: app/api/maria/chat-gestao/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Chat de gestão interna com Maria.
// Morgana ou Horácio fazem perguntas e Maria responde em "modo relatório":
// como colega de trabalho, não como SDR com cliente.
//
// Contextos disponíveis (selecionados pelo usuário na UI):
//   "metricas"  → métricas agregadas do dia / pipeline / temperatura
//   "leads"     → leads ativos com status, temperatura, tempo sem contato
//   "conversas" → conversas recentes do WhatsApp de Maria (maria-villa)
//   "tarefas"   → tarefas de WhatsApp pendentes
//
// Segurança: requer sessão autenticada. Nenhum segredo é logado.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getMariaInteligenciaAtendimento } from "@/lib/maria/dados";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mensagem = { role: "user" | "assistant"; content: string };

type ContextoSelecionado = "metricas" | "leads" | "conversas" | "tarefas";

// ─── Builders de contexto ─────────────────────────────────────────────────────

function buildContextoMetricas(dados: Awaited<ReturnType<typeof getMariaInteligenciaAtendimento>>): string {
  const m = dados.metricas;
  const r = dados.resumoDia;
  const insights = dados.insights;
  const pipeline = dados.pipeline;

  const linhas = [
    "## MÉTRICAS DO DIA",
    `Novos leads hoje: ${m.novosLeadsHoje}`,
    `Conversas ativas: ${m.conversasAtivas}`,
    `Aguardando resposta: ${m.aguardandoResposta}`,
    `Follow-ups pendentes: ${m.followupsPendentes}`,
    `Taxa de conversão histórica: ${m.taxaConversao}%`,
    `Temperatura média da carteira: ${m.temperaturaMedia}/100`,
    `Tempo médio de resposta: ${m.tempoMedioResposta} min`,
    "",
    "## PIPELINE ATUAL",
    ...pipeline.map((p) => `${p.label}: ${p.quantidade} oportunidade${p.quantidade !== 1 ? "s" : ""}`),
    "",
    "## RESUMO DO DIA",
    `Leads atendidos hoje: ${r.leadsAtendidos}`,
    `Conversas iniciadas: ${r.conversasIniciadas}`,
    `Receita potencial ativa: R$ ${r.receitaPotencial.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    "",
    "## INSIGHTS DO SISTEMA",
    ...(insights.length > 0 ? insights.map((i) => `• ${i}`) : ["Nenhum insight pendente."]),
  ];

  return linhas.join("\n");
}

function buildContextoLeads(dados: Awaited<ReturnType<typeof getMariaInteligenciaAtendimento>>): string {
  const fila = dados.filaInteligente;
  const rec = dados.recomendacoes;

  const linhas = [
    "## FILA DE LEADS (os mais urgentes)",
    ...fila.map((l) => `${l.icone} ${l.empresa} — ${l.titulo} (prioridade: ${l.prioridade})`),
    "",
    "## RECOMENDAÇÕES DE AÇÃO",
    ...rec.map((r) => `• ${r.titulo} — ${r.motivo}`),
  ];

  return linhas.join("\n");
}

async function buildContextoConversas(): Promise<string> {
  const conversas = await prisma.conversa.findMany({
    where: { instanceName: "maria-villa", status: { not: "SPAM" } },
    orderBy: { ultimaMensagemEm: "desc" },
    take: 15,
    select: {
      id: true,
      nomeContato: true,
      telefone: true,
      status: true,
      ultimaMensagemEm: true,
      atendidoPor: { select: { nome: true } },
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 2,
        select: { conteudo: true, direcao: true, autor: true, createdAt: true },
      },
    },
  });

  if (conversas.length === 0) {
    return "## CONVERSAS RECENTES (WhatsApp de Maria)\nNenhuma conversa registrada.";
  }

  const linhas = ["## CONVERSAS RECENTES (WhatsApp de Maria)"];
  for (const c of conversas) {
    const nome = c.nomeContato ?? c.telefone ?? "Desconhecido";
    const status = c.status;
    const resp = c.atendidoPor?.nome ? ` · Resp: ${c.atendidoPor.nome}` : "";
    const ultima = c.mensagens[0];
    const ultimaTexto = ultima
      ? `${ultima.direcao === "ENTRADA" ? "Cliente" : "Maria"}: "${ultima.conteudo.slice(0, 80)}${ultima.conteudo.length > 80 ? "…" : ""}"`
      : "Sem mensagens";
    const ultimaEm = c.ultimaMensagemEm
      ? new Date(c.ultimaMensagemEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
      : "—";
    linhas.push(`• ${nome} [${status}${resp}] — ${ultimaEm} — ${ultimaTexto}`);
  }

  return linhas.join("\n");
}

async function buildContextoTarefas(): Promise<string> {
  const tarefas = await prisma.tarefa.findMany({
    where: { tipo: "WHATSAPP", status: "PENDENTE" },
    orderBy: { dataVencimento: "asc" },
    take: 15,
    select: {
      id: true,
      titulo: true,
      descricao: true,
      prioridade: true,
      dataVencimento: true,
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      pessoa: { select: { nome: true } },
    },
  });

  if (tarefas.length === 0) {
    return "## TAREFAS PENDENTES (WhatsApp)\nNenhuma tarefa pendente.";
  }

  const linhas = ["## TAREFAS PENDENTES (WhatsApp / Follow-up)"];
  const agora = new Date();
  for (const t of tarefas) {
    const empresa = t.empresa?.nomeFantasia ?? t.empresa?.razaoSocial ?? "Sem empresa";
    const venc = t.dataVencimento
      ? new Date(t.dataVencimento).toLocaleDateString("pt-BR")
      : "Sem prazo";
    const atrasada = t.dataVencimento && t.dataVencimento < agora ? " ⚠️ ATRASADA" : "";
    linhas.push(`• [${t.prioridade}] ${t.titulo} — ${empresa} — vence ${venc}${atrasada}`);
    if (t.descricao) linhas.push(`  ${t.descricao.slice(0, 100)}`);
  }

  return linhas.join("\n");
}

// ─── System prompt de Maria em modo gestor ────────────────────────────────────

function buildSystemPrompt(nomeUsuario: string, blocos: string[]): string {
  const contextStr = blocos.length > 0
    ? blocos.join("\n\n")
    : "Nenhum contexto foi selecionado. Se precisar de dados específicos, peça ao usuário para carregar um contexto.";

  return `Você é Maria, SDR da Villa Empreendimentos.
Agora você está em modo de relatório interno, conversando diretamente com ${nomeUsuario}.

REGRAS DESTE CHAT:
- Responda como colega de trabalho. Tom direto, sem formalidade excessiva.
- NÃO é uma conversa de vendas. NÃO use JSON. Resposta em texto corrido.
- Fale na primeira pessoa ("Hoje eu atendi...", "Meu lead mais quente é...").
- Use SOMENTE os dados do contexto abaixo — nunca invente nomes, números ou fatos.
- Se uma informação não estiver no contexto, diga: "Esse dado não está disponível no contexto selecionado — carregue o contexto X para ver isso."
- Seja concisa mas completa. Listas curtas quando adequado.

CONTEXTO ATUAL (dados em tempo real do CRM):
${contextStr}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente." },
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
  const contextos: ContextoSelecionado[] = Array.isArray(body.contextos) ? body.contextos : [];

  if (messages.length === 0 || !messages[messages.length - 1]?.content?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  // Carrega contextos selecionados em paralelo
  const [dadosMaria, conversasBloco, tarefasBloco] = await Promise.all([
    (contextos.includes("metricas") || contextos.includes("leads"))
      ? getMariaInteligenciaAtendimento()
      : Promise.resolve(null),
    contextos.includes("conversas") ? buildContextoConversas() : Promise.resolve(null),
    contextos.includes("tarefas") ? buildContextoTarefas() : Promise.resolve(null),
  ]);

  const blocos: string[] = [];
  if (dadosMaria && contextos.includes("metricas")) blocos.push(buildContextoMetricas(dadosMaria));
  if (dadosMaria && contextos.includes("leads")) blocos.push(buildContextoLeads(dadosMaria));
  if (conversasBloco) blocos.push(conversasBloco);
  if (tarefasBloco) blocos.push(tarefasBloco);

  const systemPrompt = buildSystemPrompt(user.nome ?? user.email ?? "usuário", blocos);

  // Chama Anthropic (mesmo padrão do BI Executivo)
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
