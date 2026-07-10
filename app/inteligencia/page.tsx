"use client";

// ARQUIVO: app/inteligencia/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Central de Inteligência Comercial — visão geral dos Dossiês do João Hunter IA.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Brain,
  ChevronDown,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  score: number;
  completude: number;
  missaoAtual?: string | null;
  prioridade?: string | null;
  totalDecisores: number;
  totalEmpresas: number;
  totalNoticias: number;
  totalAtualizacoes: number;
  updatedAt: string;
  empresa?: { id: string; razaoSocial: string } | null;
  _count?: { decisores: number; empresasRelacionadas: number; atualizacoes: number };
};

// ─── Configurações de status ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<StatusDossie, { label: string; cor: string; bg: string; icone: React.ReactNode }> = {
  INVESTIGANDO:         { label: "Investigando",        cor: "text-blue-700",    bg: "bg-blue-50 border-blue-200",     icone: <Search className="h-3 w-3" /> },
  AGUARDANDO_VALIDACAO: { label: "Aguard. Validação",   cor: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   icone: <Eye className="h-3 w-3" /> },
  EM_ANALISE:           { label: "Em Análise",          cor: "text-purple-700",  bg: "bg-purple-50 border-purple-200", icone: <Brain className="h-3 w-3" /> },
  PEDIR_MAIS_PESQUISA:  { label: "Mais Pesquisa",       cor: "text-orange-700",  bg: "bg-orange-50 border-orange-200", icone: <RefreshCw className="h-3 w-3" /> },
  PRONTO_PARA_ASSUMIR:  { label: "Pronto p/ Assumir",  cor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icone: <ShieldCheck className="h-3 w-3" /> },
  ASSUMIDO:             { label: "Assumido",            cor: "text-slate-500",   bg: "bg-slate-50 border-slate-200",   icone: <TrendingUp className="h-3 w-3" /> },
  ARQUIVADO:            { label: "Arquivado",           cor: "text-slate-400",   bg: "bg-slate-50 border-slate-100",   icone: <ChevronDown className="h-3 w-3" /> },
};

const COLUNAS_KANBAN: StatusDossie[] = [
  "INVESTIGANDO",
  "AGUARDANDO_VALIDACAO",
  "EM_ANALISE",
  "PEDIR_MAIS_PESQUISA",
  "PRONTO_PARA_ASSUMIR",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatHora(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function isHoje(isoStr: string): boolean {
  try {
    const d = new Date(isoStr);
    const hoje = new Date();
    return d.getFullYear() === hoje.getFullYear() &&
           d.getMonth() === hoje.getMonth() &&
           d.getDate() === hoje.getDate();
  } catch { return false; }
}

function corPonto(status: StatusDossie): string {
  const mapa: Partial<Record<StatusDossie, string>> = {
    PRONTO_PARA_ASSUMIR:  "bg-emerald-500",
    AGUARDANDO_VALIDACAO: "bg-amber-500",
    INVESTIGANDO:         "bg-blue-500",
    EM_ANALISE:           "bg-purple-500",
    PEDIR_MAIS_PESQUISA:  "bg-orange-500",
  };
  return mapa[status] ?? "bg-slate-400";
}

// ─── Barra de completude ──────────────────────────────────────────────────────

function BarraCompletude({ valor }: { valor: number }) {
  const cor =
    valor >= 80 ? "bg-emerald-500" :
    valor >= 60 ? "bg-amber-500" :
    valor >= 40 ? "bg-blue-500" : "bg-slate-300";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${valor}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-8 text-right">{valor}%</span>
    </div>
  );
}

// ─── Card do Dossiê ───────────────────────────────────────────────────────────

function CardDossie({ dossie, onClick }: { dossie: Dossie; onClick: () => void }) {
  const cfg = STATUS_CONFIG[dossie.status];
  const diasDesdeUpdate = Math.floor(
    (Date.now() - new Date(dossie.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer border hover:shadow-md transition-all group ${cfg.bg}`}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800 leading-tight group-hover:text-blue-700 line-clamp-2">
            {dossie.titulo}
          </p>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${cfg.cor} ${cfg.bg}`}>
            {dossie.score}
          </span>
        </div>

        {/* Empresa + Localização */}
        <div className="space-y-0.5">
          {(dossie.empresa?.razaoSocial || dossie.clienteFinal) && (
            <p className="text-xs text-slate-600 truncate">
              🏢 {dossie.empresa?.razaoSocial ?? dossie.clienteFinal}
            </p>
          )}
          {(dossie.cidade || dossie.estado) && (
            <p className="text-xs text-slate-500">
              📍 {[dossie.cidade, dossie.estado].filter(Boolean).join(" / ")}
            </p>
          )}
          {dossie.segmento && (
            <p className="text-xs text-slate-400">{dossie.segmento}</p>
          )}
        </div>

        {/* Completude */}
        <BarraCompletude valor={dossie.completude} />

        {/* Missão atual */}
        {dossie.missaoAtual && (
          <div className="bg-white/70 rounded px-2 py-1.5 border border-dashed border-slate-200">
            <p className="text-xs text-slate-500 font-medium mb-0.5">🎯 Missão atual</p>
            <p className="text-xs text-slate-700 line-clamp-2">{dossie.missaoAtual}</p>
          </div>
        )}

        {/* Contadores + data */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
          <div className="flex gap-2">
            {dossie.totalDecisores > 0 && <span>👤 {dossie.totalDecisores}</span>}
            {dossie.totalNoticias > 0   && <span>📰 {dossie.totalNoticias}</span>}
            {dossie.totalAtualizacoes > 0 && <span>🔄 {dossie.totalAtualizacoes}</span>}
          </div>
          <span>{diasDesdeUpdate === 0 ? "hoje" : `${diasDesdeUpdate}d atrás`}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Painel de novidades ──────────────────────────────────────────────────────

function PainelNovidades({ dossies }: { dossies: Dossie[] }) {
  const novidades = dossies
    .filter(d => isHoje(d.updatedAt))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const total = dossies.filter(d => d.status !== "ARQUIVADO").length;
  const assumidos = dossies.filter(d => d.status === "ASSUMIDO").length;
  const taxaMaturacao = total > 0 ? Math.round((assumidos / (total + assumidos)) * 100) : 0;

  return (
    <aside className="w-60 flex-shrink-0 border-l border-slate-200 flex flex-col overflow-hidden bg-white">
      {/* Novidades */}
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Novidades de hoje</p>
        </div>
        {novidades.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Nenhuma atualização hoje.</p>
        ) : (
          <div className="space-y-2.5">
            {novidades.map(d => (
              <div key={d.id} className="flex items-start gap-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${corPonto(d.status)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-700 line-clamp-2 leading-snug">{d.titulo}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatHora(d.updatedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resumo 30 dias */}
      <div className="p-3 flex-1">
        <div className="flex items-center gap-1.5 mb-2.5">
          <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Resumo inteligência</p>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <p className="text-xs text-slate-500">Taxa de maturação</p>
            <p className="text-xs font-semibold text-emerald-600">{taxaMaturacao}%</p>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <p className="text-xs text-slate-500">Dossiês ativos</p>
            <p className="text-xs font-semibold text-slate-800">{total}</p>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
            <p className="text-xs text-slate-500">Assumidos</p>
            <p className="text-xs font-semibold text-slate-800">{assumidos}</p>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <p className="text-xs text-slate-500">Tempo médio maturação</p>
            <p className="text-xs font-semibold text-slate-800">—</p>
          </div>
        </div>
        <a href="/inteligencia" className="block mt-3 text-[10px] text-blue-600 hover:underline text-right">
          Ver analytics completo →
        </a>
      </div>
    </aside>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CentralInteligenciaPage() {
  const router = useRouter();
  const [dossies, setDossies] = useState<Dossie[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [mostrarAssumidos, setMostrarAssumidos] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filtroStatus) params.set("status", filtroStatus);
      const res = await fetch(`/api/inteligencia?${params}`);
      if (!res.ok) throw new Error("Erro ao carregar");
      const data = await res.json();
      setDossies(data.dossies ?? []);
    } catch {
      toast.error("Erro ao carregar dossiês");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [filtroStatus]);

  const dossiesFiltrados = dossies.filter(d => {
    const texto = busca.toLowerCase();
    if (!texto) return true;
    return (
      d.titulo.toLowerCase().includes(texto) ||
      d.clienteFinal?.toLowerCase().includes(texto) ||
      d.empresa?.razaoSocial?.toLowerCase().includes(texto) ||
      d.cidade?.toLowerCase().includes(texto) ||
      d.estado?.toLowerCase().includes(texto) ||
      d.segmento?.toLowerCase().includes(texto)
    );
  });

  // KPIs
  const kpis = {
    total:        dossies.filter(d => d.status !== "ARQUIVADO").length,
    investigando: dossies.filter(d => d.status === "INVESTIGANDO").length,
    prontos:      dossies.filter(d => d.status === "PRONTO_PARA_ASSUMIR").length,
    novidades:    dossies.filter(d => isHoje(d.updatedAt)).length,
  };

  return (
    <>
      {/* ── Cabeçalho da Central ─────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Ícone */}
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Brain className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight tracking-tight">
              Centro de Inteligência Comercial
            </h1>
            <p className="text-[11px] text-indigo-600 font-medium">
              Departamento de Inteligência · Villa Empreendimentos
            </p>
            <p className="text-[11px] text-slate-500">
              João monitora o mercado. A Inteligência qualifica. O Comercial executa.
            </p>
          </div>
        </div>

        {/* João card + actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
            <div>
              <p className="text-xs font-medium text-slate-800">João Hunter IA</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] text-emerald-700 font-medium">Online · Ativo</p>
              </div>
            </div>
            <button className="text-[10px] text-indigo-600 font-medium pl-2 border-l border-indigo-200 flex items-center gap-0.5 hover:text-indigo-800 transition-colors">
              Ver atividade →
            </button>
          </div>
          <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Bell className="h-4 w-4 text-slate-500" />
            {kpis.novidades > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {Math.min(kpis.novidades, 9)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Corpo principal ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Área central */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Dossiês ativos",      valor: kpis.total,        icone: <Brain className="h-4 w-4 text-indigo-600" />,   bg: "bg-indigo-50 border-indigo-100" },
                { label: "Investigando",         valor: kpis.investigando, icone: <Search className="h-4 w-4 text-amber-600" />,   bg: "bg-amber-50 border-amber-100" },
                { label: "Prontos p/ assumir",   valor: kpis.prontos,      icone: <Zap className="h-4 w-4 text-emerald-600" />,    bg: "bg-emerald-50 border-emerald-100" },
                { label: "Novidades hoje",       valor: kpis.novidades,    icone: <Sparkles className="h-4 w-4 text-blue-600" />,  bg: "bg-blue-50 border-blue-100" },
              ].map(k => (
                <Card key={k.label} className={`${k.bg} border shadow-none`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {k.icone}
                    <div>
                      <p className="text-xl font-bold text-slate-800">{k.valor}</p>
                      <p className="text-xs text-slate-500">{k.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar dossiê, obra, empresa…"
                  className="pl-8 bg-white"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
              <select
                className="border rounded-md px-3 py-2 text-sm bg-white text-slate-700"
                value={filtroStatus}
                onChange={e => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos os segmentos</option>
                {(Object.keys(STATUS_CONFIG) as StatusDossie[]).map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
                <RefreshCw className={`h-4 w-4 mr-1 ${carregando ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMostrarAssumidos(!mostrarAssumidos)}
              >
                <Filter className="h-4 w-4 mr-1" />
                {mostrarAssumidos ? "Ocultar assumidos" : "Ver assumidos"}
              </Button>
            </div>

            {/* Título da seção kanban */}
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-700">Dossiês Comerciais por Status</p>
              <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{dossiesFiltrados.filter(d => d.status !== "ASSUMIDO" && d.status !== "ARQUIVADO").length} ativos</span>
            </div>

            {/* Kanban */}
            {carregando ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {COLUNAS_KANBAN.map(status => {
                    const cfg = STATUS_CONFIG[status];
                    const lista = dossiesFiltrados.filter(d => d.status === status);
                    return (
                      <div key={status} className="space-y-2">
                        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${cfg.bg}`}>
                          <span className={cfg.cor}>{cfg.icone}</span>
                          <span className={`text-xs font-semibold ${cfg.cor}`}>{cfg.label}</span>
                          <span className={`ml-auto text-xs font-bold ${cfg.cor}`}>{lista.length}</span>
                        </div>
                        <div className="space-y-2 min-h-16">
                          {lista.map(d => (
                            <CardDossie
                              key={d.id}
                              dossie={d}
                              onClick={() => router.push(`/inteligencia/${d.id}`)}
                            />
                          ))}
                          {lista.length === 0 && (
                            <div className="text-xs text-slate-400 text-center py-4">—</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Dossiês assumidos */}
                {mostrarAssumidos && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-500">Assumidos pelo comercial</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {dossiesFiltrados
                        .filter(d => d.status === "ASSUMIDO")
                        .map(d => (
                          <CardDossie
                            key={d.id}
                            dossie={d}
                            onClick={() => router.push(`/inteligencia/${d.id}`)}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Painel lateral direito — Novidades + Resumo */}
        <PainelNovidades dossies={dossies} />
      </div>
    </>
  );
}
