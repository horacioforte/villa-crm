"use client";

// ARQUIVO: app/inteligencia/dossies/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Kanban operacional de Dossiês Comerciais do João.
// Restaurado do cockpit original conforme solicitação de Horácio (08/09/2026).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Brain,
  Building2,
  ChevronDown,
  Clock,
  Eye,
  Factory,
  FolderPlus,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

// ─── Configurações ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<StatusDossie, {
  label: string;
  textCor: string;
  bgBorder: string;
  icone: React.ReactNode;
}> = {
  INVESTIGANDO:         { label: "Investigando",       textCor: "text-blue-700",    bgBorder: "bg-blue-50 border-blue-200",       icone: <Search className="h-3 w-3" /> },
  AGUARDANDO_VALIDACAO: { label: "Aguard. Validação",  textCor: "text-amber-700",   bgBorder: "bg-amber-50 border-amber-200",     icone: <Eye className="h-3 w-3" /> },
  EM_ANALISE:           { label: "Em Análise",         textCor: "text-purple-700",  bgBorder: "bg-purple-50 border-purple-200",   icone: <Brain className="h-3 w-3" /> },
  PEDIR_MAIS_PESQUISA:  { label: "Mais Pesquisa",      textCor: "text-orange-700",  bgBorder: "bg-orange-50 border-orange-200",   icone: <RefreshCw className="h-3 w-3" /> },
  PRONTO_PARA_ASSUMIR:  { label: "Pronto p/ Assumir",  textCor: "text-emerald-700", bgBorder: "bg-emerald-50 border-emerald-200", icone: <ShieldCheck className="h-3 w-3" /> },
  ASSUMIDO:             { label: "Assumido",           textCor: "text-slate-500",   bgBorder: "bg-slate-50 border-slate-200",     icone: <TrendingUp className="h-3 w-3" /> },
  ARQUIVADO:            { label: "Arquivado",          textCor: "text-slate-400",   bgBorder: "bg-slate-50 border-slate-100",     icone: <ChevronDown className="h-3 w-3" /> },
};

const COLUNAS_KANBAN: StatusDossie[] = [
  "INVESTIGANDO",
  "AGUARDANDO_VALIDACAO",
  "EM_ANALISE",
  "PEDIR_MAIS_PESQUISA",
  "PRONTO_PARA_ASSUMIR",
  "ASSUMIDO",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasDesde(isoStr: string): number {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86_400_000);
}

function corScore(score: number): string {
  if (score >= 85) return "bg-red-500 text-white";
  if (score >= 70) return "bg-orange-500 text-white";
  if (score >= 50) return "bg-amber-400 text-white";
  return "bg-slate-300 text-slate-700";
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

  if (/pront[oa]|assumir/.test(q))    intents.push(d => d.status === "PRONTO_PARA_ASSUMIR");
  if (/investigand/.test(q))          intents.push(d => d.status === "INVESTIGANDO");
  if (/aguardand|validaç/.test(q))    intents.push(d => d.status === "AGUARDANDO_VALIDACAO");
  if (/anális|analise/.test(q))       intents.push(d => d.status === "EM_ANALISE");
  if (/mais pesquis/.test(q))         intents.push(d => d.status === "PEDIR_MAIS_PESQUISA");
  if (/\balta\b|urgente/.test(q))     intents.push(d => d.prioridade === "ALTA");
  if (/quente/.test(q))               intents.push(d => d.score >= 75);
  if (/esquecid|parad[ao]/.test(q))   intents.push(d => diasDesde(d.updatedAt) > 15);
  if (/recente|hoje|atual/.test(q))   intents.push(d => diasDesde(d.updatedAt) === 0);
  if (/sem epc/.test(q))              intents.push(d => !d.epc && !d.epcm);
  if (/sem decisor/.test(q))          intents.push(d => d.totalDecisores === 0);
  if (/com decisor/.test(q))          intents.push(d => d.totalDecisores > 0);

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

function CardDossie({ dossie, onClick, onAssumir }: { dossie: Dossie; onClick: () => void; onAssumir?: () => void }) {
  const cfg = STATUS_CFG[dossie.status];
  const dias = diasDesde(dossie.updatedAt);
  const maturidade = dossie.maturidadeComercial ?? 0;
  const parado = dias > 7;
  const potencialVilla = typeof dossie.potencialVilla === "number" ? dossie.potencialVilla : null;
  const momentoVilla  = typeof dossie.momentoVilla  === "number" ? dossie.momentoVilla  : null;
  const prontidao     = typeof dossie.prontidao     === "number" ? dossie.prontidao     : null;
  const prioridadeJoao = typeof dossie.prioridadeJoao === "number" ? dossie.prioridadeJoao : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer border rounded-lg p-2.5 hover:shadow-md transition-all group space-y-1",
        cfg.bgBorder,
        parado && "border-red-200 ring-1 ring-red-100"
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-xs font-semibold text-slate-800 leading-tight group-hover:text-blue-700 line-clamp-2">
          {dossie.titulo}
        </p>
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", corScore(dossie.score))}>
          {dossie.score}
        </span>
      </div>

      {(dossie.cidade || dossie.estado || dossie.segmento) && (
        <p className="text-[10px] text-slate-500 truncate">
          {[dossie.cidade, dossie.estado].filter(Boolean).join("/")}
          {dossie.segmento ? " · " + dossie.segmento : ""}
        </p>
      )}

      <BarraDupla completude={dossie.completude} maturidade={maturidade} />

      {(potencialVilla !== null || momentoVilla !== null || prontidao !== null || prioridadeJoao !== null) && (
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <div className="rounded bg-slate-100 px-1 py-0.5 text-center">
            <p className="text-[8px] text-slate-500">Pot.</p>
            <p className="text-[10px] font-bold text-slate-700">{potencialVilla ?? "—"}</p>
          </div>
          <div className="rounded bg-slate-100 px-1 py-0.5 text-center">
            <p className="text-[8px] text-slate-500">Mom.</p>
            <p className="text-[10px] font-bold text-slate-700">{momentoVilla ?? "—"}</p>
          </div>
          <div className="rounded bg-slate-100 px-1 py-0.5 text-center">
            <p className="text-[8px] text-slate-500">Pr.</p>
            <p className="text-[10px] font-bold text-slate-700">{prontidao ?? "—"}</p>
          </div>
          <div className="rounded bg-blue-100 px-1 py-0.5 text-center">
            <p className="text-[8px] text-blue-600">J</p>
            <p className="text-[10px] font-bold text-blue-700">{prioridadeJoao ?? "—"}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex gap-2">
          {dossie.totalDecisores > 0 && <span>👤 {dossie.totalDecisores}</span>}
          {dossie.totalNoticias   > 0 && <span>📰 {dossie.totalNoticias}</span>}
        </div>
        <span className={cn(parado ? "text-red-500 font-semibold" : "")}>
          {dias === 0 ? "hoje" : `${dias}d`}
        </span>
      </div>

      {dossie.missaoAtual && (
        <div className="bg-white/60 border border-dashed border-slate-200 rounded px-2 py-1 border-l-2 border-l-blue-400">
          <p className="text-[10px] text-slate-600 line-clamp-2">{dossie.missaoAtual}</p>
        </div>
      )}

      {parado && (
        <div className="bg-red-50 border border-red-100 rounded px-2 py-1">
          <p className="text-[10px] text-red-600 font-medium">Sem atualização há {dias} dias</p>
        </div>
      )}

      {dossie.status === "PRONTO_PARA_ASSUMIR" && onAssumir && (
        <button
          onClick={e => { e.stopPropagation(); onAssumir(); }}
          className="w-full text-[10px] py-1.5 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-95 transition-all"
        >
          Assumir dossiê →
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
  const [mostrarAssumidos, setMostrarAssumidos] = useState(false);
  const lastVisitRef = useRef<string | null>(null);

  async function assumirDossie(id: string) {
    try {
      const res = await fetch(`/api/inteligencia/${id}/assumir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao assumir dossiê");
      toast.success("Dossiê assumido! Oportunidade criada no pipeline comercial.");
      if (json.urlOportunidade) router.push(json.urlOportunidade);
      else carregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao assumir dossiê");
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

  return (
    <div className="flex h-full flex-col bg-[#F4F6FA]">
      {/* Cabeçalho */}
      <header className="border-b border-slate-200 bg-white px-5 py-3 flex items-center justify-between gap-3 shrink-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1E4FAB]">Dossiês Comerciais</p>
          <p className="text-sm text-slate-500">{dossies.length} dossiês monitorados pelo João</p>
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
            placeholder="Ex: prontos · mineração · sem EPC · alta prioridade · MG · acima de 500 milhões..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>
        <button
          onClick={() => setMostrarAssumidos(v => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors text-slate-500 shrink-0",
            mostrarAssumidos ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-white border-slate-200 hover:bg-slate-50"
          )}
        >
          {mostrarAssumidos ? "Ocultar assumidos" : "Ver assumidos"}
        </button>
        {busca && (
          <span className="text-[11px] text-slate-400 shrink-0">{dossiesFiltrados.length} resultado{dossiesFiltrados.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {COLUNAS_KANBAN.map(status => {
            const cfg = STATUS_CFG[status];
            const lista = dossiesFiltrados.filter(d => d.status === status);
            return (
              <div key={status}>
                <div className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg border mb-2", cfg.bgBorder)}>
                  <span className={cfg.textCor}>{cfg.icone}</span>
                  <span className={cn("text-[10px] font-semibold flex-1", cfg.textCor)}>{cfg.label}</span>
                  <span className={cn("text-[10px] font-bold", cfg.textCor)}>{lista.length}</span>
                </div>
                <div className="space-y-2 min-h-12">
                  {lista.map(d => (
                    <CardDossie
                      key={d.id}
                      dossie={d}
                      onClick={() => irPara(d.id)}
                      onAssumir={d.status === "PRONTO_PARA_ASSUMIR" ? () => assumirDossie(d.id) : undefined}
                    />
                  ))}
                  {lista.length === 0 && (
                    <p className="text-[10px] text-slate-300 text-center py-3">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Assumidos (colapsáveis) */}
        {mostrarAssumidos && (
          <div className="mt-2 space-y-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Assumidos</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {dossiesFiltrados
                .filter(d => d.status === "ASSUMIDO")
                .map(d => (
                  <CardDossie key={d.id} dossie={d} onClick={() => irPara(d.id)} />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
