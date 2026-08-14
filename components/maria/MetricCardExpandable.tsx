"use client";
// ARQUIVO: components/maria/MetricCardExpandable.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Card de métrica clicável que expande uma lista de leads abaixo.

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2, MessageCircle, Send, X } from "lucide-react";
import { Card } from "@/components/ui/card";

type LeadItem = {
  id: string;
  nome: string;
  empresa: string;
  empresaId: string | null;
  cidade: string;
  telefone: string;
  temperatura: string;
  info: string;
  status?: string;
  titulo?: string;
  conversaId?: string | null;
};

export function MetricCardExpandable({
  icon,
  iconClass,
  label,
  value,
  delta,
  compact,
  tipo,
  disabled,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  delta?: { positivo: boolean; texto: string } | null;
  compact?: boolean;
  tipo: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LeadItem[] | null>(null);

  // Estado do modal "Iniciar Conversa" — guarda o id do lead com o painel aberto
  const [iniciandoId, setIniciandoId] = useState<string | null>(null);
  const [msgTexto, setMsgTexto] = useState("");
  const [enviandoNova, setEnviandoNova] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function iniciarConversa(item: LeadItem) {
    if (enviandoNova || !msgTexto.trim()) return;
    setEnviandoNova(true);
    try {
      const res = await fetch("/api/conversas/nova", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: item.telefone,
          mensagem: msgTexto.trim(),
          nomeContato: item.nome !== "—" ? item.nome : undefined,
          oportunidadeId: item.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.conversaId) {
        window.location.href = `/conversas?abrir=${data.conversaId}`;
      } else {
        alert(data.error ?? "Erro ao iniciar conversa.");
        setEnviandoNova(false);
      }
    } catch {
      alert("Erro de rede ao iniciar conversa.");
      setEnviandoNova(false);
    }
  }

  async function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (items !== null) return; // já carregou
    setLoading(true);
    try {
      const res = await fetch(`/api/maria/metrica?tipo=${tipo}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const numValue = parseInt(value.replace(/\D/g, ""), 10);
  const hasData = !isNaN(numValue) && numValue > 0 && !disabled;

  return (
    <div className="flex flex-col">
      <Card
        onClick={toggle}
        className={`rounded-[20px] border-[#D7DEEA] ${compact ? "p-4" : "p-[18px]"} flex flex-col gap-2.5 transition-all
          ${hasData ? "cursor-pointer hover:border-[#2A78D6] hover:shadow-md" : ""}
          ${open ? "rounded-b-none border-b-0 shadow-md border-[#2A78D6]" : ""}
        `}
      >
        <div className="flex items-start justify-between">
          <div
            className={`flex items-center justify-center rounded-[10px] ${iconClass} ${compact ? "size-7" : "size-[34px]"}`}
          >
            {icon}
          </div>
          {hasData && (
            <span className="text-[#2A78D6]">
              {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </span>
          )}
        </div>
        <p className={`font-semibold text-[#667085] ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}>{label}</p>
        <p className={`font-extrabold leading-none text-[#1A2E5A] tabular-nums ${compact ? "text-[19px]" : "text-[28px]"}`}>
          {value}
        </p>
        {delta ? (
          <span className={`text-xs font-bold ${delta.positivo ? "text-[#0C8A3E]" : "text-[#D03B3B]"}`}>
            {delta.positivo ? "▲" : "▼"} {delta.texto}
          </span>
        ) : null}
        {hasData && !open && (
          <span className="text-[11px] text-[#2A78D6] font-semibold">Clique para ver lista →</span>
        )}
      </Card>

      {open && (
        <div className="rounded-b-[20px] border border-t-0 border-[#2A78D6] bg-white px-4 pb-4 pt-2 shadow-md">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#667085]">
              <Loader2 className="size-4 animate-spin" />
              Carregando...
            </div>
          ) : !items || items.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#98A2B3]">Nenhum registro encontrado.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#F4F6FA]">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col">
                <div className="flex items-start gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-bold text-[#1A2E5A]">{item.nome}</span>
                      {item.temperatura && item.temperatura !== "—" && (
                        <span className="text-[11px] text-[#667085]">{item.temperatura}</span>
                      )}
                    </div>
                    <span className="text-[12.5px] font-semibold text-[#2A78D6]">{item.empresa}</span>
                    {item.titulo && (
                      <span className="text-[11.5px] text-[#667085]">{item.titulo}</span>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {item.cidade && item.cidade !== "—" && (
                        <span className="text-[11.5px] text-[#98A2B3]">📍 {item.cidade}</span>
                      )}
                      {item.telefone && item.telefone !== "—" && (
                        <a
                          href={`https://wa.me/${item.telefone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11.5px] text-[#0C8A3E] font-semibold hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          📲 {item.telefone}
                        </a>
                      )}
                    </div>
                    <span className="mt-0.5 text-[11px] text-[#B5790A]">{item.info}</span>
                  </div>
                  <div className="mt-1 flex flex-shrink-0 flex-col gap-1.5">
                    {item.conversaId ? (
                      <a
                        href={`/conversas?abrir=${item.conversaId}`}
                        className="flex items-center gap-1 rounded-lg bg-[#E8EEFB] px-2 py-1 text-[11px] font-bold text-[#1E4FAB] hover:bg-[#1E4FAB] hover:text-white transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir conversa no CRM"
                      >
                        <MessageCircle className="size-3" />
                        Conversa
                      </a>
                    ) : item.telefone && item.telefone !== "—" ? (
                      <button
                        className="flex items-center gap-1 rounded-lg bg-[#E8EEFB] px-2 py-1 text-[11px] font-bold text-[#1E4FAB] hover:bg-[#1E4FAB] hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (iniciandoId === item.id) {
                            setIniciandoId(null);
                            setMsgTexto("");
                          } else {
                            setIniciandoId(item.id);
                            setMsgTexto("");
                            setTimeout(() => textareaRef.current?.focus(), 50);
                          }
                        }}
                        title="Iniciar nova conversa pelo CRM (Maria)"
                      >
                        <MessageCircle className="size-3" />
                        Iniciar
                      </button>
                    ) : null}
                    {item.empresaId && (
                      <a
                        href={`/empresas/${item.empresaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center text-[#667085] hover:text-[#2A78D6]"
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir empresa"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                {/* Painel inline "Iniciar Conversa" */}
                {iniciandoId === item.id && (
                  <div
                    className="mb-2 rounded-xl border border-[#2A78D6] bg-[#F4F7FF] px-3 py-2.5 flex flex-col gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#1E4FAB]">
                        Iniciar conversa — Maria → {item.nome}
                      </span>
                      <button
                        onClick={() => { setIniciandoId(null); setMsgTexto(""); }}
                        className="text-[#98A2B3] hover:text-[#1A2E5A]"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={msgTexto}
                      onChange={(e) => setMsgTexto(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          iniciarConversa(item);
                        }
                      }}
                      placeholder="Digite a primeira mensagem... (Enter para enviar)"
                      rows={3}
                      className="w-full resize-none rounded-lg border border-[#D7DEEA] bg-white px-2.5 py-1.5 text-[12px] text-[#1A2E5A] outline-none focus:border-[#2A78D6]"
                    />
                    <button
                      disabled={!msgTexto.trim() || enviandoNova}
                      onClick={() => iniciarConversa(item)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1E4FAB] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50 hover:bg-[#163B8A] transition-colors"
                    >
                      {enviandoNova ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Send className="size-3" />
                      )}
                      {enviandoNova ? "Enviando..." : "Enviar pelo CRM"}
                    </button>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
