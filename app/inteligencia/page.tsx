"use client";

// ARQUIVO: app/inteligencia/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Cockpit Executivo — Central de Inteligência Comercial.
// Redesenhado para responder 4 perguntas em < 30 segundos:
//   1. O que mudou desde minha última visita?
//   2. Onde concentrar o tempo hoje?
//   3. O que João descobriu de importante?
//   4. Quais oportunidades estão ficando para trás?

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bot,
  Brain,
  Building2,
  ChevronDown,
  Clock,
  Eye,
  Factory,
  Flame,
  FolderOpen,
  FolderPlus,
  History,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
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
  _count?: { decisores: number; empresasRelacionadas: number; atualizacoes: number };
};

type FeedItem = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  agente: string;
  agenteLabel: string;
  dossieId: string;
  dossieTitulo: string;
  createdAt: string;
  categoria: string;
  icone: string;
  impacto: "alto" | "medio" | "baixo";
};

type Mudancas = {
  dossies: number;
  decisores: number;
  empresas: number;
  noticias: number;
  prontos: number;
  desde: string;
};

type Esquecida = {
  id: string;
  titulo: string;
  cidade?: string | null;
  estado?: string | null;
  segmento?: string | null;
  status: string;
  score: number;
  prioridade?: string | null;
  motivo: string;
  tipo: string;
  dias: number;
};

type JoaoStatus = {
  totalDossies: number;
  dossiesInvestigando: number;
  missaoAtual: string;
  dossieAtual?: { id: string; titulo: string } | null;
  progressoMissao?: number | null;
  descobertas24h: number;
  ultimaDescoberta?: { descricao: string; dossie: string; dossieId: string; quando: string } | null;
  proximaInvestigacao?: string | null;
};

type KpisInteligencia = {
  novosDossies: number;
  dossiesAtualizados: number;
  novosDecisores: number;
  novasEmpresas: number;
  descobertas: number;
};

type KpisAcao = {
  prontos: number;
  aguardandoVal: number;
  esquecidos: number;
  quentes: number;
  emRisco: number;
};

type CockpitData = {
  dossies: Dossie[];
  kpis: { inteligencia: KpisInteligencia; acao: KpisAcao };
  feed: FeedItem[];
  mudancas: Mudancas;
  esquecidas: Esquecida[];
  joao: JoaoStatus;
};

// ─── Configurações ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<StatusDossie, {
  label: string;
  textCor: string;
  bgBorder: string;
  icone: React.ReactNode;
}> = {
  INVESTIGANDO:         { label: "Investigando",       textCor: "text-blue-700",    bgBorder: "bg-blue-50 border-blue-200",     icone: <Search className="h-3 w-3" /> },
  AGUARDANDO_VALIDACAO: { label: "Aguard. Validação",  textCor: "text-amber-700",   bgBorder: "bg-amber-50 border-amber-200",   icone: <Eye className="h-3 w-3" /> },
  EM_ANALISE:           { label: "Em Análise",         textCor: "text-purple-700",  bgBorder: "bg-purple-50 border-purple-200", icone: <Brain className="h-3 w-3" /> },
  PEDIR_MAIS_PESQUISA:  { label: "Mais Pesquisa",      textCor: "text-orange-700",  bgBorder: "bg-orange-50 border-orange-200", icone: <RefreshCw className="h-3 w-3" /> },
  PRONTO_PARA_ASSUMIR:  { label: "Pronto p/ Assumir",  textCor: "text-emerald-700", bgBorder: "bg-emerald-50 border-emerald-200", icone: <ShieldCheck className="h-3 w-3" /> },
  ASSUMIDO:             { label: "Assumido",           textCor: "text-slate-500",   bgBorder: "bg-slate-50 border-slate-200",   icone: <TrendingUp className="h-3 w-3" /> },
  ARQUIVADO:            { label: "Arquivado",          textCor: "text-slate-400",   bgBorder: "bg-slate-50 border-slate-100",   icone: <ChevronDown className="h-3 w-3" /> },
};

const COLUNAS_KANBAN: StatusDossie[] = [
  "INVESTIGANDO",
  "AGUARDANDO_VALIDACAO",
  "EM_ANALISE",
  "PEDIR_MAIS_PESQUISA",
  "PRONTO_PARA_ASSUMIR",
  "ASSUMIDO",
];

const FEED_ICONE_MAP: Record<string, React.ReactNode> = {
  "user-check":          <UserCheck className="h-3.5 w-3.5" />,
  "building-factory-2":  <Factory className="h-3.5 w-3.5" />,
  "news":                <Newspaper className="h-3.5 w-3.5" />,
  "target":              <Target className="h-3.5 w-3.5" />,
  "building":            <Building2 className="h-3.5 w-3.5" />,
  "radar-2":             <Zap className="h-3.5 w-3.5" />,
  "folder-plus":         <FolderPlus className="h-3.5 w-3.5" />,
  "eye":                 <Eye className="h-3.5 w-3.5" />,
  "shield-check":        <ShieldCheck className="h-3.5 w-3.5" />,
  "refresh":             <RefreshCw className="h-3.5 w-3.5" />,
  "info-circle":         <Bell className="h-3.5 w-3.5" />,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasDesde(isoStr: string): number {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86_400_000);
}

function formatHorario(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function formatData(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const hoje = new Date();
    const ehHoje = d.toDateString() === hoje.toDateString();
    if (ehHoje) return `Hoje, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return `Ontem, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
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
// Arquitetura preparada para substituição futura por IA (Haiku/Sonnet).
// Cada intenção retorna um predicado (Dossie) => boolean.
// Múltiplas intenções detectadas são combinadas com AND.

const ESTADOS_BR: Record<string, string[]> = {
  SP: ["são paulo", "sao paulo"],
  MG: ["minas gerais"],
  RJ: ["rio de janeiro"],
  BA: ["bahia"],
  PE: ["pernambuco"],
  GO: ["goiás", "goias"],
  PA: ["pará", "para"],
  MT: ["mato grosso"],
  ES: ["espírito santo", "espirito santo"],
  RS: ["rio grande do sul"],
  PR: ["paraná", "parana"],
  SC: ["santa catarina"],
  AM: ["amazonas"],
  MS: ["mato grosso do sul"],
  CE: ["ceará", "ceara"],
  PI: ["piauí", "piaui"],
  MA: ["maranhão", "maranhao"],
  RO: ["rondônia", "rondonia"],
  AC: ["acre"],
  TO: ["tocantins"],
};

const SEGMENTOS_KW: Array<[string, string]> = [
  ["mineraç", "miner"],
  ["celulose", "celulose"],
  ["petroquím", "petroquím"],
  ["petro", "petro"],
  ["siderurgi", "siderurg"],
  ["industrial", "industrial"],
  ["data center", "data center"],
  ["energia", "energia"],
  ["aço", "aço"],
  ["papel", "papel"],
  ["alimentos", "alimentos"],
  ["fertili", "fertili"],
  ["químic", "químic"],
  ["farmacê", "farmacê"],
  ["automotiv", "automotiv"],
  ["logística", "logística"],
  ["porto", "porto"],
  ["aeroporto", "aeroporto"],
];

function parsearBusca(rawQuery: string): (d: Dossie) => boolean {
  const q = rawQuery.toLowerCase().trim();
  if (!q) return () => true;

  const intents: Array<(d: Dossie) => boolean> = [];

  // ── Status semântico ───────────────────────────────────────────────────────
  if (/pront[oa]|assumir/.test(q))
    intents.push(d => d.status === "PRONTO_PARA_ASSUMIR");
  if (/investigand/.test(q))
    intents.push(d => d.status === "INVESTIGANDO");
  if (/aguardand|validaç/.test(q))
    intents.push(d => d.status === "AGUARDANDO_VALIDACAO");
  if (/anális|analise/.test(q))
    intents.push(d => d.status === "EM_ANALISE");
  if (/mais pesquis/.test(q))
    intents.push(d => d.status === "PEDIR_MAIS_PESQUISA");

  // ── Prioridade e score ─────────────────────────────────────────────────────
  if (/\balta\b|urgente/.test(q))
    intents.push(d => d.prioridade === "ALTA");
  if (/quente/.test(q))
    intents.push(d => d.score >= 75);
  if (/fria|baixo.*score/.test(q))
    intents.push(d => d.score < 40);

  // ── Temporal ────────────────────────────────────────────────────────────────
  if (/esquecid|parad[ao]/.test(q))
    intents.push(d => diasDesde(d.updatedAt) > 15);
  if (/recente|hoje|atual/.test(q))
    intents.push(d => diasDesde(d.updatedAt) === 0);

  // ── Campos ausentes ─────────────────────────────────────────────────────────
  if (/sem epc/.test(q))
    intents.push(d => !d.epc && !d.epcm);
  if (/sem comprador|sem cliente final/.test(q))
    intents.push(d => !d.clienteFinal);
  if (/sem construtora/.test(q))
    intents.push(d => !d.construtora);
  if (/sem decisor/.test(q))
    intents.push(d => d.totalDecisores === 0);
  if (/com decisor/.test(q))
    intents.push(d => d.totalDecisores > 0);
  if (/sem valor/.test(q))
    intents.push(d => !d.valorEstimado);

  // ── Segmentos ────────────────────────────────────────────────────────────────
  for (const [kw, match] of SEGMENTOS_KW) {
    if (q.includes(kw)) {
      intents.push(d => (d.segmento ?? "").toLowerCase().includes(match));
    }
  }

  // ── Estados ──────────────────────────────────────────────────────────────────
  for (const [uf, palavras] of Object.entries(ESTADOS_BR)) {
    const ufLower = uf.toLowerCase();
    if (q === ufLower || palavras.some(p => q.includes(p)) || q.endsWith(` ${ufLower}`)) {
      intents.push(d => (d.estado ?? "").toUpperCase() === uf);
      break; // Evita múltiplos estados no mesmo intent
    }
  }

  // ── Valor estimado: "acima de 500 milhões" / "mais de 1 bilhão" ─────────────
  const matchValor = q.match(
    /(?:acima|mais|maior)\s+(?:de\s+)?r?\$?\s*(\d+(?:[.,]\d+)?)\s*(bilh[aã]o|bilhões|milh[aã]o|milh[oõ]es|mi|bi|k)?/i
  );
  if (matchValor) {
    let v = parseFloat(matchValor[1].replace(",", "."));
    const unid = (matchValor[2] ?? "").toLowerCase();
    if (/bilh|bi/.test(unid))  v *= 1_000_000_000;
    else if (/milh|mi/.test(unid)) v *= 1_000_000;
    else if (/k/.test(unid))   v *= 1_000;
    intents.push(d => {
      const n = parseFloat((d.valorEstimado ?? "0").replace(/[^0-9.]/g, ""));
      return !isNaN(n) && n >= v;
    });
  }

  // ── Se há intenções semânticas, combina com AND ───────────────────────────
  if (intents.length > 0) {
    return (d: Dossie) => intents.every(fn => fn(d));
  }

  // ── Fallback: busca textual ampla em múltiplos campos ────────────────────
  return (d: Dossie) => {
    const text = [
      d.titulo, d.clienteFinal, d.empresa?.razaoSocial, d.resumo,
      d.cidade, d.estado, d.segmento, d.epc, d.epcm, d.construtora,
      d.missaoAtual,
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes(q);
  };
}

/** Gera agenda de prioridade determinística a partir dos dados */
function gerarPrioridade(dossies: Dossie[]): Array<{
  n: number;
  obra: string;
  porque: string;
  acao: string;
  urgencia: "ALTA" | "MÉDIA";
}> {
  const resultados: Array<{ n: number; obra: string; porque: string; acao: string; urgencia: "ALTA" | "MÉDIA" }> = [];

  // 1. Prontos para assumir — ação imediata
  dossies
    .filter(d => d.status === "PRONTO_PARA_ASSUMIR")
    .forEach(d => {
      resultados.push({
        n: resultados.length + 1,
        obra: d.titulo,
        porque: `Dossiê aprovado pela Morgana com score ${d.score}/100. ${d.totalDecisores} decisores mapeados.${d.cidade ? ` Localização: ${d.cidade}/${d.estado}.` : ""}`,
        acao: d.proximaAcaoSugerida ?? "Iniciar contato comercial — propor visita ou reunião com os decisores mapeados.",
        urgencia: "ALTA",
      });
    });

  // 2. Alta prioridade travada há mais de 7 dias
  dossies
    .filter(d => d.prioridade === "ALTA" && diasDesde(d.updatedAt) > 7 && d.status !== "PRONTO_PARA_ASSUMIR")
    .sort((a, b) => diasDesde(b.updatedAt) - diasDesde(a.updatedAt))
    .forEach(d => {
      if (resultados.length >= 3) return;
      const dias = diasDesde(d.updatedAt);
      resultados.push({
        n: resultados.length + 1,
        obra: d.titulo,
        porque: `Dossiê de alta prioridade sem atualização há ${dias} dias. João pode precisar de nova missão.${d.missaoAtual ? ` Missão atual: "${d.missaoAtual}".` : ""}`,
        acao: "Solicitar nova missão ao João via CRM IA ('João, retome investigação da [obra] e busque [objetivo]').",
        urgencia: dias > 14 ? "ALTA" : "MÉDIA",
      });
    });

  // 3. Scores altos investigando — oportunidade em evolução
  dossies
    .filter(d => d.score >= 70 && d.status === "INVESTIGANDO" && !resultados.find(r => r.obra === d.titulo))
    .sort((a, b) => b.score - a.score)
    .forEach(d => {
      if (resultados.length >= 3) return;
      resultados.push({
        n: resultados.length + 1,
        obra: d.titulo,
        porque: `Score ${d.score}/100 com ${d.totalDecisores} decisores e ${d.totalNoticias} notícias. ${d.missaoAtual ? `João trabalhando em: "${d.missaoAtual}".` : "João monitorando."} `,
        acao: d.proximaAcaoSugerida ?? "Acompanhar evolução da investigação. Verificar se João precisa de novas instruções.",
        urgencia: "MÉDIA",
      });
    });

  return resultados.slice(0, 3);
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function BarraDupla({ completude, maturidade }: { completude: number; maturidade: number }) {
  return (
    <div className="space-y-1 my-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-400 w-14 text-right shrink-0">Complet.</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", corBarra(completude, "completude"))}
            style={{ width: `${completude}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-blue-600 w-7 text-right shrink-0">{completude}%</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-400 w-14 text-right shrink-0">Maturid.</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", corBarra(maturidade, "maturidade"))}
            style={{ width: `${maturidade}%` }}
          />
        </div>
        <span className={cn(
          "text-[10px] font-medium w-7 text-right shrink-0",
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
  const momentoVilla = typeof dossie.momentoVilla === "number" ? dossie.momentoVilla : null;
  const prontidao = typeof dossie.prontidao === "number" ? dossie.prontidao : null;
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

function KpiChip({
  icone, valor, label, cor, onClick,
}: {
  icone: React.ReactNode;
  valor: number;
  label: string;
  cor: "blue" | "green" | "red" | "amber" | "slate";
  onClick?: () => void;
}) {
  const estilos: Record<string, string> = {
    blue:  "bg-blue-50  border-blue-100  text-blue-700",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
    red:   "bg-red-50   border-red-100   text-red-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    slate: "bg-slate-50 border-slate-200 text-slate-600",
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        "border rounded-lg p-2 text-center transition-all",
        estilos[cor],
        onClick ? "cursor-pointer hover:shadow-sm hover:scale-[1.03] active:scale-100" : "cursor-default"
      )}
    >
      <div className="flex justify-center mb-1">{icone}</div>
      <p className={cn("text-lg font-semibold leading-none mb-0.5")}>{valor}</p>
      <p className="text-[9px] leading-tight">{label}</p>
    </div>
  );
}

function ItemFeed({ item, onClick }: { item: FeedItem; onClick: () => void }) {
  const impactoCor = {
    alto:  "bg-red-100 text-red-700",
    medio: "bg-amber-100 text-amber-700",
    baixo: "bg-slate-100 text-slate-500",
  }[item.impacto];

  return (
    <div
      className="py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 px-1 -mx-1 rounded transition-colors last:border-none"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-400">{formatData(item.createdAt)}</span>
        <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", impactoCor)}>
          {item.impacto === "alto" ? "Alto" : item.impacto === "medio" ? "Médio" : "Baixo"}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-slate-400">{FEED_ICONE_MAP[item.icone] ?? <Bell className="h-3.5 w-3.5" />}</span>
        <span className="text-[10px] font-semibold text-slate-700">{item.categoria}</span>
        <span className="text-[9px] text-slate-400">· {item.agenteLabel}</span>
      </div>
      <p className="text-[10px] text-slate-600 line-clamp-2 leading-snug mb-1">{item.titulo}</p>
      <p className="text-[10px] text-slate-400 truncate">{item.dossieTitulo}</p>
    </div>
  );
}

// ─── Painéis alternativos ─────────────────────────────────────────────────────

function PainelMudou({ mudancas, onVoltar }: { mudancas: Mudancas; onVoltar: () => void }) {
  const desde = mudancas.desde
    ? new Date(mudancas.desde).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "última visita";

  const itens = [
    { icone: <FolderPlus className="h-5 w-5" />, n: mudancas.dossies,   label: "Novos dossiês",          cor: "text-blue-600  bg-blue-50"   },
    { icone: <UserCheck  className="h-5 w-5" />, n: mudancas.decisores, label: "Novos decisores",         cor: "text-emerald-600 bg-emerald-50" },
    { icone: <Factory    className="h-5 w-5" />, n: mudancas.empresas,  label: "Novas empresas/EPCs",     cor: "text-blue-600  bg-blue-50"   },
    { icone: <Newspaper  className="h-5 w-5" />, n: mudancas.noticias,  label: "Novas notícias",          cor: "text-slate-500 bg-slate-100"  },
    { icone: <ShieldCheck className="h-5 w-5" />, n: mudancas.prontos,  label: "Dossiês prontos p/ assumir", cor: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-5">
        <History className="h-5 w-5 text-amber-600" />
        <div>
          <h2 className="text-sm font-semibold text-slate-800">O que mudou desde sua última visita</h2>
          <p className="text-xs text-slate-400">{desde}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {itens.map(it => (
          <div key={it.label} className={cn("rounded-xl p-4 flex items-center gap-3", it.cor.split(" ")[1])}>
            <span className={cn(it.cor.split(" ")[0])}>{it.icone}</span>
            <div>
              <p className={cn("text-2xl font-semibold leading-none", it.cor.split(" ")[0])}>
                {it.n > 0 ? `+${it.n}` : "—"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">{it.label}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onVoltar}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao cockpit
      </button>
    </div>
  );
}

function PainelPrioridade({ dossies, onVoltar }: { dossies: Dossie[]; onVoltar: () => void }) {
  const prioridades = gerarPrioridade(dossies);

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-1">
        <Target className="h-5 w-5 text-blue-600" />
        <h2 className="text-sm font-semibold text-slate-800">Minha prioridade hoje</h2>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        João analisou {dossies.length} dossiês e recomenda concentrar esforços em:
      </p>

      {prioridades.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Nenhum dossiê com ação prioritária identificada.</p>
      ) : (
        <div className="space-y-3">
          {prioridades.map(p => (
            <div key={p.n} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold shrink-0">
                  {p.n}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{p.obra}</p>
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      p.urgencia === "ALTA"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    )}>
                      {p.urgencia}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pl-10 space-y-2">
                <p className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-medium text-slate-700">Por quê: </span>{p.porque}
                </p>
                <p className="text-xs text-blue-600 font-medium">→ {p.acao}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onVoltar}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors mt-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao cockpit
      </button>
    </div>
  );
}

function PainelEsquecidas({ esquecidas, onVoltar, onDossie }: {
  esquecidas: Esquecida[];
  onVoltar: () => void;
  onDossie: (id: string) => void;
}) {
  const TIPO_CFG = {
    aguardando: { cor: "bg-purple-50 border-purple-200 text-purple-700", icone: <Eye className="h-4 w-4" /> },
    risco:      { cor: "bg-red-50 border-red-200 text-red-700",           icone: <AlertTriangle className="h-4 w-4" /> },
    parado:     { cor: "bg-amber-50 border-amber-200 text-amber-700",     icone: <Clock className="h-4 w-4" /> },
  };

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <h2 className="text-sm font-semibold text-slate-800">Oportunidades esquecidas</h2>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        {esquecidas.length} {esquecidas.length === 1 ? "dossiê em risco" : "dossiês em risco"} de perder a janela comercial
      </p>

      {esquecidas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Nenhuma oportunidade esquecida.</p>
      ) : (
        <div className="space-y-2.5">
          {esquecidas.map(e => {
            const cfg = TIPO_CFG[e.tipo as keyof typeof TIPO_CFG] ?? TIPO_CFG.parado;
            return (
              <div
                key={e.id}
                className={cn("border rounded-xl p-3.5 flex items-start gap-3 cursor-pointer hover:shadow-sm transition-all", cfg.cor)}
                onClick={() => onDossie(e.id)}
              >
                <span className="mt-0.5 shrink-0">{cfg.icone}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{e.titulo}</p>
                    <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded-full shrink-0">
                      Score {e.score}
                    </span>
                  </div>
                  {(e.cidade || e.segmento) && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {[e.cidade, e.estado].filter(Boolean).join("/")}
                      {e.segmento ? " · " + e.segmento : ""}
                    </p>
                  )}
                  <p className="text-[11px] font-medium mt-1">{e.motivo}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onVoltar}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors mt-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao cockpit
      </button>
    </div>
  );
}

function PainelListagem({
  titulo,
  subtitulo,
  dossies,
  onVoltar,
  onDossie,
  onAssumir,
}: {
  titulo: string;
  subtitulo: string;
  dossies: Dossie[];
  onVoltar: () => void;
  onDossie: (id: string) => void;
  onAssumir?: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={onVoltar}
          className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </button>
        <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
        <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
          {dossies.length}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4 ml-7">{subtitulo}</p>

      {dossies.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Nenhum dossiê nesta categoria.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {dossies.map(d => (
            <CardDossie
              key={d.id}
              dossie={d}
              onClick={() => onDossie(d.id)}
              onAssumir={onAssumir && d.status === "PRONTO_PARA_ASSUMIR" ? () => onAssumir(d.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type Painel = "cockpit" | "mudou" | "prioridade" | "esquecidas" | "listagem";

type ListagemKey =
  | "novos-dossies"
  | "atualizados"
  | "novos-decisores"
  | "novas-empresas"
  | "descobertas"
  | "prontos"
  | "esquecidos"
  | "quentes"
  | "em-risco"
  | "aguardando-val";

export default function CockpitPage() {
  const router = useRouter();
  const [dados, setDados] = useState<CockpitData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [painel, setPainel] = useState<Painel>("cockpit");
  const [listagemKey, setListagemKey] = useState<ListagemKey | null>(null);
  const [filtroImpacto, setFiltroImpacto] = useState<string>("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
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
      if (!res.ok) throw new Error("Erro ao carregar cockpit");
      const data = await res.json();
      setDados(data);
    } catch {
      toast.error("Erro ao carregar Central de Inteligência");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // Salva última visita no localStorage para calcular "o que mudou"
    try {
      lastVisitRef.current = localStorage.getItem("inteligencia_last_visit");
      localStorage.setItem("inteligencia_last_visit", new Date().toISOString());
    } catch { /* sem localStorage */ }
    carregar();
  }, []);

  const irPara = useCallback((id: string) => router.push(`/inteligencia/${id}`), [router]);

  // Helper: abre PainelListagem pela chave
  const abrirListagem = useCallback((key: ListagemKey) => {
    setListagemKey(key);
    setPainel("listagem");
  }, []);

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto" />
          <p className="text-sm text-slate-400">Carregando cockpit…</p>
        </div>
      </div>
    );
  }

  if (!dados) return null;

  const { dossies, kpis, feed, mudancas, esquecidas, joao } = dados;

  // Filtros — pesquisa inteligente por intenção
  const predicadoBusca = parsearBusca(busca);
  const dossiesFiltrados = dossies.filter(predicadoBusca);

  const feedFiltrado = feed.filter(f => {
    if (filtroImpacto && f.impacto !== filtroImpacto) return false;
    if (filtroCategoria && f.categoria !== filtroCategoria) return false;
    return true;
  });

  const categoriasFeeds = [...new Set(feed.map(f => f.categoria))];
  const totalMudancas = mudancas.dossies + mudancas.decisores + mudancas.empresas + mudancas.noticias + mudancas.prontos;

  return (
    <>
      {/* ── Cabeçalho / Topbar ───────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-slate-900 leading-tight">
            Centro de Inteligência Comercial
          </h1>
          <p className="text-[11px] text-slate-400">
            João monitora o mercado · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPainel(painel === "mudou" ? "cockpit" : "mudou")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              painel === "mudou"
                ? "bg-amber-100 border-amber-200 text-amber-800"
                : "bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100"
            )}
          >
            <History className="h-3.5 w-3.5" />
            O que mudou?
            {totalMudancas > 0 && (
              <span className="bg-amber-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-4 text-center">
                {totalMudancas}
              </span>
            )}
          </button>

          <button
            onClick={() => setPainel(painel === "esquecidas" ? "cockpit" : "esquecidas")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              painel === "esquecidas"
                ? "bg-red-100 border-red-200 text-red-800"
                : "bg-red-50 border-red-100 text-red-700 hover:bg-red-100"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Esquecidas
            {kpis.acao.esquecidos > 0 && (
              <span className="bg-red-600 text-white text-[9px] font-bold px-1 py-0.5 rounded-full min-w-4 text-center">
                {kpis.acao.esquecidos}
              </span>
            )}
          </button>

          <button
            onClick={() => setPainel(painel === "prioridade" ? "cockpit" : "prioridade")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              painel === "prioridade"
                ? "bg-blue-100 border-blue-200 text-blue-800"
                : "bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100"
            )}
          >
            <Target className="h-3.5 w-3.5" />
            Prioridade hoje
          </button>

          <button onClick={carregar} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Atualizar">
            <RefreshCw className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </header>

      {/* ── KPI Strip — 2 grupos ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 space-y-2 shrink-0">
        {/* Grupo 1: Inteligência */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <Brain className="h-3 w-3" /> Inteligência — produção das últimas 24h
          </p>
          <div className="grid grid-cols-5 gap-2">
            <KpiChip icone={<FolderPlus  className="h-3.5 w-3.5" />} valor={kpis.inteligencia.novosDossies}       label="Novos dossiês"    cor="blue"  onClick={() => abrirListagem("novos-dossies")} />
            <KpiChip icone={<RefreshCw   className="h-3.5 w-3.5" />} valor={kpis.inteligencia.dossiesAtualizados} label="Atualizados"       cor="blue"  onClick={() => abrirListagem("atualizados")} />
            <KpiChip icone={<UserPlus    className="h-3.5 w-3.5" />} valor={kpis.inteligencia.novosDecisores}      label="Novos decisores"  cor="blue"  onClick={() => abrirListagem("novos-decisores")} />
            <KpiChip icone={<Factory     className="h-3.5 w-3.5" />} valor={kpis.inteligencia.novasEmpresas}       label="Novas empresas"   cor="blue"  onClick={() => abrirListagem("novas-empresas")} />
            <KpiChip icone={<Sparkles    className="h-3.5 w-3.5" />} valor={kpis.inteligencia.descobertas}         label="Descobertas"      cor="blue"  onClick={() => abrirListagem("descobertas")} />
          </div>
        </div>
        {/* Grupo 2: Ação Comercial */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <Target className="h-3 w-3" /> Ação comercial — onde atuar
          </p>
          <div className="grid grid-cols-5 gap-2">
            <KpiChip icone={<ShieldCheck   className="h-3.5 w-3.5" />} valor={kpis.acao.prontos}       label="Prontos p/ Morgana"  cor="green" onClick={() => abrirListagem("prontos")} />
            <KpiChip icone={<Clock         className="h-3.5 w-3.5" />} valor={kpis.acao.esquecidos}    label="Esquecidos +15d"     cor="red"   onClick={() => abrirListagem("esquecidos")} />
            <KpiChip icone={<Flame         className="h-3.5 w-3.5" />} valor={kpis.acao.quentes}       label="Quentes"             cor="amber" onClick={() => abrirListagem("quentes")} />
            <KpiChip icone={<AlertTriangle className="h-3.5 w-3.5" />} valor={kpis.acao.emRisco}       label="Em risco"            cor="red"   onClick={() => abrirListagem("em-risco")} />
            <KpiChip icone={<Eye           className="h-3.5 w-3.5" />} valor={kpis.acao.aguardandoVal} label="Aguard. validação"   cor="slate" onClick={() => abrirListagem("aguardando-val")} />
          </div>
        </div>
      </div>

      {/* ── Corpo ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Painéis alternativos */}
        {painel === "mudou" && (
          <PainelMudou mudancas={mudancas} onVoltar={() => setPainel("cockpit")} />
        )}
        {painel === "prioridade" && (
          <PainelPrioridade dossies={dossies} onVoltar={() => setPainel("cockpit")} />
        )}
        {painel === "esquecidas" && (
          <PainelEsquecidas
            esquecidas={esquecidas}
            onVoltar={() => setPainel("cockpit")}
            onDossie={irPara}
          />
        )}
        {painel === "listagem" && listagemKey && (() => {
          const agora = Date.now();
          const h24 = agora - 24 * 60 * 60 * 1000;
          const LISTAGENS: Record<ListagemKey, { titulo: string; subtitulo: string; pred: (d: Dossie) => boolean }> = {
            "novos-dossies":    { titulo: "Novos dossiês — últimas 24h",             subtitulo: "Dossiês criados pelo João Hunter nas últimas 24 horas",                                pred: d => new Date(d.createdAt).getTime() >= h24 },
            "atualizados":      { titulo: "Dossiês atualizados — últimas 24h",       subtitulo: "Dossiês que receberam novas informações nas últimas 24h (excluindo os recém-criados)", pred: d => new Date(d.updatedAt).getTime() >= h24 && new Date(d.createdAt).getTime() < h24 },
            "novos-decisores":  { titulo: "Dossiês com novos decisores — 24h",       subtitulo: "Dossiês atualizados nas últimas 24h com decisores mapeados",                          pred: d => new Date(d.updatedAt).getTime() >= h24 && d.totalDecisores > 0 },
            "novas-empresas":   { titulo: "Dossiês com novas empresas — 24h",        subtitulo: "Dossiês atualizados nas últimas 24h com empresas/EPCs relacionadas",                  pred: d => new Date(d.updatedAt).getTime() >= h24 && d.totalEmpresas > 0 },
            "descobertas":      { titulo: "Descobertas recentes — 24h",              subtitulo: "Dossiês com atividade de descoberta nas últimas 24h",                                  pred: d => new Date(d.updatedAt).getTime() >= h24 && (d.totalDecisores > 0 || d.totalEmpresas > 0) },
            "prontos":          { titulo: "Prontos para assumir",                     subtitulo: "Dossiês aprovados aguardando contato comercial da Morgana",                            pred: d => d.status === "PRONTO_PARA_ASSUMIR" },
            "esquecidos":       { titulo: "Esquecidos — sem atualização há +15 dias", subtitulo: "Oportunidades em risco de perder a janela comercial",                                 pred: d => (agora - new Date(d.updatedAt).getTime()) / 86_400_000 > 15 },
            "quentes":          { titulo: "Dossiês quentes — score ≥ 75",             subtitulo: "Oportunidades de alto potencial identificadas pelo João Hunter",                       pred: d => d.score >= 75 },
            "em-risco":         { titulo: "Em risco — alta prioridade parada há +7 dias", subtitulo: "Dossiês prioritários sem atualização recente",                                    pred: d => d.prioridade === "ALTA" && (agora - new Date(d.updatedAt).getTime()) / 86_400_000 > 7 },
            "aguardando-val":   { titulo: "Aguardando validação",                    subtitulo: "Dossiês que precisam de revisão antes de ir para a Morgana",                           pred: d => d.status === "AGUARDANDO_VALIDACAO" },
          };
          const cfg = LISTAGENS[listagemKey];
          return (
            <PainelListagem
              titulo={cfg.titulo}
              subtitulo={cfg.subtitulo}
              dossies={dossies.filter(cfg.pred)}
              onVoltar={() => { setPainel("cockpit"); setListagemKey(null); }}
              onDossie={irPara}
              onAssumir={assumirDossie}
            />
          );
        })()}

        {/* Painel principal: Kanban + Feed */}
        {painel === "cockpit" && (
          <>
            {/* Kanban */}
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {/* Pesquisa inteligente */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ex: prontos · mineração · sem EPC · alta prioridade · MG · acima de 500 milhões..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                  />
                  {busca && (
                    <button
                      onClick={() => setBusca("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >✕</button>
                  )}
                </div>
                <button
                  onClick={() => setMostrarAssumidos(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors text-slate-500 shrink-0",
                    mostrarAssumidos
                      ? "bg-slate-100 border-slate-300 text-slate-700"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {mostrarAssumidos ? "Ocultar assumidos" : "Ver assumidos"}
                </button>
              </div>

              {/* Colunas Kanban */}
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

              {/* Assumidos */}
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

            {/* Feed de Inteligência — ocultado a pedido de Horacio (13/07/2026) */}
          </>
        )}
      </div>
    </>
  );
}
