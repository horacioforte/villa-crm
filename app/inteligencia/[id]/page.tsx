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
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
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

type StatusDossie = "INVESTIGANDO" | "AGUARDANDO_VALIDACAO" | "EM_ANALISE" | "PEDIR_MAIS_PESQUISA" | "PRONTO_PARA_ASSUMIR" | "ASSUMIDO" | "ARQUIVADO";

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

// ─── Anel de completude ───────────────────────────────────────────────────────

function AnelCompletude({ valor }: { valor: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const progresso = (valor / 100) * circ;
  const cor = valor >= 80 ? "#10b981" : valor >= 60 ? "#f59e0b" : valor >= 40 ? "#3b82f6" : "#cbd5e1";

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={cor} strokeWidth="8"
          strokeDasharray={`${progresso} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
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
    CRIACAO:               { label: "Criação",       class: "bg-blue-100 text-blue-700" },
    CAMPO_ATUALIZADO:      { label: "Atualização",   class: "bg-slate-100 text-slate-600" },
    DECISOR_ENCONTRADO:    { label: "👤 Decisor",    class: "bg-purple-100 text-purple-700" },
    EMPRESA_ENCONTRADA:    { label: "🏢 Empresa",    class: "bg-amber-100 text-amber-700" },
    NOTICIA_ENCONTRADA:    { label: "📰 Notícia",    class: "bg-cyan-100 text-cyan-700" },
    MISSAO_CONCLUIDA:      { label: "✅ Missão",     class: "bg-emerald-100 text-emerald-700" },
    SOLICITACAO_PESQUISA:  { label: "🔍 Pesquisa",  class: "bg-orange-100 text-orange-700" },
    ANALISE_MORGANA:       { label: "🧠 Morgana",   class: "bg-violet-100 text-violet-700" },
    ASSUMIDO_PELO_COMERCIAL: { label: "🎯 Assumido", class: "bg-emerald-100 text-emerald-800" },
    MONITORAMENTO:         { label: "📡 Monitor",   class: "bg-blue-100 text-blue-600" },
  };
  const c = cfg[tipo] ?? { label: tipo, class: "bg-slate-100 text-slate-600" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.class}`}>{c.label}</span>;
}

// ─── Aba ─────────────────────────────────────────────────────────────────────

type Aba = "visao" | "decisores" | "empresas" | "timeline";

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DossieDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dossie, setDossie] = useState<Dossie | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<Aba>("visao");
  const [assumindo, setAssumindo] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState("");
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
      const res = await fetch(`/api/inteligencia/${id}/assumir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      toast.success("Oportunidade criada no pipeline!");
      router.push(data.urlOportunidade);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setAssumindo(false);
    }
  }

  async function descartar() {
    if (!motivoDescarte.trim()) { toast.error("Informe o motivo"); return; }
    setDescartando(true);
    try {
      const res = await fetch(`/api/inteligencia/${id}/descartar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: motivoDescarte }) });
      if (!res.ok) throw new Error("Erro ao arquivar");
      toast.success("Dossiê arquivado");
      router.push("/inteligencia");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDescartando(false);
    }
  }

  async function pedirMaisPesquisa() {
    const instrucao = prompt("Qual a instrução de pesquisa para o João?", dossie?.missaoAtual ?? "");
    if (instrucao === null) return;
    const res = await fetch(`/api/inteligencia/${id}/pesquisar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrucao }) });
    if (res.ok) { toast.success("Solicitação registrada. Tarefa criada para o João."); carregar(); }
    else toast.error("Erro ao solicitar pesquisa");
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!dossie) {
    return <div className="p-8 text-center text-slate-500">Dossiê não encontrado.</div>;
  }

  const jaAssumido = dossie.status === "ASSUMIDO";
  const arquivado  = dossie.status === "ARQUIVADO";

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Cabeçalho */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/inteligencia")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600 shrink-0" />
            <h1 className="text-sm font-bold text-slate-800 truncate">{dossie.titulo}</h1>
          </div>
          <p className="text-xs text-slate-500">
            {dossie.segmento ?? dossie.tipo} {dossie.cidade && `· ${dossie.cidade}/${dossie.estado}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={carregar}>
          <RefreshCw className="h-4 w-4 text-slate-400" />
        </Button>
      </div>

      {/* Hero: anel + missão */}
      <div className="bg-white border-b px-4 py-4">
        <div className="flex items-center gap-6">
          <AnelCompletude valor={dossie.completude} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-bold text-slate-800">{dossie.score}<span className="text-sm font-normal text-slate-400">/100</span></span>
              <Badge variant="outline" className="text-xs">{dossie.status.replace(/_/g, " ")}</Badge>
              {dossie.prioridade && (
                <Badge variant="outline" className={`text-xs ${dossie.prioridade === "ALTA" ? "border-red-300 text-red-700" : dossie.prioridade === "MEDIA" ? "border-amber-300 text-amber-700" : "border-slate-300"}`}>
                  {dossie.prioridade}
                </Badge>
              )}
            </div>
            {dossie.missaoAtual && !jaAssumido && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-blue-700 mb-0.5">🎯 Missão do João</p>
                <p className="text-sm text-blue-900">{dossie.missaoAtual}</p>
              </div>
            )}
            {jaAssumido && dossie.oportunidade && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-emerald-700 mb-0.5">✅ Assumido pelo comercial</p>
                <button onClick={() => router.push(`/oportunidades/${dossie.oportunidade!.id}`)} className="text-sm text-emerald-800 hover:underline flex items-center gap-1">
                  {dossie.oportunidade.titulo} <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        {!jaAssumido && !arquivado && (
          <div className="flex gap-2 mt-4">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={assumir} disabled={assumindo}>
              {assumindo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Assumir Oportunidade
            </Button>
            <Button variant="outline" onClick={pedirMaisPesquisa}>
              <Search className="h-4 w-4 mr-1" /> Mais Pesquisa
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => setMostrarDescarte(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Descarte */}
        {mostrarDescarte && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-red-700">Motivo do arquivamento (obrigatório)</p>
            <Textarea rows={2} placeholder="Ex: Obra cancelada, fora do perfil, cliente inativo…"
              value={motivoDescarte} onChange={e => setMotivoDescarte(e.target.value)} className="text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={descartar} disabled={descartando}>
                {descartando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Arquivar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMostrarDescarte(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>

      {/* Abas */}
      <div className="bg-white border-b px-4">
        <div className="flex gap-1 overflow-x-auto">
          {(["visao", "decisores", "empresas", "timeline"] as Aba[]).map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${abaAtiva === aba ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {aba === "visao" ? "Visão Geral" : aba === "decisores" ? `Decisores (${dossie.decisores.length})` : aba === "empresas" ? `Empresas (${dossie.empresasRelacionadas.length})` : "Timeline"}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo das abas */}
      <div className="flex-1 overflow-auto p-4">

        {/* ── Visão Geral ── */}
        {abaAtiva === "visao" && (
          <div className="space-y-3 max-w-2xl">
            {dossie.resumo && (
              <Card><CardContent className="p-3 text-sm text-slate-700">{dossie.resumo}</CardContent></Card>
            )}
            <Card>
              <CardHeader className="p-3 pb-0"><CardTitle className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Dados da Obra</CardTitle></CardHeader>
              <CardContent className="p-3 pt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ["Cliente Final",  dossie.clienteFinal],
                  ["Construtora",    dossie.construtora],
                  ["EPC",            dossie.epc],
                  ["EPCM",           dossie.epcm],
                  ["Consórcio",      dossie.consorcio],
                  ["Fase da Obra",   dossie.faseObra],
                  ["Valor Estimado", dossie.valorEstimado ? `R$ ${Number(dossie.valorEstimado).toLocaleString("pt-BR")}` : null],
                  ["Vol. Concreto",  dossie.volumeConcreto ? `${dossie.volumeConcreto} m³` : null],
                  ["Segmento",       dossie.segmento],
                  ["Cidade/UF",      dossie.cidade ? `${dossie.cidade}/${dossie.estado}` : null],
                ].filter(([, v]) => v).map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-xs text-slate-400">{l as string}</p>
                    <p className="text-slate-800 font-medium">{v as string}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            {(dossie.equipamentosSugeridos || dossie.campanhasSugerida || dossie.proximaAcaoSugerida) && (
              <Card>
                <CardHeader className="p-3 pb-0"><CardTitle className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Inteligência Comercial</CardTitle></CardHeader>
                <CardContent className="p-3 pt-2 space-y-2 text-sm">
                  {dossie.equipamentosSugeridos && <div><p className="text-xs text-slate-400">Equipamentos</p><p className="text-slate-800">{dossie.equipamentosSugeridos}</p></div>}
                  {dossie.campanhasSugerida     && <div><p className="text-xs text-slate-400">Campanha</p><p className="text-slate-800">{dossie.campanhasSugerida}</p></div>}
                  {dossie.proximaAcaoSugerida   && <div><p className="text-xs text-slate-400">Próxima Ação</p><p className="text-slate-800">{dossie.proximaAcaoSugerida}</p></div>}
                  {dossie.concorrentes          && <div><p className="text-xs text-slate-400">Concorrentes</p><p className="text-slate-800">{dossie.concorrentes}</p></div>}
                </CardContent>
              </Card>
            )}
            {dossie.fonteInformacao && (
              <Card>
                <CardContent className="p-3 text-sm">
                  <p className="text-xs text-slate-400 mb-1">Fonte</p>
                  <p className="text-slate-700">{dossie.fonteInformacao}</p>
                  {dossie.linkFonte && (
                    <a href={dossie.linkFonte} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      Ver fonte <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Decisores ── */}
        {abaAtiva === "decisores" && (
          <div className="space-y-2 max-w-lg">
            {dossie.decisores.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum decisor identificado ainda.</p>
            )}
            {dossie.decisores.map(d => (
              <Card key={d.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 space-y-0.5 text-sm">
                    <p className="font-semibold text-slate-800">{d.nome}</p>
                    {d.cargo   && <p className="text-xs text-slate-500">{d.cargo}</p>}
                    {d.empresa && <p className="text-xs text-slate-400">{d.empresa}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {d.telefone && <span className="text-xs text-slate-600">📞 {d.telefone}</span>}
                      {d.email    && <span className="text-xs text-slate-600">✉️ {d.email}</span>}
                      {d.linkedin && <a href={d.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">LinkedIn</a>}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{d.confianca}% conf.</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Empresas ── */}
        {abaAtiva === "empresas" && (
          <div className="space-y-2 max-w-lg">
            {dossie.empresasRelacionadas.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Nenhuma empresa relacionada ainda.</p>
            )}
            {dossie.empresasRelacionadas.map(e => (
              <Card key={e.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 text-sm space-y-0.5">
                    <p className="font-semibold text-slate-800">{e.razaoSocial}</p>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{e.papel}</span>
                    {(e.cidade || e.estado) && <p className="text-xs text-slate-400">{[e.cidade, e.estado].filter(Boolean).join("/")}</p>}
                    {e.site && <a href={e.site} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">{e.site}</a>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Timeline ── */}
        {abaAtiva === "timeline" && (
          <div className="space-y-3 max-w-2xl">
            {dossie.atualizacoes.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Nenhuma atualização ainda.</p>
            )}
            {dossie.atualizacoes.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <div className="w-px flex-1 bg-slate-200 mt-1" />
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <BadgeTipoAtualizacao tipo={a.tipo} />
                    <span className="text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {a.agente && <span className="text-xs text-slate-400">· {a.agente}</span>}
                  </div>
                  <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line mt-0.5">{a.conteudo}</p>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      Ver fonte <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
