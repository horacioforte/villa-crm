"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StatusProposta = "RASCUNHO" | "ENVIADA" | "APROVADA" | "REJEITADA" | "VENCIDA";

type PropostaResumo = {
  id: string;
  numeroProposta: string;
  versao: number;
  status: StatusProposta;
  templateUtilizado: string;
  valorTotal: string | number;
  validadeProposta: string;
  createdAt: string;
};

const statusConfig: Record<StatusProposta, { label: string; className: string }> = {
  RASCUNHO: { label: "Rascunho", className: "bg-slate-100 text-slate-700" },
  ENVIADA: { label: "Enviada", className: "bg-amber-100 text-amber-700" },
  APROVADA: { label: "Aprovada", className: "bg-emerald-100 text-emerald-700" },
  REJEITADA: { label: "Rejeitada", className: "bg-red-100 text-red-700" },
  VENCIDA: { label: "Vencida", className: "bg-zinc-100 text-zinc-700" },
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
}: {
  oportunidadeId: string;
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const [propostas, setPropostas] = useState<PropostaResumo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadPropostas() {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/oportunidades/${oportunidadeId}/propostas`,
        );

        if (!response.ok) {
          throw new Error("Falha ao carregar propostas.");
        }

        setPropostas(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar as propostas.");
      } finally {
        setIsLoading(false);
      }
    }

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
      setPropostas((current) =>
        current.map((item) => (item.id === proposta.id ? proposta : item)),
      );
      toast.success("Proposta marcada como enviada.");
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

  if (propostas.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#D7DEEA] p-4 text-sm text-[#667085]">
        Nenhuma proposta gerada para esta oportunidade.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {propostas.map((proposta) => (
        <div
          key={proposta.id}
          className="rounded-3xl border border-[#D7DEEA] bg-white p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#1A2E5A]">
                {proposta.numeroProposta} v{proposta.versao}
              </p>
              <p className="mt-1 text-xs text-[#667085]">
                {formatCurrency(proposta.valorTotal)} - validade{" "}
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
              onClick={() => window.open(`/api/propostas/${proposta.id}/pdf`, "_blank")}
              className="rounded-2xl"
            >
              <Download className="size-4" />
              PDF
            </Button>
            {proposta.status === "RASCUNHO" ? (
              <Button
                type="button"
                size="sm"
                disabled={sendingId === proposta.id}
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
        </div>
      ))}
    </div>
  );
}
