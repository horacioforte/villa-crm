"use client";
// ARQUIVO: components/maria/ChatComMaria.tsx
// REGRA: nunca remover. Apenas acrescentar.
//
// Chat de gestão interna — permite a Morgana ou Horácio conversar com Maria
// como colega de trabalho, consultando dados reais do CRM em tempo real.
//
// Comportamento:
// - Chips de contexto selecionáveis (métricas, leads, conversas, tarefas)
// - Histórico de mensagens em memória (não persiste entre recarregamentos)
// - Chama /api/maria/chat-gestao com as mensagens e contextos selecionados

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mensagem = { role: "user" | "assistant"; content: string };

type Contexto = "metricas" | "leads" | "conversas" | "tarefas";

// ─── Configuração dos chips de contexto ──────────────────────────────────────

const CONTEXTOS: { id: Contexto; label: string; descricao: string }[] = [
  { id: "metricas", label: "📊 Métricas", descricao: "Métricas do dia, pipeline, receita potencial" },
  { id: "leads", label: "🔥 Leads", descricao: "Fila inteligente e recomendações de ação" },
  { id: "conversas", label: "💬 Conversas", descricao: "Últimas conversas WhatsApp de Maria" },
  { id: "tarefas", label: "✅ Tarefas", descricao: "Follow-ups e tarefas pendentes" },
];

// ─── Componente ───────────────────────────────────────────────────────────────

export function ChatComMaria() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [contextos, setContextos] = useState<Contexto[]>(["metricas", "leads"]);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rola para o final quando chegam novas mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, isLoading]);

  function toggleContexto(id: Contexto) {
    setContextos((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || isLoading) return;

    const novasMensagens: Mensagem[] = [...mensagens, { role: "user", content: texto }];
    setMensagens(novasMensagens);
    setInput("");
    setIsLoading(true);
    setErro(null);

    // Auto-resize do textarea de volta ao normal
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/maria/chat-gestao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novasMensagens, contextos }),
      });

      const data = await res.json().catch(() => ({})) as { resposta?: string; error?: string };

      if (!res.ok || !data.resposta) {
        throw new Error(data.error ?? "Erro desconhecido.");
      }

      setMensagens([...novasMensagens, { role: "assistant", content: data.resposta }]);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao contatar Maria. Tente novamente.");
      // Remove a mensagem do usuário que foi adicionada otimisticamente
      setMensagens(mensagens);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-[#D7DEEA] bg-white p-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2A78D6] to-[#1A2E5A] text-sm font-bold text-white">
          M
        </div>
        <div>
          <p className="text-[14px] font-bold text-[#1A2E5A]">Falar com Maria</p>
          <p className="text-[11.5px] text-[#667085]">Modo relatório interno — Maria responde como colega de trabalho</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#E4F5EA] px-3 py-1 text-[11.5px] font-bold text-[#0C8A3E]">
          <span className="relative flex size-[6px]">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0C8A3E] opacity-60" />
            <span className="relative inline-flex size-[6px] rounded-full bg-[#0C8A3E]" />
          </span>
          Online
        </span>
      </div>

      {/* Chips de contexto */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
          Carregar dados antes de perguntar:
        </p>
        <div className="flex flex-wrap gap-2">
          {CONTEXTOS.map((ctx) => {
            const ativo = contextos.includes(ctx.id);
            return (
              <button
                key={ctx.id}
                onClick={() => toggleContexto(ctx.id)}
                title={ctx.descricao}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  ativo
                    ? "bg-[#1A2E5A] text-white"
                    : "bg-[#E8EEFB] text-[#1E4FAB] hover:bg-[#1A2E5A] hover:text-white"
                }`}
              >
                {ctx.label}
              </button>
            );
          })}
        </div>
        {contextos.length === 0 && (
          <p className="mt-1.5 text-[11px] text-[#B5790A]">
            ⚠️ Nenhum contexto selecionado — Maria não terá dados do CRM para responder.
          </p>
        )}
      </div>

      {/* Thread de mensagens */}
      <div
        ref={scrollRef}
        className="flex max-h-[400px] min-h-[180px] flex-col gap-3 overflow-y-auto rounded-[14px] bg-[#F4F6FA] p-4"
      >
        {mensagens.length === 0 && !isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl">👋</span>
            <p className="text-[13px] font-semibold text-[#1A2E5A]">Olá! Pode perguntar.</p>
            <p className="text-[12px] text-[#667085]">
              Selecione os contextos acima e me faça qualquer pergunta sobre o que está acontecendo no comercial.
            </p>
          </div>
        ) : (
          <>
            {mensagens.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={i}
                  className={`flex max-w-[85%] flex-col gap-1 ${isUser ? "ml-auto items-end" : "items-start"}`}
                >
                  <p className="text-[10.5px] font-semibold text-[#98A2B3]">
                    {isUser ? "Você" : "Maria"}
                  </p>
                  <div
                    className={`rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed ${
                      isUser
                        ? "bg-[#1A2E5A] text-white"
                        : "bg-white text-[#172033] border border-[#D7DEEA]"
                    }`}
                  >
                    {msg.content.split("\n").map((linha, j) => (
                      <span key={j}>
                        {linha}
                        {j < msg.content.split("\n").length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="flex items-center gap-2 rounded-[14px] border border-[#D7DEEA] bg-white px-4 py-2.5">
                  <Loader2 className="size-3.5 animate-spin text-[#1E4FAB]" />
                  <span className="text-[12.5px] text-[#667085]">Maria está consultando o CRM…</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="rounded-[10px] bg-[#FBE9E9] px-4 py-2.5 text-[12.5px] text-[#D03B3B]">
          ⚠️ {erro}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Ex.: Quem você falou hoje? Qual o lead mais quente? Como estão as redes sociais?"
          rows={1}
          className="flex-1 resize-none rounded-[14px] border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-2.5 text-[13.5px] text-[#172033] placeholder-[#98A2B3] outline-none transition focus:border-[#1E4FAB] focus:bg-white disabled:opacity-60"
          style={{ minHeight: "44px", maxHeight: "120px" }}
        />
        <button
          onClick={enviar}
          disabled={!input.trim() || isLoading}
          className="flex shrink-0 items-center gap-1.5 rounded-[14px] bg-[#1A2E5A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E4FAB] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="size-3.5" />
          Enviar
        </button>
      </div>
      <p className="text-[10.5px] text-[#98A2B3]">
        Enter para enviar · Shift+Enter para nova linha · Dados carregados em tempo real do CRM
      </p>
    </div>
  );
}
