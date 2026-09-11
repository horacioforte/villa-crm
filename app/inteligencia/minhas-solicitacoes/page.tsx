// ARQUIVO: app/inteligencia/minhas-solicitacoes/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Lista dossiês solicitados manualmente por Horácio via CRM IA.
// Filtro: origem = "MANUAL".
// V2 — Adicionado Kanban de maturidade (Grade ↔ Kanban toggle via SolicitacoesView).

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Clock, Target, TrendingUp } from "lucide-react";
import { NovasSolicitacoesButton } from "./NovasSolicitacoesButton";
import { SolicitacoesView, type DossieParaView } from "./SolicitacoesView";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasDesde(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default async function MinhasSolicitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const filtroStatusInicial = params.status ?? "";

  // Busca todos os dossiês MANUAL não arquivados (sem filtro de status —
  // o filtro de status é aplicado client-side no componente SolicitacoesView).
  const dossiesRaw = await prisma.dossieComercial.findMany({
    where: {
      origem: "MANUAL",
      status: { notIn: ["ARQUIVADO"] },
    },
    orderBy: [{ status: "asc" }, { score: "desc" }, { updatedAt: "desc" }],
    take: 200,
    include: {
      _count:    { select: { decisores: true, empresasRelacionadas: true } },
      decisores: { select: { nome: true, telefone: true, email: true } },
    },
  });

  // Serializa para o client component (Dates → string)
  const dossies: DossieParaView[] = dossiesRaw.map(d => ({
    id:                    d.id,
    titulo:                d.titulo,
    score:                 d.score,
    completude:            d.completude ?? 0,
    status:                d.status,
    cidade:                d.cidade,
    estado:                d.estado,
    segmento:              d.segmento,
    criadoPorAgente:       d.criadoPorAgente,
    fonteInformacao:       d.fonteInformacao,
    createdAt:             d.createdAt.toISOString(),
    clienteFinal:          d.clienteFinal,
    construtora:           d.construtora,
    epc:                   d.epc,
    epcm:                  d.epcm,
    faseObra:              d.faseObra,
    cronograma:            d.cronograma,
    licenciamento:         d.licenciamento,
    valorEstimado:         d.valorEstimado?.toString() ?? null,
    volumeConcreto:        d.volumeConcreto?.toString() ?? null,
    equipamentosSugeridos: d.equipamentosSugeridos,
    potencialVilla:        d.potencialVilla,
    momentoVilla:          d.momentoVilla,
    prontidao:             d.prontidao,
    totalDecisores:        d._count?.decisores ?? 0,
    decisores:             d.decisores.map(dec => ({
      nome:     dec.nome,
      telefone: dec.telefone,
      email:    dec.email,
    })),
  }));

  // KPIs — computados server-side de todos os dossiês
  const totalCount      = dossies.length;
  const diasMedio       = totalCount > 0 ? Math.round(dossies.reduce((acc, d) => acc + diasDesde(new Date(d.createdAt)), 0) / totalCount) : 0;
  const completudeMedia = totalCount > 0 ? Math.round(dossies.reduce((acc, d) => acc + d.completude, 0) / totalCount) : 0;
  const scoreMediano    = totalCount > 0 ? Math.round(dossies.reduce((acc, d) => acc + d.score, 0) / totalCount) : 0;
  const prontos         = dossies.filter(d => d.status === "PRONTO_PARA_ASSUMIR").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
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
      </div>

      {/* ── Conteúdo (grade ou kanban) — client component ── */}
      <SolicitacoesView
        dossies={dossies}
        filtroStatusInicial={filtroStatusInicial}
      />

    </div>
  );
}
