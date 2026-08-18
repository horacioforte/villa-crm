import Link from "next/link";
import { AlertTriangle, Star } from "lucide-react";

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

export function BlocoOportunidadesEstrategicas({
  oportunidades,
}: {
  oportunidades: OportunidadeEstrategica[];
}) {
  return (
    <Card className="h-full rounded-2xl border-[#D7DEEA] bg-white print:rounded-lg print:shadow-none">
      <CardContent className="flex h-full flex-col p-4 print:p-2.5">
        <div className="flex items-center gap-1.5 text-amber-700">
          <Star className="size-3.5 fill-amber-600" />
          <p className="text-[11px] font-semibold uppercase tracking-wide">Estratégicas sem Proposta</p>
        </div>

        {oportunidades.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-xs text-[#667085]">Nenhuma oportunidade estratégica marcada</p>
            <Link href="/oportunidades" className="text-xs font-semibold text-[#1E4FAB] hover:underline">
              Ver oportunidades →
            </Link>
          </div>
        ) : (
          <ul className="mt-1.5 flex-1 space-y-1.5 overflow-hidden">
            {oportunidades.map((oportunidade, index) => {
              const proximaAcao = oportunidade.tarefas[0];
              return (
                <li key={oportunidade.id}>
                  <Link
                    href={`/oportunidades?id=${oportunidade.id}`}
                    className="flex items-start gap-2 rounded-lg px-1.5 py-1 transition hover:bg-amber-50"
                  >
                    <span className="mt-0.5 w-4 shrink-0 text-[10px] font-bold text-amber-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-bold text-[#1A2E5A]">
                        {oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial}
                      </span>
                      <span className="block truncate text-[10px] text-[#667085]">
                        {oportunidade.obra?.nome ?? "Sem obra"} · {oportunidade.responsavel?.nome ?? "Sem responsável"}
                      </span>
                      {proximaAcao ? (
                        <span className="block truncate text-[10px] text-[#98A2B3]">
                          Próxima ação: {proximaAcao.titulo}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                          <AlertTriangle className="size-2.5" />
                          Sem próxima ação
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
