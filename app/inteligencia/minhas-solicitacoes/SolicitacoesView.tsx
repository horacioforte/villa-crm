"use client";

// ARQUIVO: app/inteligencia/minhas-solicitacoes/SolicitacoesView.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Client component — toggle entre Grade e Kanban de Maturidade.
// O Kanban usa as mesmas colunas do Dossiês Comerciais (A→B→C→Pronto→Oportunidade).

import { useState } from "react";
import Link from "next/link";
import { Clock, MapPin, LayoutGrid, Columns3 } from "lucide-react";
import {
  calcularNivelInvestigacao,
  NIVEL_CFG,
  type NivelLabel,
} from "@/lib/inteligencia/maturidade";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DossieParaView = {
  id: string;
  titulo: string;
  score: number;
  completude: number;
  status: string;
  cidade: string | null;
  estado: string | null;
  segmento: string | null;
  criadoPorAgente: string;
  fonteInformacao: string | null;
  createdAt: string; // ISO string serializado
  // campos para cálculo de maturidade
  clienteFinal: string | null;
  construtora: string | null;
  epc: string | null;
  epcm: string | null;
  faseObra: string | null;
  cronograma: string | null;
  licenciamento: string | null;
  valorEstimado: string | null;
  volumeConcreto: string | null;
  equipamentosSugeridos: string | null;
  potencialVilla: number | null;
  momentoVilla: number | null;
  prontidao: number | null;
  totalDecisores: number;
  decisores: { nome: string | null; telefone: string | null; email: string | null }[];
};

// ─── Colunas do Kanban ────────────────────────────────────────────────────────

const COLUNAS: {
  nivel: NivelLabel;
  label: string;
  headerBg: string;
  headerText: string;
  colBorder: string;
}[] = [
  { nivel: "A",            label: "Investigação A", headerBg: "bg-blue-50",    headerText: "text-blue-700",    colBorder: "border-blue-200"    },
  { nivel: "B",            label: "Investigação B", headerBg: "bg-amber-50",   headerText: "text-amber-700",   colBorder: "border-amber-200"   },
  { nivel: "C",            label: "Investigação C", headerBg: "bg-violet-50",  headerText: "text-violet-700",  colBorder: "border-violet-200"  },
  { nivel: "PRONTO",       label: "Pronto",         headerBg: "bg-emerald-50", headerText: "text-emerald-700", colBorder: "border-emerald-200" },
  { nivel: "OPORTUNIDADE", label: "Oportunidade",   headerBg: "bg-indigo-50",  headerText: "text-indigo-700",  colBorder: "border-indigo-200"  },
];

const STATUS_LABEL: Record<string, string> = {
  INVESTIGANDO:         "Investigando",
  AGUARDANDO_VALIDACAO: "Aguardando validação",
  EM_ANALISE:           "Em análise",
  PEDIR_MAIS_PESQUISA:  "Mais pesquisa",
  PRONTO_PARA_ASSUMIR:  "Pronto para assumir",
  ASSUMIDO:             "Assumido",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasDesde(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function nivelDoDossie(d: DossieParaView): NivelLabel {
  if (d.status === "ASSUMIDO") return "OPORTUNIDADE";
  if (d.status === "ARQUIVADO") return "ARQUIVADO";
  const r = calcularNivelInvestigacao(
    {
      clienteFinal:          d.clienteFinal,
      construtora:           d.construtora,
      epc:                   d.epc,
      epcm:                  d.epcm,
      faseObra:              d.faseObra,
      cronograma:            d.cronograma,
      licenciamento:         d.licenciamento,
      valorEstimado:         d.valorEstimado,
      volumeConcreto:        d.volumeConcreto,
      equipamentosSugeridos: d.equipamentosSugeridos,
      potencialVilla:        d.potencialVilla,
      momentoVilla:          d.momentoVilla,
      prontidao:             d.prontidao,
      completude:            d.completude,
      totalDecisores:        d.totalDecisores,
      score:                 d.score,
      cidade:                d.cidade,
      estado:                d.estado,
    },
    d.decisores,
  );
  return r.nivel;
}

function corScore(score: number) {
  if (score >= 75) return "bg-red-100 text-red-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function solicitante(criadoPorAgente: string, fonteInformacao: string | null): string | null {
  const ignorar = new Set(["joao-radar", "joao-outbound", "manual", "equipe", ""]);
  if (criadoPorAgente && !ignorar.has(criadoPorAgente)) return criadoPorAgente;
  if (fonteInformacao?.startsWith("Solicitado por ")) {
    return fonteInformacao.replace("Solicitado por ", "").trim();
  }
  return null;
}

// ─── Card (grid) ─────────────────────────────────────────────────────────────

function CardGrid({ d }: { d: DossieParaView }) {
  const dias = diasDesde(d.createdAt);
  const completude = d.completude ?? 0;
  const nome = solicitante(d.criadoPorAgente, d.fonteInformacao);
  const corSt =
    d.status === "PRONTO_PARA_ASSUMIR" ? "bg-emerald-100 text-emerald-700" :
    d.status === "INVESTIGANDO"        ? "bg-blue-100 text-blue-700" :
    d.status === "ASSUMIDO"            ? "bg-indigo-100 text-indigo-700" :
    "bg-slate-100 text-slate-500";

  return (
    <Link
      href={`/inteligencia/${d.id}`}
      className="group flex flex-col bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-indigo-200 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", corScore(d.score))}>{d.score}</span>
          {nome && (
            <span
              title={`Solicitado por ${nome}`}
              className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"
            >
              {nome[0].toUpperCase()}
            </span>
          )}
        </div>
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", corSt)}>
          {STATUS_LABEL[d.status] ?? d.status}
        </span>
      </div>

      <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-indigo-700 transition-colors">
        {d.titulo}
      </p>

      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-3">
        {(d.cidade || d.estado) && (
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3" />
            {[d.cidade, d.estado].filter(Boolean).join(" / ")}
          </span>
        )}
        {d.segmento && (
          <>
            {(d.cidade || d.estado) && <span>·</span>}
            <span>{d.segmento}</span>
          </>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-slate-400">Completude</span>
          <span className="text-[10px] font-semibold text-blue-600">{completude}%</span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${completude}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
          Solicitado por você
        </span>
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
          <Clock className="h-3 w-3" />
          {dias === 0 ? "hoje" : `há ${dias}d`}
        </span>
      </div>
    </Link>
  );
}

// ─── Card (kanban) ────────────────────────────────────────────────────────────

function CardKanban({ d }: { d: DossieParaView }) {
  const dias = diasDesde(d.createdAt);
  const nivel = nivelDoDossie(d);
  const cfg = NIVEL_CFG[nivel];

  return (
    <Link
      href={`/inteligencia/${d.id}`}
      className="group block bg-white border border-slate-100 rounded-xl p-3 hover:shadow-md hover:border-indigo-200 transition-all"
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", corScore(d.score))}>
          {d.score}
        </span>
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
          <Clock className="h-2.5 w-2.5" />
          {dias === 0 ? "hoje" : `${dias}d`}
        </span>
      </div>

      <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-indigo-700 transition-colors">
        {d.titulo}
      </p>

      {(d.cidade || d.estado) && (
        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mb-2">
          <MapPin className="h-2.5 w-2.5" />
          {[d.cidade, d.estado].filter(Boolean).join(" / ")}
        </p>
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">Complet.</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all bg-blue-400" style={{ width: `${d.completude}%` }} />
          </div>
          <span className="text-[10px] font-medium text-blue-600 w-6 text-right shrink-0">{d.completude}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">Maturid.</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${d.prontidao ?? 0}%`,
                backgroundColor:
                  nivel === "PRONTO"       ? "#10b981" :
                  nivel === "OPORTUNIDADE" ? "#6366f1" :
                  nivel === "C"            ? "#9333ea" :
                  nivel === "B"            ? "#f59e0b" : "#3b82f6",
              }}
            />
          </div>
          <span className="text-[10px] font-medium w-6 text-right shrink-0" style={{
            color:
              nivel === "PRONTO"       ? "#10b981" :
              nivel === "OPORTUNIDADE" ? "#6366f1" :
              nivel === "C"            ? "#9333ea" :
              nivel === "B"            ? "#f59e0b" : "#3b82f6",
          }}>{d.prontidao ?? 0}%</span>
        </div>
      </div>
    </Link>
  );
}

// ─── View principal ───────────────────────────────────────────────────────────

const STATUS_OPCOES = [
  { value: "",                  label: "Todos" },
  { value: "INVESTIGANDO",      label: "Investigando" },
  { value: "PRONTO_PARA_ASSUMIR", label: "Prontos" },
  { value: "AGUARDANDO_VALIDACAO", label: "Aguardando validação" },
  { value: "ASSUMIDO",          label: "Assumidos" },
];

export function SolicitacoesView({
  dossies,
  filtroStatusInicial,
}: {
  dossies: DossieParaView[];
  filtroStatusInicial: string;
}) {
  const [view, setView] = useState<"grid" | "kanban">("kanban");
  const [filtroStatus, setFiltroStatus] = useState(filtroStatusInicial);

  // Grid: filtra por status; Kanban: todos (groupados por coluna)
  const dossiesFiltrados =
    view === "grid" && filtroStatus
      ? dossies.filter(d => d.status === filtroStatus)
      : dossies;

  // Agrupa por nível para o Kanban
  const porNivel = Object.fromEntries(
    COLUNAS.map(c => [
      c.nivel,
      dossies
        .filter(d => nivelDoDossie(d) === c.nivel)
        .sort((a, b) => b.score - a.score),
    ]),
  ) as Record<NivelLabel, DossieParaView[]>;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Barra de controle: filtro de status (grade) + toggle view ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-100 px-5 py-2 flex items-center justify-between gap-3">
        {/* Filtros de status — visíveis só na grade */}
        <div className="flex items-center gap-2 flex-wrap">
          {view === "grid" && STATUS_OPCOES.map(op => (
            <button
              key={op.value}
              onClick={() => setFiltroStatus(op.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                filtroStatus === op.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700",
              )}
            >
              {op.label}
            </button>
          ))}
          {view === "kanban" && (
            <span className="text-xs text-slate-400">Agrupado por nível de maturidade</span>
          )}
        </div>

        {/* Toggle Grade / Kanban */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              view === "grid" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grade
          </button>
          <button
            onClick={() => setView("kanban")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              view === "kanban" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-auto">

        {/* GRADE */}
        {view === "grid" && (
          <div className="p-5">
            {dossiesFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Nenhuma solicitação encontrada</p>
                <p className="text-xs text-slate-400">Peça ao João para investigar uma obra ou empresa via chat do CRM IA.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {dossiesFiltrados.map(d => <CardGrid key={d.id} d={d} />)}
              </div>
            )}
          </div>
        )}

        {/* KANBAN */}
        {view === "kanban" && (
          <div className="flex gap-3 p-4 min-w-max min-h-full items-start">
            {COLUNAS.map(col => {
              const itens = porNivel[col.nivel] ?? [];
              return (
                <div
                  key={col.nivel}
                  className={cn("flex flex-col w-52 shrink-0 rounded-xl border", col.colBorder)}
                >
                  {/* Header da coluna */}
                  <div className={cn("px-3 py-2.5 rounded-t-xl flex items-center justify-between", col.headerBg)}>
                    <span className={cn("text-xs font-bold", col.headerText)}>
                      {NIVEL_CFG[col.nivel]?.emoji ?? ""} {col.label}
                    </span>
                    <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60", col.headerText)}>
                      {itens.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2 flex-1">
                    {itens.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-4">Nenhuma aqui</p>
                    ) : (
                      itens.map(d => <CardKanban key={d.id} d={d} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
