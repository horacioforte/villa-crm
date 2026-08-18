"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(
    value,
  );
}

const estagioLabels: Record<string, string> = {
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
};

export function BlocoPipelinePorEstagio({
  dados,
}: {
  dados: {
    porEstagio: Array<{ estagio: string; quantidade: number; valor: number; percentual: number }>;
    ticketMedio: number;
    quantidadeComProposta: number;
  };
}) {
  const chartData = dados.porEstagio.map((item) => ({
    estagio: estagioLabels[item.estagio] ?? item.estagio,
    valor: item.valor,
    percentual: item.percentual,
  }));
  const semDados = dados.quantidadeComProposta === 0;

  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[#667085]">
          <Layers className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">Pipeline por Estágio</p>
        </div>

        {semDados ? (
          <p className="mt-4 text-xs text-[#667085]">
            Nenhuma proposta vigente em Proposta Enviada ou Negociação no momento.
          </p>
        ) : (
          <>
            <div className="mt-3 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke="#EEF1F7" />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="estagio"
                    type="category"
                    tick={{ fontSize: 11, fill: "#1A2E5A" }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: 12, borderColor: "#D7DEEA", fontSize: 12 }}
                  />
                  <Bar dataKey="valor" fill="#1E4FAB" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {dados.porEstagio.map((item) => (
                <div key={item.estagio} className="flex justify-between text-xs text-[#667085]">
                  <span>{estagioLabels[item.estagio] ?? item.estagio}</span>
                  <span className="font-semibold text-[#1A2E5A]">
                    {Math.round(item.percentual * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[#F4F6FA] px-3 py-2 text-center">
            <p className="text-[10px] text-[#667085]">Ticket médio</p>
            <p className="text-sm font-bold text-[#1A2E5A]">{formatCurrency(dados.ticketMedio)}</p>
          </div>
          <div className="rounded-2xl bg-[#F4F6FA] px-3 py-2 text-center">
            <p className="text-[10px] text-[#667085]">Com proposta</p>
            <p className="text-sm font-bold text-[#1A2E5A]">{dados.quantidadeComProposta}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
