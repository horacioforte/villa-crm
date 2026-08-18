import { ArrowDown } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export function BlocoFunilComercial({
  funil,
}: {
  funil: {
    abertas: number;
    comProposta: number;
    emNegociacao: number;
    ganhasNoPeriodo: number;
    taxaAbertasParaProposta: number;
    taxaPropostaParaNegociacao: number;
  };
}) {
  const etapas = [
    { label: "Abertas", valor: funil.abertas },
    { label: "Com proposta", valor: funil.comProposta, taxa: funil.taxaAbertasParaProposta },
    { label: "Em negociação", valor: funil.emNegociacao, taxa: funil.taxaPropostaParaNegociacao },
  ];

  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
          Funil Comercial
        </p>
        <div className="mt-3 space-y-1">
          {etapas.map((etapa, index) => (
            <div key={etapa.label}>
              {index > 0 ? (
                <div className="flex items-center gap-2 py-0.5 pl-1 text-[10px] text-[#98A2B3]">
                  <ArrowDown className="size-3" />
                  {etapa.taxa !== undefined ? pct(etapa.taxa) : null}
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-2xl bg-[#F4F6FA] px-3 py-2">
                <span className="text-xs font-medium text-[#1A2E5A]">{etapa.label}</span>
                <span className="text-lg font-bold text-[#1A2E5A]">{etapa.valor}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <span className="text-xs font-medium text-emerald-800">Ganhas no período</span>
          <span className="text-lg font-bold text-emerald-800">{funil.ganhasNoPeriodo}</span>
        </div>
        <p className="mt-3 text-[10px] text-[#98A2B3]">
          Abertas / Com proposta / Em negociação são uma fotografia de agora. "Ganhas no período"
          é a única métrica de movimento — por isso aparece separada, sem taxa em relação às demais.
        </p>
      </CardContent>
    </Card>
  );
}
