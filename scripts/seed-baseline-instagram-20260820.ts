// ARQUIVO: scripts/seed-baseline-instagram-20260820.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Sprint 2 (Instagram Analytics Real) — C6. Grava o baseline MANUAL de
// 20/08/2026 como UM MetricaSocialSnapshot (tipo: CONTA, origem: MANUAL).
// A partir daí, /api/midias-sociais/instagram/resumo consegue comparar o
// próximo snapshot vindo da API contra este ponto de partida real, em vez de
// mostrar "histórico insuficiente" até a segunda sincronização.
//
// ATENÇÃO — gravação de dado real de produção, não uma migração de schema.
// Sinalizado explicitamente na Proposta_Tecnica_Sprint2_Instagram_Analytics.docx
// como precisando de revisão separada antes de rodar. Não rodar com --apply
// sem o Horacio ter revisado os números abaixo primeiro.
//
// MetricaSocialSnapshot é append-only (mesma regra do sync-engine — nunca
// UPDATE). Para não duplicar o baseline se este script for rodado de novo por
// engano, ele verifica antes se já existe um snapshot origem=MANUAL para esta
// conta e recusa gravar um segundo (a menos que --forcar seja passado
// explicitamente).
//
// Modo padrão: DRY RUN (só relatório, nenhuma escrita). Passe --apply para gravar de fato.
//
// Uso:
//   npx tsx scripts/seed-baseline-instagram-20260820.ts             (dry run)
//   npx tsx scripts/seed-baseline-instagram-20260820.ts --apply      (grava)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const APLICAR = process.argv.includes("--apply");
const FORCAR = process.argv.includes("--forcar");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NOME_CONTA = "@villapumps";

// Baseline manual de 20/08/2026, conforme relatado pelo Horacio.
// TODO(Horacio): confirmar estes números antes de rodar com --apply, e
// informar os percentuais de breakdown (se houver) para metricasExtra — não
// inventados aqui, propositalmente deixados de fora até serem confirmados.
const CAPTURADO_EM = new Date("2026-08-20T00:00:00-03:00");
const BASELINE = {
  seguidores: 2894,
  quantidadePosts: 467,
  visualizacoes: 11919,
  interacoes: 280,
  visitasPerfil: 192,
  cliquesBio: 8,
};
const METRICAS_EXTRA: Record<string, number> = {};

async function main() {
  const relatorio: Record<string, unknown> = { modo: APLICAR ? "APLICAR" : "DRY_RUN" };

  const conta = await prisma.redeSocialConta.findUnique({
    where: { rede_nome: { rede: "INSTAGRAM", nome: NOME_CONTA } },
  });

  if (!conta) {
    relatorio.erro =
      "Conta Instagram não encontrada (rode scripts/registrar-conta-instagram.ts --apply primeiro). Nenhum id foi inventado.";
    console.log(JSON.stringify(relatorio, null, 2));
    return;
  }

  relatorio.contaId = conta.id;

  const snapshotManualExistente = await prisma.metricaSocialSnapshot.findFirst({
    where: { redeSocialContaId: conta.id, tipo: "CONTA", origem: "MANUAL" },
    orderBy: { capturadoEm: "desc" },
  });

  if (snapshotManualExistente && !FORCAR) {
    relatorio.jaExisteBaseline = true;
    relatorio.baselineExistente = snapshotManualExistente;
    relatorio.acao = "Nenhuma escrita — já existe um snapshot MANUAL para esta conta. Passe --forcar para gravar mesmo assim (cria um segundo).";
    console.log(JSON.stringify(relatorio, null, 2));
    return;
  }

  relatorio.snapshotAGravar = { ...BASELINE, capturadoEm: CAPTURADO_EM.toISOString(), metricasExtra: METRICAS_EXTRA };

  if (APLICAR) {
    const snapshot = await prisma.metricaSocialSnapshot.create({
      data: {
        redeSocialContaId: conta.id,
        tipo: "CONTA",
        origem: "MANUAL",
        capturadoEm: CAPTURADO_EM,
        seguidores: BASELINE.seguidores,
        quantidadePosts: BASELINE.quantidadePosts,
        visualizacoes: BASELINE.visualizacoes,
        interacoes: BASELINE.interacoes,
        visitasPerfil: BASELINE.visitasPerfil,
        cliquesBio: BASELINE.cliquesBio,
        metricasExtra: METRICAS_EXTRA,
        status: "COMPLETO",
      },
    });
    relatorio.snapshotCriado = snapshot;
  }

  console.log(JSON.stringify(relatorio, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nenhuma escrita foi feita. Rode com --apply para gravar.");
  }
}

main().finally(() => prisma.$disconnect());
