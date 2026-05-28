"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { PropostaPreview } from "@/components/propostas/PropostaPreview";
import { Button } from "@/components/ui/button";

type PropostaDetalhe = {
  id: string;
  numeroProposta: string;
  versao: number;
  status: string;
  htmlSnapshot: string;
  oportunidade: {
    titulo: string;
    empresa: {
      razaoSocial: string;
      nomeFantasia: string | null;
    };
  };
};

export function PropostaPageClient({ id }: { id: string }) {
  const [proposta, setProposta] = useState<PropostaDetalhe | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProposta() {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/propostas/${id}`);

        if (!response.ok) {
          throw new Error("Falha ao carregar proposta.");
        }

        setProposta(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar a proposta.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProposta();
  }, [id]);

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-5xl">
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
          </div>

          <Button
            type="button"
            onClick={() => window.open(`/api/propostas/${id}/pdf`, "_blank")}
            className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            <Download className="size-4" />
            Baixar PDF
          </Button>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando proposta...
          </div>
        ) : proposta ? (
          <PropostaPreview html={proposta.htmlSnapshot} />
        ) : (
          <div className="rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-12 text-center text-[#667085]">
            Proposta nao encontrada.
          </div>
        )}
      </div>
    </main>
  );
}
