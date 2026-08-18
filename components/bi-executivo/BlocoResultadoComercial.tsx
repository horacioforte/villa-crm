"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[#667085]">
          <Trophy className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">Resultado Comercial</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] text-emerald-700">Contratado no período</p>
            <p className="text-base font-bold text-emerald-800">{formatCurrency(ganhas.valor)}</p>
            <p className="text-[10px] text-emerald-700">{ganhas.quantidade} contrato{ganhas.quantidade === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[10px] text-red-700">Perdido no período</p>
            <p className="text-base font-bold text-red-800">{formatCurrency(perdidas.valor)}</p>
            <p className="text-[10px] text-red-700">{perdidas.quantidade} negócio{perdidas.quantidade === 1 ? "" : "s"}</p>
          </div>
        </div>

        <p className="mt-2 text-xs text-[#667085]">
          Taxa de conversão do período:{" "}
          <span className="font-semibold text-[#1A2E5A]">{Math.round(taxaConversao * 100)}%</span>{" "}
          <span className="text-[10px]">(ganhas / (ganhas + perdidas), ambas fechadas no período)</span>
        </p>

        {evolucao.length > 0 ? (
          <div className="mt-3 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucao} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EEF1F7" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(value: any) => formatCurrencyFull(Number(value))}
                  contentStyle={{ borderRadius: 12, borderColor: "#D7DEEA", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="contratado" name="Contratado" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="perdido" name="Perdido" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-4 text-xs text-[#667085]">
            Ainda sem histórico suficiente para o gráfico de evolução.
          </p>
        )}
        <p className="mt-2 text-[10px] text-[#98A2B3]">
          Evolução reconstruída a partir das datas reais de fechamento (histórico de status) — meses
          exibidos são só os que têm negócio fechado registrado.
        </p>
      </CardContent>
    </Card>
  );
}
