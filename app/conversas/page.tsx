"use client";

// ARQUIVO: app/conversas/page.tsx
// REGRA: nunca remover. Apenas acrescentar.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  MessageCircle,
  RefreshCw,
  Send,
  User,
} from "lucide-react";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { cn } from "@/lib/utils";

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
  atendidoPor?: { nome: string } | null;
  mensagens: Array<{
    conteudo: string;
    direcao: string;
    createdAt: string;
  }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_LABELS: Record<string, { label: string; cor: string }> = {
  "maria-villa": { label: "Maria", cor: "bg-purple-100 text-purple-700" },
  "joao-villa": { label: "João", cor: "bg-blue-100 text-blue-700" },
  "morgana-villa": { label: "Morgana", cor: "bg-rose-100 text-rose-700" },
  "taciane-villa": { label: "Taciane", cor: "bg-amber-100 text-amber-700" },
};

const STATUS_LABELS: Record<string, { label: string; cor: string }> = {
  ABERTA: { label: "Aberta", cor: "bg-green-100 text-green-700" },
  PENDENTE: { label: "Pendente", cor: "bg-amber-100 text-amber-700" },
  CONCLUIDA: { label: "Concluída", cor: "bg-zinc-100 text-zinc-600" },
  SPAM: { label: "Spam", cor: "bg-red-100 text-red-700" },
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConversasPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("ABERTA");
  const [filtroInstance, setFiltroInstance] = useState("");
  const [busca, setBusca] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Carrega lista de conversas
  const carregarConversas = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (filtroInstance) params.set("instance", filtroInstance);
      if (busca) params.set("busca", busca);
      const resp = await fetch(`/api/conversas?${params}`);
      if (resp.ok) setConversas(await resp.json());
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroInstance, busca]);

  useEffect(() => {
    carregarConversas();
  }, [carregarConversas]);

  // Carrega mensagens da conversa ativa
  const carregarMensagens = useCallback(async (conversa: Conversa) => {
    const resp = await fetch(`/api/conversas/${conversa.id}/mensagens`);
    if (resp.ok) {
      const data = await resp.json();
      setMensagens(data);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, []);

  useEffect(() => {
    if (conversaAtiva) carregarMensagens(conversaAtiva);
  }, [conversaAtiva, carregarMensagens]);

  // Auto-refresh mensagens a cada 5s
  useEffect(() => {
    if (!conversaAtiva) return;
    const timer = setInterval(() => carregarMensagens(conversaAtiva), 5000);
    return () => clearInterval(timer);
  }, [conversaAtiva, carregarMensagens]);

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
      // Recarrega mensagens para pegar o ID real
      await carregarMensagens(conversaAtiva);
    } catch {
      // mantém a mensagem local mesmo com erro
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
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
                conversas.map((c) => {
                  const instanceInfo =
                    INSTANCE_LABELS[c.instanceName] ?? {
                      label: c.instanceName,
                      cor: "bg-zinc-100 text-zinc-600",
                    };
                  const ultimaMsg = c.mensagens[0];

                  return (
                    <button
                      key={c.id}
                      onClick={() => setConversaAtiva(c)}
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
                          {c.ultimaMensagemEm
                            ? formatData(c.ultimaMensagemEm)
                            : ""}
                        </span>
                      </div>
                      {ultimaMsg && (
                        <p className="mt-0.5 truncate text-xs text-[#667085]">
                          {ultimaMsg.direcao === "SAIDA" ? "Você: " : ""}
                          {ultimaMsg.conteudo}
                        </p>
                      )}
                      <div className="mt-1.5 flex gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${instanceInfo.cor}`}
                        >
                          {instanceInfo.label}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_LABELS[c.status]?.cor}`}
                        >
                          {STATUS_LABELS[c.status]?.label}
                        </span>
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
                      {conversaAtiva.nomeContato ??
                        conversaAtiva.telefone ??
                        "Desconhecido"}
                    </p>
                    <div className="mt-1 flex gap-2">
                      <span className="text-xs text-[#667085]">
                        {conversaAtiva.telefone}
                      </span>
                      {conversaAtiva.atendidoPor && (
                        <span className="text-xs text-[#667085]">
                          · Atendente: {conversaAtiva.atendidoPor.nome}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${INSTANCE_LABELS[conversaAtiva.instanceName]?.cor}`}
                    >
                      {INSTANCE_LABELS[conversaAtiva.instanceName]?.label ??
                        conversaAtiva.instanceName}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_LABELS[conversaAtiva.status]?.cor}`}
                    >
                      {STATUS_LABELS[conversaAtiva.status]?.label}
                    </span>
                  </div>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
                                IA ·{" "}
                                {INSTANCE_LABELS[conversaAtiva.instanceName]
                                  ?.label}
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
                    {INSTANCE_LABELS[conversaAtiva.instanceName]?.label ??
                      conversaAtiva.instanceName}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-[#667085]">
                <MessageCircle className="size-12 opacity-20" />
                <p className="text-lg font-semibold">Central de Atendimento</p>
                <p className="text-sm">
                  Selecione uma conversa para começar a atender.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
