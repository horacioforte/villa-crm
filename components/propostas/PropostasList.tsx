"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StatusProposta =
  | "RASCUNHO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADA"
  | "ENVIADA"
  | "ACEITA"
  | "REJEITADA"
  | "VENCIDA"
  | "CANCELADA";

type PropostaResumo = {
  id: string;
  propostaId?: string | null;
  numeroProposta: string;
  versao: number;
  ativa?: boolean;
  status: StatusProposta;
  templateUtilizado: string;
  valorTotal: string | number;
  validadeProposta: string;
  createdAt: string;
  excecoes?: Array<{ status: "PENDENTE" | "APROVADA" | "REJEITADA" }>;
};

type TipoProposta = "BETONEIRA" | "BOMBA" | "CENTRAL" | "TELEBELT" | "OUTRO";

type PropostaGrupoResumo = {
  id: string;
  numero: string;
  tipoProposta: TipoProposta;
  descricao: string | null;
  versoes: PropostaResumo[];
};

type PropostasResponse = {
  grupos: PropostaGrupoResumo[];
  legadas: PropostaResumo[];
  totalProposto: number;
};

const statusConfig: Record<StatusProposta, { label: string; className: string }> = {
  RASCUNHO: { label: "Rascunho", className: "bg-slate-100 text-slate-700" },
  AGUARDANDO_APROVACAO: {
    label: "Aguardando aprovacao",
    className: "bg-orange-100 text-orange-700",
  },
  APROVADA: { label: "Aprovada", className: "bg-emerald-100 text-emerald-700" },
  ENVIADA: { label: "Enviada", className: "bg-amber-100 text-amber-700" },
  ACEITA: { label: "Aceita", className: "bg-green-100 text-green-700" },
  REJEITADA: { label: "Rejeitada", className: "bg-red-100 text-red-700" },
  VENCIDA: { label: "Vencida", className: "bg-zinc-100 text-zinc-700" },
  CANCELADA: { label: "Cancelada", className: "bg-zinc-100 text-zinc-700" },
};

const tipoPropostaLabels: Record<TipoProposta, string> = {
  BETONEIRA: "Betoneira",
  BOMBA: "Bomba de concreto",
  CENTRAL: "Central de concreto",
  TELEBELT: "Telebelt",
  OUTRO: "Outro",
};

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export function PropostasList({
  oportunidadeId,
  refreshKey,
  onChanged,
  onTotalPropostoChange,
}: {
  oportunidadeId: string;
  refreshKey?: number;
  onChanged?: () => void;
  onTotalPropostoChange?: (value: number) => void;
}) {
  const [grupos, setGrupos] = useState<PropostaGrupoResumo[]>([]);
  const [legadas, setLegadas] = useState<PropostaResumo[]>([]);
  const [totalProposto, setTotalProposto] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function loadPropostas() {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/oportunidades/${oportunidadeId}/propostas`,
      );

      if (!response.ok) {
        throw new Error("Falha ao carregar propostas.");
      }

      const data = (await response.json()) as PropostasResponse | PropostaResumo[];

      if (Array.isArray(data)) {
        setGrupos([]);
        setLegadas(data);
        setTotalProposto(0);
        onTotalPropostoChange?.(0);
      } else {
        setGrupos(data.grupos ?? []);
        setLegadas(data.legadas ?? []);
        setTotalProposto(data.totalProposto ?? 0);
        onTotalPropostoChange?.(data.totalProposto ?? 0);
      }
    } catch {
      toast.error("Nao foi possivel carregar as propostas.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPropostas();
  }, [oportunidadeId, refreshKey]);

  async function handleEnviar(propostaId: string) {
    setSendingId(propostaId);

    try {
      const response = await fetch(`/api/propostas/${propostaId}/enviar`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao enviar proposta.");
      }

      const proposta = await response.json();
      setGrupos((current) =>
        current.map((grupo) => ({
          ...grupo,
          versoes: grupo.versoes.map((item) =>
            item.id === proposta.id ? proposta : item,
          ),
        })),
      );
      setLegadas((current) =>
        current.map((item) => (item.id === proposta.id ? proposta : item)),
      );
      toast.success("Proposta marcada como enviada.");
      await loadPropostas();
      onChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar a proposta.",
      );
    } finally {
      setSendingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center rounded-3xl border border-dashed border-[#D7DEEA] p-4 text-sm text-[#667085]">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Carregando propostas...
      </div>
    );
  }

  if (grupos.length === 0 && legadas.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#D7DEEA] p-4 text-sm text-[#667085]">
        Nenhuma proposta gerada para esta oportunidade.
      </div>
    );
  }

  function getVersaoAtiva(grupo: PropostaGrupoResumo) {
    return grupo.versoes.find((versao) => versao.ativa) ?? grupo.versoes[0] ?? null;
  }

  function renderActions(proposta: PropostaResumo) {
    const hasPendente = proposta.excecoes?.some(
      (excecao) => excecao.status === "PENDENTE",
    );

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => window.open(`/propostas/${proposta.id}`, "_blank")}
          className="rounded-2xl"
        >
          <Eye className="size-4" />
          Abrir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={hasPendente}
          onClick={() => window.open(`/api/propostas/${proposta.id}/pdf`, "_blank")}
          className="rounded-2xl"
        >
          <Download className="size-4" />
          PDF
        </Button>
        {["RASCUNHO", "APROVADA"].includes(proposta.status) ? (
          <Button
            type="button"
            size="sm"
            disabled={sendingId === proposta.id || hasPendente}
            onClick={() => handleEnviar(proposta.id)}
            className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            {sendingId === proposta.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grupos.map((grupo) => {
        const ativa = getVersaoAtiva(grupo);
        const anteriores = grupo.versoes.filter((versao) => versao.id !== ativa?.id);

        return (
        <div
          key={grupo.id}
          className="rounded-3xl border border-[#D7DEEA] bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#1A2E5A]">
                {tipoPropostaLabels[grupo.tipoProposta]} · {grupo.numero}
              </p>
              {ativa ? (
                <p className="mt-1 text-xs text-[#667085]">
                  v{ativa.versao} ativa · {formatCurrency(ativa.valorTotal)} ·
                  validade {formatDate(ativa.validadeProposta)}
                </p>
              ) : null}
              {grupo.descricao ? (
                <p className="mt-1 text-xs text-[#667085]">{grupo.descricao}</p>
              ) : null}
            </div>
            {ativa ? (
              <Badge
                variant="secondary"
                className={statusConfig[ativa.status].className}
              >
                {statusConfig[ativa.status].label}
              </Badge>
            ) : null}
          </div>

          {ativa ? renderActions(ativa) : null}

          {anteriores.length ? (
            <details className="mt-3 rounded-2xl bg-[#F4F6FA] px-3 py-2 text-sm text-[#667085]">
              <summary className="cursor-pointer font-semibold text-[#1A2E5A]">
                Versões anteriores ({anteriores.length})
              </summary>
              <div className="mt-2 space-y-2">
                {anteriores.map((versao) => (
                  <div
                    key={versao.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      v{versao.versao} · {formatCurrency(versao.valorTotal)}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/propostas/${versao.id}`, "_blank")}
                      className="h-8 rounded-2xl"
                    >
                      Abrir
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
        );
      })}

      {legadas.map((proposta) => (
        <div
          key={proposta.id}
          className="rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#1A2E5A]">
                Legada · {proposta.numeroProposta} v{proposta.versao}
              </p>
              <p className="mt-1 text-xs text-[#667085]">
                {formatCurrency(proposta.valorTotal)} · validade{" "}
                {formatDate(proposta.validadeProposta)}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={statusConfig[proposta.status].className}
            >
              {statusConfig[proposta.status].label}
            </Badge>
          </div>
          {renderActions(proposta)}
        </div>
      ))}

      <div className="flex items-center justify-between rounded-3xl bg-[#1A2E5A] px-4 py-3 text-white">
        <span className="text-sm">Total proposto</span>
        <span className="font-semibold">{formatCurrency(totalProposto)}</span>
      </div>
    </div>
  );
}
