"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts";
import { ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/bi-executivo/InfoTooltip";

export function BlocoOportunidadesAbertas({
  abertas,
  evolucao,
}: {
  abertas: number;
  evolucao: Array<{ mes: string; quantidade: number }>;
}) {
  const anterior = evolucao.length >= 2 ? evolucao[evolucao.length - 2] : null;
  const atual = evolucao.length >= 2 ? evolucao[evolucao.length - 1] : null;
  const diferenca = anterior && atual ? atual.quantidade - anterior.quantidade : null;
  const percentual =
    anterior && anterior.quantidade > 0 && diferenca !== null
      ? Math.round((diferenca / anterior.quantidade) * 1000) / 10
      : null;

  return (
    <Card className="h-full rounded-2xl border-[#D7DEEA] bg-white print:rounded-lg print:shadow-none">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-center gap-1.5 text-[#667085]">
          <ClipboardList className="size-3.5" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">Oportunidades Abertas</p>
          <InfoTooltip>
            Estágios abertos do pipeline: Nova, Em atendimento, Proposta enviada e Negociação. GANHA e
            PERDIDA nunca contam aqui.
          </InfoTooltip>
        </div>

        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-[32px] font-bold leading-none text-[#1A2E5A]">{abertas}</p>
          {diferenca !== null ? (
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-[#475569]">
                {diferenca >= 0 ? "+" : ""}
                {diferenca} vs. mês anterior
              </span>
              {percentual !== null ? (
                <InfoTooltip>
                  {percentual >= 0 ? "+" : ""}
                  {percentual}% em relação a {anterior?.mes}. Comparação absoluta é mais confiável aqui — o
                  percentual é só referência secundária.
                </InfoTooltip>
              ) : null}
            </div>
          ) : null}
        </div>

        {evolucao.length >= 2 ? (
          <div className="mt-2 flex-1" style={{ minHeight: 64 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                <ChartTooltip
                  formatter={(value: any) => `${value} abertas`}
                  contentStyle={{ borderRadius: 10, borderColor: "#D7DEEA", fontSize: 11, padding: "4px 8px" }}
                />
                <Line
                  type="monotone"
                  dataKey="quantidade"
                  stroke="#1E4FAB"
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 flex-1 text-[11px] text-[#98A2B3]">
            Histórico ainda curto para evolução — dados desde {evolucao[0]?.mes ?? "recentemente"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
