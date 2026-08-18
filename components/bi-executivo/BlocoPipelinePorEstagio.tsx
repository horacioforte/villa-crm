"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Layers } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/bi-executivo/InfoTooltip";

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
  const semDados = dados.quantidadeComProposta === 0;
  const chartData = dados.porEstagio.map((item) => ({
    estagio: estagioLabels[item.estagio] ?? item.estagio,
    valor: item.valor,
  }));

  return (
    <Card className="h-full rounded-2xl border-[#D7DEEA] bg-white print:rounded-lg print:shadow-none">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-center gap-1.5 text-[#667085]">
          <Layers className="size-3.5" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">Pipeline por Estágio</p>
          <InfoTooltip>
            Decompõe o Pipeline Proposto entre Proposta Enviada e Negociação — os dois estágios onde uma
            proposta vigente normalmente existe.
          </InfoTooltip>
        </div>

        {semDados ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
            <Layers className="size-5 text-[#D7DEEA]" />
            <p className="text-xs font-semibold text-[#475569]">Ainda não há propostas vigentes</p>
            <p className="text-[10.5px] text-[#98A2B3]">
              O gráfico aparece quando propostas entrarem no pipeline
            </p>
          </div>
        ) : (
          <div className="flex-1" style={{ minHeight: 70 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="estagio"
                  type="category"
                  tick={{ fontSize: 10.5, fill: "#1A2E5A" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <ChartTooltip
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 10, borderColor: "#D7DEEA", fontSize: 11, padding: "4px 8px" }}
                />
                <Bar dataKey="valor" fill="#1E4FAB" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F4F6FA] px-3 py-1.5 text-[11px]">
          <span className="text-[#667085]">
            {dados.quantidadeComProposta} proposta{dados.quantidadeComProposta === 1 ? "" : "s"}
          </span>
          <span className="font-semibold text-[#1A2E5A]">
            Ticket médio {formatCurrency(dados.ticketMedio)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
