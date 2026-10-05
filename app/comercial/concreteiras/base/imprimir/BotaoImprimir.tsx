"use client";

// ARQUIVO: app/comercial/concreteiras/base/imprimir/BotaoImprimir.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Registra a impressão em RelatorioConcreteirasGerado e abre o diálogo do navegador.

import { useState } from "react";
import { Printer } from "lucide-react";

export function BotaoImprimir({ query }: { query: string }) {
  const [estado, setEstado] = useState<"livre" | "registrando" | "erro">("livre");

  async function imprimir() {
    setEstado("registrando");
    try {
      const r = await fetch("/api/base-nacional/relatorio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      setEstado(r.ok ? "livre" : "erro");
    } catch {
      setEstado("erro");
    }
    window.print();
  }

  return (
    <button type="button" onClick={imprimir} disabled={estado === "registrando"}
      className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60 print:hidden">
      <Printer className="h-3.5 w-3.5" />
      {estado === "registrando" ? "Registrando…" : "Imprimir"}
      {estado === "erro" && <span className="ml-1 text-[10px] text-amber-200">(registro falhou)</span>}
    </button>
  );
}
