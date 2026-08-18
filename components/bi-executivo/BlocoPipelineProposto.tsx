import { CircleDollarSign } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function BlocoPipelineProposto({
  proposto,
  potencial,
}: {
  proposto: { total: number; quantidade: number };
  potencial: { total: number; quantidade: number };
}) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[#667085]">
          <CircleDollarSign className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">Pipeline Proposto</p>
        </div>
        <p className="mt-2 text-3xl font-bold text-[#1A2E5A]">{formatCurrency(proposto.total)}</p>
        <p className="mt-1 text-xs text-[#667085]">
          {proposto.quantidade} proposta{proposto.quantidade === 1 ? "" : "s"} vigente
          {proposto.quantidade === 1 ? "" : "s"} de oportunidades abertas
        </p>
        {proposto.total === 0 ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Nenhuma oportunidade aberta tem proposta vigente hoje. Dinheiro em disputa neste
            momento: zero — mesmo com {formatCurrency(potencial.total)} de potencial em{" "}
            {potencial.quantidade} oportunidades abertas.
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#E8EEFB] px-3 py-2 text-xs">
          <span className="text-[#1A2E5A]">Pipeline Potencial (referência)</span>
          <span className="font-bold text-[#1E4FAB]">{formatCurrency(potencial.total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
