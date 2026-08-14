"use client";
// ARQUIVO: components/maria/MetricCardExpandable.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Card de métrica clicável que expande uma lista de leads abaixo.

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Loader2, MessageCircle } from "lucide-react";
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
                <div key={item.id} className="flex items-start gap-3 py-3">
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
                    {item.conversaId && (
                      <a
                        href={`/conversas?abrir=${item.conversaId}`}
                        className="flex items-center gap-1 rounded-lg bg-[#E8EEFB] px-2 py-1 text-[11px] font-bold text-[#1E4FAB] hover:bg-[#1E4FAB] hover:text-white transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir conversa"
                      >
                        <MessageCircle className="size-3" />
                        Conversa
                      </a>
                    )}
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
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
