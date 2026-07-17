// ARQUIVO: app/inteligencia/linkedin/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Aba LinkedIn — lista todos os dossiês descobertos via LinkedIn pelo João Hunter IA.
// Filtra por fonteInformacao LIKE "LinkedIn%".

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Link2, ExternalLink, TrendingUp, Users, Building2, MapPin, Calendar } from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function corScore(score: number): string {
  if (score >= 85) return "bg-red-500 text-white";
  if (score >= 70) return "bg-orange-500 text-white";
  if (score >= 50) return "bg-amber-400 text-white";
  return "bg-slate-300 text-slate-700";
}

function corPrioridade(prioridade: string | null): string {
  if (prioridade === "URGENTE") return "bg-red-100 text-red-700 border-red-200";
  if (prioridade === "ALTA")    return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function formatarFonte(fonte: string): { pessoa: string; contexto: string } {
  // "LinkedIn — Sávio Soares (post de novo cargo)" → { pessoa: "Sávio Soares", contexto: "(post de novo cargo)" }
  const semPrefixo = fonte.replace(/^LinkedIn\s*[—–-]\s*/i, "").trim();
  const match = semPrefixo.match(/^([^(]+?)(?:\s*(\(.+\)))?$/);
  if (match) {
    return { pessoa: match[1].trim(), contexto: match[2]?.trim() ?? "" };
  }
  return { pessoa: semPrefixo, contexto: "" };
}

function formatarData(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const diff = Math.floor((hoje.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return `${diff} dias atrás`;
}

// ─── Página (Server Component) ────────────────────────────────────────────────

export default async function LinkedInPage() {
  // Busca dossiês descobertos via LinkedIn
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

  const total = dossies.length;
  const leads  = dossies.filter(d => d.tipo === "LEAD").length;
  const obras  = dossies.filter(d => d.tipo === "OBRA").length;
  const urgentes = dossies.filter(d => d.score >= 85).length;

  // Agrupa por "pessoa/publicação" no LinkedIn (extraído da fonteInformacao)
  const porFonte = new Map<string, typeof dossies>();
  for (const d of dossies) {
    const { pessoa } = formatarFonte(d.fonteInformacao ?? "");
    const key = pessoa || "Fonte não identificada";
    if (!porFonte.has(key)) porFonte.set(key, []);
    porFonte.get(key)!.push(d);
  }

  // Ordena os grupos por score máximo (grupos mais quentes primeiro)
  const grupos = [...porFonte.entries()].sort((a, b) => {
    const maxA = Math.max(...a[1].map(d => d.score ?? 0));
    const maxB = Math.max(...b[1].map(d => d.score ?? 0));
    return maxB - maxA;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Link2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">LinkedIn — Descobertas do João</h1>
            <p className="text-[11px] text-slate-400">
              Dossiês criados a partir do monitoramento diário de LinkedIn pelo João Hunter IA
            </p>
          </div>
        </div>

        {/* KPIs rápidos */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-800 leading-none">{total}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Total</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center">
            <p className="text-lg font-semibold text-orange-600 leading-none">{urgentes}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Score ≥ 85</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600 leading-none">{obras}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Obras</p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center">
            <p className="text-lg font-semibold text-emerald-600 leading-none">{leads}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">Leads</p>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-4 space-y-5">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Link2 className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-400">Nenhuma descoberta via LinkedIn ainda</p>
            <p className="text-xs text-slate-300 mt-1">João monitora o LinkedIn diariamente e criará dossiês aqui automaticamente</p>
          </div>
        ) : (
          grupos.map(([fonte, items]) => {
            const { pessoa, contexto } = formatarFonte(items[0].fonteInformacao ?? "");
            const maxScore = Math.max(...items.map(d => d.score ?? 0));

            return (
              <div key={fonte} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Cabeçalho do grupo (quem publicou no LinkedIn) */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 leading-tight">{pessoa}</p>
                    {contexto && (
                      <p className="text-[10px] text-slate-400">{contexto}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">{items.length} {items.length === 1 ? "dossiê" : "dossiês"}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${corScore(maxScore)}`}>
                      {maxScore}
                    </span>
                  </div>
                </div>

                {/* Cards dos dossiês deste grupo */}
                <div className="divide-y divide-slate-100">
                  {items.map(d => {
                    const localidade = [d.cidade, d.estado].filter(Boolean).join("/");
                    return (
                      <Link
                        key={d.id}
                        href={`/inteligencia/${d.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                      >
                        {/* Score */}
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 shrink-0 ${corScore(d.score ?? 0)}`}>
                          {d.score}
                        </span>

                        {/* Conteúdo principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1">
                            <p className="text-xs font-semibold text-slate-800 leading-tight group-hover:text-blue-700 flex-1">
                              {d.titulo}
                            </p>
                            {d.prioridade && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${corPrioridade(d.prioridade)}`}>
                                {d.prioridade === "URGENTE" ? "🔴 URGENTE" : d.prioridade === "ALTA" ? "🟠 ALTA" : "MÉDIA"}
                              </span>
                            )}
                          </div>

                          {/* Metadados */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                            {d.tipo && (
                              <span className={`font-medium ${d.tipo === "LEAD" ? "text-emerald-600" : "text-blue-600"}`}>
                                {d.tipo}
                              </span>
                            )}
                            {localidade && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {localidade}
                              </span>
                            )}
                            {d.segmento && (
                              <span className="flex items-center gap-0.5">
                                <Building2 className="h-2.5 w-2.5" />
                                {d.segmento}
                              </span>
                            )}
                            {d.clienteFinal && (
                              <span className="text-slate-500 font-medium">{d.clienteFinal}</span>
                            )}
                            <span className="flex items-center gap-0.5 ml-auto">
                              <Calendar className="h-2.5 w-2.5" />
                              {formatarData(d.updatedAt.toISOString())}
                            </span>
                          </div>

                          {/* Resumo curto */}
                          {d.resumo && (
                            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {d.resumo}
                            </p>
                          )}

                          {/* Decisores */}
                          {d.decisores && d.decisores.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Users className="h-2.5 w-2.5 text-slate-400" />
                              <span className="text-[10px] text-slate-400">
                                {d.decisores.map(dec => `${dec.nome}${dec.cargo ? ` (${dec.cargo})` : ""}`).join(", ")}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Completude */}
                        <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                          <div className="w-px h-8 bg-slate-100 relative">
                            <div
                              className="absolute bottom-0 left-0 w-full bg-blue-400 rounded-full"
                              style={{ height: `${d.completude ?? 0}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-400">{d.completude ?? 0}%</span>
                        </div>

                        <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-blue-400 shrink-0 mt-1" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
