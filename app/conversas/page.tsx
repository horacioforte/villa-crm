"use client";

// ARQUIVO: app/conversas/page.tsx
// REGRA: nunca remover. Apenas acrescentar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Bot,
  Check,
  MessageCircle,
  RefreshCw,
  Send,
  User,
  X,
} from "lucide-react";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { cn } from "@/lib/utils";
import { buildMelhorProximaAcao } from "@/lib/conversas/next-action";
import { getConversaPrioridade, ordenarConversasPorPrioridade } from "@/lib/conversas/prioridade";

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

const INSTANCE_LABELS: Record<string, { label: string; cor: string }> = {
  "maria-villa":   { label: "Maria",   cor: "bg-purple-100 text-purple-700" },
  "joao-villa":    { label: "João",    cor: "bg-blue-100 text-blue-700" },
  "morgana-villa": { label: "Morgana", cor: "bg-rose-100 text-rose-700" },
  "taciane-villa": { label: "Taciane", cor: "bg-amber-100 text-amber-700" },
};

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
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
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

  function marcarRecomendacao(status: "executado" | "nao-executado") {
    setHistoricoRecomendacoes((prev) => {
      if (prev.length === 0) return prev;
      const atualizados = [...prev];
      atualizados[atualizados.length - 1] = {
        ...atualizados[atualizados.length - 1],
        status,
      };
      return atualizados;
    });
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA]">
      <div className="px-5 py-8 sm:px-8">
        <PageNavigation currentPage="Conversas" currentHref="/conversas" />

        <div className="flex h-[calc(100vh-14rem)] overflow-hidden rounded-3xl border border-[#D7DEEA] bg-white shadow-sm">
          {/* ── Painel esquerdo: lista de conversas ── */}
          <aside className="flex w-80 flex-col border-r border-[#D7DEEA]">
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
                  const instanceInfo =
                    INSTANCE_LABELS[c.instanceName] ?? {
                      label: c.instanceName,
                      cor: "bg-zinc-100 text-zinc-600",
                    };
                  const ultimaMsg = c.mensagens[0];
                  const prioridadeInfo = getConversaPrioridade(c);

                  return (
                    <button
                      key={c.id}
                      onClick={() => { setConversaAtiva(c); setShowTransferir(false); }}
                      className={cn(
                        "w-full border-b border-[#D7DEEA] px-4 py-3 text-left transition hover:bg-[#F4F6FA]",
                        conversaAtiva?.id === c.id && "bg-[#E8EEFB]"
                      )}
                    >
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
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${instanceInfo.cor}`}>
                          {instanceInfo.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_LABELS[c.status]?.cor}`}>
                          {STATUS_LABELS[c.status]?.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${prioridadeInfo.cor}`}>
                          {prioridadeInfo.label}
                        </span>
                        {c.atendidoPor && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
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

          {/* ── Painel direito: chat ── */}
          <div className="flex flex-1 flex-col">
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
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${INSTANCE_LABELS[conversaAtiva.instanceName]?.cor}`}>
                      {INSTANCE_LABELS[conversaAtiva.instanceName]?.label ?? conversaAtiva.instanceName}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_LABELS[conversaAtiva.status]?.cor}`}>
                      {STATUS_LABELS[conversaAtiva.status]?.label}
                    </span>
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

                {/* Próxima ação */}
                <div className="border-b border-[#D7DEEA] bg-[#F8FAFF] p-4 sm:p-6" onClick={() => setShowTransferir(false)}>
                  <div className="rounded-3xl border border-[#D7DEEA] bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1E4FAB]">
                      O Brain analisou esta oportunidade e recomenda a seguinte ação:
                    </p>
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[#1A2E5A]">
                          {melhorProximaAcao.acao}
                        </h3>
                        <p className="mt-2 text-sm text-[#475467]">
                          {melhorProximaAcao.motivos.join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          melhorProximaAcao.urgencia === "alta" ? "bg-rose-100 text-rose-700" :
                          melhorProximaAcao.urgencia === "media" ? "bg-amber-100 text-amber-700" :
                          "bg-emerald-100 text-emerald-700"
                        )}>
                          {melhorProximaAcao.urgencia === "alta" ? "Urgência alta" : melhorProximaAcao.urgencia === "media" ? "Urgência média" : "Urgência baixa"}
                        </span>
                        <span className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          melhorProximaAcao.confianca === "alta" ? "bg-emerald-100 text-emerald-700" :
                          melhorProximaAcao.confianca === "media" ? "bg-amber-100 text-amber-700" :
                          "bg-zinc-100 text-zinc-600"
                        )}>
                          {melhorProximaAcao.confianca === "alta" ? "Confiança alta" : melhorProximaAcao.confianca === "media" ? "Confiança média" : "Confiança baixa"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl bg-[#F4F6FA] p-3 text-sm text-[#1A2E5A]">
                      <p className="font-medium">Impacto esperado:</p>
                      <p className="mt-1 text-[#475467]">{melhorProximaAcao.impacto}</p>
                      <p className="mt-2 font-medium">Se não agir:</p>
                      <p className="mt-1 text-[#475467]">{melhorProximaAcao.naoAgir}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => marcarRecomendacao("executado")}
                        className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-2 text-sm font-medium text-[#1A2E5A] hover:bg-[#E8EEFB]"
                      >
                        📞 Ligar
                      </button>
                      <button
                        onClick={() => marcarRecomendacao("executado")}
                        className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-2 text-sm font-medium text-[#1A2E5A] hover:bg-[#E8EEFB]"
                      >
                        💬 WhatsApp
                      </button>
                      <button
                        onClick={() => marcarRecomendacao("executado")}
                        className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-2 text-sm font-medium text-[#1A2E5A] hover:bg-[#E8EEFB]"
                      >
                        📅 Agendar follow-up
                      </button>
                      <button
                        onClick={() => marcarRecomendacao("executado")}
                        className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-2 text-sm font-medium text-[#1A2E5A] hover:bg-[#E8EEFB]"
                      >
                        📄 Abrir proposta
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[#D7DEEA] bg-[#F8FAFF] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1E4FAB]">Últimas recomendações</p>
                      <div className="mt-2 space-y-2 text-sm text-[#475467]">
                        {historicoRecomendacoes.length === 0 ? (
                          <p className="text-[#98A2B3]">Ainda não há histórico para esta sessão.</p>
                        ) : (
                          historicoRecomendacoes.slice().reverse().map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
                              <span>{item.status === "executado" ? "✔" : "✖"} {item.acao}</span>
                              <span className="text-xs text-[#98A2B3]">{new Date(item.data).toLocaleDateString("pt-BR")}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#667085]">
                      {conversaContexto?.empresa?.razaoSocial && (
                        <span>Cliente: <strong className="text-[#1A2E5A]">{conversaContexto.empresa.razaoSocial}</strong></span>
                      )}
                      {conversaContexto?.oportunidade?.status && (
                        <span>Etapa: <strong className="text-[#1A2E5A]">{conversaContexto.oportunidade.status}</strong></span>
                      )}
                      {conversaContexto?.oportunidade?.valorContrato && (
                        <span>Valor: <strong className="text-[#1A2E5A]">{formatCurrency(conversaContexto.oportunidade.valorContrato)}</strong></span>
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
                  <p className="mt-1.5 text-center text-xs text-[#98A2B3]">
                    Enviando como atendente humano via{" "}
                    {INSTANCE_LABELS[conversaAtiva.instanceName]?.label ?? conversaAtiva.instanceName}
                  </p>
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
        </div>
      </div>
    </div>
  );
}
