"use client";

// ARQUIVO: components/crm-ia/CrmIaChat.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Chat flutuante do CRM IA — aparece em todas as páginas do CRM.

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, X, ChevronDown } from "lucide-react";

type Mensagem = {
  role: "user" | "assistant";
  content: string;
};

export function CrmIaChat() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o **CRM IA**, seu assistente inteligente.\n\nPosso responder perguntas sobre oportunidades, propostas, tarefas, pipeline, equipamentos e muito mais. O que você precisa?",
    },
  ]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (aberto) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [aberto, mensagens]);

  async function enviar() {
    const texto = input.trim();
    if (!texto || carregando) return;

    const novasMensagens: Mensagem[] = [
      ...mensagens,
      { role: "user", content: texto },
    ];
    setMensagens(novasMensagens);
    setInput("");
    setCarregando(true);

    try {
      const res = await fetch("/api/crm-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: texto,
          historico: novasMensagens.slice(-10), // Envia últimas 10 mensagens como contexto
        }),
      });

      if (!res.ok) throw new Error("Erro na resposta");
      const data = await res.json();

      setMensagens([
        ...novasMensagens,
        { role: "assistant", content: data.resposta },
      ]);
    } catch {
      setMensagens([
        ...novasMensagens,
        {
          role: "assistant",
          content: "Desculpe, ocorreu um erro. Tente novamente.",
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  // Renderiza markdown simples (negrito e quebras de linha)
  function renderTexto(texto: string) {
    const partes = texto.split(/(\*\*[^*]+\*\*)/g);
    return partes.map((parte, i) => {
      if (parte.startsWith("**") && parte.endsWith("**")) {
        return <strong key={i}>{parte.slice(2, -2)}</strong>;
      }
      return (
        <span key={i}>
          {parte.split("\n").map((linha, j, arr) => (
            <span key={j}>
              {linha}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    });
  }

  return (
    <>
      {/* Botão flutuante */}
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#1A2E5A] px-4 py-3 text-white shadow-lg transition hover:bg-[#1E4FAB] hover:scale-105 active:scale-95"
          aria-label="Abrir CRM IA"
        >
          <Bot className="size-5" />
          <span className="text-sm font-semibold">CRM IA</span>
        </button>
      )}

      {/* Painel do chat */}
      {aberto && (
        <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-2xl border border-[#D7DEEA] bg-white shadow-2xl"
          style={{ maxHeight: "min(580px, calc(100vh - 48px))" }}>

          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-[#1A2E5A] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
                <Bot className="size-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">CRM IA</p>
                <p className="text-[10px] text-blue-200">Assistente inteligente</p>
              </div>
            </div>
            <button
              onClick={() => setAberto(false)}
              className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white transition"
              aria-label="Fechar"
            >
              <ChevronDown className="size-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
            {mensagens.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="mr-2 mt-1 flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8EEFB]">
                    <Bot className="size-3 text-[#1A2E5A]" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#1A2E5A] text-white rounded-tr-sm"
                      : "bg-[#F4F6FA] text-[#1A2E5A] rounded-tl-sm"
                  }`}
                >
                  {renderTexto(msg.content)}
                </div>
              </div>
            ))}

            {carregando && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8EEFB]">
                  <Bot className="size-3 text-[#1A2E5A]" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-[#F4F6FA] px-3 py-2">
                  <Loader2 className="size-3.5 animate-spin text-[#1A2E5A]" />
                  <span className="text-xs text-[#667085]">Consultando o CRM...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sugestões rápidas (só na primeira mensagem) */}
          {mensagens.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {[
                "Pipeline de vendas",
                "Tarefas pendentes",
                "Oportunidades abertas",
                "Origem dos leads",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-[#D7DEEA] bg-white px-2.5 py-1 text-xs text-[#1A2E5A] hover:bg-[#E8EEFB] transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[#D7DEEA] p-3">
            <div className="flex items-end gap-2 rounded-xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-2 focus-within:border-[#1E4FAB] transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre oportunidades, tarefas, pipeline..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-[#1A2E5A] placeholder:text-[#98A2B3] outline-none"
                style={{ maxHeight: "80px" }}
                disabled={carregando}
              />
              <button
                onClick={enviar}
                disabled={!input.trim() || carregando}
                className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#1A2E5A] text-white transition hover:bg-[#1E4FAB] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Enviar"
              >
                <Send className="size-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-[#98A2B3]">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      )}
    </>
  );
}
