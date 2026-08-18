"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/bi-executivo/InfoTooltip";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(
    value,
  );
}
function formatCurrencyFull(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function BlocoResultadoComercial({
  ganhas,
  perdidas,
  taxaConversao,
  evolucao,
}: {
  ganhas: { quantidade: number; valor: number };
  perdidas: { quantidade: number; valor: number };
  taxaConversao: number;
  evolucao: Array<{ mes: string; contratado: number; perdido: number }>;
}) {
  return (
    <Card className="h-full rounded-2xl border-[#D7DEEA] bg-white print:rounded-lg print:shadow-none">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-center gap-1.5 text-[#667085]">
          <Trophy className="size-3.5" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">Resultado Comercial</p>
        </div>

        <div className="mt-2 flex gap-2">
          <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[9.5px] font-semibold uppercase text-emerald-700">Contratado</p>
            <p className="text-xl font-bold leading-tight text-emerald-800">{formatCurrency(ganhas.valor)}</p>
            <p className="text-[10px] text-emerald-700">
              {ganhas.quantidade} contrato{ganhas.quantidade === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[9.5px] font-semibold uppercase text-red-700">Perdido</p>
            <p className="text-xl font-bold leading-tight text-red-800">{formatCurrency(perdidas.valor)}</p>
            <p className="text-[10px] text-red-700">
              {perdidas.quantidade} negócio{perdidas.quantidade === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {evolucao.length > 0 ? (
          <div className="mt-2 flex-1" style={{ minHeight: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#98A2B3" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <ChartTooltip
                  formatter={(value: any) => formatCurrencyFull(Number(value))}
                  contentStyle={{ borderRadius: 10, borderColor: "#D7DEEA", fontSize: 11, padding: "4px 8px" }}
                />
                <Bar dataKey="contratado" name="Contratado" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="perdido" name="Perdido" fill="#EF4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-2 flex-1 text-[11px] text-[#98A2B3]">Sem histórico suficiente para evolução.</p>
        )}

        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
          <span className="text-[#667085]">Conversão do período:</span>
          <span className="font-bold text-[#1A2E5A]">{Math.round(taxaConversao * 100)}%</span>
          <InfoTooltip>Ganhas / (Ganhas + Perdidas), ambas fechadas no período selecionado.</InfoTooltip>
        </div>
      </CardContent>
    </Card>
  );
}
