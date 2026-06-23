// ARQUIVO: app/campanhas/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Dashboard de campanhas do João (prospecção ativa outbound).
// Métricas de funil, lista de campanhas, importação de números e disparo ativo.
// REGRA: Oportunidade só é criada via botão "Qualificar" — ação manual do comercial.

"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Star,
  TrendingUp,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageNavigation } from "@/components/layout/PageNavigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Metricas = {
  total: number;
  abordados: number;
  responderam: number;
  interessados: number;
  qualificados: number;
  oportunidadesCriadas: number;
  descartados: number;
  taxaResposta: number;
  taxaInteresse: number;
  taxaConversao: number;
};

type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  mensagemInicial: string | null;
  status: string;
  tipo: string;
  createdAt: string;
  _count: { prospects: number };
};

type Prospect = {
  id: string;
  nomeContato: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  origem: string | null;
  updatedAt: string;
  empresa: { razaoSocial: string; nomeFantasia: string | null } | null;
  pessoa: { nome: string } | null;
  campanha: { nome: string } | null;
  oportunidade: { titulo: string; status: string } | null;
  interacoes: { tipo: string; createdAt: string }[];
};

type ResultadoDisparo = {
  ok: boolean;
  campanha?: string;
  total?: number;
  enviados?: number;
  erros?: number;
  mensagem?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PROSPECTADO: "Prospectado",
  ABORDADO: "Abordado",
  RESPONDEU: "Respondeu",
  INTERESSADO: "Interessado",
  QUALIFICADO: "Qualificado",
  OPORTUNIDADE_CRIADA: "Oportunidade",
  DESCARTADO: "Descartado",
};

const STATUS_COLORS: Record<string, string> = {
  PROSPECTADO: "bg-slate-100 text-slate-700",
  ABORDADO: "bg-blue-100 text-blue-700",
  RESPONDEU: "bg-cyan-100 text-cyan-700",
  INTERESSADO: "bg-amber-100 text-amber-700",
  QUALIFICADO: "bg-orange-100 text-orange-700",
  OPORTUNIDADE_CRIADA: "bg-green-100 text-green-700",
  DESCARTADO: "bg-red-100 text-red-700",
};

const INTERACAO_LABELS: Record<string, string> = {
  WHATSAPP_ENVIADO: "Enviado",
  WHATSAPP_RESPONDIDO: "Respondeu",
  INTERESSE_REGISTRADO: "Interesse",
  QUALIFICADO_MANUAL: "Qualificado",
  DESCARTADO: "Descartado",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, highlight,
}: {
  label: string; value: number; sub?: string;
  icon: React.ElementType; highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight
      ? "border-[#1A2E5A] bg-[#1A2E5A] text-white"
      : "border-[#D7DEEA] bg-white"}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${highlight ? "text-blue-200" : "text-[#6B7A99]"}`}>{label}</span>
        <Icon className={`size-4 ${highlight ? "text-blue-200" : "text-[#6B7A99]"}`} />
      </div>
      <p className={`mt-2 text-3xl font-bold ${highlight ? "text-white" : "text-[#1A2E5A]"}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${highlight ? "text-blue-200" : "text-[#6B7A99]"}`}>{sub}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campanhaAtiva, setCampanhaAtiva] = useState<string | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProspects, setIsLoadingProspects] = useState(false);
  const [qualificando, setQualificando] = useState<string | null>(null);

  // Nova campanha
  const [showNovaCampanha, setShowNovaCampanha] = useState(false);
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [descricaoCampanha, setDescricaoCampanha] = useState("");
  const [mensagemInicialCampanha, setMensagemInicialCampanha] = useState("");
  const [criandoCampanha, setCriandoCampanha] = useState(false);

  // Importar números
  const [campanhaImportando, setCampanhaImportando] = useState<string | null>(null);
  const [numerosImportar, setNumerosImportar] = useState("");
  const [importando, setImportando] = useState(false);

  // Disparo
  const [disparando, setDisparando] = useState<string | null>(null);
  const [resultadoDisparo, setResultadoDisparo] = useState<ResultadoDisparo | null>(null);

  // Carrega métricas e campanhas
  const loadMetricas = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = campanhaAtiva
        ? `/api/campanhas?campanhaId=${campanhaAtiva}`
        : "/api/campanhas";
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMetricas(data.metricas);
      setCampanhas(data.campanhas ?? []);
    } catch {
      toast.error("Erro ao carregar dados das campanhas.");
    } finally {
      setIsLoading(false);
    }
  }, [campanhaAtiva]);

  // Carrega prospects
  const loadProspects = useCallback(async () => {
    setIsLoadingProspects(true);
    try {
      const params = new URLSearchParams({ agente: "joao-villa" });
      if (statusFiltro !== "todos") params.set("status", statusFiltro);
      if (campanhaAtiva) params.set("campanhaId", campanhaAtiva);
      if (busca.trim()) params.set("busca", busca.trim());
      const res = await fetch(`/api/prospects?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProspects(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar prospects.");
    } finally {
      setIsLoadingProspects(false);
    }
  }, [statusFiltro, campanhaAtiva, busca]);

  useEffect(() => { loadMetricas(); }, [loadMetricas]);
  useEffect(() => { loadProspects(); }, [loadProspects]);

  // Qualificar → cria oportunidade (manual)
  async function qualificar(prospectId: string, nome: string | null) {
    if (!confirm(`Criar oportunidade para "${nome ?? "este prospect"}"?\n\nEssa ação é irreversível e cria um registro no CRM.`)) return;
    setQualificando(prospectId);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/qualificar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      toast.success(`Oportunidade criada: ${data.oportunidade?.titulo}`);
      await Promise.all([loadMetricas(), loadProspects()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao qualificar.");
    } finally {
      setQualificando(null);
    }
  }

  // Criar campanha
  async function criarCampanha() {
    if (!nomeCampanha.trim()) { toast.error("Informe o nome da campanha."); return; }
    setCriandoCampanha(true);
    try {
      const res = await fetch("/api/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeCampanha.trim(),
          descricao: descricaoCampanha.trim() || null,
          mensagemInicial: mensagemInicialCampanha.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Campanha criada!");
      setShowNovaCampanha(false);
      setNomeCampanha(""); setDescricaoCampanha(""); setMensagemInicialCampanha("");
      await loadMetricas();
    } catch {
      toast.error("Erro ao criar campanha.");
    } finally {
      setCriandoCampanha(false);
    }
  }

  // Importar números
  async function importarNumeros() {
    if (!campanhaImportando || !numerosImportar.trim()) return;
    setImportando(true);
    try {
      // Cada linha é um número (com ou sem nome separado por tab/vírgula)
      const linhas = numerosImportar
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const prospects = linhas.map((linha) => {
        // Suporta: "5511999991234", "5511999991234,João Silva", "5511999991234\tJoão Silva"
        const partes = linha.split(/[,\t]/).map((p) => p.trim());
        return {
          telefone: partes[0],
          nomeContato: partes[1] ?? null,
        };
      });

      const res = await fetch(`/api/campanhas/${campanhaImportando}/prospects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospects }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      toast.success(`${data.criados} prospect(s) importado(s). ${data.ignorados} já existiam.`);
      setCampanhaImportando(null);
      setNumerosImportar("");
      await Promise.all([loadMetricas(), loadProspects()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao importar.");
    } finally {
      setImportando(false);
    }
  }

  // Disparo ativo
  async function disparar(campanhaId: string, nomeCamp: string, prospectados: number) {
    if (prospectados === 0) {
      toast.error("Nenhum prospect com status PROSPECTADO nesta campanha para disparar.");
      return;
    }
    if (!confirm(`Disparar campanha "${nomeCamp}"?\n\n${prospectados} mensagem(ns) serão enviadas via WhatsApp pelo João.\n\nEstimativa: ~${Math.ceil((prospectados * 2) / 60)} min (2s entre envios).`)) return;

    setDisparando(campanhaId);
    setResultadoDisparo(null);
    try {
      const res = await fetch(`/api/campanhas/${campanhaId}/disparar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no disparo");
      setResultadoDisparo(data);
      toast.success(`Disparo concluído: ${data.enviados}/${data.total} enviados.`);
      await Promise.all([loadMetricas(), loadProspects()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro no disparo.");
    } finally {
      setDisparando(null);
    }
  }

  const statusFiltros = [
    { value: "todos", label: "Todos" },
    { value: "PROSPECTADO", label: "Prospectado" },
    { value: "ABORDADO", label: "Abordado" },
    { value: "RESPONDEU", label: "Respondeu" },
    { value: "INTERESSADO", label: "Interessado ⭐" },
    { value: "QUALIFICADO", label: "Qualificado" },
    { value: "OPORTUNIDADE_CRIADA", label: "Oportunidade" },
    { value: "DESCARTADO", label: "Descartado" },
  ];

  const campanhaAtivaObj = campanhas.find((c) => c.id === campanhaAtiva);
  const prospectados = campanhaAtivaObj?._count?.prospects ?? 0;

  return (
    <div className="min-h-screen bg-[#F4F6FA] p-4 lg:p-8">
      <PageNavigation currentPage="Campanhas João" currentHref="/campanhas" />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E5A]">Prospecção Ativa — João</h1>
          <p className="text-sm text-[#6B7A99]">Funil de leads abordados pelo agente João via WhatsApp outbound</p>
        </div>
        <Button
          onClick={() => setShowNovaCampanha(!showNovaCampanha)}
          className="flex items-center gap-2 rounded-2xl bg-[#1A2E5A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E4FAB]"
        >
          <Plus className="size-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Resultado do disparo */}
      {resultadoDisparo && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="font-semibold text-green-800">
              Disparo concluído — campanha "{resultadoDisparo.campanha}"
            </p>
            <p className="text-sm text-green-700">
              {resultadoDisparo.enviados} enviados · {resultadoDisparo.erros} erros · {resultadoDisparo.total} total
            </p>
          </div>
          <button onClick={() => setResultadoDisparo(null)} className="text-green-600 hover:text-green-800">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Formulário nova campanha */}
      {showNovaCampanha && (
        <Card className="mb-6 rounded-2xl border-[#D7DEEA]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#1A2E5A]">Nova Campanha</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6B7A99]">Nome *</label>
                <Input
                  value={nomeCampanha}
                  onChange={(e) => setNomeCampanha(e.target.value)}
                  placeholder="Ex: Lajes Pré-moldadas — Julho/26"
                  className="rounded-xl border-[#D7DEEA]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#6B7A99]">Descrição</label>
                <Input
                  value={descricaoCampanha}
                  onChange={(e) => setDescricaoCampanha(e.target.value)}
                  placeholder="Descrição opcional"
                  className="rounded-xl border-[#D7DEEA]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#6B7A99]">
                Mensagem inicial *{" "}
                <span className="font-normal text-[#6B7A99]">
                  — texto enviado na primeira abordagem ativa do João
                </span>
              </label>
              <textarea
                value={mensagemInicialCampanha}
                onChange={(e) => setMensagemInicialCampanha(e.target.value)}
                placeholder={`Exemplo:\nOlá {nome}, tudo bem? Sou o João da Villa Empreendimentos. Trabalhamos com locação de bombas de concreto e betoneiras para obras em SP. Vocês têm algum projeto em andamento ou planejado que possamos apoiar?`}
                rows={4}
                className="w-full rounded-xl border border-[#D7DEEA] p-3 text-sm text-[#1A2E5A] placeholder:text-[#6B7A99] focus:outline-none focus:ring-2 focus:ring-[#1A2E5A]/20"
              />
              <p className="mt-1 text-xs text-[#6B7A99]">
                Use <code className="rounded bg-[#F4F6FA] px-1">{`{nome}`}</code> para inserir o nome do contato (quando disponível).
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={criarCampanha}
                disabled={criandoCampanha}
                className="rounded-xl bg-[#1A2E5A] text-white hover:bg-[#1E4FAB]"
              >
                {criandoCampanha ? <Loader2 className="size-4 animate-spin" /> : "Criar campanha"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowNovaCampanha(false); setNomeCampanha(""); setDescricaoCampanha(""); setMensagemInicialCampanha(""); }}
                className="rounded-xl border-[#D7DEEA]"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal importar números */}
      {campanhaImportando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#1A2E5A]">Importar Números</h2>
              <button onClick={() => { setCampanhaImportando(null); setNumerosImportar(""); }}>
                <X className="size-5 text-[#6B7A99]" />
              </button>
            </div>
            <p className="mb-3 text-sm text-[#6B7A99]">
              Cole os números abaixo, um por linha. Formatos aceitos:
            </p>
            <ul className="mb-3 text-xs text-[#6B7A99] space-y-1 pl-4 list-disc">
              <li><code className="rounded bg-[#F4F6FA] px-1">5511999991234</code> — só o número</li>
              <li><code className="rounded bg-[#F4F6FA] px-1">5511999991234,João Silva</code> — número + nome</li>
              <li><code className="rounded bg-[#F4F6FA] px-1">+5511999991234</code> — com DDI</li>
            </ul>
            <textarea
              value={numerosImportar}
              onChange={(e) => setNumerosImportar(e.target.value)}
              placeholder={"5511999991234,João Silva\n5511888882345\n5511777773456,Maria Oliveira"}
              rows={8}
              className="mb-4 w-full rounded-xl border border-[#D7DEEA] p-3 font-mono text-sm text-[#1A2E5A] placeholder:text-[#6B7A99] focus:outline-none focus:ring-2 focus:ring-[#1A2E5A]/20"
            />
            <div className="flex gap-2">
              <Button
                onClick={importarNumeros}
                disabled={importando || !numerosImportar.trim()}
                className="flex-1 rounded-xl bg-[#1A2E5A] text-white hover:bg-[#1E4FAB]"
              >
                {importando ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> Importando...</>
                ) : (
                  <><Upload className="mr-2 size-4" /> Importar</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setCampanhaImportando(null); setNumerosImportar(""); }}
                className="rounded-xl border-[#D7DEEA]"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-[#1A2E5A]" />
        </div>
      ) : metricas ? (
        <>
          {/* Métricas de funil */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard label="Total" value={metricas.total} icon={Users} />
            <MetricCard label="Abordados" value={metricas.abordados} icon={Send}
              sub={`${metricas.total > 0 ? Math.round((metricas.abordados / metricas.total) * 100) : 0}% do total`} />
            <MetricCard label="Responderam" value={metricas.responderam} icon={MessageSquare}
              sub={`Taxa ${metricas.taxaResposta}%`} />
            <MetricCard label="Interessados" value={metricas.interessados} icon={Star}
              sub={`Taxa ${metricas.taxaInteresse}%`} highlight />
            <MetricCard label="Oportunidades" value={metricas.oportunidadesCriadas} icon={TrendingUp}
              sub={`Conversão ${metricas.taxaConversao}%`} />
          </div>

          {/* Campanhas */}
          {campanhas.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7A99]">Campanhas</h2>
              <div className="flex flex-col gap-3">
                {/* Botão "Todas" */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCampanhaAtiva(null)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      campanhaAtiva === null
                        ? "bg-[#1A2E5A] text-white"
                        : "bg-white border border-[#D7DEEA] text-[#1A2E5A] hover:bg-[#E8EEFB]"
                    }`}
                  >
                    Todas
                  </button>
                  {campanhas.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCampanhaAtiva(c.id === campanhaAtiva ? null : c.id)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        campanhaAtiva === c.id
                          ? "bg-[#1A2E5A] text-white"
                          : "bg-white border border-[#D7DEEA] text-[#1A2E5A] hover:bg-[#E8EEFB]"
                      }`}
                    >
                      {c.nome}
                      <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                        {c._count.prospects}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Ações da campanha selecionada */}
                {campanhaAtiva && campanhaAtivaObj && (
                  <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-[#D7DEEA] bg-white p-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1A2E5A]">{campanhaAtivaObj.nome}</p>
                      {campanhaAtivaObj.mensagemInicial ? (
                        <p className="mt-1 text-xs text-[#6B7A99] line-clamp-2">
                          <span className="font-semibold text-[#1A2E5A]">Msg. inicial: </span>
                          {campanhaAtivaObj.mensagemInicial}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-600">
                          ⚠ Sem mensagem inicial — configure antes de disparar.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCampanhaImportando(campanhaAtiva)}
                        className="rounded-xl border-[#D7DEEA] text-[#1A2E5A] text-xs"
                      >
                        <Upload className="mr-1 size-3" />
                        Importar números
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => disparar(
                          campanhaAtiva,
                          campanhaAtivaObj.nome,
                          prospects.filter((p) => p.status === "PROSPECTADO").length,
                        )}
                        disabled={
                          disparando === campanhaAtiva ||
                          !campanhaAtivaObj.mensagemInicial
                        }
                        className="rounded-xl bg-amber-500 text-white text-xs hover:bg-amber-600 disabled:opacity-50"
                      >
                        {disparando === campanhaAtiva ? (
                          <><Loader2 className="mr-1 size-3 animate-spin" /> Disparando...</>
                        ) : (
                          <><Zap className="mr-1 size-3" /> Disparar campanha</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lista de prospects */}
          <Card className="rounded-2xl border-[#D7DEEA]">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base text-[#1A2E5A]">
                  Prospects
                  {campanhaAtivaObj && (
                    <span className="ml-2 text-sm font-normal text-[#6B7A99]">
                      — {campanhaAtivaObj.nome}
                    </span>
                  )}
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6B7A99]" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, telefone..."
                    className="rounded-xl border-[#D7DEEA] pl-9"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {statusFiltros.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFiltro(f.value)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      statusFiltro === f.value
                        ? "bg-[#1A2E5A] text-white"
                        : "bg-[#F4F6FA] text-[#1A2E5A] hover:bg-[#E8EEFB]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isLoadingProspects ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-[#1A2E5A]" />
                </div>
              ) : prospects.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-2">
                  <Users className="size-8 text-[#D7DEEA]" />
                  <p className="text-sm text-[#6B7A99]">Nenhum prospect encontrado</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F4F6FA]">
                  {prospects.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-6 py-4 hover:bg-[#F4F6FA] transition">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8EEFB] text-sm font-bold text-[#1A2E5A]">
                        {(p.nomeContato ?? p.telefone ?? "?")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#1A2E5A] truncate">
                            {p.nomeContato ?? p.telefone ?? "Sem nome"}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[p.status] ?? "bg-slate-100 text-slate-700"}`}>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </span>
                          {p.campanha && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                              {p.campanha.nome}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-[#6B7A99]">
                          {p.telefone && <span>{p.telefone}</span>}
                          {p.empresa && <span>{p.empresa.nomeFantasia ?? p.empresa.razaoSocial}</span>}
                          {p.interacoes[0] && (
                            <span>
                              Últ: {INTERACAO_LABELS[p.interacoes[0].tipo] ?? p.interacoes[0].tipo} · {formatDate(p.interacoes[0].createdAt)}
                            </span>
                          )}
                          {p.oportunidade && (
                            <span className="font-semibold text-green-700">
                              → {p.oportunidade.titulo}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {(p.status === "INTERESSADO" || p.status === "QUALIFICADO") && (
                          <Button
                            size="sm"
                            onClick={() => qualificar(p.id, p.nomeContato)}
                            disabled={qualificando === p.id}
                            className="rounded-xl bg-amber-500 text-white text-xs hover:bg-amber-600"
                          >
                            {qualificando === p.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <><CheckCircle2 className="mr-1 size-3" />Qualificar</>
                            )}
                          </Button>
                        )}
                        {p.status === "OPORTUNIDADE_CRIADA" && (
                          <span className="flex items-center gap-1 rounded-xl bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
                            <CheckCircle2 className="size-3" />
                            Oportunidade criada
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
