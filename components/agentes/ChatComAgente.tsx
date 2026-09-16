"use client";
// ARQUIVO: components/agentes/ChatComAgente.tsx
// REGRA: nunca remover. Apenas acrescentar.
//
// Componente genérico de chat de gestão interna.
// Usado por Maria (/maria) e João (/joao) — passa apiRoute e config de cada agente.
// Histórico em memória (não persiste entre reloads).

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mensagem = { role: "user" | "assistant"; content: string };

export type ChipContexto = {
  id: string;
  label: string;
  descricao: string;
  defaultAtivo?: boolean;
};

export type ChatComAgenteConfig = {
  /** Rota da API que processa o chat — ex: "/api/maria/chat-gestao" */
  apiRoute: string;
  /** Nome do agente exibido na interface */
  nome: string;
  /** Inicial para o avatar */
  inicial: string;
  /** Subtítulo exibido abaixo do nome */
  subtitulo: string;
  /** Placeholder do campo de texto */
  placeholder: string;
  /** Mensagem de boas-vindas quando o chat está vazio */
  boasVindas: string;
  /** Chips de contexto disponíveis para carregar */
  chips: ChipContexto[];
  /** Cor do gradiente do avatar (classe Tailwind) */
  avatarGradiente?: string;
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function ChatComAgente({ config }: { config: ChatComAgenteConfig }) {
  const defaultAtivos = config.chips
    .filter((c) => c.defaultAtivo)
    .map((c) => c.id);

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [contextos, setContextos] = useState<string[]>(defaultAtivos);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, isLoading]);

  function toggleContexto(id: string) {
    setContextos((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || isLoading) return;

    const novasMensagens: Mensagem[] = [
      ...mensagens,
      { role: "user", content: texto },
    ];
    setMensagens(novasMensagens);
    setInput("");
    setIsLoading(true);
    setErro(null);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch(config.apiRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novasMensagens, contextos }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        resposta?: string;
        error?: string;
      };

      if (!res.ok || !data.resposta) {
        throw new Error(data.error ?? "Erro desconhecido.");
      }

      setMensagens([
        ...novasMensagens,
        { role: "assistant", content: data.resposta },
      ]);
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Falha ao contatar o agente. Tente novamente."
      );
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
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  const gradiente =
    config.avatarGradiente ?? "from-[#2A78D6] to-[#1A2E5A]";

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-[#D7DEEA] bg-white p-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div
          className={`flex size-[38px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradiente} text-sm font-bold text-white`}
        >
          {config.inicial}
        </div>
        <div>
          <p className="text-[14px] font-bold text-[#1A2E5A]">
            Falar com {config.nome}
          </p>
          <p className="text-[11.5px] text-[#667085]">{config.subtitulo}</p>
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
          O que {config.nome} deve saber antes de responder:
        </p>
        <div className="flex flex-wrap gap-2">
          {config.chips.map((ctx) => {
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
            ⚠️ Nenhum contexto selecionado — {config.nome} não terá dados para responder com precisão.
          </p>
        )}
      </div>

      {/* Thread de mensagens */}
      <div
        ref={scrollRef}
        className="flex max-h-[420px] min-h-[180px] flex-col gap-3 overflow-y-auto rounded-[14px] bg-[#F4F6FA] p-4"
      >
        {mensagens.length === 0 && !isLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl">👋</span>
            <p className="text-[13px] font-semibold text-[#1A2E5A]">
              Olá! Pode perguntar.
            </p>
            <p className="max-w-sm text-[12px] text-[#667085]">
              {config.boasVindas}
            </p>
          </div>
        ) : (
          <>
            {mensagens.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={i}
                  className={`flex max-w-[85%] flex-col gap-1 ${
                    isUser ? "ml-auto items-end" : "items-start"
                  }`}
                >
                  <p className="text-[10.5px] font-semibold text-[#98A2B3]">
                    {isUser ? "Você" : config.nome}
                  </p>
                  <div
                    className={`rounded-[14px] px-4 py-2.5 text-[13.5px] leading-relaxed ${
                      isUser
                        ? "bg-[#1A2E5A] text-white"
                        : "border border-[#D7DEEA] bg-white text-[#172033]"
                    }`}
                  >
                    {msg.content.split("\n").map((linha, j, arr) => (
                      <span key={j}>
                        {linha}
                        {j < arr.length - 1 && <br />}
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
                  <span className="text-[12.5px] text-[#667085]">
                    {config.nome} está consultando o CRM…
                  </span>
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
          placeholder={config.placeholder}
          rows={1}
          className="flex-1 resize-none rounded-[14px] border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-2.5 text-[13.5px] text-[#172033] placeholder-[#98A2B3] outline-none transition focus:border-[#1E4FAB] focus:bg-white disabled:opacity-60"
          style={{ minHeight: "44px", maxHeight: "120px" }}
        />
        <button
          onClick={enviar}
          disabled={!input.trim() || isLoading}
          className="flex shrink-0 items-center gap-1.5 rounded-[14px] bg-[#1A2E5A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E4FAB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="size-3.5" />
          Enviar
        </button>
      </div>
      <p className="text-[10.5px] text-[#98A2B3]">
        Enter para enviar · Shift+Enter para nova linha · Dados em tempo real do CRM
      </p>
    </div>
  );
}
