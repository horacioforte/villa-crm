"use client";

// ARQUIVO: app/inteligencia/[id]/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Detalhe de um Dossiê Comercial — Centro de investigação João Hunter IA.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Target,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type StatusDossie =
  | "INVESTIGANDO" | "AGUARDANDO_VALIDACAO" | "EM_ANALISE"
  | "PEDIR_MAIS_PESQUISA" | "PRONTO_PARA_ASSUMIR" | "ASSUMIDO" | "ARQUIVADO";

type DecisorDossie = {
  id: string; nome: string; cargo?: string | null; empresa?: string | null;
  telefone?: string | null; email?: string | null; linkedin?: string | null;
  confianca: number;
};

type EmpresaDossie = {
  id: string; razaoSocial: string; papel: string;
  cidade?: string | null; estado?: string | null;
  site?: string | null; vinculadaCRM?: boolean;
};

type Atualizacao = {
  id: string; tipo: string; titulo: string; conteudo: string;
  fonte?: string | null; link?: string | null; agente?: string | null;
  createdAt: string;
};

type Dossie = {
  id: string; titulo: string; resumo?: string | null;
  status: StatusDossie; origem: string; tipo: string; segmento?: string | null;
  cidade?: string | null; estado?: string | null;
  clienteFinal?: string | null; construtora?: string | null;
  epc?: string | null; epcm?: string | null; consorcio?: string | null;
  faseObra?: string | null; cronograma?: string | null;
  licenciamento?: string | null; valorEstimado?: string | null;
  volumeConcreto?: string | null;
  equipamentosSugeridos?: string | null; campanhasSugerida?: string | null;
  proximaAcaoSugerida?: string | null; concorrentes?: string | null;
  fornecedores?: string | null; concreteiras?: string | null;
  fonteInformacao?: string | null; linkFonte?: string | null;
  score: number; completude: number; prioridade?: string | null;
  missaoAtual?: string | null;
  totalDecisores: number; totalEmpresas: number;
  totalNoticias: number; totalAtualizacoes: number;
  createdAt: string; updatedAt: string; ultimaAtividade?: string | null;
  empresa?: { id: string; razaoSocial: string } | null;
  obra?: { id: string; nome: string } | null;
  oportunidade?: { id: string; titulo: string; status: string } | null;
  assumidoPor?: { id: string; nome: string } | null;
  assumidaEm?: string | null;
  decisores: DecisorDossie[];
  empresasRelacionadas: EmpresaDossie[];
  atualizacoes: Atualizacao[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasDesde(dataISO: string): string {
  const diff = Math.floor((Date.now() - new Date(dataISO).getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "1 dia";
  return `${diff} dias`;
}

function formatarDataHora(dataISO: string): string {
  const d = new Date(dataISO);
  const hoje = new Date();
  const isHoje = d.toDateString() === hoje.toDateString();
  if (isHoje) return `Hoje ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function scoreParaStars(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 45) return 2;
  if (score >= 30) return 1;
  return 0;
}

const ORDEM_PAPEL: Record<string, number> = {
  CLIENTE_FINAL: 1, CONSTRUTORA: 2, EPC: 3, EPCM: 4,
  CONSORCIO: 5, CONCRETEIRA: 6, FORNECEDOR: 7, CONCORRENTE: 8,
};

const LABEL_PAPEL: Record<string, string> = {
  CLIENTE_FINAL: "Cliente Final", CONSTRUTORA: "Construtora",
  EPC: "EPC", EPCM: "EPCM", CONSORCIO: "Consórcio",
  CONCRETEIRA: "Concreteira", FORNECEDOR: "Fornecedor", CONCORRENTE: "Concorrente",
};

function nivelHierarquia(cargo?: string | null): number {
  if (!cargo) return 99;
  const c = cargo.toLowerCase();
  if (c.includes("presidente") || c.includes("ceo")) return 0;
  if (c.includes("diretor") && (c.includes("industrial") || c.includes("geral") || c.includes("operações"))) return 1;
  if (c.includes("diretor") && (c.includes("engenharia") || c.includes("obras"))) return 2;
  if (c.includes("diretor")) return 3;
  if (c.includes("gerente") && (c.includes("obras") || c.includes("engenharia"))) return 4;
  if (c.includes("gerente") && (c.includes("compras") || c.includes("suprimentos"))) return 5;
  if (c.includes("gerente")) return 6;
  if (c.includes("comprador") || (c.includes("coordenador") && c.includes("suprimentos"))) return 7;
  if (c.includes("coordenador") || c.includes("engenheiro")) return 8;
  return 10;
}

function equipamentosParaStars(texto: string): { nome: string; stars: number }[] {
  const t = texto.toLowerCase();
  const result: { nome: string; stars: number }[] = [];
  if (t.includes("central")) result.push({ nome: "Central de Concreto", stars: 5 });
  if (t.includes("lança") || t.includes("lanca")) result.push({ nome: "Bomba Lança", stars: 5 });
  else if (t.includes("estacionária") || t.includes("estacionaria")) result.push({ nome: "Bomba Estacionária", stars: 4 });
  else if (t.includes("bomba")) result.push({ nome: "Bomba de Concreto", stars: 4 });
  if (t.includes("betoneira") || t.includes("caminhão")) result.push({ nome: "Betoneira", stars: 3 });
  if (t.includes("telebelt")) result.push({ nome: "Telebelt", stars: 2 });
  return result;
}

function calcularProbabilidade(d: Dossie): { prob: number; motivadores: { texto: string; positivo: boolean }[] } {
  const motivadores: { texto: string; positivo: boolean }[] = [];
  let bonus = 0;
  if (d.score >= 90)  { motivadores.push({ texto: "Alta relevância comercial",             positivo: true  }); bonus += 5; }
  if (d.valorEstimado && Number(d.valorEstimado) > 1_000_000_000)
                       { motivadores.push({ texto: "Grande volume estimado",                 positivo: true  }); bonus += 5; }
  if (d.decisores.length > 0)
                       { motivadores.push({ texto: "Decisores identificados",               positivo: true  }); bonus += 8; }
  if (!d.construtora && !d.epc && !d.epcm)
                       { motivadores.push({ texto: "EPC não definido — janela aberta",      positivo: true  }); bonus += 3; }
  if (d.faseObra?.match(/licenciamento|planejamento|mobilização/i))
                       { motivadores.push({ texto: "Fase inicial — posicionamento antecipado", positivo: true }); bonus += 5; }
  if (!d.concorrentes) { motivadores.push({ texto: "Sem concorrentes registrados",          positivo: true  }); bonus += 4; }
  if (d.completude < 40)
                       { motivadores.push({ texto: "Investigação em andamento",             positivo: false }); }
  const base = Math.round(d.score * 0.6 + d.completude * 0.15 + bonus);
  return { prob: Math.min(94, Math.max(35, base)), motivadores };
}

function calcularChecklist(d: Dossie): { item: string; ok: boolean }[] {
  return [
    { item: "Construtora ou EPC identificado",    ok: !!(d.construtora || d.epc || d.epcm || d.consorcio) },
    { item: "Decisor de compras identificado",    ok: d.decisores.length > 0 },
    { item: "Volume de concreto estimado",        ok: !!d.volumeConcreto },
    { item: "Cronograma da obra confirmado",      ok: !!d.cronograma },
    { item: "Valor estimado da obra",             ok: !!d.valorEstimado },
    { item: "Telefone ou e-mail do decisor",      ok: d.decisores.some(dec => dec.telefone || dec.email) },
  ];
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Estrelas({ valor, max = 5, size = "sm" }: { valor: number; max?: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className={`${cls} ${i < valor ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`} />
      ))}
    </div>
  );
}

function BarraProgresso({ valor, cor }: { valor: number; cor?: string }) {
  const corFinal = cor ?? (valor >= 80 ? "#10b981" : valor >= 60 ? "#f59e0b" : valor >= 40 ? "#3b82f6" : "#94a3b8");
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, valor)}%`, backgroundColor: corFinal }} />
    </div>
  );
}

// ─── AnelCompletude mantido por regra (nunca remover) ────────────────────────

function AnelCompletude({ valor }: { valor: number }) {
  const r = 36; const circ = 2 * Math.PI * r;
  const cor = valor >= 80 ? "#10b981" : valor >= 60 ? "#f59e0b" : valor >= 40 ? "#3b82f6" : "#cbd5e1";
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={cor} strokeWidth="8"
          strokeDasharray={`${(valor / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-xl font-bold text-slate-800">{valor}%</p>
        <p className="text-xs text-slate-500">completo</p>
      </div>
    </div>
  );
}

// ─── Badge de tipo de atualização ─────────────────────────────────────────────

function BadgeTipoAtualizacao({ tipo }: { tipo: string }) {
  const cfg: Record<string, { label: string; class: string }> = {
    CRIACAO:                 { label: "Criação",      class: "bg-blue-100 text-blue-700" },
    CAMPO_ATUALIZADO:        { label: "Atualização",  class: "bg-slate-100 text-slate-600" },
    DECISOR_ENCONTRADO:      { label: "👤 Decisor",   class: "bg-purple-100 text-purple-700" },
    EMPRESA_ENCONTRADA:      { label: "🏢 Empresa",   class: "bg-amber-100 text-amber-700" },
    NOTICIA_ENCONTRADA:      { label: "📰 Notícia",   class: "bg-cyan-100 text-cyan-700" },
    MISSAO_CONCLUIDA:        { label: "✅ Missão",    class: "bg-emerald-100 text-emerald-700" },
    SOLICITACAO_PESQUISA:    { label: "🔍 Pesquisa", class: "bg-orange-100 text-orange-700" },
    ANALISE_MORGANA:         { label: "🧠 Morgana",  class: "bg-violet-100 text-violet-700" },
    ASSUMIDO_PELO_COMERCIAL: { label: "🎯 Assumido", class: "bg-emerald-100 text-emerald-800" },
    MONITORAMENTO:           { label: "📡 Monitor",  class: "bg-blue-100 text-blue-600" },
  };
  const c = cfg[tipo] ?? { label: tipo, class: "bg-slate-100 text-slate-600" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.class}`}>{c.label}</span>;
}

// ─── Aba ─────────────────────────────────────────────────────────────────────

type Aba = "resumo" | "decisores" | "empresas" | "timeline" | "inteligencia" | "investigacoes";

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DossieDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [dossie,          setDossie]          = useState<Dossie | null>(null);
  const [carregando,      setCarregando]      = useState(true);
  const [abaAtiva,        setAbaAtiva]        = useState<Aba>("resumo");
  const [assumindo,       setAssumindo]       = useState(false);
  const [descartando,     setDescartando]     = useState(false);
  const [motivoDescarte,  setMotivoDescarte]  = useState("");
  const [mostrarDescarte, setMostrarDescarte] = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const res = await fetch(`/api/inteligencia/${id}`);
      if (!res.ok) throw new Error();
      setDossie(await res.json());
    } catch {
      toast.error("Erro ao carregar dossiê");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [id]);

  async function assumir() {
    if (!confirm("Confirma assumir este dossiê? Será criada uma oportunidade no pipeline comercial.")) return;
    setAssumindo(true);
    try {
      const res = await fetch(`/api/inteligencia/${id}/assumir`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      toast.success("Oportunidade criada no pipeline!");
      router.push(data.urlOportunidade);
    } catch (e) { toast.error(String(e)); }
    finally { setAssumindo(false); }
  }

  async function descartar() {
    if (!motivoDescarte.trim()) { toast.error("Informe o motivo"); return; }
    setDescartando(true);
    try {
      const res = await fetch(`/api/inteligencia/${id}/descartar`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivoDescarte }),
      });
      if (!res.ok) throw new Error("Erro ao arquivar");
      toast.success("Dossiê arquivado");
      router.push("/inteligencia");
    } catch (e) { toast.error(String(e)); }
    finally { setDescartando(false); }
  }

  async function pedirMaisPesquisa() {
    const instrucao = prompt("Instrução de pesquisa para o João:", dossie?.missaoAtual ?? "");
    if (instrucao === null) return;
    const res = await fetch(`/api/inteligencia/${id}/pesquisar`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrucao }),
    });
    if (res.ok) { toast.success("Solicitação registrada. Tarefa criada para o João."); carregar(); }
    else toast.error("Erro ao solicitar pesquisa");
  }

  // ── Loading / not found ──
  if (carregando) {
    return <div className="flex items-center justify-center flex-1 h-full"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }
  if (!dossie) {
    return <div className="p-8 text-center text-slate-500">Dossiê não encontrado.</div>;
  }

  // ── Derivações ──
  const jaAssumido       = dossie.status === "ASSUMIDO";
  const arquivado        = dossie.status === "ARQUIVADO";
  const podeAssumirAgora = dossie.completude >= 80;

  const { prob: probVenda, motivadores: motivVenda } = calcularProbabilidade(dossie);
  const checklist    = calcularChecklist(dossie);
  const checklistOk  = checklist.filter(c => c.ok).length;
  const equipStars   = dossie.equipamentosSugeridos ? equipamentosParaStars(dossie.equipamentosSugeridos) : [];

  const decisoresOrdenados = [...dossie.decisores].sort(
    (a, b) => nivelHierarquia(a.cargo) - nivelHierarquia(b.cargo)
  );
  const empresasOrdenadas = [...dossie.empresasRelacionadas].sort(
    (a, b) => (ORDEM_PAPEL[a.papel] ?? 99) - (ORDEM_PAPEL[b.papel] ?? 99)
  );

  // Agrupar timeline por data
  const timelineAgrupada: Record<string, Atualizacao[]> = {};
  for (const a of dossie.atualizacoes) {
    const dia = new Date(a.createdAt).toLocaleDateString("pt-BR");
    (timelineAgrupada[dia] ??= []).push(a);
  }

  // Fatos confirmados para aba Inteligência
  const fatosConfirmados: string[] = [];
  if (dossie.clienteFinal)  fatosConfirmados.push(`Cliente confirmado: ${dossie.clienteFinal}`);
  if (dossie.valorEstimado) fatosConfirmados.push(`Valor estimado: R$ ${Number(dossie.valorEstimado).toLocaleString("pt-BR")}`);
  if (dossie.faseObra)      fatosConfirmados.push(`Fase da obra: ${dossie.faseObra}`);
  if (dossie.cronograma)    fatosConfirmados.push(`Cronograma: ${dossie.cronograma}`);
  if (dossie.construtora)   fatosConfirmados.push(`Construtora: ${dossie.construtora}`);
  if (dossie.epc)           fatosConfirmados.push(`EPC: ${dossie.epc}`);
  if (dossie.volumeConcreto) fatosConfirmados.push(`Volume de concreto: ${dossie.volumeConcreto} m³`);
  for (const a of dossie.atualizacoes.filter(a => ["DECISOR_ENCONTRADO","EMPRESA_ENCONTRADA","MISSAO_CONCLUIDA"].includes(a.tipo))) {
    fatosConfirmados.push(a.titulo);
  }

  const hipoteses = dossie.atualizacoes.filter(a => a.tipo === "NOTICIA_ENCONTRADA").slice(0, 5);

  // ── Render ──
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50">

      {/* ── Cabeçalho ── */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => router.push("/inteligencia")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600 shrink-0" />
            <h1 className="text-sm font-bold text-slate-800 truncate">{dossie.titulo}</h1>
          </div>
          <p className="text-xs text-slate-500">
            {dossie.segmento ?? dossie.tipo}{dossie.cidade && ` · ${dossie.cidade}/${dossie.estado}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={carregar}>
          <RefreshCw className="h-4 w-4 text-slate-400" />
        </Button>
      </div>

      {/* ── Painel Executivo ── */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex divide-x min-w-max">

          {/* Score */}
          <div className="w-36 px-5 py-4 space-y-1.5 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score</p>
            <p className="text-5xl font-black text-slate-900 leading-none">{dossie.score}</p>
            <Estrelas valor={scoreParaStars(dossie.score)} size="md" />
          </div>

          {/* Completude */}
          <div className="w-48 px-5 py-4 space-y-2 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completude</p>
            <p className="text-4xl font-black text-slate-900 leading-none">
              {dossie.completude}<span className="text-xl font-normal text-slate-400">%</span>
            </p>
            <BarraProgresso valor={dossie.completude} />
          </div>

          {/* Tempo de investigação */}
          <div className="w-40 px-5 py-4 space-y-1.5 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Investigação</p>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" />
              <p className="text-2xl font-bold text-slate-800">{diasDesde(dossie.createdAt)}</p>
            </div>
          </div>

          {/* Última atualização */}
          <div className="w-48 px-5 py-4 space-y-1.5 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Última Atualização</p>
            <p className="text-sm font-semibold text-slate-700 leading-snug">
              {formatarDataHora(dossie.ultimaAtividade ?? dossie.updatedAt)}
            </p>
          </div>

          {/* Status */}
          <div className="w-40 px-5 py-4 space-y-2 shrink-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
            <div className="flex flex-col gap-1.5">
              <Badge variant="outline" className="text-xs w-fit">{dossie.status.replace(/_/g, " ")}</Badge>
              {dossie.prioridade && (
                <Badge variant="outline" className={`text-xs w-fit ${
                  dossie.prioridade === "URGENTE" ? "border-red-400 text-red-700 bg-red-50" :
                  dossie.prioridade === "ALTA"    ? "border-orange-300 text-orange-700 bg-orange-50" :
                  "border-amber-300 text-amber-700 bg-amber-50"
                }`}>{dossie.prioridade}</Badge>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Missão do João ── */}
      {dossie.missaoAtual && !jaAssumido && !arquivado && (
        <div className="bg-blue-950 px-5 py-3.5">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Missão Atual</p>
              <p className="text-sm font-semibold text-white leading-snug">{dossie.missaoAtual}</p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-blue-400">🔄 Em andamento</span>
                <span className="text-blue-800 text-xs">·</span>
                <span className="text-xs text-blue-400">
                  {dossie.prioridade === "URGENTE" ? "🔴 Urgente" :
                   dossie.prioridade === "ALTA"    ? "🟠 Alta prioridade" :
                                                    "🟡 Prioridade média"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assumido ── */}
      {jaAssumido && dossie.oportunidade && (
        <div className="bg-emerald-600 px-5 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-100 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-100 uppercase tracking-wide">Assumido pelo Comercial</p>
              <button
                onClick={() => router.push(`/oportunidades/${dossie.oportunidade!.id}`)}
                className="text-sm font-semibold text-white hover:underline flex items-center gap-1"
              >
                {dossie.oportunidade.titulo} <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ações ── */}
      {!jaAssumido && !arquivado && (
        <div className="bg-white border-b px-4 py-3 space-y-2">

          {/* Botão Assumir — inteligente */}
          {podeAssumirAgora ? (
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-sm font-bold" onClick={assumir} disabled={assumindo}>
              {assumindo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              🟢 Assumir Oportunidade
            </Button>
          ) : (
            <div className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              <div>
                <p className="text-xs font-bold text-slate-500">João ainda está investigando este dossiê</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Precisa de 80% de completude para assumir · Atual: <span className="font-semibold text-slate-600">{dossie.completude}%</span>
                </p>
              </div>
            </div>
          )}

          {/* Ações secundárias */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-sm" onClick={pedirMaisPesquisa}>
              <Search className="h-4 w-4 mr-1.5" /> Mais Pesquisa
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => setMostrarDescarte(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Descarte */}
          {mostrarDescarte && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
              <p className="text-xs font-bold text-red-700">Motivo do arquivamento (obrigatório)</p>
              <Textarea rows={2} placeholder="Ex: Obra cancelada, fora do perfil, cliente inativo…"
                value={motivoDescarte} onChange={e => setMotivoDescarte(e.target.value)} className="text-sm" />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={descartar} disabled={descartando}>
                  {descartando && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Arquivar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMostrarDescarte(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Abas ── */}
      <div className="bg-white border-b px-4 sticky top-[57px] z-10">
        <div className="flex overflow-x-auto">
          {([
            ["resumo",         "Resumo Executivo"],
            ["decisores",      `Decisores (${dossie.decisores.length})`],
            ["empresas",       `Empresas (${dossie.empresasRelacionadas.length})`],
            ["timeline",       "Timeline"],
            ["inteligencia",   "Inteligência"],
            ["investigacoes",  "🤖 Investigações"],
          ] as [Aba, string][]).map(([aba, label]) => (
            <button key={aba} onClick={() => setAbaAtiva(aba)}
              className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0 ${
                abaAtiva === aba
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-auto p-4">

        {/* ─────────────────────────────── RESUMO EXECUTIVO ─── */}
        {abaAtiva === "resumo" && (
          <div className="space-y-3 max-w-2xl">

            {dossie.resumo && (
              <Card>
                <CardContent className="p-4 text-sm text-slate-700 leading-relaxed">{dossie.resumo}</CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-xs text-slate-400 font-bold uppercase tracking-widest">Dados da Obra</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {([
                  ["Cliente Final",  dossie.clienteFinal],
                  ["Fase da Obra",   dossie.faseObra],
                  ["Valor Estimado", dossie.valorEstimado ? `R$ ${Number(dossie.valorEstimado).toLocaleString("pt-BR")}` : null],
                  ["Segmento",       dossie.segmento],
                  ["Cidade/UF",      dossie.cidade ? `${dossie.cidade}/${dossie.estado}` : null],
                  ["Construtora",    dossie.construtora],
                  ["EPC",            dossie.epc],
                  ["EPCM",           dossie.epcm],
                  ["Consórcio",      dossie.consorcio],
                  ["Vol. Concreto",  dossie.volumeConcreto ? `${dossie.volumeConcreto} m³` : null],
                  ["Cronograma",     dossie.cronograma],
                  ["Licenciamento",  dossie.licenciamento],
                ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-xs text-slate-400">{l as string}</p>
                    <p className="text-slate-800 font-semibold">{v as string}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Equipamentos Villa */}
            {(equipStars.length > 0 || dossie.equipamentosSugeridos) && (
              <Card>
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-xs text-slate-400 font-bold uppercase tracking-widest">Equipamentos Villa</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-2 space-y-2.5">
                  {equipStars.length > 0
                    ? equipStars.map(e => (
                        <div key={e.nome} className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{e.nome}</p>
                          <Estrelas valor={e.stars} size="md" />
                        </div>
                      ))
                    : <p className="text-sm text-slate-700">{dossie.equipamentosSugeridos}</p>
                  }
                </CardContent>
              </Card>
            )}

            {/* Campanha */}
            {dossie.campanhasSugerida && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Campanha Recomendada</p>
                  <p className="text-xl font-black text-blue-900">{dossie.campanhasSugerida}</p>
                  {dossie.proximaAcaoSugerida && (
                    <p className="text-sm text-blue-700 mt-1">{dossie.proximaAcaoSugerida}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Concorrentes / fornecedores */}
            {(dossie.concorrentes || dossie.fornecedores || dossie.concreteiras) && (
              <Card>
                <CardContent className="p-3 space-y-2 text-sm">
                  {dossie.concorrentes  && <div><p className="text-xs text-slate-400">Concorrentes</p><p className="text-slate-700">{dossie.concorrentes}</p></div>}
                  {dossie.fornecedores  && <div><p className="text-xs text-slate-400">Fornecedores</p><p className="text-slate-700">{dossie.fornecedores}</p></div>}
                  {dossie.concreteiras  && <div><p className="text-xs text-slate-400">Concreteiras</p><p className="text-slate-700">{dossie.concreteiras}</p></div>}
                </CardContent>
              </Card>
            )}

            {/* Fonte */}
            {dossie.fonteInformacao && (
              <Card>
                <CardContent className="p-3 text-sm">
                  <p className="text-xs text-slate-400 mb-1">Fonte</p>
                  <p className="text-slate-700">{dossie.fonteInformacao}</p>
                  {dossie.linkFonte && (
                    <a href={dossie.linkFonte} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      Ver fonte <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────── DECISORES ─── */}
        {abaAtiva === "decisores" && (
          <div className="max-w-lg">
            {decisoresOrdenados.length === 0 ? (
              <div className="text-center py-14">
                <User className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400">Nenhum decisor identificado ainda.</p>
                <p className="text-xs text-slate-300 mt-1">João está investigando os contatos da obra.</p>
              </div>
            ) : (
              <div>
                {decisoresOrdenados.map((d, i) => (
                  <div key={d.id} className="flex">
                    {/* Árvore lateral */}
                    <div className="flex flex-col items-center w-8 shrink-0 pt-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        i === 0 ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
                      }`}>
                        <User className={`h-3 w-3 ${i === 0 ? "text-white" : "text-slate-400"}`} />
                      </div>
                      {i < decisoresOrdenados.length - 1 && (
                        <div className="w-px flex-1 bg-slate-200 mt-1" />
                      )}
                    </div>

                    {/* Card do decisor */}
                    <div className={`flex-1 ml-3 ${i < decisoresOrdenados.length - 1 ? "mb-2 pb-2" : "mb-0"}`}>
                      <Card className={i === 0 ? "border-blue-200 bg-blue-50/30" : ""}>
                        <CardContent className="p-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-800">{d.nome}</p>
                              {d.cargo   && <p className="text-xs font-semibold text-blue-700">{d.cargo}</p>}
                              {d.empresa && <p className="text-xs text-slate-400">{d.empresa}</p>}
                            </div>
                            <span className="text-xs text-slate-300 shrink-0">{d.confianca}% conf.</span>
                          </div>
                          {(d.telefone || d.email || d.linkedin) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5 border-t border-slate-100">
                              {d.telefone && <span className="text-xs text-slate-600">📱 {d.telefone}</span>}
                              {d.email    && <span className="text-xs text-slate-600">📧 {d.email}</span>}
                              {d.linkedin && (
                                <a href={d.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                  🔗 LinkedIn
                                </a>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────── EMPRESAS ─── */}
        {abaAtiva === "empresas" && (
          <div className="max-w-sm">
            {empresasOrdenadas.length === 0 ? (
              <div className="text-center py-14">
                <Building2 className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-400">Nenhuma empresa relacionada ainda.</p>
                <p className="text-xs text-slate-300 mt-1">João está mapeando a cadeia da obra.</p>
              </div>
            ) : (
              <div className="flex flex-col items-stretch">
                {empresasOrdenadas.map((e, i) => (
                  <div key={e.id} className="flex flex-col items-center">
                    <Card className="w-full">
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-800 truncate">{e.razaoSocial}</p>
                            {e.vinculadaCRM && <span className="text-xs text-emerald-600 shrink-0">✓ CRM</span>}
                          </div>
                          <span className="inline-block text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded mt-0.5">
                            {LABEL_PAPEL[e.papel] ?? e.papel}
                          </span>
                          {(e.cidade || e.estado) && (
                            <p className="text-xs text-slate-400 mt-0.5">{[e.cidade, e.estado].filter(Boolean).join("/")}</p>
                          )}
                          {e.site && (
                            <a href={e.site} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block mt-0.5">{e.site}</a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    {i < empresasOrdenadas.length - 1 && (
                      <div className="flex flex-col items-center py-0.5">
                        <div className="w-px h-3 bg-slate-300" />
                        <ChevronDown className="h-3 w-3 text-slate-400 -mt-0.5" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Villa sempre ao final */}
                <div className="flex flex-col items-center py-0.5">
                  <div className="w-px h-3 bg-slate-300" />
                  <ChevronDown className="h-3 w-3 text-slate-400 -mt-0.5" />
                </div>
                <Card className="w-full border-2 border-blue-500 bg-blue-50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-blue-900">Villa Empreendimentos</p>
                      <p className="text-xs font-medium text-blue-600">Locação de equipamentos para concreto</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────── TIMELINE ─── */}
        {abaAtiva === "timeline" && (
          <div className="space-y-6 max-w-2xl">
            {dossie.atualizacoes.length === 0 && (
              <div className="text-center py-14">
                <Clock className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Nenhuma atualização ainda.</p>
              </div>
            )}
            {Object.entries(timelineAgrupada).map(([dia, items]) => (
              <div key={dia}>
                {/* Separador de data */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{dia}</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div>
                  {items.map((a, i) => (
                    <div key={a.id} className="flex gap-3">
                      {/* Linha de tempo */}
                      <div className="flex flex-col items-center w-4 shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                          a.tipo === "DECISOR_ENCONTRADO"      ? "bg-purple-500" :
                          a.tipo === "EMPRESA_ENCONTRADA"      ? "bg-amber-500" :
                          a.tipo === "NOTICIA_ENCONTRADA"      ? "bg-cyan-500" :
                          a.tipo === "MISSAO_CONCLUIDA"        ? "bg-emerald-500" :
                          a.tipo === "CRIACAO"                 ? "bg-blue-500" :
                          a.tipo === "ASSUMIDO_PELO_COMERCIAL" ? "bg-emerald-600" :
                          "bg-slate-300"
                        }`} />
                        {i < items.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                      </div>

                      {/* Conteúdo */}
                      <div className="pb-5 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <BadgeTipoAtualizacao tipo={a.tipo} />
                          <span className="text-xs text-slate-400">
                            {new Date(a.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {a.agente && <span className="text-xs text-slate-300">· {a.agente}</span>}
                        </div>
                        <p className="text-sm font-bold text-slate-800">{a.titulo}</p>
                        <p className="text-sm text-slate-600 whitespace-pre-line mt-0.5 leading-relaxed">{a.conteudo}</p>
                        {a.link && (
                          <a href={a.link} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                            Ver fonte <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ───────────────────────────────────── INTELIGÊNCIA ─── */}
        {abaAtiva === "inteligencia" && (
          <div className="space-y-4 max-w-2xl">

            {/* Probabilidade de venda */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Probabilidade de Venda</p>
                <div className="flex items-end gap-4 mb-3">
                  <p className="text-6xl font-black text-slate-900 leading-none">
                    {probVenda}<span className="text-2xl font-normal text-slate-400">%</span>
                  </p>
                  <div className="flex-1 pb-1">
                    <BarraProgresso
                      valor={probVenda}
                      cor={probVenda >= 75 ? "#10b981" : probVenda >= 55 ? "#f59e0b" : "#94a3b8"}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {motivVenda.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-sm ${m.positivo ? "text-emerald-500" : "text-slate-400"}`}>
                        {m.positivo ? "✓" : "•"}
                      </span>
                      <p className={`text-xs ${m.positivo ? "text-slate-700" : "text-slate-400"}`}>{m.texto}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* O que falta para a Morgana assumir */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">O Que Falta Para Assumir</p>
                  <span className="text-xs font-bold text-slate-500">{checklistOk}/{checklist.length}</span>
                </div>
                <BarraProgresso valor={(checklistOk / checklist.length) * 100} />
                <div className="mt-4 space-y-2.5">
                  {checklist.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {c.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-300 shrink-0" />
                      )}
                      <p className={`text-sm ${c.ok ? "text-slate-400 line-through" : "text-slate-800 font-semibold"}`}>
                        {c.item}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fatos confirmados */}
            {fatosConfirmados.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">João Confirmou</p>
                  <div className="space-y-2">
                    {fatosConfirmados.slice(0, 10).map((f, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 text-xs font-bold mt-0.5">✓</span>
                        <p className="text-sm text-slate-700">{f}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hipóteses */}
            {hipoteses.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Hipóteses</p>
                  </div>
                  <div className="space-y-3">
                    {hipoteses.map(a => (
                      <div key={a.id} className="border-l-2 border-amber-300 pl-3">
                        <p className="text-sm font-bold text-slate-800">{a.titulo}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{a.conteudo}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Equipamentos */}
            {dossie.equipamentosSugeridos && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Equipamentos Villa</p>
                  {equipStars.length > 0 ? (
                    <div className="space-y-3">
                      {equipStars.map(e => (
                        <div key={e.nome} className="flex items-center justify-between">
                          <p className="text-sm font-bold text-slate-700">{e.nome}</p>
                          <Estrelas valor={e.stars} size="md" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700">{dossie.equipamentosSugeridos}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Campanha */}
            {dossie.campanhasSugerida && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">Campanha Recomendada</p>
                  <p className="text-2xl font-black text-blue-900">{dossie.campanhasSugerida}</p>
                  {dossie.proximaAcaoSugerida && (
                    <p className="text-sm text-blue-700 mt-2">{dossie.proximaAcaoSugerida}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Próxima missão */}
            {dossie.missaoAtual && (
              <Card className="bg-blue-950 border-0">
                <CardContent className="p-4">
                  <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">Próxima Pesquisa do João</p>
                  <p className="text-sm text-white font-semibold leading-relaxed">{dossie.missaoAtual}</p>
                </CardContent>
              </Card>
            )}

          </div>
        )}

        {/* ────────────────────────────────── INVESTIGAÇÕES ─── */}
        {abaAtiva === "investigacoes" && (() => {
          const agenteJoao = (a: Atualizacao) =>
            !!(a.agente?.startsWith("joao"));

          const investigacoes = dossie.atualizacoes.filter(agenteJoao);

          const ordenadas = [...investigacoes].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          const corAgente = (agente?: string | null) => {
            if (agente === "joao-claude") return { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-100 text-violet-700", label: "Claude Haiku" };
            if (agente === "joao-gpt4o")  return { bg: "bg-emerald-50", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-700", label: "GPT-4o" };
            return { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-100 text-slate-600", label: agente ?? "João" };
          };

          return (
            <div className="space-y-3 max-w-2xl">
              {ordenadas.length === 0 ? (
                <div className="text-center py-14">
                  <Brain className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-400">Nenhuma investigação registrada ainda.</p>
                  <p className="text-xs text-slate-300 mt-1">João investigará nas próximas segundas e quartas-feiras.</p>
                </div>
              ) : (
                ordenadas.map(a => {
                  const cores = corAgente(a.agente);
                  const isNoticia = a.tipo === "NOTICIA_ENCONTRADA";
                  const isDecisor = a.tipo === "DECISOR_ENCONTRADO";
                  return (
                    <div key={a.id} className={`rounded-xl border p-4 ${cores.bg} ${cores.border}`}>
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cores.badge}`}>
                            {cores.label}
                          </span>
                          {isNoticia && <span className="text-xs text-cyan-700 font-semibold bg-cyan-100 px-2 py-0.5 rounded-full">📰 Notícia</span>}
                          {isDecisor && <span className="text-xs text-purple-700 font-semibold bg-purple-100 px-2 py-0.5 rounded-full">👤 Decisor</span>}
                          {!isNoticia && !isDecisor && <span className="text-xs text-slate-600 font-semibold bg-slate-200 px-2 py-0.5 rounded-full">📋 Relatório</span>}
                        </div>
                        <span className="text-xs text-slate-400">{formatarDataHora(a.createdAt)}</span>
                      </div>

                      <p className="text-sm font-bold text-slate-800 mb-1.5 leading-snug">
                        {a.titulo.replace(/^\[joao-\w+\]\s*/i, "")}
                      </p>

                      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                        {a.conteudo}
                      </p>

                      {a.link && (
                        <a href={a.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2">
                          Ver fonte <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {!a.link && a.fonte && (
                        <p className="text-xs text-slate-400 mt-2">Fonte: {a.fonte}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
