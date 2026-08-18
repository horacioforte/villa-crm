"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardList } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function BlocoOportunidadesAbertas({
  abertas,
  evolucao,
}: {
  abertas: number;
  evolucao: Array<{ mes: string; quantidade: number }>;
}) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[#667085]">
          <ClipboardList className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">Oportunidades Abertas</p>
        </div>
        <p className="mt-2 text-3xl font-bold text-[#1A2E5A]">{abertas}</p>
        <p className="mt-1 text-xs text-[#667085]">
          Estágios abertos do pipeline (Nova, Em atendimento, Proposta enviada, Negociação)
        </p>

        {evolucao.length >= 2 ? (
          <div className="mt-4 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
                <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                <Tooltip
                  formatter={(value: any) => `${value} abertas`}
                  contentStyle={{ borderRadius: 12, borderColor: "#D7DEEA", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="quantidade"
                  stroke="#1E4FAB"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  label={{ position: "top", fontSize: 11, fill: "#1A2E5A" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 text-xs text-[#667085]">
            Histórico ainda curto para gráfico de evolução — o CRM está reunindo dados desde{" "}
            {evolucao[0]?.mes ?? "recentemente"}.
          </p>
        )}
        <p className="mt-2 text-[10px] text-[#98A2B3]">
          Evolução real reconstruída a partir do histórico de mudanças de status — mostra só os meses em que o CRM realmente tem dado, sem preencher meses anteriores com zero.
        </p>
      </CardContent>
    </Card>
  );
}
