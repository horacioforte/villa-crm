"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Eye, Loader2, Pencil, Send } from "lucide-react";
import { toast } from "sonner";

import type { StatusPropostaComercial } from "@/app/generated/prisma/client";

type ProposalQuickActionsProps = {
  propostaId: string;
  status: StatusPropostaComercial;
  hasPendingException: boolean;
};

const linkClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-[#D7DEEA] bg-white px-3 text-xs font-semibold text-[#1A2E5A] transition hover:border-[#1E4FAB] hover:text-[#1E4FAB]";

export function ProposalQuickActions({
  propostaId,
  status,
  hasPendingException,
}: ProposalQuickActionsProps) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const canSend =
    !hasPendingException && (status === "RASCUNHO" || status === "APROVADA");

  async function handleSend() {
    setIsSending(true);

    try {
      const response = await fetch(`/api/propostas/${propostaId}/enviar`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao enviar proposta.");
      }

      toast.success("Proposta marcada como enviada.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel enviar a proposta.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/propostas/${propostaId}`} className={linkClassName}>
        <Eye className="size-4" />
        Abrir
      </Link>

      {!hasPendingException ? (
        <Link
          href={`/api/propostas/${propostaId}/pdf`}
          target="_blank"
          className={linkClassName}
        >
          <Download className="size-4" />
          PDF
        </Link>
      ) : null}

      {status === "RASCUNHO" ? (
        <Link href={`/propostas/${propostaId}`} className={linkClassName}>
          <Pencil className="size-4" />
          Editar
        </Link>
      ) : null}

      {canSend ? (
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl bg-[#1E4FAB] px-3 text-xs font-semibold text-white transition hover:bg-[#1A2E5A] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Enviar
        </button>
      ) : null}
    </div>
  );
}
