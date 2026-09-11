"use client";

// ARQUIVO: app/inteligencia/dossies/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Kanban de Maturidade da Investigação — 5 colunas:
//   🔎 Investigação A | 🧠 Investigação B | 🎯 Investigação C
//   | 🟢 Pronto para Morgana | 🟣 Oportunidade Gerada
//
// Usa a função calcularNivelInvestigacao() de lib/inteligencia/maturidade.ts
// como ÚNICA fonte de verdade para exibição dos níveis.
//
// Histórico:
//   08/09/2026 — criado (kanban 6 colunas StatusDossie)
//   09/09/2026 — funil 5 colunas com labels comerciais (Morgana)
//   10/09/2026 — funil de maturidade da investigação (Fases 0–27)

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  NIVEL_CFG,
  NivelLabel,
  calcularNivelInvestigacao,
  statusParaNivel,
  THRESHOLDS,
} from "@/lib/inteligencia/maturidade";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StatusDossie =
  | "INVESTIGANDO"
  | "AGUARDANDO_VALIDACAO"
  | "EM_ANALISE"
  | "PEDIR_MAIS_PESQUISA"
  | "PRONTO_PARA_ASSUMIR"
  | "ASSUMIDO"
  | "ARQUIVADO";

type Dossie = {
  id: string;
  titulo: string;
  resumo?: string | null;
  status: StatusDossie;
  origem: string;
  segmento?: string | null;
  cidade?: string | null;
  estado?: string | null;
  clienteFinal?: string | null;
  construtora?: string | null;
  epc?: string | null;
  epcm?: string | null;
  licenciamento?: string | null;
  valorEstimado?: string | null;
  faseObra?: string | null;
  cronograma?: string | null;
  score: number;
  completude: number;
  maturidadeComercial: number;
  potencialVilla?: number | null;
  momentoVilla?: number | null;
  prontidao?: number | null;
  prioridadeJoao?: number | null;
  motivoPrioridade?: string | null;
  missaoAtual?: string | null;
  proximaAcaoSugerida?: string | null;
  prioridade?: string | null;
  totalDecisores: number;
  totalEmpresas: number;
  totalNoticias: number;
  totalAtualizacoes: number;
  updatedAt: string;
  createdAt: string;
  empresa?: { id: string; razaoSocial: string } | null;
};

// ─── Colunas do Kanban ────────────────────────────────────────────────────────

const COLUNAS_KANBAN: {
  nivel: NivelLabel;
  headerBg: string;
  headerText: string;
  colBorder: string;
}[] = [
  { nivel: "A",            headerBg: "bg-blue-50",    headerText: "text-blue-700",    colBorder: "border-blue-200"    },
  { nivel: "B",            headerBg: "bg-amber-50",   headerText: "text-amber-700",   colBorder: "border-amber-200"   },
  { nivel: "C",            headerBg: "bg-violet-50",  headerText: "text-violet-700",  colBorder: "border-violet-200"  },
  { nivel: "PRONTO",       headerBg: "bg-emerald-50", headerText: "text-emerald-700", colBorder: "border-emerald-200" },
  { nivel: "OPORTUNIDADE", headerBg: "bg-indigo-50",  headerText: "text-indigo-700",  colBorder: "border-indigo-200"  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasDesde(isoStr: string): number {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86_400_000);
}

function corScore(score: number): string {
  if (score >= 75) return "bg-red-100 text-red-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function corBarra(pct: number, tipo: "completude" | "maturidade"): string {
  if (tipo === "maturidade") {
    if (pct >= 70) return "bg-emerald-500";
    if (pct >= 40) return "bg-amber-500";
    return "bg-slate-300";
  }
  if (pct >= 70) return "bg-blue-500";
  if (pct >= 40) return "bg-blue-400";
  return "bg-slate-300";
}

/** Determina o nível visual de um dossiê usando a função central de maturidade */
function nivelDoDossie(d: Dossie): NivelLabel {
  // ASSUMIDO e ARQUIVADO não são reclassificados
  if (d.status === "ASSUMIDO")  return "OPORTUNIDADE";
  if (d.status === "ARQUIVADO") return "ARQUIVADO";

  // Usa calcularNivelInvestigacao para os demais (fonte única de verdade)
  const resultado = calcularNivelInvestigacao(
    {
      clienteFinal: d.clienteFinal,
      construtora: d.construtora,
      epc: d.epc,
      epcm: d.epcm,
      faseObra: d.faseObra,
      cronograma: d.cronograma,
      licenciamento: d.licenciamento,
      valorEstimado: d.valorEstimado,
      cidade: d.cidade,
      estado: d.estado,
      completude: d.completude,
      totalDecisores: d.totalDecisores,
      potencialVilla: d.potencialVilla,
      momentoVilla: d.momentoVilla,
      prontidao: d.prontidao,
    },
    [],
  );

  return resultado.nivel;
}

/** Gates faltantes para dossiês próximos de Pronto */
function gatesFaltantesDoDossie(d: Dossie): string[] {
  if (d.completude < THRESHOLDS.C) return [];
  const resultado = calcularNivelInvestigacao(
    {
      clienteFinal: d.clienteFinal,
      construtora: d.construtora,
      epc: d.epc,
      epcm: d.epcm,
      faseObra: d.faseObra,
      cronograma: d.cronograma,
      licenciamento: d.licenciamento,
      valorEstimado: d.valorEstimado,
      cidade: d.cidade,
      estado: d.estado,
      completude: d.completude,
      totalDecisores: d.totalDecisores,
      potencialVilla: d.potencialVilla,
    },
    [],
  );
  return resultado.gatesFaltantes;
}

/** Critérios para avançar ao próximo nível */
function criteriosParaProximo(d: Dossie): string[] {
  const resultado = calcularNivelInvestigacao(
    {
      clienteFinal: d.clienteFinal,
      construtora: d.construtora,
      epc: d.epc,
      epcm: d.epcm,
      faseObra: d.faseObra,
      cronograma: d.cronograma,
      licenciamento: d.licenciamento,
      valorEstimado: d.valorEstimado,
      cidade: d.cidade,
      estado: d.estado,
      completude: d.completude,
      totalDecisores: d.totalDecisores,
    },
    [],
  );
  return resultado.criteriosParaProximo;
}

// ─── Parser de pesquisa por intenção ─────────────────────────────────────────

const ESTADOS_BR: Record<string, string[]> = {
  SP: ["são paulo", "sao paulo"], MG: ["minas gerais"], RJ: ["rio de janeiro"],
  BA: ["bahia"], PE: ["pernambuco"], GO: ["goiás", "goias"], PA: ["pará", "para"],
  MT: ["mato grosso"], ES: ["espírito santo", "espirito santo"],
  RS: ["rio grande do sul"], PR: ["paraná", "parana"], SC: ["santa catarina"],
  AM: ["amazonas"], MS: ["mato grosso do sul"], CE: ["ceará", "ceara"],
};

function parsearBusca(rawQuery: string): (d: Dossie) => boolean {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return () => true;
  const intents: Array<(d: Dossie) => boolean> = [];

  // filtros por nível
  if (/\bnivel\s*a\b|investiga[cç][aã]o\s*a/.test(q)) intents.push(d => nivelDoDossie(d) === "A");
  if (/\bnivel\s*b\b|investiga[cç][aã]o\s*b/.test(q)) intents.push(d => nivelDoDossie(d) === "B");
  if (/\bnivel\s*c\b|investiga[cç][aã]o\s*c/.test(q)) intents.push(d => nivelDoDossie(d) === "C");
  if (/pront[ao]|morgana/.test(q))                     intents.push(d => nivelDoDossie(d) === "PRONTO");
  if (/oportunidade\s*gerada/.test(q))                 intents.push(d => nivelDoDossie(d) === "OPORTUNIDADE");

  // filtros por prioridade e qualidade
  if (/\balta\b|urgente/.test(q))   intents.push(d => d.prioridade === "ALTA");
  if (/quente/.test(q))             intents.push(d => d.score >= 75);
  if (/esquecid|parad[ao]/.test(q)) intents.push(d => diasDesde(d.updatedAt) > 15);
  if (/recente|hoje|atual/.test(q)) intents.push(d => diasDesde(d.updatedAt) === 0);
  if (/sem epc/.test(q))            intents.push(d => !d.epc && !d.epcm);
  if (/sem decisor/.test(q))        intents.push(d => d.totalDecisores === 0);
  if (/com decisor/.test(q))        intents.push(d => d.totalDecisores > 0);

  for (const [uf, palavras] of Object.entries(ESTADOS_BR)) {
    if (q === uf.toLowerCase() || palavras.some(p => q.includes(p))) {
      intents.push(d => (d.estado ?? "").toUpperCase() === uf);
      break;
    }
  }

  if (intents.length > 0) return (d: Dossie) => intents.every(fn => fn(d));

  return (d: Dossie) => {
    const text = [d.titulo, d.clienteFinal, d.empresa?.razaoSocial, d.resumo,
      d.cidade, d.estado, d.segmento, d.epc, d.epcm, d.construtora, d.missaoAtual,
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes(q);
  };
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function BarraDupla({ completude, maturidade }: { completude: number; maturidade: number }) {
  return (
    <div className="space-y-1 my-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-400 w-14 text-right shrink-0">Complet.</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", corBarra(completude, "completude"))} style={{ width: `${completude}%` }} />
        </div>
        <span className="text-[10px] font-medium text-blue-600 w-7 text-right shrink-0">{completude}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-400 w-14 text-right shrink-0">Maturid.</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", corBarra(maturidade, "maturidade"))} style={{ width: `${maturidade}%` }} />
        </div>
        <span className={cn("text-[10px] font-medium w-7 text-right shrink-0",
          maturidade >= 70 ? "text-emerald-600" : maturidade >= 40 ? "text-amber-600" : "text-slate-400"
        )}>{maturidade}%</span>
      </div>
    </div>
  );
}

function CardDossie({
  dossie,
  nivel,
  onClick,
  onGerarOportunidade,
}: {
  dossie: Dossie;
  nivel: NivelLabel;
  onClick: () => void;
  onGerarOportunidade?: () => void;
}) {
  const dias = diasDesde(dossie.updatedAt);
  const corBarra =
    nivel === "PRONTO"       ? "#10b981" :
    nivel === "OPORTUNIDADE" ? "#6366f1" :
    nivel === "C"            ? "#9333ea" :
    nivel === "B"            ? "#f59e0b" : "#3b82f6";

  return (
    <div
      onClick={onClick}
      className="cursor-pointer bg-white border border-slate-100 rounded-xl p-3 hover:shadow-md hover:border-indigo-200 transition-all group"
    >
      {/* Score + dias */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", corScore(dossie.score))}>
          {dossie.score}
        </span>
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
          <Clock className="h-2.5 w-2.5" />
          {dias === 0 ? "hoje" : `${dias}d`}
        </span>
      </div>

      {/* Título */}
      <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-indigo-700 transition-colors">
        {dossie.titulo}
      </p>

      {/* Localização */}
      {(dossie.cidade || dossie.estado) && (
        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mb-2">
          <MapPin className="h-2.5 w-2.5" />
          {[dossie.cidade, dossie.estado].filter(Boolean).join(" / ")}
          {dossie.segmento ? " · " + dossie.segmento : ""}
        </p>
      )}

      {/* Barras duplas */}
      <div className="space-y-1 my-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">Complet.</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all bg-blue-400" style={{ width: `${dossie.completude}%` }} />
          </div>
          <span className="text-[10px] font-medium text-blue-600 w-6 text-right shrink-0">{dossie.completude}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">Maturid.</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${dossie.maturidadeComercial ?? 0}%`, backgroundColor: corBarra }} />
          </div>
          <span className="text-[10px] font-medium w-6 text-right shrink-0" style={{ color: corBarra }}>{dossie.maturidadeComercial ?? 0}%</span>
        </div>
      </div>

      {/* Decisores */}
      {dossie.totalDecisores > 0 && (
        <p className="text-[10px] text-slate-400 mt-1.5">👤 {dossie.totalDecisores}</p>
      )}

      {/* Falta para Pronto — apenas gate count, sem bloco */}
      {nivel === "C" && gatesFaltantesDoDossie(dossie).length > 0 && (
        <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
          Falta para Pronto ({gatesFaltantesDoDossie(dossie).length})
        </p>
      )}

      {/* Botão Gerar Oportunidade */}
      {nivel === "PRONTO" && onGerarOportunidade && (
        <button
          onClick={e => { e.stopPropagation(); onGerarOportunidade(); }}
          className="w-full mt-2 text-[10px] py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 active:scale-95 transition-all"
        >
          🚀 Gerar Oportunidade →
        </button>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DossiesPage() {
  const router = useRouter();
  const [dossies, setDossies] = useState<Dossie[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const lastVisitRef = useRef<string | null>(null);

  async function gerarOportunidade(id: string) {
    try {
      const res = await fetch(`/api/inteligencia/${id}/assumir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar oportunidade");
      toast.success("Oportunidade gerada no pipeline comercial!");
      if (json.urlOportunidade) router.push(json.urlOportunidade);
      else carregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar oportunidade");
    }
  }

  async function carregar() {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (lastVisitRef.current) params.set("lastVisit", lastVisitRef.current);
      const res = await fetch(`/api/inteligencia/cockpit?${params}`);
      if (!res.ok) throw new Error("Erro ao carregar dossiês");
      const data = await res.json();
      setDossies(data.dossies ?? []);
    } catch {
      toast.error("Erro ao carregar Dossiês Comerciais");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    try {
      lastVisitRef.current = localStorage.getItem("inteligencia_last_visit");
    } catch { /* sem localStorage */ }
    carregar();
  }, []);

  const irPara = useCallback((id: string) => router.push(`/inteligencia/${id}`), [router]);

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto" />
          <p className="text-sm text-slate-400">Carregando dossiês…</p>
        </div>
      </div>
    );
  }

  const predicadoBusca = parsearBusca(busca);
  const dossiesFiltrados = dossies.filter(predicadoBusca);

  // Agrupa por nível (calculado no frontend, usando a mesma função central)
  const porNivel: Record<NivelLabel, Dossie[]> = {
    A: [], B: [], C: [], PRONTO: [], OPORTUNIDADE: [], ARQUIVADO: [],
  };
  for (const d of dossiesFiltrados) {
    const nivel = nivelDoDossie(d);
    porNivel[nivel].push(d);
  }

  // Total por coluna (do banco inteiro, não filtrado)
  const totalPorNivel: Record<NivelLabel, number> = {
    A: 0, B: 0, C: 0, PRONTO: 0, OPORTUNIDADE: 0, ARQUIVADO: 0,
  };
  for (const d of dossies) totalPorNivel[nivelDoDossie(d)]++;

  return (
    <div className="flex h-full flex-col bg-[#F4F6FA]">
      {/* Cabeçalho */}
      <header className="border-b border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-3 shrink-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E4FAB]">
            Maturidade da Investigação
          </p>
          <p className="text-sm text-slate-500">
            {dossies.length} dossiês · A≥{THRESHOLDS.B}% B · ≥{THRESHOLDS.C}% C · ≥{THRESHOLDS.PRONTO}%+gates Pronto
          </p>
        </div>
        <button
          onClick={carregar}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </header>

      {/* Barra de pesquisa */}
      <div className="border-b border-slate-200 bg-white px-5 py-2 flex gap-2 items-center shrink-0">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Ex: nível b · mineração · sem EPC · com decisor · PE · nível c · pronto..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>
        {totalPorNivel.OPORTUNIDADE > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg bg-indigo-50 border-indigo-100 text-indigo-600 shrink-0">
            🟣 {totalPorNivel.OPORTUNIDADE} oportunidade{totalPorNivel.OPORTUNIDADE !== 1 ? "s" : ""} gerada{totalPorNivel.OPORTUNIDADE !== 1 ? "s" : ""}
          </span>
        )}
        {busca && (
          <span className="text-[11px] text-slate-400 shrink-0">
            {dossiesFiltrados.length} resultado{dossiesFiltrados.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-3 p-4 min-w-max min-h-full items-start">
          {COLUNAS_KANBAN.map(col => {
            const cfg = NIVEL_CFG[col.nivel];
            const lista = porNivel[col.nivel];
            const totalGlobal = totalPorNivel[col.nivel];
            return (
              <div
                key={col.nivel}
                className={cn("flex flex-col w-52 shrink-0 rounded-xl border", col.colBorder)}
              >
                {/* Cabeçalho da coluna */}
                <div
                  title={cfg.descricao}
                  className={cn("px-3 py-2.5 rounded-t-xl flex items-center justify-between cursor-help", col.headerBg)}
                >
                  <span className={cn("text-xs font-bold", col.headerText)}>
                    {cfg.emoji} {cfg.label}
                  </span>
                  <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/60", col.headerText)}>
                    {busca ? `${lista.length}/` : ""}{totalGlobal}
                  </span>
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 flex-1">
                  {lista.map(d => (
                    <CardDossie
                      key={d.id}
                      dossie={d}
                      nivel={col.nivel}
                      onClick={() => irPara(d.id)}
                      onGerarOportunidade={col.nivel === "PRONTO" ? () => gerarOportunidade(d.id) : undefined}
                    />
                  ))}
                  {lista.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center py-4">Nenhuma aqui</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
