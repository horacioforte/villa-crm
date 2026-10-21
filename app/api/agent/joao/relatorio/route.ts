// ARQUIVO: app/api/agent/joao/relatorio/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Relatório semanal de atividade do agente João.
// GET /api/agent/joao/relatorio?dias=7  →  resumo da última semana
// Auth: Bearer AGENT_API_KEY

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function GET(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dias = Math.min(parseInt(searchParams.get("dias") ?? "7", 10) || 7, 90);

  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  // 1. Buscar todas as atualizações do João no período
  const atualizacoes = await prisma.atualizacaoDossie.findMany({
    where: {
      agente: "joao-investigador",
      createdAt: { gte: desde },
    },
    select: {
      id: true,
      dossieId: true,
      tipo: true,
      titulo: true,
      createdAt: true,
      dossie: {
        select: {
          titulo: true,
          segmento: true,
          cidade: true,
          estado: true,
          status: true,
          completude: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 2. Dossiês arquivados automaticamente (obras encerradas) no período
  const arquivadosAutomaticamente = atualizacoes.filter(
    (a) => a.titulo === "Obra encerrada — dossiê arquivado automaticamente"
  );

  // 3. Agrupamento por dossiê
  const porDossie: Record<string, {
    dossieId: string;
    tituloDossie: string;
    segmento: string | null;
    cidade: string | null;
    estado: string | null;
    statusAtual: string;
    completude: number;
    totalAtualizacoes: number;
    camposAtualizados: number;
    decisoresEncontrados: number;
    noticiasEncontradas: number;
    obraEncerrada: boolean;
    ultimaAtividade: Date;
  }> = {};

  for (const a of atualizacoes) {
    if (!porDossie[a.dossieId]) {
      porDossie[a.dossieId] = {
        dossieId: a.dossieId,
        tituloDossie: a.dossie?.titulo ?? a.dossieId,
        segmento: a.dossie?.segmento ?? null,
        cidade: a.dossie?.cidade ?? null,
        estado: a.dossie?.estado ?? null,
        statusAtual: a.dossie?.status ?? "?",
        completude: a.dossie?.completude ?? 0,
        totalAtualizacoes: 0,
        camposAtualizados: 0,
        decisoresEncontrados: 0,
        noticiasEncontradas: 0,
        obraEncerrada: false,
        ultimaAtividade: a.createdAt,
      };
    }
    const d = porDossie[a.dossieId];
    d.totalAtualizacoes++;
    if (a.tipo === "CAMPO_ATUALIZADO") d.camposAtualizados++;
    if (a.tipo === "DECISOR_ENCONTRADO") d.decisoresEncontrados++;
    if (a.tipo === "NOTICIA_ENCONTRADA") d.noticiasEncontradas++;
    if (a.titulo === "Obra encerrada — dossiê arquivado automaticamente") d.obraEncerrada = true;
    if (a.createdAt > d.ultimaAtividade) d.ultimaAtividade = a.createdAt;
  }

  const dossiesAtivos = Object.values(porDossie).sort(
    (a, b) => b.ultimaAtividade.getTime() - a.ultimaAtividade.getTime()
  );

  // 4. Contagem atual da fila
  const [investigando, pedirPesquisa, aguardandoValidacao] = await Promise.all([
    prisma.dossieComercial.count({ where: { status: "INVESTIGANDO" } }),
    prisma.dossieComercial.count({ where: { status: "PEDIR_MAIS_PESQUISA" } }),
    prisma.dossieComercial.count({ where: { status: "AGUARDANDO_VALIDACAO" } }),
  ]);

  // 5. Totais do período
  const totais = {
    dossiesInvestigados: dossiesAtivos.length,
    totalAtualizacoes: atualizacoes.length,
    camposAtualizados: atualizacoes.filter(a => a.tipo === "CAMPO_ATUALIZADO").length,
    decisoresEncontrados: atualizacoes.filter(a => a.tipo === "DECISOR_ENCONTRADO").length,
    noticiasEncontradas: atualizacoes.filter(a => a.tipo === "NOTICIA_ENCONTRADA").length,
    obrasEncerradas: arquivadosAutomaticamente.length,
  };

  // 6. Montar texto do relatório
  const periodoTexto = dias === 1 ? "últimas 24h" : `últimos ${dias} dias`;
  const dataInicio = desde.toLocaleDateString("pt-BR");
  const dataFim = new Date().toLocaleDateString("pt-BR");

  const linhasDossies = dossiesAtivos.map((d) => {
    const partes = [];
    if (d.camposAtualizados > 0) partes.push(`${d.camposAtualizados} campo(s) atualizado(s)`);
    if (d.decisoresEncontrados > 0) partes.push(`${d.decisoresEncontrados} decisor(es)`);
    if (d.noticiasEncontradas > 0) partes.push(`${d.noticiasEncontradas} notícia(s)`);
    if (d.obraEncerrada) partes.push("⚠️ obra encerrada — arquivado");
    const local = [d.cidade, d.estado].filter(Boolean).join("/");
    return `• ${d.tituloDossie}${local ? ` (${local})` : ""} — ${partes.join(", ") || "investigado sem achados"} — completude ${d.completude}%`;
  }).join("\n");

  const relatorioTexto = `📊 RELATÓRIO DE ATIVIDADE DO JOÃO
Período: ${dataInicio} a ${dataFim} (${periodoTexto})
─────────────────────────────────
RESUMO GERAL
• Dossiês investigados: ${totais.dossiesInvestigados}
• Campos atualizados: ${totais.camposAtualizados}
• Decisores encontrados: ${totais.decisoresEncontrados}
• Notícias registradas: ${totais.noticiasEncontradas}
• Obras encerradas (arquivadas): ${totais.obrasEncerradas}

FILA ATUAL
• Em investigação: ${investigando}
• Aguardando mais pesquisa: ${pedirPesquisa}
• Aguardando validação humana: ${aguardandoValidacao}

DOSSIÊS COM ATIVIDADE NO PERÍODO
${linhasDossies || "Nenhum dossiê com atividade no período."}`;

  return NextResponse.json({
    sucesso: true,
    periodo: { dias, desde: desde.toISOString(), ate: new Date().toISOString() },
    totais,
    filaAtual: { investigando, pedirPesquisa, aguardandoValidacao },
    dossies: dossiesAtivos,
    relatorioTexto,
  });
}
