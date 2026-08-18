import { Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { AnaliseExecutivaIA } from "@/lib/bi-executivo/analise";

export function AnaliseIA({ analise }: { analise: AnaliseExecutivaIA | null }) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[#1E4FAB]">
          <Sparkles className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">
            CRM IA — Análise Executiva
          </p>
        </div>

        {!analise ? (
          <p className="mt-3 text-xs text-[#667085]">
            Análise da IA indisponível no momento. Os números acima já refletem a camada central
            de métricas normalmente.
          </p>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <p className="text-sm text-[#1A2E5A] md:col-span-3">{analise.analise}</p>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Alertas
              </p>
              <ul className="mt-1 space-y-1 text-xs text-[#667085]">
                {analise.alertas.map((alerta, index) => (
                  <li key={index}>• {alerta}</li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1E4FAB]">
                Prioridades para a próxima semana
              </p>
              <ol className="mt-1 space-y-1 text-xs text-[#667085]">
                {analise.prioridades.map((prioridade, index) => (
                  <li key={index}>
                    {index + 1}. {prioridade}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
