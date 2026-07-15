"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const CORES: Record<string, string> = {
  SITE: "#1E4FAB",
  WHATSAPP: "#1BAF7A",
  EMAIL: "#4A3AA7",
};

type OrigemLead = {
  canal: string;
  label: string;
  quantidade: number;
  conversaoPct: number;
  qualidade: string;
};

export function OrigemLeadsDonut({ dados }: { dados: OrigemLead[] }) {
  const total = dados.reduce((acc, d) => acc + d.quantidade, 0);
  const comDados = dados.filter((d) => d.quantidade > 0);

  if (total === 0) {
    return (
      <div className="flex h-[104px] items-center justify-center text-sm text-[#98A2B3]">
        Sem leads registrados ainda.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[104px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={comDados}
              dataKey="quantidade"
              nameKey="label"
              innerRadius={32}
              outerRadius={52}
              stroke="none"
            >
              {comDados.map((d) => (
                <Cell key={d.canal} fill={CORES[d.canal] ?? "#98A2B3"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #D7DEEA",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <b className="text-[19px] font-extrabold text-[#1A2E5A] tabular-nums">{total}</b>
          <span className="text-[9.5px] text-[#667085]">leads</span>
        </div>
      </div>
      <div className="flex-1 text-xs">
        {dados.map((d) => (
          <div key={d.canal} className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-2 py-1">
            <span
              className="size-2 rounded-full"
              style={{ background: CORES[d.canal] ?? "#98A2B3" }}
            />
            <span className="font-medium text-[#1A2E5A]">{d.label}</span>
            <span className="text-right tabular-nums text-[#667085]">{d.quantidade}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background:
                  d.qualidade === "Alta" ? "#E4F5EA" : d.qualidade === "Média" ? "#FCF1DA" : "#FBE9E9",
                color:
                  d.qualidade === "Alta" ? "#0C8A3E" : d.qualidade === "Média" ? "#B5790A" : "#D03B3B",
              }}
            >
              {d.qualidade}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
