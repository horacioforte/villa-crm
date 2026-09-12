// ARQUIVO: app/inteligencia/linkedin/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Aba LinkedIn — lista todos os dossiês descobertos via LinkedIn pelo João Hunter IA.
// Filtra por fonteInformacao LIKE "LinkedIn%".
// V2 — redesign visual: grid de cards limpos, mesma linguagem do Kanban.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MapPin, Building2, Clock } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corScore(score: number): string {
  if (score >= 75) return "bg-red-100 text-red-700";
  if (score >= 50) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function corPrioridade(p: string | null) {
  if (p === "URGENTE") return "bg-red-100 text-red-700 border-red-200";
  if (p === "ALTA")    return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

function labelPrioridade(p: string | null) {
  if (p === "URGENTE") return "🔴 URGENTE";
  if (p === "ALTA")    return "🟠 ALTA";
  return "MÉDIA";
}

function corCompletude(pct: number) {
  if (pct >= 70) return "#10b981";
  if (pct >= 40) return "#f59e0b";
  return "#94a3b8";
}

function formatarFonte(fonte: string): { pessoa: string; contexto: string } {
  const semPrefixo = fonte.replace(/^LinkedIn\s*[—–-]\s*/i, "").trim();
  const match = semPrefixo.match(/^([^(]+?)(?:\s*(\(.+\)))?$/);
  if (match) return { pessoa: match[1].trim(), contexto: match[2]?.trim() ?? "" };
  return { pessoa: semPrefixo, contexto: "" };
}

function diasDesde(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `${diff}d`;
}

function inicialAvatar(nome: string): string {
  return nome.trim()[0]?.toUpperCase() ?? "?";
}

// Cores fixas para avatares dos grupos (rotação por índice)
const AVATAR_CORES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
  "bg-rose-100 text-rose-700",
];

// ─── Página (Server Component) ────────────────────────────────────────────────

export default async function LinkedInPage() {
  const dossies = await prisma.dossieComercial.findMany({
    where: {
      fonteInformacao: { startsWith: "LinkedIn", mode: "insensitive" },
      status: { not: "ARQUIVADO" },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      decisores: { select: { nome: true, cargo: true }, take: 2 },
    },
  });

  const total   = dossies.length;
  const urgentes = dossies.filter(d => d.score >= 85).length;
  const obras    = dossies.filter(d => d.tipo === "OBRA").length;
  const leads    = dossies.filter(d => d.tipo === "LEAD").length;

  // Agrupa por pessoa/fonte
  const porFonte = new Map<string, typeof dossies>();
  for (const d of dossies) {
    const { pessoa } = formatarFonte(d.fonteInformacao ?? "");
    const key = pessoa || "Fonte não identificada";
    if (!porFonte.has(key)) porFonte.set(key, []);
    porFonte.get(key)!.push(d);
  }

  const grupos = [...porFonte.entries()].sort((a, b) => {
    const maxA = Math.max(...a[1].map(d => d.score ?? 0));
    const maxB = Math.max(...b[1].map(d => d.score ?? 0));
    return maxB - maxA;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-slate-800">LinkedIn — Descobertas do João</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Oportunidades criadas a partir do monitoramento diário de LinkedIn
            </p>
          </div>

          {/* KPIs */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
              <span className="text-lg font-semibold text-slate-800">{total}</span>
              <span className="text-xs text-slate-400">total</span>
            </div>
            {urgentes > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <span className="text-sm font-semibold text-red-700">{urgentes}</span>
                <span className="text-xs text-red-500">score ≥ 85</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold text-blue-700">{obras}</span>
              <span className="text-xs text-blue-500">obras</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <span className="text-sm font-semibold text-emerald-700">{leads}</span>
              <span className="text-xs text-emerald-500">leads</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <div className="flex-1 overflow-auto p-5 space-y-6">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm font-medium text-slate-400">Nenhuma descoberta via LinkedIn ainda</p>
            <p className="text-xs text-slate-300 mt-1">João monitora o LinkedIn diariamente e criará dossiês aqui automaticamente</p>
          </div>
        ) : (
          grupos.map(([fonte, items], idx) => {
            const { pessoa, contexto } = formatarFonte(items[0].fonteInformacao ?? "");
            const maxScore = Math.max(...items.map(d => d.score ?? 0));
            const avatarCor = AVATAR_CORES[idx % AVATAR_CORES.length];

            return (
              <div key={fonte}>
                {/* ── Cabeçalho do grupo ── */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarCor}`}>
                    {inicialAvatar(pessoa)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{pessoa}</p>
                    {contexto && (
                      <p className="text-[11px] text-slate-400 leading-tight">{contexto}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {items.length} {items.length === 1 ? "dossiê" : "dossiês"}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${corScore(maxScore)}`}>
                    {maxScore}
                  </span>
                </div>

                {/* ── Grid de cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {items.map(d => {
                    const completude = d.completude ?? 0;
                    const dias = diasDesde(d.updatedAt.toISOString());
                    const localidade = [d.cidade, d.estado].filter(Boolean).join(" / ");

                    return (
                      <Link
                        key={d.id}
                        href={`/inteligencia/${d.id}`}
                        className="group bg-white border border-slate-100 rounded-xl p-3 hover:shadow-md hover:border-indigo-200 transition-all flex flex-col gap-2"
                      >
                        {/* Score + prioridade + dias */}
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${corScore(d.score ?? 0)}`}>
                            {d.score}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {d.prioridade && d.prioridade !== "MEDIA" && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${corPrioridade(d.prioridade)}`}>
                                {labelPrioridade(d.prioridade)}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                              <Clock className="h-2.5 w-2.5" />
                              {dias}
                            </span>
                          </div>
                        </div>

                        {/* Título */}
                        <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
                          {d.titulo}
                        </p>

                        {/* Localidade + Segmento */}
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {localidade && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {localidade}
                            </span>
                          )}
                          {d.segmento && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Building2 className="h-2.5 w-2.5" />
                              {d.segmento}
                            </span>
                          )}
                        </div>

                        {/* Cliente final */}
                        {d.clienteFinal && (
                          <p className="text-[10px] text-slate-500 font-medium truncate">{d.clienteFinal}</p>
                        )}

                        {/* Barra de completude */}
                        <div className="mt-auto">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-slate-400">Completude</span>
                            <span className="text-[10px] font-medium text-slate-600">{completude}%</span>
                          </div>
                          <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${completude}%`, backgroundColor: corCompletude(completude) }}
                            />
                          </div>
                        </div>

                        {/* Decisores */}
                        {d.decisores && d.decisores.length > 0 && (
                          <p className="text-[10px] text-slate-400">
                            👤 {d.decisores[0].nome}{d.decisores[0].cargo ? ` · ${d.decisores[0].cargo}` : ""}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Separador entre grupos */}
                <div className="mt-6 border-b border-slate-100" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
