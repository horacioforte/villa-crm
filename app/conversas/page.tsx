"use client";

// ARQUIVO: app/conversas/page.tsx
// REGRA: nunca remover. Apenas acrescentar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  Bot,
  Check,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Send,
  User,
  X,
} from "lucide-react";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { cn } from "@/lib/utils";
import { buildMelhorProximaAcao, buildTarefaPayloadFromRecomendacao } from "@/lib/conversas/next-action";
import { getPrioridadeAguardando, ordenarConversasPorPrioridade } from "@/lib/conversas/prioridade";
import { formatarTempoDecorrido } from "@/lib/conversas/aguardando-resposta";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mensagem = {
  id: string;
  conteudo: string;
  direcao: "ENTRADA" | "SAIDA";
  autor: "IA" | "HUMANO" | "SISTEMA";
  status: string;
  createdAt: string;
  autorUsuario?: { nome: string } | null;
};

type Conversa = {
  id: string;
  nomeContato: string | null;
  telefone: string | null;
  instanceName: string;
  status: "ABERTA" | "PENDENTE" | "CONCLUIDA" | "SPAM";
  ultimaMensagemEm: string | null;
  atendidoPorId?: string | null;
  atendidoPor?: { nome: string } | null;
  canalWhatsapp?: { nome: string; displayPhoneNumber: string | null } | null;
  // Ciclo de Atendimento — nunca persistido, sempre calculado pela API a partir das
  // mensagens (ver lib/conversas/aguardando-resposta.ts). null = já respondida por um
  // humano (ou nunca houve mensagem de cliente).
  aguardandoRespostaDesde?: string | null;
  mensagens: Array<{
    conteudo: string;
    direcao: string;
    createdAt: string;
  }>;
};

type Usuario = {
  id: string;
  nome: string;
  email: string;
};

type TarefaResumo = {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  dataVencimento: string;
};

type PropostaResumo = {
  id: string;
  numeroProposta: string;
  status: string;
};

type HistoricoResumo = {
  id: string;
  resumo: string;
  tipo: string;
  dataContato: string;
};

type OportunidadeResumo = {
  id: string;
  titulo: string;
  status: string;
  potencialOportunidade?: string | number | null;
  valorContrato?: string | number | null;
  probabilidade?: number | null;
  tarefas?: TarefaResumo[];
  propostas?: PropostaResumo[];
  historicos?: HistoricoResumo[];
};

type ConversaContexto = {
  id: string;
  status?: "ABERTA" | "PENDENTE" | "CONCLUIDA" | "SPAM";
  aguardandoRespostaDesde?: string | null;
  empresa?: { id: string; razaoSocial: string | null; nomeFantasia: string | null } | null;
  pessoa?: { id: string; nome: string | null; telefone: string | null; cargo: string | null } | null;
  oportunidade?: OportunidadeResumo | null;
};

type HistoricoRecomendacao = {
  id: string;
  acao: string;
  status: "executado" | "nao-executado";
  data: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// corBarra: mesma família de cor do badge (cor), em tom sólido — usada na barra
// lateral do card da lista e no badge de canal em destaque no cabeçalho (Sprint UX de
// segurança: canal precisa ser o elemento visual mais forte, não só mais uma pill).
const INSTANCE_LABELS: Record<string, { label: string; cor: string; corBarra: string }> = {
  "maria-villa":   { label: "Maria",   cor: "bg-purple-100 text-purple-700", corBarra: "bg-purple-500" },
  "joao-villa":    { label: "João",    cor: "bg-blue-100 text-blue-700",    corBarra: "bg-blue-500" },
  "morgana-villa": { label: "Morgana", cor: "bg-rose-100 text-rose-700",    corBarra: "bg-rose-500" },
  "taciane-villa": { label: "Taciane", cor: "bg-amber-100 text-amber-700", corBarra: "bg-amber-500" },
};

const INSTANCE_LABEL_FALLBACK = { cor: "bg-zinc-100 text-zinc-600", corBarra: "bg-zinc-400" };

function getInstanceInfo(instanceName: string) {
  return INSTANCE_LABELS[instanceName] ?? { label: instanceName, ...INSTANCE_LABEL_FALLBACK };
}

const STATUS_LABELS: Record<string, { label: string; cor: string }> = {
  ABERTA:   { label: "Aberta",   cor: "bg-green-100 text-green-700" },
  PENDENTE: { label: "Pendente", cor: "bg-amber-100 text-amber-700" },
  CONCLUIDA:{ label: "Concluída",cor: "bg-zinc-100 text-zinc-600" },
  SPAM:     { label: "Spam",     cor: "bg-red-100 text-red-700" },
};

function formatHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatData(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  if (
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear()
  ) {
    return formatHora(iso);
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const numero = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numero)) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(numero);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConversasPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<Conversa | null>(null);
  const [conversaContexto, setConversaContexto] = useState<ConversaContexto | null>(null);
  const [conversasMesmoContato, setConversasMesmoContato] = useState<Conversa[]>([]);
  // Reestruturação em 3 áreas — painel de contexto do cliente começa aberto no
  // desktop, mas é recolhível. Não afeta nenhum estado de dados/lógica de envio.
  const [painelContextoAberto, setPainelContextoAberto] = useState(true);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("ABERTA");
  const [filtroInstance, setFiltroInstance] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [busca, setBusca] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showTransferir, setShowTransferir] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [transferiuPara, setTransferiuPara] = useState<string | null>(null);
  const [historicoRecomendacoes, setHistoricoRecomendacoes] = useState<HistoricoRecomendacao[]>([]);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [feedbackAcao, setFeedbackAcao] = useState<string | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  const abrirConversaId = searchParams.get("abrir");

  // Ciclo de Atendimento — re-renderiza a cada 30s só para o texto de "há quanto tempo
  // aguardando" ficar em dia. Puramente client-side: não busca nada do servidor, não é
  // cron/job, não escreve no banco — é só um "tick" para o cálculo local rodar de novo.
  const [, forcarRecalculoTempo] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => forcarRecalculoTempo((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Carrega lista de usuários para filtro e transferência
  useEffect(() => {
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsuarios(data);
      })
      .catch(() => {});
  }, []);

  // Carrega lista de conversas
  const carregarConversas = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (filtroInstance) params.set("instance", filtroInstance);
      if (filtroResponsavel === "SEM") params.set("semResponsavel", "1");
      else if (filtroResponsavel) params.set("responsavelId", filtroResponsavel);
      if (busca) params.set("busca", busca);
      const resp = await fetch(`/api/conversas?${params}`);
      if (resp.ok) setConversas(await resp.json());
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroInstance, filtroResponsavel, busca]);

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const salvo = window.localStorage.getItem("villa-conversas-historico-recomendacoes");
    if (salvo) {
      try {
        setHistoricoRecomendacoes(JSON.parse(salvo));
      } catch {
        window.localStorage.removeItem("villa-conversas-historico-recomendacoes");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("villa-conversas-historico-recomendacoes", JSON.stringify(historicoRecomendacoes));
  }, [historicoRecomendacoes]);

  // Auto-abre a conversa quando vem de ?abrir=ID (ex: da página Maria)
  useEffect(() => {
    if (!abrirConversaId || conversas.length === 0 || conversaAtiva) return;
    const alvo = conversas.find((c) => c.id === abrirConversaId);
    if (alvo) {
      setConversaAtiva(alvo);
      carregarDetalhesConversa(alvo);
    } else {
      // Conversa pode estar em outro status (ex: CONCLUIDA) — busca direto pela API
      fetch(`/api/conversas/${abrirConversaId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setConversaAtiva(data);
            setMensagens(data.mensagens ?? []);
            setConversaContexto(data);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirConversaId, conversas]);

  // Carrega contexto e mensagens da conversa ativa
  const carregarDetalhesConversa = useCallback(async (conversa: Conversa) => {
    const resp = await fetch(`/api/conversas/${conversa.id}`);
    if (resp.ok) {
      const data = await resp.json();
      setMensagens(data.mensagens ?? []);
      setConversaContexto(data);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, []);

  useEffect(() => {
    if (conversaAtiva) carregarDetalhesConversa(conversaAtiva);
  }, [conversaAtiva, carregarDetalhesConversa]);

  // Sprint UX de segurança — item 4: mesmo contato em outros canais. Busca sem os
  // filtros ativos (status/instance/responsável) para não esconder uma conversa em
  // outro canal só porque, por exemplo, o filtro de status está em "Abertas". Usa o
  // mesmo /api/conversas já existente, com busca pelo telefone — nenhum endpoint novo.
  useEffect(() => {
    const telefone = conversaAtiva?.telefone;
    if (!telefone) {
      setConversasMesmoContato([]);
      return;
    }

    let cancelado = false;
    fetch(`/api/conversas?busca=${encodeURIComponent(telefone)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Conversa[]) => {
        if (cancelado || !Array.isArray(data)) return;
        setConversasMesmoContato(
          data.filter((c) => c.telefone === telefone && c.id !== conversaAtiva?.id),
        );
      })
      .catch(() => {
        if (!cancelado) setConversasMesmoContato([]);
      });

    return () => {
      cancelado = true;
    };
  }, [conversaAtiva?.id, conversaAtiva?.telefone]);

  // Auto-refresh contexto e mensagens a cada 5s
  useEffect(() => {
    if (!conversaAtiva) return;
    const timer = setInterval(() => carregarDetalhesConversa(conversaAtiva), 5000);
    return () => clearInterval(timer);
  }, [conversaAtiva, carregarDetalhesConversa]);

  async function enviarMensagem() {
    if (!texto.trim() || !conversaAtiva || enviando) return;
    setEnviando(true);
    const conteudoLocal = texto.trim();
    setTexto("");

    // Optimistic update
    const tempMsg: Mensagem = {
      id: `temp-${Date.now()}`,
      conteudo: conteudoLocal,
      direcao: "SAIDA",
      autor: "HUMANO",
      status: "ENVIADA",
      createdAt: new Date().toISOString(),
    };
    setMensagens((prev) => [...prev, tempMsg]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      await fetch("/api/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversaId: conversaAtiva.id, conteudo: conteudoLocal }),
      });
      await carregarDetalhesConversa(conversaAtiva);
    } catch {
      // mantém a mensagem local mesmo com erro
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }

  async function transferirConversa(paraUsuarioId: string) {
    if (!conversaAtiva || transferindo) return;
    setTransferindo(true);
    try {
      const resp = await fetch(`/api/conversas/${conversaAtiva.id}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paraUsuarioId }),
      });
      if (resp.ok) {
        const atualizada = await resp.json();
        // Atualiza conversa ativa com novo atendente
        setConversaAtiva((prev) =>
          prev ? { ...prev, atendidoPorId: paraUsuarioId, atendidoPor: atualizada.atendidoPor } : prev
        );
        setTransferiuPara(paraUsuarioId);
        setTimeout(() => {
          setShowTransferir(false);
          setTransferiuPara(null);
        }, 1500);
        await carregarConversas();
      }
    } finally {
      setTransferindo(false);
    }
  }

  // Ciclo de Atendimento — mudança MANUAL de status (ABERTA/PENDENTE/CONCLUIDA/SPAM).
  // "Aguardando resposta" nunca passa por aqui — é sempre calculado, nunca setado.
  async function alterarStatusConversa(novoStatus: Conversa["status"]) {
    if (!conversaAtiva || alterandoStatus || conversaAtiva.status === novoStatus) return;
    setAlterandoStatus(true);
    try {
      const resp = await fetch(`/api/conversas/${conversaAtiva.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (resp.ok) {
        setConversaAtiva((prev) => (prev ? { ...prev, status: novoStatus } : prev));
        setConversaContexto((prev) => (prev ? { ...prev, status: novoStatus } : prev));
        await carregarConversas();
      }
    } finally {
      setAlterandoStatus(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  }

  async function criarTarefaDaRecomendacao() {
    if (!conversaAtiva || !conversaContexto?.oportunidade?.id) {
      setFeedbackAcao("A oportunidade ainda não está vinculada a esta conversa.");
      return;
    }

    setCriandoTarefa(true);
    setFeedbackAcao(null);

    try {
      const payload = buildTarefaPayloadFromRecomendacao({
        acao: melhorProximaAcao.acao,
        urgencia: melhorProximaAcao.urgencia,
        motivos: melhorProximaAcao.motivos,
        oportunidadeId: conversaContexto.oportunidade.id,
        empresaId: conversaContexto.empresa?.id,
        pessoaId: conversaContexto.pessoa?.id,
      });

      const response = await fetch(`/api/oportunidades/${conversaContexto.oportunidade.id}/tarefas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? "Não foi possível criar a tarefa.");
      }

      setFeedbackAcao("Tarefa criada e vinculada à oportunidade.");
    } catch (error) {
      setFeedbackAcao(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    } finally {
      setCriandoTarefa(false);
    }
  }

  const melhorProximaAcao = useMemo(() => {
    if (!conversaContexto) {
      return buildMelhorProximaAcao({
        tarefasVencidas: 0,
        propostasAbertas: 0,
        ultimaMensagemEm: null,
        ultimaMensagemCliente: false,
        oportunidadeAtiva: true,
      });
    }

    const tarefas = conversaContexto.oportunidade?.tarefas ?? [];
    const propostas = conversaContexto.oportunidade?.propostas ?? [];
    const ultimaMensagem = mensagens[mensagens.length - 1];
    const ultimaMensagemEm = ultimaMensagem ? new Date(ultimaMensagem.createdAt) : null;
    const ultimaMensagemCliente = Boolean(ultimaMensagem && ultimaMensagem.direcao === "ENTRADA");
    const oportunidadeAtiva = !["GANHA", "PERDIDA"].includes(conversaContexto.oportunidade?.status ?? "");

    return buildMelhorProximaAcao({
      tarefasVencidas: tarefas.filter((t) => t.status === "ATRASADA" || t.status === "PENDENTE").length,
      propostasAbertas: propostas.filter((p) => !["ACEITA", "REJEITADA", "CANCELADA"].includes(p.status)).length,
      ultimaMensagemEm,
      ultimaMensagemCliente,
      oportunidadeAtiva,
    });
  }, [conversaContexto, mensagens]);

  useEffect(() => {
    if (!conversaAtiva || !melhorProximaAcao.acao) return;
    const chave = `${conversaAtiva.id}:${melhorProximaAcao.acao}`;
    setHistoricoRecomendacoes((prev) => {
      const ultimo = prev[prev.length - 1];
      if (ultimo?.acao === melhorProximaAcao.acao && ultimo?.id === chave) return prev;
      return [...prev.slice(-4), {
        id: chave,
        acao: melhorProximaAcao.acao,
        status: "nao-executado",
        data: new Date().toISOString(),
      }];
    });
  }, [conversaAtiva, melhorProximaAcao.acao]);

  return (
    // Central de Atendimento — página trava na altura da viewport (h-screen +
    // overflow-hidden), sem número mágico de calc(). Cada uma das 3 áreas rola por
    // conta própria (min-h-0 em cada nível de coluna flex é o que garante isso —
    // sem ele, o navegador deixa cada coluna crescer para caber o conteúdo em vez de
    // respeitar a altura disponível, e a página inteira acaba rolando).
    <div className="flex h-screen flex-col overflow-hidden bg-[#F4F6FA]">
      <div className="shrink-0 px-5 pt-8 sm:px-8">
        <PageNavigation currentPage="Conversas" currentHref="/conversas" />
      </div>

      <div className="min-h-0 flex-1 px-5 pb-8 sm:px-8">
        <div className="flex h-full min-h-0 overflow-hidden rounded-3xl border border-[#D7DEEA] bg-white shadow-sm">
          {/* ── Coluna 1 (~27%): lista de conversas ── */}
          <aside className="flex w-[27%] min-h-0 min-w-[280px] shrink-0 flex-col border-r border-[#D7DEEA]">
            {/* Filtros */}
            <div className="border-b border-[#D7DEEA] p-4 space-y-3">
              <input
                type="text"
                placeholder="Buscar contato ou número..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-2 text-sm outline-none focus:border-[#1E4FAB]"
              />
              <div className="flex gap-2">
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="flex-1 rounded-xl border border-[#D7DEEA] bg-[#F4F6FA] px-2 py-1.5 text-xs font-semibold outline-none"
                >
                  <option value="">Todos status</option>
                  <option value="ABERTA">Abertas</option>
                  <option value="PENDENTE">Pendentes</option>
                  <option value="CONCLUIDA">Concluídas</option>
                </select>
                <select
                  value={filtroInstance}
                  onChange={(e) => setFiltroInstance(e.target.value)}
                  className="flex-1 rounded-xl border border-[#D7DEEA] bg-[#F4F6FA] px-2 py-1.5 text-xs font-semibold outline-none"
                >
                  <option value="">Todos agentes</option>
                  <option value="maria-villa">Maria</option>
                  <option value="joao-villa">João</option>
                  <option value="morgana-villa">Morgana</option>
                  <option value="taciane-villa">Taciane</option>
                </select>
                <button
                  onClick={carregarConversas}
                  title="Recarregar"
                  className="rounded-xl border border-[#D7DEEA] p-1.5 text-[#667085] hover:bg-[#F4F6FA]"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
              {/* Filtro por responsável */}
              <select
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                className="w-full rounded-xl border border-[#D7DEEA] bg-[#F4F6FA] px-2 py-1.5 text-xs font-semibold outline-none"
              >
                <option value="">Todos responsáveis</option>
                <option value="SEM">Sem responsável</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {carregando ? (
                <div className="flex h-full items-center justify-center text-sm text-[#667085]">
                  Carregando...
                </div>
              ) : conversas.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-[#667085]">
                  <MessageCircle className="size-8 opacity-30" />
                  <p>Nenhuma conversa encontrada.</p>
                  <p className="text-xs">As mensagens chegam via WhatsApp e aparecem aqui automaticamente.</p>
                </div>
              ) : (
                ordenarConversasPorPrioridade(conversas).map((c) => {
                  const instanceInfo = getInstanceInfo(c.instanceName);
                  const ultimaMsg = c.mensagens[0];
                  const aguardando = Boolean(c.aguardandoRespostaDesde);
                  const prioridadeInfo = getPrioridadeAguardando(c.aguardandoRespostaDesde);

                  return (
                    <button
                      key={c.id}
                      onClick={() => { setConversaAtiva(c); setShowTransferir(false); }}
                      className={cn(
                        "relative w-full border-b border-[#D7DEEA] py-3 pl-4 pr-4 text-left transition hover:bg-[#F4F6FA]",
                        conversaAtiva?.id === c.id && "bg-[#E8EEFB]"
                      )}
                    >
                      {/* Sprint UX de segurança — item 1: identidade do canal reforçada
                          por uma barra sólida, além do badge pastel já existente abaixo. */}
                      <span
                        aria-hidden="true"
                        className={cn("absolute inset-y-0 left-0 w-1", instanceInfo.corBarra)}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[#1A2E5A]">
                          {c.nomeContato ?? c.telefone ?? "Desconhecido"}
                        </p>
                        <span className="shrink-0 text-xs text-[#98A2B3]">
                          {c.ultimaMensagemEm ? formatData(c.ultimaMensagemEm) : ""}
                        </span>
                      </div>
                      {ultimaMsg && (
                        <p className="mt-0.5 truncate text-xs text-[#667085]">
                          {ultimaMsg.direcao === "SAIDA" ? "Você: " : ""}
                          {ultimaMsg.conteudo}
                        </p>
                      )}
                      {/* Ciclo de Atendimento — linha combinada canal + estado, no lugar
                          dos 4 badges anteriores (canal | status | prioridade | responsável).
                          Prioridade só aparece quando != Normal (menos ruído visual). */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", instanceInfo.cor)}>
                          {instanceInfo.label}
                        </span>
                        {aguardando ? (
                          <span className="truncate text-[11px] font-semibold text-[#475467]">
                            Aguardando resposta · {formatarTempoDecorrido(c.aguardandoRespostaDesde as string)}
                            {prioridadeInfo && prioridadeInfo.prioridade !== "normal" && (
                              <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide", prioridadeInfo.cor)}>
                                {prioridadeInfo.label}
                              </span>
                            )}
                          </span>
                        ) : (
                          c.status !== "ABERTA" && (
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_LABELS[c.status]?.cor)}>
                              {STATUS_LABELS[c.status]?.label}
                            </span>
                          )
                        )}
                        {c.atendidoPor && (
                          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                            {c.atendidoPor.nome.split(" ")[0]}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* ── Coluna 2 (~53% com painel aberto, ~80% fechado): chat, protagonista ── */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {conversaAtiva ? (
              <>
                {/* Header da conversa */}
                <div className="flex items-center justify-between border-b border-[#D7DEEA] px-6 py-4">
                  <div>
                    <p className="font-bold text-[#1A2E5A]">
                      {conversaAtiva.nomeContato ?? conversaAtiva.telefone ?? "Desconhecido"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#667085]">
                      {conversaAtiva.telefone && <span>{conversaAtiva.telefone}</span>}
                      {conversaAtiva.atendidoPor && (
                        <span>· Responsável: <strong>{conversaAtiva.atendidoPor.nome}</strong></span>
                      )}
                      {!conversaAtiva.atendidoPor && (
                        <span className="text-amber-600">· Sem responsável</span>
                      )}
                    </div>
                    {/* Sprint UX de segurança — item 4: mesmo contato em outros canais.
                        Não mescla histórico nenhum — só ajuda a navegar entre as
                        conversas separadas do mesmo telefone. */}
                    {conversasMesmoContato.length > 0 && (
                      <p className="mt-1 text-xs text-[#667085]">
                        Também possui conversa em:{" "}
                        {conversasMesmoContato.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 && " · "}
                            <button
                              type="button"
                              onClick={() => { setConversaAtiva(c); setShowTransferir(false); }}
                              className="font-semibold text-[#1E4FAB] hover:underline"
                            >
                              {getInstanceInfo(c.instanceName).label}
                            </button>
                          </span>
                        ))}
                      </p>
                    )}
                    {/* Ciclo de Atendimento — "aguardando resposta" nunca é status manual,
                        é sempre calculado (ver lib/conversas/aguardando-resposta.ts). Usa
                        conversaContexto quando já carregado (mais fresco, atualizado a
                        cada 5s) e cai para conversaAtiva enquanto isso não chega. */}
                    {(() => {
                      const aguardandoDesde =
                        conversaContexto?.id === conversaAtiva.id
                          ? conversaContexto?.aguardandoRespostaDesde
                          : conversaAtiva.aguardandoRespostaDesde;
                      if (!aguardandoDesde) return null;
                      const prioridadeHeader = getPrioridadeAguardando(aguardandoDesde);
                      return (
                        <p className="mt-1 text-xs font-semibold text-[#475467]">
                          Aguardando resposta · {formatarTempoDecorrido(aguardandoDesde)}
                          {prioridadeHeader && prioridadeHeader.prioridade !== "normal" && (
                            <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide", prioridadeHeader.cor)}>
                              {prioridadeHeader.label}
                            </span>
                          )}
                        </p>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Sprint UX de segurança — item 2: canal ativo com mais peso visual
                        que os badges secundários (cor sólida + maior, não pastel). */}
                    <span className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-extrabold text-white",
                      getInstanceInfo(conversaAtiva.instanceName).corBarra,
                    )}>
                      {getInstanceInfo(conversaAtiva.instanceName).label}
                    </span>
                    {/* Ciclo de Atendimento — controle manual de status (Aberta/
                        Pendente/Concluída/Spam). "Aguardando resposta" nunca aparece
                        aqui — não é um status, é calculado. */}
                    <select
                      value={conversaAtiva.status}
                      disabled={alterandoStatus}
                      onChange={(e) => alterarStatusConversa(e.target.value as Conversa["status"])}
                      title="Mudar status do atendimento"
                      className={cn(
                        "rounded-full border-0 px-3 py-1 text-xs font-bold outline-none disabled:opacity-60",
                        STATUS_LABELS[conversaAtiva.status]?.cor,
                      )}
                    >
                      {(["ABERTA", "PENDENTE", "CONCLUIDA", "SPAM"] as const).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]?.label}
                        </option>
                      ))}
                    </select>
                    {/* Toggle do painel de contexto do cliente (coluna 3) */}
                    <button
                      onClick={() => setPainelContextoAberto((v) => !v)}
                      title={painelContextoAberto ? "Fechar contexto do cliente" : "Abrir contexto do cliente"}
                      className="flex items-center gap-1.5 rounded-xl border border-[#D7DEEA] px-3 py-1.5 text-xs font-semibold text-[#1A2E5A] hover:bg-[#F4F6FA]"
                    >
                      {painelContextoAberto ? (
                        <PanelRightClose className="size-3.5" />
                      ) : (
                        <PanelRightOpen className="size-3.5" />
                      )}
                      Contexto
                    </button>
                    {/* Botão de transferência */}
                    <div className="relative">
                      <button
                        onClick={() => setShowTransferir((v) => !v)}
                        title="Transferir conversa"
                        className="flex items-center gap-1.5 rounded-xl border border-[#D7DEEA] px-3 py-1.5 text-xs font-semibold text-[#1A2E5A] hover:bg-[#F4F6FA]"
                      >
                        <ArrowRightLeft className="size-3.5" />
                        Transferir
                      </button>

                      {/* Dropdown de transferência */}
                      {showTransferir && (
                        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-2xl border border-[#D7DEEA] bg-white shadow-lg">
                          <div className="flex items-center justify-between border-b border-[#D7DEEA] px-4 py-3">
                            <p className="text-xs font-semibold text-[#1A2E5A]">Transferir para</p>
                            <button onClick={() => setShowTransferir(false)}>
                              <X className="size-4 text-[#667085]" />
                            </button>
                          </div>
                          <div className="py-1">
                            {usuarios.length === 0 ? (
                              <p className="px-4 py-3 text-xs text-[#667085]">Nenhum usuário disponível.</p>
                            ) : (
                              usuarios.map((u) => {
                                const isAtual = u.id === conversaAtiva.atendidoPorId;
                                const transferiuParaEste = transferiuPara === u.id;
                                return (
                                  <button
                                    key={u.id}
                                    onClick={() => !isAtual && transferirConversa(u.id)}
                                    disabled={isAtual || transferindo}
                                    className={cn(
                                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition",
                                      isAtual
                                        ? "cursor-default text-[#98A2B3]"
                                        : "text-[#1A2E5A] hover:bg-[#F4F6FA]"
                                    )}
                                  >
                                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-[10px] font-bold text-[#1E4FAB]">
                                      {u.nome.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold">{u.nome}</p>
                                      {isAtual && <p className="text-[10px] text-[#98A2B3]">atual</p>}
                                    </div>
                                    {transferiuParaEste && (
                                      <Check className="size-4 text-green-500" />
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3" onClick={() => setShowTransferir(false)}>
                  {mensagens.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-[#667085]">
                      Nenhuma mensagem ainda.
                    </div>
                  ) : (
                    mensagens.map((msg) => {
                      const isSaida = msg.direcao === "SAIDA";
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex gap-2",
                            isSaida ? "justify-end" : "justify-start"
                          )}
                        >
                          {!isSaida && (
                            <div className="mt-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-[#1E4FAB]">
                              <Bot className="size-4" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                              isSaida
                                ? "rounded-br-sm bg-[#1A2E5A] text-white"
                                : "rounded-bl-sm bg-[#F4F6FA] text-[#1A2E5A]"
                            )}
                          >
                            {isSaida && msg.autor === "HUMANO" && (
                              <p className="mb-0.5 text-[10px] font-semibold text-white/60">
                                {msg.autorUsuario?.nome ?? "Você"}
                              </p>
                            )}
                            {isSaida && msg.autor === "IA" && (
                              <p className="mb-0.5 text-[10px] font-semibold text-white/60">
                                IA · {INSTANCE_LABELS[conversaAtiva.instanceName]?.label}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                            <p
                              className={cn(
                                "mt-1 text-right text-[10px]",
                                isSaida ? "text-white/50" : "text-[#98A2B3]"
                              )}
                            >
                              {formatHora(msg.createdAt)}
                            </p>
                          </div>
                          {isSaida && (
                            <div className="mt-auto flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1E4FAB] text-white">
                              <User className="size-4" />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                {/* Input de envio */}
                <div className="border-t border-[#D7DEEA] p-4">
                  {/* Sprint UX de segurança — item 3: faixa clara e associada ao
                      composer, nome e número derivados de CanalWhatsapp (nunca
                      hardcoded) — genérico para qualquer canal, não só Taciane.
                      Cor pastel (mesma classe já usada nos badges de canal em toda a
                      página) — leve, mas com a mesma identificação inequívoca. */}
                  <div className={cn(
                    "mb-2 rounded-xl px-3 py-2 text-center text-xs font-bold",
                    getInstanceInfo(conversaAtiva.instanceName).cor,
                  )}>
                    Enviando pelo WhatsApp de {getInstanceInfo(conversaAtiva.instanceName).label}
                    {conversaAtiva.canalWhatsapp?.displayPhoneNumber
                      ? ` · ${conversaAtiva.canalWhatsapp.displayPhoneNumber}`
                      : ""}
                  </div>
                  <div className="flex items-end gap-3 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-3">
                    <textarea
                      ref={inputRef}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite uma mensagem... (Enter para enviar, Shift+Enter para quebrar linha)"
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-[#98A2B3]"
                      style={{ maxHeight: "120px" }}
                    />
                    <button
                      onClick={enviarMensagem}
                      disabled={!texto.trim() || enviando}
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1A2E5A] text-white transition hover:bg-[#1E4FAB] disabled:opacity-40"
                    >
                      <Send className="size-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-[#667085]">
                <MessageCircle className="size-12 opacity-20" />
                <p className="text-lg font-semibold">Workspace Comercial</p>
                <p className="text-sm">Selecione uma conversa para começar a trabalhar na próxima ação.</p>
              </div>
            )}
          </div>

          {/* ── Coluna 3 (~20%, piso de 260px): contexto do cliente — auxiliar, recolhível ── */}
          {conversaAtiva && painelContextoAberto && (
            <aside
              className="flex w-[20%] min-h-0 min-w-[260px] shrink-0 flex-col overflow-y-auto border-l border-[#D7DEEA] bg-[#FAFBFC] p-3"
              onClick={() => setShowTransferir(false)}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#98A2B3]">
                Contexto do cliente
              </p>

              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#98A2B3]">
                  Recomendação do Brain
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[#1A2E5A]">
                  {melhorProximaAcao.acao}
                </h3>
                <p className="mt-1 text-xs text-[#475467]">
                  {melhorProximaAcao.motivos.join(" · ")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    melhorProximaAcao.urgencia === "alta" ? "bg-rose-100 text-rose-700" :
                    melhorProximaAcao.urgencia === "media" ? "bg-amber-100 text-amber-700" :
                    "bg-emerald-100 text-emerald-700"
                  )}>
                    {melhorProximaAcao.urgencia === "alta" ? "Urgência alta" : melhorProximaAcao.urgencia === "media" ? "Urgência média" : "Urgência baixa"}
                  </span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    melhorProximaAcao.confianca === "alta" ? "bg-emerald-100 text-emerald-700" :
                    melhorProximaAcao.confianca === "media" ? "bg-amber-100 text-amber-700" :
                    "bg-zinc-100 text-zinc-600"
                  )}>
                    {melhorProximaAcao.confianca === "alta" ? "Confiança alta" : melhorProximaAcao.confianca === "media" ? "Confiança média" : "Confiança baixa"}
                  </span>
                </div>

                <div className="mt-3 border-t border-[#EDEFF3] pt-2 text-xs text-[#475467]">
                  <p className="font-medium text-[#1A2E5A]">Impacto esperado</p>
                  <p className="mt-0.5">{melhorProximaAcao.impacto}</p>
                  <p className="mt-2 font-medium text-[#1A2E5A]">Se não agir</p>
                  <p className="mt-0.5">{melhorProximaAcao.naoAgir}</p>
                </div>

                <div className="mt-3 rounded-xl border border-dashed border-[#E4E7EC] p-2 text-[11px] text-[#667085]">
                  <p className="font-semibold uppercase tracking-[0.16em] text-[#98A2B3]">Status da entrega</p>
                  <p className="mt-1">Implementada tecnicamente — aguardando validação dos usuários.</p>
                  <p className="mt-1">Os botões abaixo são prévias e ainda não executam ações reais no sistema.</p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    onClick={criarTarefaDaRecomendacao}
                    disabled={criandoTarefa || !conversaContexto?.oportunidade?.id}
                    className="rounded-xl border border-[#D7DEEA] bg-[#1E4FAB] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#1A2E5A] disabled:cursor-not-allowed disabled:bg-[#98A2B3]"
                  >
                    {criandoTarefa ? "Criando tarefa..." : "✅ Criar tarefa"}
                  </button>
                  <button disabled className="cursor-not-allowed rounded-xl border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#98A2B3]">
                    💬 WhatsApp · Em breve
                  </button>
                  <button disabled className="cursor-not-allowed rounded-xl border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#98A2B3]">
                    📅 Follow-up · Em breve
                  </button>
                  <button disabled className="cursor-not-allowed rounded-xl border border-[#E4E7EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#98A2B3]">
                    📄 Proposta · Em breve
                  </button>
                </div>

                {feedbackAcao && (
                  <p className="mt-2 text-xs text-[#1A2E5A]">{feedbackAcao}</p>
                )}
              </div>

              <div className="mt-4 border-t border-[#EDEFF3] pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#98A2B3]">Últimas recomendações</p>
                <p className="mt-1 text-[10px] text-[#98A2B3]">Protótipo de UX local — não persiste, não é compartilhado, não alimenta o Brain.</p>
                <div className="mt-2 space-y-1.5 text-xs text-[#475467]">
                  {historicoRecomendacoes.length === 0 ? (
                    <p className="text-[#98A2B3]">Ainda não há histórico para esta sessão.</p>
                  ) : (
                    historicoRecomendacoes.slice().reverse().map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                        <span>{item.status === "executado" ? "✔" : "✖"} {item.acao}</span>
                        <span className="text-[10px] text-[#98A2B3]">{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {(conversaContexto?.empresa?.razaoSocial || conversaContexto?.oportunidade) && (
                <div className="mt-4 border-t border-[#EDEFF3] pt-3 text-xs text-[#667085]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#98A2B3]">Oportunidade</p>
                  <div className="mt-1.5 space-y-1">
                    {conversaContexto?.empresa?.razaoSocial && (
                      <p>Cliente: <strong className="text-[#1A2E5A]">{conversaContexto.empresa.razaoSocial}</strong></p>
                    )}
                    {conversaContexto?.oportunidade?.status && (
                      <p>Etapa: <strong className="text-[#1A2E5A]">{conversaContexto.oportunidade.status}</strong></p>
                    )}
                    {conversaContexto?.oportunidade?.valorContrato && (
                      <p>Valor: <strong className="text-[#1A2E5A]">{formatCurrency(conversaContexto.oportunidade.valorContrato)}</strong></p>
                    )}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
