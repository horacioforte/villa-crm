import { CircleDollarSign } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/bi-executivo/InfoTooltip";

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
  const semProposta = proposto.total === 0;

  return (
    <Card className="h-full rounded-2xl border-[#D7DEEA] bg-white print:rounded-lg print:shadow-none">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-center gap-1.5 text-[#667085]">
          <CircleDollarSign className="size-3.5" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">Pipeline Proposto</p>
          <InfoTooltip>
            Valor das propostas vigentes de oportunidades ainda abertas. Nunca inclui GANHA, PERDIDA,
            versões antigas de proposta nem valores simbólicos abaixo de R$ 100.
          </InfoTooltip>
        </div>

        {semProposta ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-sm font-bold text-[#1A2E5A]">Nenhuma proposta vigente</p>
            <p className="text-xs text-[#667085]">0 propostas abertas</p>
            {potencial.quantidade > 0 ? (
              <div className="mt-1.5 rounded-lg bg-[#EFF4FF] px-3 py-1.5 text-[11px] text-[#1849A9]">
                {potencial.quantidade} oportunidade{potencial.quantidade === 1 ? "" : "s"} com potencial
                ainda sem proposta
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[32px] font-bold leading-none text-[#1A2E5A]">
              {formatCurrency(proposto.total)}
            </p>
            <p className="mt-1.5 text-xs text-[#667085]">
              {proposto.quantidade} proposta{proposto.quantidade === 1 ? "" : "s"} vigente
              {proposto.quantidade === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
