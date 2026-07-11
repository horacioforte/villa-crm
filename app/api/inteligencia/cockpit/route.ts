// ARQUIVO: app/api/inteligencia/cockpit/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint agregado para o Cockpit Executivo da Central de Inteligência.
// Retorna: dossiês ativos, KPIs em 2 grupos, feed de inteligência,
// "o que mudou", oportunidades esquecidas e status do João.
// V1.0 — campos totalDecisores/totalEmpresas/totalAtualizacoes mapeados do _count
// V1.0 — feed inclui agente e conteúdo resumido; take 50

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// ─── Mapeamento de tipos de atualização → Feed ────────────────────────────────

export const FEED_META: Record<string, {
  categoria: string;
  icone: string;
  impacto: "alto" | "medio" | "baixo";
}> = {
  DECISOR_ENCONTRADO:      { categoria: "Decisor",   icone: "user-check",          impacto: "alto"  },
  EMPRESA_ENCONTRADA:      { categoria: "Empresa",   icone: "building-factory-2",  impacto: "medio" },
  NOTICIA_ENCONTRADA:      { categoria: "Notícia",   icone: "news",                impacto: "medio" },
  MISSAO_CONCLUIDA:        { categoria: "Missão",    icone: "target",              impacto: "medio" },
  MISSAO_DEFINIDA:         { categoria: "Missão",    icone: "target",              impacto: "baixo" },
  CAMPO_ATUALIZADO:        { categoria: "Obra",      icone: "building",            impacto: "baixo" },
  MONITORAMENTO:           { categoria: "Obra",      icone: "radar-2",             impacto: "baixo" },
  CRIACAO:                 { categoria: "Dossiê",    icone: "folder-plus",         impacto: "medio" },
  ANALISE_MORGANA:         { categoria: "Análise",   icone: "eye",                 impacto: "alto"  },
  ASSUMIDO_PELO_COMERCIAL: { categoria: "Assumido",  icone: "shield-check",        impacto: "alto"  },
  SOLICITACAO_PESQUISA:    { categoria: "Pesquisa",  icone: "refresh",             impacto: "medio" },
};

// Rótulo legível por humanos para cada agente do sistema
const AGENTE_LABEL: Record<string, string> = {
  "joao-hunter":  "João Hunter IA",
  "joao":         "João Hunter IA",
  "morgana":      "Morgana",
  "comercial":    "Equipe Comercial",
  "manual":       "Equipe Comercial",
  "sistema":      "Sistema",
  "webhook":      "Sistema",
};

// ─── GET — dados completos do cockpit ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const lastVisitStr = req.nextUrl.searchParams.get("lastVisit");
  const lastVisit = lastVisitStr ? new Date(lastVisitStr) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ontem     = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // ── 1. Dossiês ativos (todas as colunas do kanban, exceto ARQUIVADO) ────────
  const dossiesRaw = await prisma.dossieComercial.findMany({
    where: { status: { notIn: ["ARQUIVADO"] } },
    orderBy: [{ status: "asc" }, { score: "desc" }, { updatedAt: "desc" }],
    take: 500,
    include: {
      empresa: { select: { id: true, razaoSocial: true } },
      obra:    { select: { id: true, nome: true } },
      _count:  { select: { decisores: true, empresasRelacionadas: true, atualizacoes: true } },
    },
  });

  // Mapeia _count para campos de primeiro nível — corrige bug de totalDecisores undefined
  const dossies = dossiesRaw.map(d => ({
    ...d,
    totalDecisores:    d._count?.decisores            ?? 0,
    totalEmpresas:     d._count?.empresasRelacionadas ?? 0,
    totalAtualizacoes: d._count?.atualizacoes         ?? 0,
    totalNoticias:     0, // contagem detalhada disponível via feed; evita N+1 queries
  }));

  // ── 2. KPIs — Inteligência (produção do João nas últimas 24h) ───────────────
  const [novosDossies, dossiesAtualizados, novosDecisores, novasEmpresas, descobertas] =
    await Promise.all([
      prisma.dossieComercial.count({ where: { createdAt: { gte: ontem } } }),
      prisma.dossieComercial.count({ where: { updatedAt: { gte: ontem }, createdAt: { lt: ontem } } }),
      prisma.decisorDossie.count({ where: { createdAt: { gte: ontem } } }),
      prisma.empresaDossie.count({ where: { createdAt: { gte: ontem } } }),
      // Só conta descobertas reais — exclui atualizações rotineiras de monitoramento
      prisma.atualizacaoDossie.count({
        where: {
          createdAt: { gte: ontem },
          tipo: { in: ["DECISOR_ENCONTRADO", "EMPRESA_ENCONTRADA", "NOTICIA_ENCONTRADA", "ANALISE_MORGANA", "MISSAO_CONCLUIDA"] },
        },
      }),
    ]);

  // ── 3. KPIs — Ação Comercial ────────────────────────────────────────────────
  const agora = Date.now();
  const prontos          = dossies.filter(d => d.status === "PRONTO_PARA_ASSUMIR").length;
  const aguardandoVal    = dossies.filter(d => d.status === "AGUARDANDO_VALIDACAO").length;
  const esquecidosCount  = dossies.filter(d => {
    const dias = (agora - new Date(d.updatedAt).getTime()) / 86_400_000;
    return dias > 15;
  }).length;
  const quentes = dossies.filter(d => d.score >= 75).length;
  const emRisco = dossies.filter(d => {
    const dias = (agora - new Date(d.updatedAt).getTime()) / 86_400_000;
    return d.prioridade === "ALTA" && dias > 7;
  }).length;

  // ── 4. Feed de Inteligência (últimas 50 atualizações dos dossiês ativos) ────
  const atualizacoes = await prisma.atualizacaoDossie.findMany({
    where: { dossie: { status: { notIn: ["ARQUIVADO"] } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { dossie: { select: { id: true, titulo: true } } },
  });

  const feed = atualizacoes.map(a => ({
    id:           a.id,
    tipo:         a.tipo,
    titulo:       a.titulo,
    conteudo:     a.conteudo,
    agente:       a.agente ?? "sistema",
    agenteLabel:  AGENTE_LABEL[a.agente ?? ""] ?? "Sistema",
    dossieId:     a.dossieId,
    dossieTitulo: a.dossie.titulo,
    createdAt:    a.createdAt.toISOString(),
    ...(FEED_META[a.tipo] ?? { categoria: "Outro", icone: "info-circle", impacto: "baixo" as const }),
  }));

  // ── 5. O que mudou desde a última visita ────────────────────────────────────
  const [
    mudancaDossies,
    mudancaDecisores,
    mudancaEmpresas,
    mudancaNoticias,
    mudancaProntos,
  ] = await Promise.all([
    prisma.dossieComercial.count({ where: { createdAt: { gte: lastVisit } } }),
    prisma.decisorDossie.count({ where: { createdAt: { gte: lastVisit } } }),
    prisma.empresaDossie.count({ where: { createdAt: { gte: lastVisit } } }),
    prisma.atualizacaoDossie.count({ where: { tipo: "NOTICIA_ENCONTRADA", createdAt: { gte: lastVisit } } }),
    prisma.dossieComercial.count({ where: { status: "PRONTO_PARA_ASSUMIR", updatedAt: { gte: lastVisit } } }),
  ]);

  // ── 6. Oportunidades esquecidas ──────────────────────────────────────────────
  const esquecidas = dossies
    .filter(d => {
      const dias = (agora - new Date(d.updatedAt).getTime()) / 86_400_000;
      return (
        dias > 15 ||
        (d.prioridade === "ALTA" && dias > 7) ||
        (d.status === "AGUARDANDO_VALIDACAO" && dias > 5)
      );
    })
    .map(d => {
      const dias = Math.floor((agora - new Date(d.updatedAt).getTime()) / 86_400_000);
      let motivo = `Sem atualização há ${dias} dias`;
      let tipo   = "parado";
      if (d.status === "AGUARDANDO_VALIDACAO" && dias > 5) {
        motivo = `Aguardando validação da Morgana há ${dias} dias`;
        tipo   = "aguardando";
      } else if (d.prioridade === "ALTA" && dias > 7) {
        motivo = `Alta prioridade sem ação comercial há ${dias} dias`;
        tipo   = "risco";
      }
      return {
        id:       d.id,
        titulo:   d.titulo,
        cidade:   d.cidade,
        estado:   d.estado,
        segmento: d.segmento,
        status:   d.status,
        score:    d.score,
        prioridade: d.prioridade,
        motivo,
        tipo,
        dias,
      };
    })
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 10);

  // ── 7. Status do João ────────────────────────────────────────────────────────
  const dossieAtivo = dossies.find(d => d.status === "INVESTIGANDO" && d.missaoAtual);

  const ultimaDescobertaRecord = await prisma.atualizacaoDossie.findFirst({
    where: {
      tipo: { in: ["DECISOR_ENCONTRADO", "EMPRESA_ENCONTRADA", "NOTICIA_ENCONTRADA"] },
    },
    orderBy: { createdAt: "desc" },
    include: { dossie: { select: { id: true, titulo: true } } },
  });

  // Contagem de descobertas nas últimas 24h para o painel do João
  const descobertasJoao24h = await prisma.atualizacaoDossie.count({
    where: {
      createdAt: { gte: ontem },
      tipo: { in: ["DECISOR_ENCONTRADO", "EMPRESA_ENCONTRADA", "NOTICIA_ENCONTRADA"] },
    },
  });

  const joao = {
    totalDossies:       dossies.length,
    dossiesInvestigando: dossies.filter(d => d.status === "INVESTIGANDO").length,
    missaoAtual:        dossieAtivo?.missaoAtual ?? "Monitorando o mercado",
    dossieAtual:        dossieAtivo
      ? { id: dossieAtivo.id, titulo: dossieAtivo.titulo }
      : null,
    // Proxy de progresso: completude do dossiê em investigação
    progressoMissao:    dossieAtivo?.completude ?? null,
    descobertas24h:     descobertasJoao24h,
    ultimaDescoberta: ultimaDescobertaRecord
      ? {
          descricao: ultimaDescobertaRecord.titulo,
          dossie:    ultimaDescobertaRecord.dossie.titulo,
          dossieId:  ultimaDescobertaRecord.dossie.id,
          quando:    ultimaDescobertaRecord.createdAt.toISOString(),
        }
      : null,
    // Próxima investigação: campo para expansão futura (scheduler do João)
    proximaInvestigacao: null as string | null,
  };

  return NextResponse.json({
    dossies,
    kpis: {
      inteligencia: { novosDossies, dossiesAtualizados, novosDecisores, novasEmpresas, descobertas },
      acao:         { prontos, aguardandoVal, esquecidos: esquecidosCount, quentes, emRisco },
    },
    feed,
    mudancas: {
      dossies:   mudancaDossies,
      decisores: mudancaDecisores,
      empresas:  mudancaEmpresas,
      noticias:  mudancaNoticias,
      prontos:   mudancaProntos,
      desde:     lastVisit.toISOString(),
    },
    esquecidas,
    joao,
  });
}
