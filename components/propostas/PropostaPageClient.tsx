"use client";

import { useEffect, useState } from "react";
import { Check, Download, Loader2, Save, X } from "lucide-react";
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

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageNavigation
          currentPage="Proposta comercial"
          currentHref={`/propostas/${id}`}
        />

        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-[#D7DEEA] bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa Empreendimentos
            </p>
            <h1 className="mt-2 text-2xl font-bold text-[#1A2E5A]">
              {proposta
                ? `${proposta.numeroProposta} v${proposta.versao}`
                : "Proposta comercial"}
            </h1>
            {proposta ? (
              <p className="mt-1 text-sm text-[#667085]">
                {proposta.oportunidade.empresa.nomeFantasia ??
                  proposta.oportunidade.empresa.razaoSocial}{" "}
                - {proposta.oportunidade.titulo}
              </p>
            ) : null}
            {proposta ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-[#E8EEFB] text-[#1A2E5A]">
                  {statusLabels[proposta.status] ?? proposta.status}
                </Badge>
                {hasPendente ? (
                  <Badge className="bg-orange-100 text-orange-700">
                    Excecao pendente
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            disabled={!proposta || hasPendente}
            onClick={() => window.open(`/api/propostas/${id}/pdf`, "_blank")}
            className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            <Download className="size-4" />
            {hasPendente ? "PDF bloqueado" : "Baixar PDF"}
          </Button>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando proposta...
          </div>
        ) : proposta ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <section className="space-y-4">
              {proposta.blocos.map((bloco) => {
                const isBlocked = bloco.tipo === "BLOQUEADO";
                const needsApproval = bloco.tipo === "EDITAVEL_COM_APROVACAO";

                return (
                  <div
                    key={bloco.id}
                    className="rounded-3xl border border-[#D7DEEA] bg-white p-5"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                          {tipoLabels[bloco.tipo]}
                        </p>
                        <h2 className="mt-1 font-bold text-[#1A2E5A]">
                          {bloco.titulo}
                        </h2>
                      </div>
                      {isBlocked ? (
                        <Badge className="bg-slate-100 text-slate-700">
                          Somente leitura
                        </Badge>
                      ) : null}
                    </div>

                    <Textarea
                      value={conteudos[bloco.id] ?? bloco.conteudoAtual}
                      readOnly={isBlocked}
                      onChange={(event) =>
                        setConteudos((current) => ({
                          ...current,
                          [bloco.id]: event.target.value,
                        }))
                      }
                      className="min-h-48 rounded-2xl bg-[#F4F6FA]"
                    />

                    {!isBlocked ? (
                      <div className="mt-3 space-y-3">
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
                          {needsApproval ? "Solicitar aprovacao" : "Salvar bloco"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-[#D7DEEA] bg-white p-5">
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
                          <div className="mt-3 flex gap-2">
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

              <PropostaPreview html={proposta.htmlSnapshot} />
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
