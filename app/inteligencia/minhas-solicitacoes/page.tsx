// ARQUIVO: app/inteligencia/minhas-solicitacoes/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Lista dossiês solicitados manualmente por Horácio via CRM IA.
// Filtro: fonteInformacao STARTSWITH "Solicitado por Horácio" (case-insensitive).

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, MapPin, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { NovasSolicitacoesButton } from "./NovasSolicitacoesButton";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasDesde(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function corScore(score: number) {
  if (score >= 75) return "bg-red-100 text-red-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function labelStatus(status: string) {
  const map: Record<string, string> = {
    INVESTIGANDO:        "Investigando",
    AGUARDANDO_VALIDACAO:"Aguardando validação",
    EM_ANALISE:          "Em análise",
    PEDIR_MAIS_PESQUISA: "Mais pesquisa",
    PRONTO_PARA_ASSUMIR: "Pronto para assumir",
    ASSUMIDO:            "Assumido",
    ARQUIVADO:           "Arquivado",
  };
  return map[status] ?? status;
}

function corStatus(status: string) {
  if (status === "PRONTO_PARA_ASSUMIR") return "bg-emerald-100 text-emerald-700";
  if (status === "INVESTIGANDO")        return "bg-blue-100 text-blue-700";
  if (status === "ASSUMIDO")            return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-500";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default async function MinhasSolicitacoesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  // Auth
  const { req } = { req: null as any };
  // Server component — usa prisma direto; a auth é verificada pelo layout (middleware)

  const params = await searchParams;
  const filtroStatus = params.status;

  const where: Record<string, any> = {
    fonteInformacao: { startsWith: "Solicitado por Horácio", mode: "insensitive" },
    status: { notIn: ["ARQUIVADO"] },
  };
  if (filtroStatus) where.status = filtroStatus;

  const dossies = await prisma.dossieComercial.findMany({
    where,
    orderBy: [{ status: "asc" }, { score: "desc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      _count: { select: { decisores: true, empresasRelacionadas: true } },
    },
  });

  const totalCount = await prisma.dossieComercial.count({
    where: {
      fonteInformacao: { startsWith: "Solicitado por Horácio", mode: "insensitive" },
      status: { notIn: ["ARQUIVADO"] },
    },
  });

  const scoreMediano =
    dossies.length > 0
      ? Math.round(dossies.reduce((acc, d) => acc + d.score, 0) / dossies.length)
      : 0;
  const completudeMedia =
    dossies.length > 0
      ? Math.round(dossies.reduce((acc, d) => acc + (d.completude ?? 0), 0) / dossies.length)
      : 0;
  const diasMedio =
    dossies.length > 0
      ? Math.round(dossies.reduce((acc, d) => acc + diasDesde(d.createdAt), 0) / dossies.length)
      : 0;
  const prontos = dossies.filter(d => d.status === "PRONTO_PARA_ASSUMIR").length;

  const statusOpcoes = [
    { value: "", label: "Todos" },
    { value: "INVESTIGANDO", label: "Investigando" },
    { value: "PRONTO_PARA_ASSUMIR", label: "Prontos" },
    { value: "AGUARDANDO_VALIDACAO", label: "Aguardando validação" },
    { value: "ASSUMIDO", label: "Assumidos" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-100 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-slate-800">Minhas Solicitações</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Obras e empresas que você pediu ao João Hunter IA para investigar
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/inteligencia"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Voltar ao cockpit
            </Link>
            <NovasSolicitacoesButton />
          </div>
        </div>

        {/* KPI chips */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <span className="text-lg font-semibold text-slate-800">{totalCount}</span>
            <span className="text-xs text-slate-400">em investigação</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{diasMedio}d</span>
            <span className="text-xs text-slate-400">médio</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{completudeMedia}%</span>
            <span className="text-xs text-slate-400">completude</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <Target className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">{scoreMediano}</span>
            <span className="text-xs text-slate-400">score médio</span>
          </div>
          {prontos > 0 && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold text-emerald-700">{prontos}</span>
              <span className="text-xs text-emerald-600">pronto{prontos > 1 ? "s" : ""} para assumir</span>
            </div>
          )}
        </div>

        {/* Filtro de status */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {statusOpcoes.map(op => (
            <Link
              key={op.value}
              href={op.value ? `/inteligencia/minhas-solicitacoes?status=${op.value}` : "/inteligencia/minhas-solicitacoes"}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                (filtroStatus ?? "") === op.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
              )}
            >
              {op.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Lista de dossiês */}
      <div className="flex-1 overflow-y-auto p-5">
        {dossies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm font-medium text-slate-500 mb-1">Nenhuma solicitação encontrada</p>
            <p className="text-xs text-slate-400">
              Peça ao João para investigar uma obra ou empresa via chat do CRM IA.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {dossies.map(d => {
              const dias = diasDesde(d.createdAt);
              const completude = d.completude ?? 0;
              return (
                <Link
                  key={d.id}
                  href={`/inteligencia/${d.id}`}
                  className="group flex flex-col bg-white border border-slate-100 rounded-xl p-4 hover:shadow-md hover:border-indigo-200 transition-all"
                >
                  {/* Score + status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", corScore(d.score))}>
                      {d.score}
                    </span>
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", corStatus(d.status))}>
                      {labelStatus(d.status)}
                    </span>
                  </div>

                  {/* Título */}
                  <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 mb-2 group-hover:text-indigo-700 transition-colors">
                    {d.titulo}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-3">
                    {(d.cidade || d.estado) && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {[d.cidade, d.estado].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    {d.segmento && (
                      <>
                        {(d.cidade || d.estado) && <span>·</span>}
                        <span>{d.segmento}</span>
                      </>
                    )}
                  </div>

                  {/* Barra completude */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-400">Completude</span>
                      <span className="text-[10px] font-semibold text-blue-600">{completude}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all"
                        style={{ width: `${completude}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                      Solicitado por você
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {dias === 0 ? "hoje" : `há ${dias}d`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
