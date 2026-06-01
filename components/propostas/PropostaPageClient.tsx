"use client";

import { useEffect, useState } from "react";
import { Check, Download, Eye, FileText, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { PropostaPreview } from "@/components/propostas/PropostaPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TipoBloco = "BLOQUEADO" | "EDITAVEL" | "EDITAVEL_COM_APROVACAO";
type StatusExcecao = "PENDENTE" | "APROVADA" | "REJEITADA";

type PropostaBloco = {
  id: string;
  chave: string;
  titulo: string;
  tipo: TipoBloco;
  ordem: number;
  conteudoAtual: string;
};

type PropostaExcecao = {
  id: string;
  campo: string;
  justificativa: string;
  status: StatusExcecao;
  decisaoMotivo: string | null;
  valorAnterior: unknown;
  valorProposto: unknown;
  bloco: { id: string; titulo: string } | null;
  solicitante: { nome: string | null } | null;
  aprovador: { nome: string | null } | null;
};

type PropostaDetalhe = {
  id: string;
  numeroProposta: string;
  versao: number;
  status: string;
  htmlSnapshot: string;
  blocos: PropostaBloco[];
  excecoes: PropostaExcecao[];
  currentUser?: {
    papel: "ADMIN" | "GERENTE" | "COMERCIAL" | "OPERACIONAL";
  };
  oportunidade: {
    titulo: string;
    empresa: {
      razaoSocial: string;
      nomeFantasia: string | null;
    };
  };
};

const statusLabels: Record<string, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_APROVACAO: "Aguardando aprovacao",
  APROVADA: "Aprovada",
  ENVIADA: "Enviada",
  ACEITA: "Aceita",
  REJEITADA: "Rejeitada",
  VENCIDA: "Vencida",
  CANCELADA: "Cancelada",
};

const tipoLabels: Record<TipoBloco, string> = {
  BLOQUEADO: "Bloqueado",
  EDITAVEL: "Editavel",
  EDITAVEL_COM_APROVACAO: "Editavel com aprovacao",
};

function stringifyValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

export function PropostaPageClient({ id }: { id: string }) {
  const [proposta, setProposta] = useState<PropostaDetalhe | null>(null);
  const [conteudos, setConteudos] = useState<Record<string, string>>({});
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [modoVisualizacao, setModoVisualizacao] = useState<"preview" | "edicao">(
    "preview",
  );

  useEffect(() => {
    let active = true;

    async function loadProposta() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/propostas/${id}`);

        if (!response.ok) {
          throw new Error("Falha ao carregar proposta.");
        }

        const data: PropostaDetalhe = await response.json();

        if (!active) {
          return;
        }

        setProposta(data);
        setConteudos(
          Object.fromEntries(
            data.blocos.map((bloco) => [bloco.id, bloco.conteudoAtual]),
          ),
        );
      } catch {
        if (active) {
          toast.error("Nao foi possivel carregar a proposta.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadProposta();

    return () => {
      active = false;
    };
  }, [id]);

  async function salvarBloco(bloco: PropostaBloco) {
    setSavingId(bloco.id);

    try {
      const response = await fetch(`/api/propostas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocos: [
            {
              id: bloco.id,
              conteudoAtual: conteudos[bloco.id],
              justificativa: justificativas[bloco.id],
            },
          ],
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao salvar bloco.");
      }

      const data = await response.json();
      setProposta(data);
      toast.success(
        bloco.tipo === "EDITAVEL_COM_APROVACAO"
          ? "Solicitacao de aprovacao criada."
          : "Bloco atualizado.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel salvar.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function decidirExcecao(excecaoId: string, decisao: "APROVAR" | "REJEITAR") {
    setDecidingId(excecaoId);

    try {
      const response = await fetch(`/api/propostas/${id}/excecoes/${excecaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao decidir excecao.");
      }

      const data = await response.json();
      setProposta(data);
      setConteudos(
        Object.fromEntries(
          data.blocos.map((bloco: PropostaBloco) => [bloco.id, bloco.conteudoAtual]),
        ),
      );
      toast.success(decisao === "APROVAR" ? "Excecao aprovada." : "Excecao rejeitada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel decidir a excecao.",
      );
    } finally {
      setDecidingId(null);
    }
  }

  const hasPendente = proposta?.excecoes.some(
    (excecao) => excecao.status === "PENDENTE",
  );
  const canDecideExcecao =
    proposta?.currentUser?.papel === "ADMIN" ||
    proposta?.currentUser?.papel === "GERENTE";

  function renderExcecoesCard(className = "") {
    if (!proposta) {
      return null;
    }

    return (
      <section
        className={`rounded-3xl border border-[#D7DEEA] bg-white p-5 ${className}`}
      >
        <h2 className="font-bold text-[#1A2E5A]">Excecoes</h2>
        <p className="mt-1 text-sm text-[#667085]">
          Alteracoes sensiveis exigem aprovacao de ADMIN ou GERENTE.
        </p>
        <div className="mt-4 space-y-3">
          {proposta.excecoes.length === 0 ? (
            <p className="text-sm text-[#667085]">
              Nenhuma excecao registrada.
            </p>
          ) : (
            proposta.excecoes.map((excecao) => (
              <div
                key={excecao.id}
                className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#1A2E5A]">
                    {excecao.bloco?.titulo ?? excecao.campo}
                  </p>
                  <Badge className="bg-white text-[#1A2E5A]">
                    {excecao.status === "PENDENTE"
                      ? "Pendente"
                      : excecao.status === "APROVADA"
                        ? "Aprovada"
                        : "Rejeitada"}
                  </Badge>
                </div>
                <p className="mt-2 text-[#667085]">
                  {excecao.justificativa}
                </p>
                <details className="mt-2 text-xs text-[#667085]">
                  <summary>Ver alteracao proposta</summary>
                  <p className="mt-2 whitespace-pre-wrap">
                    De: {stringifyValue(excecao.valorAnterior)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">
                    Para: {stringifyValue(excecao.valorProposto)}
                  </p>
                </details>
                {excecao.status === "PENDENTE" && canDecideExcecao ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={decidingId === excecao.id}
                      onClick={() => decidirExcecao(excecao.id, "APROVAR")}
                      className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Check className="size-4" />
                      Aprovar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={decidingId === excecao.id}
                      onClick={() => decidirExcecao(excecao.id, "REJEITAR")}
                      className="rounded-2xl border-red-200 text-red-700"
                    >
                      <X className="size-4" />
                      Rejeitar
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation
          currentPage="Proposta comercial"
          currentHref={`/propostas/${id}`}
        />

        <header className="mb-6 overflow-hidden rounded-3xl border border-[#D7DEEA] bg-white shadow-sm">
          <div className="bg-[#1A2E5A] px-6 py-5 text-white">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                  Villa Empreendimentos
                </p>
                <h1 className="mt-2 break-words text-2xl font-bold sm:text-3xl">
                  {proposta
                    ? `${proposta.numeroProposta} v${proposta.versao}`
                    : "Proposta comercial"}
                </h1>
                {proposta ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                    {proposta.oportunidade.empresa.nomeFantasia ??
                      proposta.oportunidade.empresa.razaoSocial}{" "}
                    · {proposta.oportunidade.titulo}
                  </p>
                ) : null}
              </div>

              <Button
                type="button"
                disabled={!proposta || hasPendente}
                onClick={() => window.open(`/api/propostas/${id}/pdf`, "_blank")}
                className="w-full shrink-0 rounded-2xl bg-white text-[#1A2E5A] hover:bg-[#E8EEFB] sm:w-auto"
              >
                <Download className="size-4" />
                {hasPendente ? "PDF bloqueado" : "Baixar PDF"}
              </Button>
            </div>
          </div>

          {proposta ? (
            <div className="grid gap-4 px-6 py-5 md:grid-cols-3">
              <div className="rounded-2xl bg-[#F4F6FA] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className="bg-[#E8EEFB] text-[#1A2E5A]">
                    {statusLabels[proposta.status] ?? proposta.status}
                  </Badge>
                  {hasPendente ? (
                    <Badge className="bg-orange-100 text-orange-700">
                      Excecao pendente
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl bg-[#F4F6FA] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Cliente
                </p>
                <p className="mt-2 font-semibold text-[#1A2E5A]">
                  {proposta.oportunidade.empresa.nomeFantasia ??
                    proposta.oportunidade.empresa.razaoSocial}
                </p>
              </div>
              <div className="rounded-2xl bg-[#F4F6FA] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                  Blocos
                </p>
                <p className="mt-2 font-semibold text-[#1A2E5A]">
                  {proposta.blocos.length} secoes da proposta
                </p>
              </div>
            </div>
          ) : null}
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando proposta...
          </div>
        ) : proposta ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-5">
              <section className="rounded-3xl border border-[#D7DEEA] bg-white p-3 shadow-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("preview")}
                    className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      modoVisualizacao === "preview"
                        ? "bg-[#1A2E5A] text-white"
                        : "bg-[#F4F6FA] text-[#1A2E5A] hover:bg-[#E8EEFB]"
                    }`}
                  >
                    <Eye className="size-4" />
                    Visualizar proposta
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVisualizacao("edicao")}
                    className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      modoVisualizacao === "edicao"
                        ? "bg-[#1A2E5A] text-white"
                        : "bg-[#F4F6FA] text-[#1A2E5A] hover:bg-[#E8EEFB]"
                    }`}
                  >
                    <FileText className="size-4" />
                    Editar blocos
                  </button>
                </div>
              </section>

              {modoVisualizacao === "preview" ? (
                <section className="rounded-3xl border border-[#D7DEEA] bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-[#1A2E5A]">
                        Visualizacao da proposta
                      </h2>
                      <p className="text-sm text-[#667085]">
                        Esta é a versão que será usada para gerar o PDF.
                      </p>
                    </div>
                  </div>
                  <PropostaPreview html={proposta.htmlSnapshot} />
                </section>
              ) : (
                <section className="space-y-4">
                  {proposta.blocos.map((bloco) => {
                    const isBlocked = bloco.tipo === "BLOQUEADO";
                    const needsApproval = bloco.tipo === "EDITAVEL_COM_APROVACAO";

                    return (
                      <details
                        key={bloco.id}
                        className="overflow-hidden rounded-3xl border border-[#D7DEEA] bg-white shadow-sm"
                        open={!isBlocked}
                      >
                        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 bg-[#F4F6FA] px-5 py-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                              {tipoLabels[bloco.tipo]}
                            </p>
                            <h2 className="mt-1 font-bold text-[#1A2E5A]">
                              {bloco.titulo}
                            </h2>
                          </div>
                          <Badge
                            className={
                              isBlocked
                                ? "bg-slate-100 text-slate-700"
                                : needsApproval
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-[#E8EEFB] text-[#1A2E5A]"
                            }
                          >
                            {isBlocked
                              ? "Somente leitura"
                              : needsApproval
                                ? "Exige aprovacao"
                                : "Editavel"}
                          </Badge>
                        </summary>

                        <div className="p-5">
                          <Textarea
                            value={conteudos[bloco.id] ?? bloco.conteudoAtual}
                            readOnly={isBlocked}
                            onChange={(event) =>
                              setConteudos((current) => ({
                                ...current,
                                [bloco.id]: event.target.value,
                              }))
                            }
                            className="min-h-56 rounded-2xl bg-[#F4F6FA] leading-6"
                          />

                          {!isBlocked ? (
                            <div className="mt-4 space-y-3">
                              {needsApproval ? (
                                <div>
                                  <Label className="text-[#1A2E5A]">
                                    Justificativa obrigatoria para aprovacao
                                  </Label>
                                  <Textarea
                                    value={justificativas[bloco.id] ?? ""}
                                    onChange={(event) =>
                                      setJustificativas((current) => ({
                                        ...current,
                                        [bloco.id]: event.target.value,
                                      }))
                                    }
                                    className="mt-2 min-h-20 rounded-2xl bg-white"
                                  />
                                </div>
                              ) : null}
                              <Button
                                type="button"
                                disabled={savingId === bloco.id}
                                onClick={() => salvarBloco(bloco)}
                                className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
                              >
                                {savingId === bloco.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Save className="size-4" />
                                )}
                                {needsApproval
                                  ? "Solicitar aprovacao"
                                  : "Salvar bloco"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                </section>
              )}
            </div>

            <aside className="min-w-0 space-y-4">
              {renderExcecoesCard()}
              <section className="rounded-3xl border border-[#D7DEEA] bg-white p-5 shadow-sm">
                <h2 className="font-bold text-[#1A2E5A]">Como usar</h2>
                <div className="mt-3 space-y-3 text-sm leading-6 text-[#667085]">
                  <p>
                    Use <b>Visualizar proposta</b> para conferir o documento
                    pronto.
                  </p>
                  <p>
                    Use <b>Editar blocos</b> somente quando precisar ajustar
                    textos específicos antes de baixar o PDF.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-12 text-center text-[#667085]">
            Proposta nao encontrada.
          </div>
        )}
      </div>
    </main>
  );
}
