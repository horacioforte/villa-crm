"use client";
// ARQUIVO: components/conversas/ConversasTab.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Aba de conversas reutilizável para cards de Empresa, Contato e Oportunidade.
// Apenas leitura — sem envio de mensagem nesta fase.

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, ChevronRight, Loader2, MessageSquare, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Conversa = {
  id: string;
  instanceName: string;
  status: "ABERTA" | "PENDENTE" | "CONCLUIDA" | "SPAM";
  telefone: string | null;
  nomeContato: string | null;
  ultimaMensagemEm: string | null;
  createdAt: string;
  atendidoPor: { nome: string } | null;
  mensagens: Array<{ conteudo: string; direcao: string; createdAt: string }>;
};

type Mensagem = {
  id: string;
  conteudo: string;
  direcao: "ENTRADA" | "SAIDA";
  autor: "IA" | "HUMANO" | "SISTEMA";
  createdAt: string;
};

type ConversaDetalhe = Omit<Conversa, "mensagens"> & {
  mensagens: Mensagem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AGENTE_LABELS: Record<string, string> = {
  "maria-villa": "Maria",
  "joao-villa": "João",
  "morgana-villa": "Morgana",
  "taciane-villa": "Taciane",
};

const AGENTE_COLORS: Record<string, string> = {
  "maria-villa": "bg-[#E8EEFB] text-[#1E4FAB]",
  "joao-villa": "bg-purple-100 text-purple-700",
  "morgana-villa": "bg-green-100 text-green-700",
  "taciane-villa": "bg-amber-100 text-amber-700",
};

const STATUS_LABELS: Record<string, string> = {
  ABERTA: "Em aberto",
  PENDENTE: "Pendente",
  CONCLUIDA: "Concluída",
  SPAM: "Spam",
};

const STATUS_COLORS: Record<string, string> = {
  ABERTA: "bg-green-100 text-green-700",
  PENDENTE: "bg-amber-100 text-amber-700",
  CONCLUIDA: "bg-gray-100 text-gray-600",
  SPAM: "bg-red-100 text-red-700",
};

function nomeAgente(instanceName: string) {
  return AGENTE_LABELS[instanceName] ?? instanceName;
}

function corAgente(instanceName: string) {
  return AGENTE_COLORS[instanceName] ?? "bg-gray-100 text-gray-600";
}

// ─── Props ────────────────────────────────────────────────────────────────────

type ConversasTabProps = {
  empresaId?: string;
  pessoaId?: string;
  oportunidadeId?: string;
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function ConversasTab({ empresaId, pessoaId, oportunidadeId }: ConversasTabProps) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("todos");
  const [conversaSelecionada, setConversaSelecionada] = useState<ConversaDetalhe | null>(null);
  const [isLoadingMensagens, setIsLoadingMensagens] = useState(false);

  // Carrega lista de conversas
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (empresaId) params.set("empresaId", empresaId);
        if (pessoaId) params.set("pessoaId", pessoaId);
        if (oportunidadeId) params.set("oportunidadeId", oportunidadeId);

        const res = await fetch(`/api/conversas?${params.toString()}`);
        if (!res.ok) throw new Error("Falha ao carregar conversas.");
        const data = await res.json();
        setConversas(data);
      } catch {
        setConversas([]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [empresaId, pessoaId, oportunidadeId]);

  // Carrega mensagens da conversa selecionada
  async function abrirConversa(conversa: Conversa) {
    setIsLoadingMensagens(true);
    setConversaSelecionada({ ...conversa, mensagens: [] });
    try {
      const res = await fetch(`/api/conversas/${conversa.id}`);
      if (!res.ok) throw new Error();
      const data: ConversaDetalhe = await res.json();
      setConversaSelecionada(data);
    } catch {
      // mantém conversa selecionada com mensagens vazias
    } finally {
      setIsLoadingMensagens(false);
    }
  }

  // Filtros disponíveis
  const filtros = [
    { id: "todos", label: "Todos" },
    { id: "maria-villa", label: "Maria" },
    { id: "joao-villa", label: "João" },
    { id: "ABERTA", label: "Em aberto" },
    { id: "transferido", label: "Transferido" },
  ];

  const conversasFiltradas = conversas.filter((c) => {
    if (filtro === "todos") return true;
    if (filtro === "transferido") return !!c.atendidoPor;
    if (["ABERTA", "PENDENTE", "CONCLUIDA", "SPAM"].includes(filtro)) return c.status === filtro;
    return c.instanceName === filtro;
  });

  // ─── Thread de mensagens ───────────────────────────────────────────────────

  if (conversaSelecionada) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setConversaSelecionada(null)}
            className="flex items-center gap-1.5 text-sm text-[#667085] hover:text-[#1A2E5A] transition-colors"
          >
            ← Voltar
          </button>
          <span className="text-sm text-[#D7DEEA]">/</span>
          <span className="text-sm font-medium text-[#1A2E5A]">
            {conversaSelecionada.nomeContato ?? conversaSelecionada.telefone ?? "Conversa"}
          </span>
          <Badge className={`${corAgente(conversaSelecionada.instanceName)} border-0 text-xs`}>
            {nomeAgente(conversaSelecionada.instanceName)}
          </Badge>
          <Badge className={`${STATUS_COLORS[conversaSelecionada.status]} border-0 text-xs`}>
            {STATUS_LABELS[conversaSelecionada.status]}
          </Badge>
          {conversaSelecionada.atendidoPor && (
            <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">
              Humano: {conversaSelecionada.atendidoPor.nome}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-4">
          {isLoadingMensagens ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-[#667085]" />
            </div>
          ) : conversaSelecionada.mensagens.length === 0 ? (
            <p className="text-center text-sm text-[#667085] py-8">Nenhuma mensagem registrada.</p>
          ) : (
            conversaSelecionada.mensagens.map((msg) => {
              const isEntrada = msg.direcao === "ENTRADA";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 max-w-[80%] ${isEntrada ? "self-start" : "self-end items-end"}`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-xs text-[#667085] ${isEntrada ? "" : "justify-end"}`}
                  >
                    {isEntrada ? (
                      <>
                        <User className="size-3" />
                        <span>Cliente</span>
                      </>
                    ) : (
                      <>
                        <Bot className="size-3" />
                        <span>{msg.autor === "HUMANO" ? "Humano" : nomeAgente(conversaSelecionada.instanceName)}</span>
                      </>
                    )}
                    <span className="text-[#D7DEEA]">·</span>
                    <span>{format(new Date(msg.createdAt), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isEntrada
                        ? "bg-white border border-[#D7DEEA] text-[#172033]"
                        : "bg-[#1E4FAB] text-white"
                    }`}
                  >
                    {msg.conteudo}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ─── Lista de conversas ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filtro === f.id
                ? "bg-[#1A2E5A] text-white"
                : "bg-[#E8EEFB] text-[#1E4FAB] hover:bg-[#1A2E5A] hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-[#667085]" />
        </div>
      ) : conversasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-[#667085]">
          <MessageSquare className="size-8 opacity-40" />
          <p className="text-sm">Nenhuma conversa encontrada.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversasFiltradas.map((conversa) => {
            const ultima = conversa.mensagens[0];
            return (
              <button
                key={conversa.id}
                onClick={() => abrirConversa(conversa)}
                className="flex items-center gap-4 rounded-2xl border border-[#D7DEEA] bg-white p-4 text-left transition-all hover:border-[#1E4FAB] hover:shadow-sm"
              >
                {/* Avatar do agente */}
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#1A2E5A] text-white">
                  <Bot className="size-5" />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-[#172033] text-sm truncate">
                      {conversa.nomeContato ?? conversa.telefone ?? "Desconhecido"}
                    </span>
                    <Badge className={`${corAgente(conversa.instanceName)} border-0 text-xs shrink-0`}>
                      {nomeAgente(conversa.instanceName)}
                    </Badge>
                    <Badge className={`${STATUS_COLORS[conversa.status]} border-0 text-xs shrink-0`}>
                      {STATUS_LABELS[conversa.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#667085] truncate">
                    {ultima ? ultima.conteudo : "Sem mensagens"}
                  </p>
                  {conversa.telefone && (
                    <p className="text-xs text-[#667085] mt-0.5">{conversa.telefone}</p>
                  )}
                </div>

                {/* Data + seta */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {conversa.ultimaMensagemEm && (
                    <span className="text-xs text-[#667085]">
                      {format(new Date(conversa.ultimaMensagemEm), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  {conversa.atendidoPor && (
                    <span className="text-xs text-indigo-600 font-medium">
                      {conversa.atendidoPor.nome}
                    </span>
                  )}
                  <ChevronRight className="size-4 text-[#D7DEEA]" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
