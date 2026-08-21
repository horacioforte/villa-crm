"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  ScrollText,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageNavigation } from "@/components/layout/PageNavigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  NIVEL_RISCO_LABELS,
  TIPO_CONTRATO_LABELS,
  tipoContratoValues,
} from "@/lib/validations/contrato";

type TipoContrato = (typeof tipoContratoValues)[number];
type NivelRisco = "BAIXO" | "MEDIO" | "ALTO";
type TabId = "violacoes" | "conflitos" | "conformes" | "faltando" | "acoes";

type EmpresaOption = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
};

type ResultadoAnalise = {
  tipoDetectado?: string;
  partes?: string[];
  prazo?: string;
  valor?: string;
  reajuste?: string;
  riscoGeral?: string;
  resumo?: string;
  conformes?: { regra: string; detalhe: string }[];
  conflitos?: {
    regra: string;
    contratoCliente: string;
    villaEspera: string;
    gravidade: string;
  }[];
  violacoesRegrasDeOuro?: { numero: number; regra: string; problema: string }[];
  clausulasFaltando?: { clausula: string; importancia: string; descricao: string }[];
  recomendacoes?: { acao: string; prioridade: string }[];
};

type AnaliseRow = {
  id: string | null;
  nomeArquivo: string | null;
  tipoContrato: TipoContrato;
  tipoDetectado: string | null;
  partes: string[];
  prazo: string | null;
  valor: string | null;
  reajuste: string | null;
  riscoGeral: NivelRisco | null;
  resumo: string | null;
  resultado: ResultadoAnalise;
  createdAt: string;
  empresa: { id: string; razaoSocial: string; nomeFantasia: string | null } | null;
  oportunidade: { id: string; titulo: string } | null;
  createdBy: { id: string; nome: string | null } | null;
  persistido?: boolean;
  message?: string;
};

const TIPO_ICON: Record<TipoContrato, string> = {
  CAMINHAO_BETONEIRA: "🚛",
  AUTO_BOMBA: "🏗",
  USINA_CONCRETO: "🏭",
  GERAL_OUTRO: "📋",
};

const RISCO_BADGE: Record<NivelRisco, string> = {
  BAIXO: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  MEDIO: "bg-amber-100 text-amber-800 border border-amber-200",
  ALTO: "bg-red-100 text-red-700 border border-red-200",
};

const RISCO_TEXTO_BADGE: Record<string, string> = {
  Baixo: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  Médio: "bg-amber-100 text-amber-800 border border-amber-200",
  Alto: "bg-red-100 text-red-700 border border-red-200",
};

const GRAVIDADE_BADGE: Record<string, string> = {
  Alta: "bg-red-100 text-red-700 border border-red-200",
  Média: "bg-amber-100 text-amber-800 border border-amber-200",
  Baixa: "bg-[#E8EEFB] text-[#1A2E5A] border border-[#D7DEEA]",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function fetchHistorico() {
  const response = await fetch("/api/contratos");
  if (!response.ok) {
    throw new Error("Falha ao carregar o histórico de análises.");
  }
  return response.json() as Promise<AnaliseRow[]>;
}

async function fetchEmpresas() {
  const response = await fetch("/api/empresas");
  if (!response.ok) {
    throw new Error("Falha ao carregar empresas.");
  }
  return response.json() as Promise<EmpresaOption[]>;
}

export default function ContratosPage() {
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>("CAMINHAO_BETONEIRA");
  const [texto, setTexto] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>("__none__");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ativo, setAtivo] = useState<AnaliseRow | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("violacoes");

  const [historico, setHistorico] = useState<AnaliseRow[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(true);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [papel, setPapel] = useState<string | null>(null);

  const loadHistorico = useCallback(async () => {
    setIsLoadingHistorico(true);
    try {
      setHistorico(await fetchHistorico());
    } catch {
      toast.error("Não foi possível carregar o histórico de análises.");
    } finally {
      setIsLoadingHistorico(false);
    }
  }, []);

  useEffect(() => {
    loadHistorico();
  }, [loadHistorico]);

  useEffect(() => {
    fetchEmpresas()
      .then(setEmpresas)
      .catch(() => toast.error("Não foi possível carregar as empresas."));
  }, []);

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/session");
      if (!response.ok) return;
      const session = await response.json();
      setPapel(session?.user?.papel ?? null);
    }
    loadSession();
  }, []);

  const podeExcluir = papel === "ADMIN" || papel === "GERENTE";

  const empresaItems = useMemo(
    () => [
      { value: "__none__", label: "Nenhuma" },
      ...empresas.map((empresa) => ({
        value: empresa.id,
        label: empresa.nomeFantasia ?? empresa.razaoSocial,
      })),
    ],
    [empresas],
  );

  const resumoRisco = useMemo(
    () =>
      historico.reduce(
        (total, item) => {
          if (item.riscoGeral) {
            total[item.riscoGeral] += 1;
          }
          return total;
        },
        { BAIXO: 0, MEDIO: 0, ALTO: 0 } as Record<NivelRisco, number>,
      ),
    [historico],
  );

  function handleFile(file: File | null | undefined) {
    if (!file) return;
    setFileName(file.name);
    setTexto("");
    setPdfBase64(null);

    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setPdfBase64(result.split(",")[1] ?? null);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setTexto(result);
        }
      };
      reader.readAsText(file);
    }
  }

  function clearFile() {
    setFileName(null);
    setPdfBase64(null);
  }

  const canAnalyze = !loading && Boolean(pdfBase64 || texto.trim());

  async function analisar() {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoContrato,
          nomeArquivo: fileName,
          texto: pdfBase64 ? undefined : texto,
          pdfBase64: pdfBase64 ?? undefined,
          empresaId: empresaId === "__none__" ? null : empresaId,
        }),
      });

      const payload = (await response.json().catch(() => null)) as AnaliseRow | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? "Falha ao analisar o contrato.");
      }

      setAtivo(payload);
      setActiveTab("violacoes");

      if (payload?.persistido === false) {
        toast.warning(payload.message ?? "Análise concluída, mas não foi salva no histórico.");
      } else {
        toast.success("Contrato analisado e salvo no histórico.");
        await loadHistorico();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar o contrato.");
    } finally {
      setLoading(false);
    }
  }

  function verAnalise(row: AnaliseRow) {
    setAtivo(row);
    setActiveTab("violacoes");
    setError(null);
  }

  async function excluirAnalise(row: AnaliseRow) {
    if (!row.id) return;
    if (!window.confirm(`Excluir a análise de "${row.nomeArquivo ?? "contrato sem nome"}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/contratos/${row.id}`, { method: "DELETE" });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao excluir a análise.");
      }

      toast.success("Análise excluída.");
      if (ativo?.id === row.id) {
        setAtivo(null);
      }
      await loadHistorico();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível excluir a análise.",
      );
    }
  }

  const resultado = ativo?.resultado;

  const tabs: { id: TabId; label: string; count: number }[] = resultado
    ? [
        {
          id: "violacoes",
          label: "Regras de Ouro",
          count: resultado.violacoesRegrasDeOuro?.length ?? 0,
        },
        { id: "conflitos", label: "Conflitos", count: resultado.conflitos?.length ?? 0 },
        { id: "conformes", label: "Conformes", count: resultado.conformes?.length ?? 0 },
        {
          id: "faltando",
          label: "Faltando",
          count: resultado.clausulasFaltando?.length ?? 0,
        },
        { id: "acoes", label: "Ações", count: resultado.recomendacoes?.length ?? 0 },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Contratos" currentHref="/contratos" />

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Análise de Contratos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Compare o contrato enviado pelo cliente com as 21 Regras de Ouro e as
              propostas padrão da Villa (ABL · ABE · CBCO · CBSO) usando IA.
            </p>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Total analisado</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {historico.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Risco baixo</CardDescription>
              <CardTitle className="text-3xl font-bold text-emerald-600">
                {resumoRisco.BAIXO}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Risco médio</CardDescription>
              <CardTitle className="text-3xl font-bold text-amber-600">
                {resumoRisco.MEDIO}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Risco alto</CardDescription>
              <CardTitle className="text-3xl font-bold text-red-600">
                {resumoRisco.ALTO}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* ── FORMULÁRIO DE NOVA ANÁLISE ── */}
          <Card className="h-fit rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-[#1A2E5A]">
                Nova análise
              </CardTitle>
              <CardDescription>
                Carregue o PDF ou cole o texto do contrato do cliente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1E4FAB]">
                  Tipo de contrato
                </p>
                <div className="flex flex-wrap gap-2">
                  {tipoContratoValues.map((tipo) => {
                    const active = tipoContrato === tipo;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setTipoContrato(tipo)}
                        className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                          active
                            ? "border-[#1E4FAB] bg-[#E8EEFB] text-[#1A2E5A]"
                            : "border-[#D7DEEA] bg-[#F4F6FA] text-[#667085] hover:bg-[#E8EEFB]"
                        }`}
                      >
                        <span>{TIPO_ICON[tipo]}</span>
                        {TIPO_CONTRATO_LABELS[tipo]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1E4FAB]">
                  Vincular a uma empresa (opcional)
                </p>
                <Select
                  items={empresaItems}
                  value={empresaId}
                  onValueChange={(value) => setEmpresaId(String(value ?? "__none__"))}
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl border-[#D7DEEA]">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nomeFantasia ?? empresa.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1E4FAB]">
                  Contrato do cliente
                </p>

                {!pdfBase64 && (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      handleFile(e.dataTransfer.files[0]);
                    }}
                    onClick={() => document.getElementById("villa-contrato-input")?.click()}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
                      dragging
                        ? "border-[#1E4FAB] bg-[#E8EEFB]"
                        : "border-[#D7DEEA] bg-[#F4F6FA] hover:bg-[#E8EEFB]"
                    }`}
                  >
                    <UploadCloud className="mx-auto size-7 text-[#667085]" />
                    <p className="mt-2 text-sm font-semibold text-[#1A2E5A]">
                      Arraste o PDF aqui
                    </p>
                    <p className="text-xs text-[#667085]">
                      ou clique para selecionar · .pdf, .txt
                    </p>
                    <input
                      id="villa-contrato-input"
                      type="file"
                      accept=".pdf,.txt,.md"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                  </div>
                )}

                {pdfBase64 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-[#93C5FD] bg-[#E8EEFB] px-4 py-3">
                    <FileText className="size-6 text-[#1E4FAB]" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1E4FAB]">{fileName}</p>
                      <p className="text-xs text-[#667085]">PDF pronto para análise</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      className="text-[#667085] hover:text-[#1A2E5A]"
                      aria-label="Remover arquivo"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}

                {!pdfBase64 && (
                  <>
                    <div className="my-3 flex items-center gap-3 text-xs text-[#667085]">
                      <div className="h-px flex-1 bg-[#D7DEEA]" />
                      ou cole o texto
                      <div className="h-px flex-1 bg-[#D7DEEA]" />
                    </div>
                    <Textarea
                      value={texto}
                      onChange={(e) => {
                        setTexto(e.target.value);
                        setFileName(null);
                      }}
                      placeholder="Cole aqui o texto do contrato enviado pelo cliente..."
                      className="min-h-[160px] rounded-2xl border-[#D7DEEA]"
                    />
                  </>
                )}
              </div>

              <Button
                type="button"
                disabled={!canAnalyze}
                onClick={analisar}
                className="h-12 rounded-2xl bg-[#1E4FAB] text-sm font-bold uppercase tracking-wide text-white hover:bg-[#1A2E5A] disabled:bg-[#D7DEEA] disabled:text-[#98A2B3]"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Analisar contrato
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] leading-5 text-[#98A2B3]">
                Análise gerada por IA para uso interno · Consulte o jurídico para decisões
                finais
              </p>
            </CardContent>
          </Card>

          {/* ── RESULTADO ── */}
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardContent className="p-6">
              {!loading && !resultado && !error && (
                <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-center">
                  <ScrollText className="size-12 text-[#D7DEEA]" />
                  <p className="text-sm font-bold uppercase tracking-wide text-[#98A2B3]">
                    Aguardando contrato
                  </p>
                  <p className="max-w-sm text-sm text-[#667085]">
                    Carregue o PDF ou cole o texto ao lado e clique em Analisar contrato.
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 text-center">
                  <Loader2 className="size-10 animate-spin text-[#1E4FAB]" />
                  <div>
                    <p className="text-sm font-semibold text-[#1A2E5A]">
                      Verificando as 21 Regras de Ouro...
                    </p>
                    <p className="mt-1 text-xs text-[#667085]">
                      Comparando com a proposta {TIPO_CONTRATO_LABELS[tipoContrato]}
                    </p>
                  </div>
                </div>
              )}

              {error && !loading && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 size-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {resultado && !loading && (
                <div>
                  <div className="rounded-2xl border border-[#D7DEEA] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-[200px] flex-[2]">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1E4FAB]">
                          Contrato identificado
                        </p>
                        <p className="mt-1 text-base font-bold text-[#1A2E5A]">
                          {resultado.tipoDetectado}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#667085]">
                          {resultado.resumo}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-4">
                        {(
                          [
                            { label: "Partes", value: resultado.partes?.join(" × ") },
                            { label: "Prazo", value: resultado.prazo },
                            { label: "Valor", value: resultado.valor },
                            { label: "Reajuste", value: resultado.reajuste },
                          ] as { label: string; value?: string }[]
                        )
                          .filter((item) => item.value)
                          .map((item) => (
                            <div key={item.label}>
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#98A2B3]">
                                {item.label}
                              </p>
                              <p className="max-w-[160px] text-xs text-[#334155]">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        <div>
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#98A2B3]">
                            Risco
                          </p>
                          <Badge
                            className={
                              RISCO_TEXTO_BADGE[resultado.riscoGeral ?? ""] ??
                              "bg-slate-100 text-slate-700"
                            }
                          >
                            {resultado.riscoGeral}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(resultado.violacoesRegrasDeOuro?.length ?? 0) > 0 && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      <AlertTriangle className="size-4 flex-shrink-0" />
                      <span>
                        <strong>{resultado.violacoesRegrasDeOuro?.length} violação(ões)</strong>{" "}
                        de Regras de Ouro detectadas — itens inegociáveis que precisam ser
                        ajustados.
                      </span>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-1 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          activeTab === tab.id
                            ? "bg-white text-[#1A2E5A] shadow-sm"
                            : "text-[#667085] hover:text-[#1A2E5A]"
                        }`}
                      >
                        {tab.label}
                        {tab.count > 0 && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              activeTab === tab.id
                                ? "bg-[#1E4FAB] text-white"
                                : "bg-[#D7DEEA] text-[#667085]"
                            }`}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {activeTab === "violacoes" &&
                      (resultado.violacoesRegrasDeOuro?.length ? (
                        resultado.violacoesRegrasDeOuro.map((v, i) => (
                          <div
                            key={i}
                            className="rounded-2xl border border-red-200 border-l-4 border-l-red-500 bg-red-50 p-4"
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <span className="rounded bg-red-200 px-2 py-0.5 text-[11px] font-bold text-red-800">
                                REGRA #{v.numero}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wide text-red-800">
                                Inegociável
                              </span>
                            </div>
                            <p className="mb-1 text-xs italic text-red-600">{v.regra}</p>
                            <p className="text-sm leading-6 text-red-800">⚠ {v.problema}</p>
                          </div>
                        ))
                      ) : (
                        <EmptyState texto="Nenhuma violação de Regras de Ouro detectada." />
                      ))}

                    {activeTab === "conflitos" &&
                      (resultado.conflitos?.length ? (
                        resultado.conflitos.map((c, i) => (
                          <div
                            key={i}
                            className={`rounded-2xl border border-[#D7DEEA] border-l-4 bg-white p-4 ${
                              c.gravidade === "Alta"
                                ? "border-l-red-500"
                                : c.gravidade === "Média"
                                  ? "border-l-amber-500"
                                  : "border-l-[#1E4FAB]"
                            }`}
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-sm font-semibold text-[#1A2E5A]">
                                {c.regra}
                              </span>
                              <Badge
                                className={
                                  GRAVIDADE_BADGE[c.gravidade] ?? "bg-slate-100 text-slate-700"
                                }
                              >
                                {c.gravidade}
                              </Badge>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-xl bg-amber-50 p-3">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                  Contrato do cliente
                                </p>
                                <p className="text-xs leading-5 text-[#334155]">
                                  {c.contratoCliente}
                                </p>
                              </div>
                              <div className="rounded-xl bg-[#E8EEFB] p-3">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#1E4FAB]">
                                  Villa exige
                                </p>
                                <p className="text-xs leading-5 text-[#334155]">
                                  {c.villaEspera}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState texto="Nenhum conflito direto com a proposta." />
                      ))}

                    {activeTab === "conformes" &&
                      (resultado.conformes?.length ? (
                        resultado.conformes.map((c, i) => (
                          <div
                            key={i}
                            className="flex gap-3 rounded-2xl border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50 p-4"
                          >
                            <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0 text-emerald-600" />
                            <div>
                              <p className="mb-1 text-sm font-semibold text-emerald-800">
                                {c.regra}
                              </p>
                              <p className="text-xs leading-5 text-[#334155]">{c.detalhe}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState texto="Nenhum item em conformidade identificado." neutro />
                      ))}

                    {activeTab === "faltando" &&
                      (resultado.clausulasFaltando?.length ? (
                        resultado.clausulasFaltando.map((c, i) => (
                          <div
                            key={i}
                            className="rounded-2xl border border-[#D7DEEA] border-l-4 border-l-amber-500 bg-white p-4"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-semibold text-[#1A2E5A]">
                                {c.clausula}
                              </span>
                              <Badge className="border border-amber-200 bg-amber-100 text-amber-800">
                                {c.importancia}
                              </Badge>
                            </div>
                            <p className="text-xs leading-5 text-[#334155]">{c.descricao}</p>
                          </div>
                        ))
                      ) : (
                        <EmptyState texto="Nenhuma cláusula essencial ausente." />
                      ))}

                    {activeTab === "acoes" &&
                      (resultado.recomendacoes?.length ? (
                        resultado.recomendacoes.map((r, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-3 rounded-2xl border border-[#D7DEEA] border-l-4 bg-white p-4 ${
                              r.prioridade === "Alta"
                                ? "border-l-red-500"
                                : r.prioridade === "Média"
                                  ? "border-l-amber-500"
                                  : "border-l-[#1E4FAB]"
                            }`}
                          >
                            <span className="mt-0.5 text-base">
                              {r.prioridade === "Alta"
                                ? "🔴"
                                : r.prioridade === "Média"
                                  ? "🟡"
                                  : "🔵"}
                            </span>
                            <p className="flex-1 text-sm leading-6 text-[#334155]">{r.acao}</p>
                            <Badge
                              className={
                                GRAVIDADE_BADGE[r.prioridade] ?? "bg-slate-100 text-slate-700"
                              }
                            >
                              {r.prioridade}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <EmptyState texto="Nenhuma ação recomendada." neutro />
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── HISTÓRICO ── */}
        <Card className="mt-6 rounded-3xl border-[#D7DEEA]">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-[#1A2E5A]">
              Histórico de análises
            </CardTitle>
            <CardDescription>
              Clique em uma linha para ver o resultado completo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistorico ? (
              <div className="flex items-center justify-center py-10 text-[#667085]">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : historico.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#667085]">
                Nenhuma análise realizada ainda.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Analisado por</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((row) => (
                    <TableRow
                      key={row.id ?? row.createdAt}
                      className="cursor-pointer"
                      onClick={() => verAnalise(row)}
                    >
                      <TableCell className="text-xs text-[#667085]">
                        {formatDate(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-[#1A2E5A]">
                        {row.nomeArquivo ?? "Texto colado"}
                      </TableCell>
                      <TableCell className="text-xs text-[#667085]">
                        {TIPO_CONTRATO_LABELS[row.tipoContrato]}
                      </TableCell>
                      <TableCell className="text-xs text-[#667085]">
                        {row.empresa?.nomeFantasia ?? row.empresa?.razaoSocial ?? "—"}
                      </TableCell>
                      <TableCell>
                        {row.riscoGeral ? (
                          <Badge className={RISCO_BADGE[row.riscoGeral]}>
                            {NIVEL_RISCO_LABELS[row.riscoGeral]}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[#667085]">
                        {row.createdBy?.nome ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {podeExcluir && row.id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              excluirAnalise(row);
                            }}
                            className="text-[#98A2B3] hover:text-red-600"
                            aria-label="Excluir análise"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function EmptyState({ texto, neutro }: { texto: string; neutro?: boolean }) {
  if (neutro) {
    return (
      <div className="rounded-2xl border border-[#D7DEEA] bg-white p-4 text-sm text-[#667085]">
        {texto}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
      <CheckCircle2 className="size-4 flex-shrink-0" />✓ {texto}
    </div>
  );
}
