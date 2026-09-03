// ARQUIVO: app/api/midias-sociais/instagram/resumo/route.ts
// Central de Mídias Sociais — Sprint 2 (Instagram Analytics Real), C4.
// Ver Proposta_Tecnica_Sprint2_Instagram_Analytics.docx, itens 11, 12, 13, 15.
//
// Só lê o Postgres — nunca chama a Meta (item 8). O cockpit sempre mostra o
// último dado já sincronizado, mesmo se a Meta estiver fora do ar.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";

const PERIODOS_DIAS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

// Campos de MetricaSocialSnapshot comparados entre períodos — todos vêm
// direto da Meta ("métrica Meta", item 13), nenhum é calculado aqui.
const CAMPOS_COMPARAVEIS = [
  "seguidores",
  "alcance",
  "visualizacoes",
  "interacoes",
  "visitasPerfil",
  "cliquesBio",
  "quantidadePosts",
] as const;

type CampoComparavel = (typeof CAMPOS_COMPARAVEIS)[number];

function extrairCampos(snapshot: Record<string, unknown>): Record<CampoComparavel, number | null> {
  const resultado = {} as Record<CampoComparavel, number | null>;
  for (const campo of CAMPOS_COMPARAVEIS) {
    const valor = snapshot[campo];
    resultado[campo] = typeof valor === "number" ? valor : null;
  }
  return resultado;
}

function montarComparacao(
  atual: Record<CampoComparavel, number | null>,
  anterior: { campos: Record<CampoComparavel, number | null>; origem: string } | null,
) {
  const porMetrica: Record<
    CampoComparavel,
    {
      valorAtual: number | null;
      valorAnterior: number | null;
      variacaoAbsoluta: number | null;
      variacaoPercentual: number | null;
    }
  > = {} as never;

  for (const campo of CAMPOS_COMPARAVEIS) {
    const valorAtual = atual[campo];
    const valorAnterior = anterior?.campos[campo] ?? null;
    const temAmbos = valorAtual !== null && valorAnterior !== null;
    porMetrica[campo] = {
      valorAtual,
      valorAnterior,
      variacaoAbsoluta: temAmbos ? (valorAtual as number) - (valorAnterior as number) : null,
      // Taxa de variação — métrica CALCULADA pelo Villa CRM (item 13: nunca
      // apresentada como se viesse direto da Meta). Fórmula: (atual −
      // anterior) / anterior.
      variacaoPercentual:
        temAmbos && valorAnterior !== 0
          ? (((valorAtual as number) - (valorAnterior as number)) / (valorAnterior as number)) * 100
          : null,
    };
  }

  return {
    disponivel: anterior !== null,
    // Comparações envolvendo o baseline manual precisam ficar rotuladas
    // explicitamente como tal (item 6) — nunca misturadas silenciosamente
    // com pontos de série vindos da API.
    origemComparacao: anterior?.origem ?? null,
    porMetrica,
  };
}

export async function GET(request: Request) {
  const authResult = await requirePermission("midias_sociais", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get("periodo") ?? "30d";
  const diasPeriodo = PERIODOS_DIAS[periodo];

  if (!diasPeriodo) {
    return NextResponse.json(
      { message: `Período inválido. Use um de: ${Object.keys(PERIODOS_DIAS).join(", ")}.` },
      { status: 400 },
    );
  }

  const conta = await prisma.redeSocialConta.findFirst({
    where: { rede: "INSTAGRAM" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nome: true,
      instagramBusinessAccountId: true,
      statusConexao: true,
      ultimaSincronizacaoEm: true,
      ultimoErro: true,
    },
  });

  if (!conta) {
    return NextResponse.json({ conectado: false, conta: null, snapshotAtual: null, comparacao: null });
  }

  const snapshotAtual = await prisma.metricaSocialSnapshot.findFirst({
    where: { redeSocialContaId: conta.id, tipo: "CONTA" },
    orderBy: { capturadoEm: "desc" },
  });

  if (!snapshotAtual) {
    return NextResponse.json({
      conectado: conta.statusConexao === "CONECTADO",
      conta,
      snapshotAtual: null,
      comparacao: null,
    });
  }

  const cortePeriodo = new Date(snapshotAtual.capturadoEm);
  cortePeriodo.setDate(cortePeriodo.getDate() - diasPeriodo);

  // Precisa de um snapshot que cubra INTEGRALMENTE o período pedido — nunca
  // comparar contra um ponto "quase certo" e rotular como se fosse exato
  // (item 12: mostrar "histórico insuficiente" em vez disso).
  const snapshotAnterior = await prisma.metricaSocialSnapshot.findFirst({
    where: {
      redeSocialContaId: conta.id,
      tipo: "CONTA",
      capturadoEm: { lte: cortePeriodo },
    },
    orderBy: { capturadoEm: "desc" },
  });

  const comparacao = montarComparacao(
    extrairCampos(snapshotAtual),
    snapshotAnterior ? { campos: extrairCampos(snapshotAnterior), origem: snapshotAnterior.origem } : null,
  );

  return NextResponse.json({
    conectado: conta.statusConexao === "CONECTADO",
    conta,
    snapshotAtual,
    comparacao,
  });
}
