"use client";

import { FileDown, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BotaoGerarPdf({ periodo, tipo }: { periodo: string; tipo?: string }) {
  function abrirPdf() {
    const params = new URLSearchParams({ periodo });
    if (tipo) params.set("tipo", tipo);
    window.open(`/api/bi-executivo/pdf?${params.toString()}`, "_blank");
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => window.print()}
        className="h-9 rounded-2xl border-[#D7DEEA] text-[#1A2E5A]"
      >
        <Printer className="size-4" />
        Imprimir
      </Button>
      <Button
        type="button"
        onClick={abrirPdf}
        className="h-9 rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
      >
        <FileDown className="size-4" />
        Gerar PDF
      </Button>
    </div>
  );
}
