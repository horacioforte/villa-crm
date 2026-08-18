import { GitBranch } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/bi-executivo/InfoTooltip";

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
  const max = Math.max(funil.abertas, 1);
  const etapas = [
    { label: "Abertas", valor: funil.abertas },
    { label: "Com proposta", valor: funil.comProposta, taxa: funil.taxaAbertasParaProposta },
    { label: "Negociação", valor: funil.emNegociacao, taxa: funil.taxaPropostaParaNegociacao },
  ];

  return (
    <Card className="h-full rounded-2xl border-[#D7DEEA] bg-white print:rounded-lg print:shadow-none">
      <CardContent className="flex h-full flex-col p-4 print:p-2.5">
        <div className="flex items-center gap-1.5 text-[#667085]">
          <GitBranch className="size-3.5" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">Funil Comercial</p>
          <InfoTooltip>
            Pipeline Atual é uma fotografia de agora (estoque). Resultado do Período mede movimento — são
            populações diferentes, por isso ficam visualmente separadas.
          </InfoTooltip>
        </div>

        <p className="mt-2 text-[9.5px] font-bold uppercase tracking-wider text-[#98A2B3] print:mt-1">
          Pipeline atual
        </p>
        <div className="mt-1.5 space-y-1.5 print:mt-1 print:space-y-1">
          {etapas.map((etapa) => (
            <div key={etapa.label} className="flex items-center gap-2">
              <span className="w-[78px] shrink-0 text-[11px] text-[#475569]">{etapa.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#EEF1F7]">
                <div
                  className="h-full rounded-full bg-[#1E4FAB]"
                  style={{ width: `${Math.min(100, (etapa.valor / max) * 100)}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs font-bold text-[#1A2E5A]">
                {etapa.valor}
              </span>
              {etapa.taxa !== undefined && funil.abertas > 0 && etapa.label === "Com proposta" ? (
                <span className="w-9 shrink-0 text-right text-[9.5px] text-[#98A2B3]">{pct(etapa.taxa)}</span>
              ) : etapa.taxa !== undefined && funil.comProposta > 0 && etapa.label === "Negociação" ? (
                <span className="w-9 shrink-0 text-right text-[9.5px] text-[#98A2B3]">{pct(etapa.taxa)}</span>
              ) : (
                <span className="w-9 shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="my-2.5 border-t border-dashed border-[#D7DEEA] print:my-1.5" />

        <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#98A2B3]">
          Resultado do período
        </p>
        <div className="mt-1.5 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 print:mt-1 print:py-1.5">
          <span className="text-xs font-semibold text-emerald-800">Ganhas no período</span>
          <span className="text-lg font-bold text-emerald-800 print:text-base">{funil.ganhasNoPeriodo}</span>
        </div>
      </CardContent>
    </Card>
  );
}
