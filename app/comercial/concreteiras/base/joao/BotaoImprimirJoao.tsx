"use client";

// ARQUIVO: app/comercial/concreteiras/base/joao/BotaoImprimirJoao.tsx
// REGRA: nunca remover. Apenas acrescentar.
import { useState } from "react";
import { Printer } from "lucide-react";

export function BotaoImprimirJoao({ query }: { query: string }) {
  const [estado, setEstado] = useState<"livre" | "registrando">("livre");
  return (
    <button type="button" disabled={estado === "registrando"} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white print:hidden"
      onClick={async () => {
        setEstado("registrando");
        try { await fetch("/api/base-nacional/joao/relatorio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }); } catch { /* impressão segue */ }
        setEstado("livre");
        window.print();
      }}>
      <Printer className="h-3.5 w-3.5" /> {estado === "registrando" ? "Registrando…" : "Imprimir"}
    </button>
  );
}
