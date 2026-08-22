"use client";

import { useMemo } from "react";
import { ArrowRight, BriefcaseBusiness, Globe, History, MapPin, Target, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type EtapaCarteira =
  | "MONITORANDO"
  | "SINAL_DETECTADO"
  | "EM_INVESTIGACAO"
  | "DECISOR_ENCONTRADO"
  | "PRONTO_PARA_ABORDAR"
  | "EM_CAMPANHA"
  | "RESPONDEU"
  | "INTERESSADO";

export type CarteiraKanbanItem = {
  id: string;
  empresa: string;
  cidade: string;
  uf: string;
  segmento: string;
  score: number;
  ultimaInvestigacao: string;
  principalSinal: string;
  decisores: number;
  proximaAcao: string;
  tempoSemAtualizacao: string;
  estagio: EtapaCarteira;
  dossieId?: string | null;
  emCampanha?: boolean;
  interessado?: boolean;
  extras?: Array<{ label: string; value: string }>;
};

const ETAPAS: { key: EtapaCarteira; label: string; tone: string }[] = [
  { key: "MONITORANDO", label: "Monitorando", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  { key: "SINAL_DETECTADO", label: "Sinal Detectado", tone: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "EM_INVESTIGACAO", label: "Em Investigação", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "DECISOR_ENCONTRADO", label: "Decisor Encontrado", tone: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "PRONTO_PARA_ABORDAR", label: "Pronto para Abordar", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "EM_CAMPANHA", label: "Em Campanha", tone: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  { key: "RESPONDEU", label: "Respondeu", tone: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { key: "INTERESSADO", label: "Interessado", tone: "bg-pink-100 text-pink-700 border-pink-200" },
];

export function CarteiraKanban({
  items,
  onOpenDossie,
  onLinkedIn,
  onCampanha,
  onStageChange,
}: {
  items: CarteiraKanbanItem[];
  onOpenDossie?: (item: CarteiraKanbanItem) => void;
  onLinkedIn?: (item: CarteiraKanbanItem) => void;
  onCampanha?: (item: CarteiraKanbanItem) => void;
  onStageChange?: (item: CarteiraKanbanItem, nextStage: EtapaCarteira) => void;
}) {
  const columns = useMemo(() => ETAPAS.map((etapa) => ({
    ...etapa,
    itens: items.filter((item) => item.estagio === etapa.key),
  })), [items]);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-4">
      {columns.map((column) => (
        <div key={column.key} className="rounded-2xl border border-slate-200 bg-slate-100/70 p-2.5">
          <div className={cn("flex items-center justify-between gap-2 rounded-xl border px-2 py-2 text-[11px] font-semibold", column.tone)}>
            <span>{column.label}</span>
            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px]">{column.itens.length}</span>
          </div>

          <div className="mt-2 space-y-2">
            {column.itens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-[11px] text-slate-400">
                Sem registros
              </div>
            ) : (
              column.itens.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.empresa}</p>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                        <MapPin className="h-3 w-3" />
                        <span>{item.cidade} / {item.uf}</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{item.score}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>{item.segmento}</span>
                    <span>{item.ultimaInvestigacao}</span>
                  </div>

                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                    <p className="font-medium text-[10px] uppercase tracking-[0.12em] text-slate-500">Principal sinal</p>
                    <p className="mt-1">{item.principalSinal}</p>
                  </div>

                  {item.extras && item.extras.length > 0 && (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                      {item.extras.map((extra) => (
                        <div key={`${item.id}-${extra.label}`} className="flex gap-2">
                          <span className="min-w-[86px] font-medium text-slate-500">{extra.label}:</span>
                          <span className="text-slate-700">{extra.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1">
                      <UserRound className="h-3 w-3" />
                      <span>{item.decisores} decisores</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      <span>{item.tempoSemAtualizacao}</span>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-600">
                    <span className="font-medium text-slate-700">Próxima ação:</span> {item.proximaAcao}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDossie?.(item)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Abrir dossiê
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onLinkedIn?.(item)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                    >
                      LinkedIn
                      <Globe className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCampanha?.(item)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Campanha
                      <BriefcaseBusiness className="h-3 w-3" />
                    </button>
                    <a
                      href={item.dossieId ? `/inteligencia/${item.dossieId}` : "#"}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-violet-50 px-2 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100"
                    >
                      Histórico
                      <History className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">Mudar estágio</label>
                    <select
                      value={item.estagio}
                      onChange={(event) => onStageChange?.(item, event.target.value as EtapaCarteira)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-blue-400"
                    >
                      {ETAPAS.map((etapa) => (
                        <option key={etapa.key} value={etapa.key}>{etapa.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
