"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

const periodoOptions = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "ano", label: "Ano atual" },
];

const tipoOptions = [
  { value: "TODOS", label: "Todos" },
  { value: "LOCACAO", label: "Locação" },
  { value: "EQUIPAMENTO_USADO", label: "Equipamento usado" },
];

export function FiltrosBI({
  periodoAtual,
  tipoAtual,
}: {
  periodoAtual: string;
  tipoAtual: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function atualizar(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor === "TODOS") {
      params.delete("tipo");
    } else {
      params.set(chave, valor);
    }
    if (chave === "periodo") {
      params.set("periodo", valor);
      params.delete("dataInicio");
      params.delete("dataFim");
    }
    router.push(`/bi-executivo?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-2xl border border-[#D7DEEA] bg-white p-1">
        {periodoOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => atualizar("periodo", opt.value)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              periodoAtual === opt.value
                ? "bg-[#1E4FAB] text-white"
                : "text-[#667085] hover:bg-[#F4F6FA]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 rounded-2xl border border-[#D7DEEA] bg-white p-1">
        {tipoOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => atualizar("tipo", opt.value)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              tipoAtual === opt.value
                ? "bg-[#1E4FAB] text-white"
                : "text-[#667085] hover:bg-[#F4F6FA]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
