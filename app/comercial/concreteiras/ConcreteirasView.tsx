"use client";

// ARQUIVO: app/comercial/concreteiras/ConcreteirasView.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Client Component — Kanban de 5 colunas do CRM João — Concreteiras.
// Mesma linguagem visual dos Kanbans de Dossiês / Minhas Solicitações.
// Botão "Iniciar abordagem" abre modal que APENAS EXIBE o número do decisor.
// Nada é disparado automaticamente. Nunca informar preços — direcionar à equipe comercial.
// Criado em 01/10/2026.

import { useState } from "react";
import Link from "next/link";
import { Check, Clock, Copy, MapPin, MessageCircle, Phone, Radio, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { NivelLabel } from "@/lib/inteligencia/maturidade";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DecisorResumo = {
  nome: string;
  cargo: string | null;
  telefone: string | null;
};

export type ConcreteiraParaView = {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
  score: number;
  completude: number;
  prontidao: number | null;
  nivel: NivelLabel;
  atualizadoEm: string; // ISO
  principalSinal: string | null;
  emCampanha: boolean;
  etapaCarteira: string;
  decisor: DecisorResumo | null;
};

type NivelKanban = Exclude<NivelLabel, "ARQUIVADO">;

// ─── Colunas ──────────────────────────────────────────────────────────────────

const COLUNAS: {
  nivel: NivelKanban;
  emoji: string;
  label: string;
  headerBg: string;
  headerText: string;
  colBorder: string;
  barra: string;
}[] = [
  { nivel: "A",            emoji: "🔍", label: "Monitorando",         headerBg: "bg-blue-50",    headerText: "text-blue-700",    colBorder: "border-blue-200",    barra: "#3b82f6" },
  { nivel: "B",            emoji: "📡", label: "Sinal detectado",     headerBg: "bg-amber-50",   headerText: "text-amber-700",   colBorder: "border-amber-200",   barra: "#f59e0b" },
  { nivel: "C",            emoji: "📞", label: "Em abordagem",        headerBg: "bg-violet-50",  headerText: "text-violet-700",  colBorder: "border-violet-200",  barra: "#8b5cf6" },
  { nivel: "PRONTO",       emoji: "🤝", label: "Interessada",         headerBg: "bg-emerald-50", headerText: "text-emerald-700", colBorder: "border-emerald-200", barra: "#10b981" },
  { nivel: "OPORTUNIDADE", emoji: "✅", label: "Oportunidade criada", headerBg: "bg-indigo-50",  headerText: "text-indigo-700",  colBorder: "border-indigo-200",  barra: "#6366f1" },
];

const COR_BARRA: Record<NivelKanban, string> = Object.fromEntries(
  COLUNAS.map(c => [c.nivel, c.barra]),
) as Record<NivelKanban, string>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corScore(score: number): string {
  if (score >= 75) return "bg-red-100 text-red-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function formatarData(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function resumir(texto: string, max = 90): string {
  const t = texto.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Normaliza telefone para wa.me (somente dígitos, com DDI 55 quando ausente). */
function telefoneParaWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function CardConcreteira({
  c,
  onIniciarAbordagem,
}: {
  c: ConcreteiraParaView;
  onIniciarAbordagem: (c: ConcreteiraParaView) => void;
}) {
  const nivel: NivelKanban = c.nivel === "ARQUIVADO" ? "A" : c.nivel;
  const cor = COR_BARRA[nivel];
  const maturidade = c.prontidao ?? 0;

  return (
    <div className="group bg-white border border-slate-100 rounded-xl p-3 hover:shadow-md hover:border-indigo-200 transition-all">
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", corScore(c.score))}>
          {c.score}
        </span>
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0" title={new Date(c.atualizadoEm).toLocaleString("pt-BR")}>
          <Clock className="h-2.5 w-2.5" />
          {formatarData(c.atualizadoEm)}
        </span>
      </div>

      <Link
        href={`/inteligencia/${c.id}`}
        className="block text-xs font-semibold text-slate-800 leading-snug line-clamp-2 mb-1.5 group-hover:text-indigo-700 transition-colors"
      >
        {c.nome}
      </Link>

      {(c.cidade || c.estado) && (
        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mb-1.5">
          <MapPin className="h-2.5 w-2.5" />
          {[c.cidade, c.estado].filter(Boolean).join(" / ")}
        </p>
      )}

      {c.decisor && (
        <p className="text-[10px] text-slate-600 flex items-center gap-1 mb-1.5 min-w-0">
          <User className="h-2.5 w-2.5 shrink-0 text-slate-400" />
          <span className="truncate">
            {c.decisor.nome}
            {c.decisor.cargo ? <span className="text-slate-400"> · {c.decisor.cargo}</span> : null}
          </span>
        </p>
      )}

      {c.principalSinal?.trim() && (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-1 mb-2 flex items-start gap-1">
          <Radio className="h-2.5 w-2.5 mt-0.5 shrink-0" />
          <span className="line-clamp-2">{resumir(c.principalSinal)}</span>
        </p>
      )}

      <div className="space-y-1 mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">Complet.</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all bg-blue-400" style={{ width: `${c.completude}%` }} />
          </div>
          <span className="text-[10px] font-medium text-blue-600 w-6 text-right shrink-0">{c.completude}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">Maturid.</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${maturidade}%`, backgroundColor: cor }} />
          </div>
          <span className="text-[10px] font-medium w-6 text-right shrink-0" style={{ color: cor }}>{maturidade}%</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onIniciarAbordagem(c)}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-200 transition-colors"
      >
        <MessageCircle className="h-3 w-3" />
        Iniciar abordagem
      </button>
    </div>
  );
}

// ─── Modal de abordagem ───────────────────────────────────────────────────────

function ModalAbordagem({
  concreteira,
  onFechar,
}: {
  concreteira: ConcreteiraParaView | null;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const decisor = concreteira?.decisor ?? null;
  const telefone = decisor?.telefone?.trim() || null;

  async function copiar() {
    if (!telefone) return;
    try {
      await navigator.clipboard.writeText(telefone);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Dialog
      open={concreteira !== null}
      onOpenChange={open => {
        if (!open) {
          setCopiado(false);
          onFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-slate-800">Iniciar abordagem</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {concreteira?.nome}
            {concreteira && (concreteira.cidade || concreteira.estado)
              ? ` — ${[concreteira.cidade, concreteira.estado].filter(Boolean).join(" / ")}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {decisor ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{decisor.nome}</p>
                {decisor.cargo && <p className="text-xs text-slate-500 truncate">{decisor.cargo}</p>}
              </div>
            </div>

            {telefone ? (
              <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-mono text-slate-800">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  {telefone}
                </span>
                <button
                  type="button"
                  onClick={copiar}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Decisor sem telefone cadastrado. Peça ao João para completar o contato.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Nenhum decisor identificado ainda para esta concreteira.
          </p>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Nenhuma mensagem é enviada automaticamente. Valores e condições comerciais devem ser
          tratados pela equipe comercial — não informe preços na abordagem.
        </p>

        <div className="flex items-center justify-end gap-2">
          {telefone && (
            <a
              href={`https://wa.me/${telefoneParaWhatsApp(telefone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Abrir conversa no WhatsApp
            </a>
          )}
          {concreteira && (
            <Link
              href={`/inteligencia/${concreteira.id}`}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Ver dossiê
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── View principal ───────────────────────────────────────────────────────────

export function ConcreteirasView({ concreteiras }: { concreteiras: ConcreteiraParaView[] }) {
  const [selecionada, setSelecionada] = useState<ConcreteiraParaView | null>(null);

  const porNivel = Object.fromEntries(
    COLUNAS.map(col => [
      col.nivel,
      concreteiras
        .filter(c => (c.nivel === "ARQUIVADO" ? "A" : c.nivel) === col.nivel)
        .sort((a, b) => b.score - a.score),
    ]),
  ) as Record<NivelKanban, ConcreteiraParaView[]>;

  return (
    <div className="flex-1 overflow-auto">
      {concreteiras.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-sm font-medium text-slate-500 mb-1">Nenhuma concreteira na carteira ainda</p>
          <p className="text-xs text-slate-400">Os dossiês classificados na carteira Concreteiras aparecem aqui automaticamente.</p>
        </div>
      ) : (
        <div className="flex gap-3 p-4 h-full items-start">
          {COLUNAS.map(col => {
            const itens = porNivel[col.nivel] ?? [];
            return (
              <div key={col.nivel} className={cn("flex flex-col flex-1 min-w-0 rounded-xl border", col.colBorder)}>
                <div className={cn("px-3 py-2.5 rounded-t-xl flex items-center justify-between", col.headerBg)}>
                  <span className={cn("text-xs font-bold", col.headerText)}>
                    {col.emoji} {col.label}
                  </span>
                  <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60", col.headerText)}>
                    {itens.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-2 flex-1">
                  {itens.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-4">Nenhuma aqui</p>
                  ) : (
                    itens.map(c => (
                      <CardConcreteira key={c.id} c={c} onIniciarAbordagem={setSelecionada} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalAbordagem concreteira={selecionada} onFechar={() => setSelecionada(null)} />
    </div>
  );
}
