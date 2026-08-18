import { Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { AnaliseExecutivaIA } from "@/lib/bi-executivo/analise";

export function AnaliseIA({ analise }: { analise: AnaliseExecutivaIA | null }) {
  return (
    <Card className="rounded-2xl border-[#D7DEEA] bg-white print:rounded-lg print:shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-[#1E4FAB]">
          <Sparkles className="size-3.5" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">CRM IA — Leitura Executiva</p>
        </div>

        {!analise ? (
          <p className="mt-2 text-xs text-[#667085]">
            Análise da IA indisponível no momento. Os números acima já refletem a camada central de
            métricas normalmente.
          </p>
        ) : (
          <div className="mt-2 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <p className="text-[13px] leading-snug text-[#1A2E5A]">{analise.analise}</p>
            {analise.alertas.length > 0 ? (
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-amber-700">Alertas</p>
                <ul className="mt-1 space-y-0.5 text-[11.5px] text-[#475569]">
                  {analise.alertas.slice(0, 3).map((alerta, index) => (
                    <li key={index}>• {alerta}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {analise.prioridades.length > 0 ? (
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#1E4FAB]">
                  Prioridades
                </p>
                <ol className="mt-1 space-y-0.5 text-[11.5px] text-[#475569]">
                  {analise.prioridades.slice(0, 3).map((prioridade, index) => (
                    <li key={index}>
                      {index + 1}. {prioridade}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
