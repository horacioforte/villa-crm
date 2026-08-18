import Link from "next/link";
import { Star } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type OportunidadeEstrategica = {
  id: string;
  titulo: string;
  status: string;
  updatedAt: Date;
  empresa: { razaoSocial: string; nomeFantasia: string | null };
  obra: { nome: string } | null;
  responsavel: { nome: string } | null;
  tarefas: Array<{ titulo: string; dataVencimento: Date }>;
};

const statusLabels: Record<string, string> = {
  NOVA: "Nova",
  EM_ATENDIMENTO: "Em atendimento",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
};

export function BlocoOportunidadesEstrategicas({
  oportunidades,
}: {
  oportunidades: OportunidadeEstrategica[];
}) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-amber-700">
          <Star className="size-4 fill-amber-600" />
          <p className="text-xs font-semibold uppercase tracking-wide">
            Oportunidades Estratégicas — Sem Proposta
          </p>
        </div>

        {oportunidades.length === 0 ? (
          <p className="mt-4 text-xs text-[#667085]">
            Nenhuma oportunidade marcada como estratégica está sem proposta hoje. Marcações
            manuais podem ser feitas na tela de cada oportunidade (ADMIN/GERENTE).
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {oportunidades.map((oportunidade) => (
              <li key={oportunidade.id}>
                <Link
                  href={`/oportunidades?id=${oportunidade.id}`}
                  className="block rounded-2xl border border-amber-200 bg-amber-50 p-3 transition hover:border-amber-300"
                >
                  <p className="text-xs font-bold text-[#1A2E5A]">
                    {oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial}
                  </p>
                  <p className="text-[11px] text-[#667085]">
                    {oportunidade.obra?.nome ?? "Sem obra vinculada"} ·{" "}
                    {statusLabels[oportunidade.status] ?? oportunidade.status}
                  </p>
                  <p className="mt-1 text-[10px] text-[#667085]">
                    Responsável: {oportunidade.responsavel?.nome ?? "Sem responsável"}
                    {oportunidade.tarefas[0]
                      ? ` · Próxima ação: ${oportunidade.tarefas[0].titulo}`
                      : " · Sem próxima ação"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
