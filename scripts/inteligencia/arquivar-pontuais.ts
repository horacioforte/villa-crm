// ARQUIVO: scripts/inteligencia/arquivar-pontuais.ts
// REGRA: nunca remover. Apenas acrescentar.
// Arquiva dossiês específicos identificados em revisão manual (27/10/2026):
//   - 2 entradas de teste (DIAGNÓSTICO e TESTE CONECTIVIDADE)
//   - 1 duplicata Scala/RS (manter "Scala Data Centers — AI City")
//   - 1 duplicata Aena/Congonhas (manter "Ampliação do Aeroporto de Congonhas")
//   - 4 títulos informais sem valor comercial
//
// Uso:
//   npx tsx --env-file=.env.local scripts/inteligencia/arquivar-pontuais.ts           # dry-run
//   npx tsx --env-file=.env.local scripts/inteligencia/arquivar-pontuais.ts --executar

import { prisma } from "@/lib/prisma";

const EXECUTAR = process.argv.includes("--executar");

// Títulos (substring, case-insensitive) dos dossiês a arquivar, com motivo
const ALVOS: { substring: string; motivo: string }[] = [
  // Entradas de teste
  {
    substring: "DIAGNÓSTICO — Teste de conexão",
    motivo: "Entrada de teste — arquivado em revisão manual 27/10/2026.",
  },
  {
    substring: "TESTE CONECTIVIDADE",
    motivo: "Entrada de teste — arquivado em revisão manual 27/10/2026.",
  },
  // Duplicata Scala Data Centers: manter "Scala Data Centers — AI City (Eldorado do Sul/RS)"
  {
    substring: "Acordo com Governo do RS (cidade de data centers)",
    motivo: "Duplicata de 'Scala Data Centers — AI City (Eldorado do Sul/RS)' — arquivado em revisão manual 27/10/2026.",
  },
  // Duplicata Aena/Congonhas: manter "Ampliação do Aeroporto de Congonhas"
  {
    substring: "Aena — Expansão Congonhas + 10 aeroportos",
    motivo: "Duplicata de 'Ampliação do Aeroporto de Congonhas' — arquivado em revisão manual 27/10/2026.",
  },
  // Títulos informais sem valor comercial
  {
    substring: "ponte em Recife",
    motivo: "Título informal sem identificação de cliente/obra — arquivado em revisão manual 27/10/2026.",
  },
  {
    substring: "rodovia corredor litoraneo norte",
    motivo: "Título informal sem identificação de cliente/obra — arquivado em revisão manual 27/10/2026.",
  },
  {
    substring: "One Data Center",
    motivo: "Título informal sem identificação de cliente/obra — arquivado em revisão manual 27/10/2026.",
  },
  {
    substring: "Mineracao em terras raras",
    motivo: "Título informal sem identificação de cliente/obra — arquivado em revisão manual 27/10/2026.",
  },
];

async function main() {
  console.log(`\n🔍  Modo: ${EXECUTAR ? "EXECUTAR (arquiva de verdade)" : "DRY-RUN (somente leitura)"}\n`);

  let totalEncontrados = 0;
  let totalArquivados  = 0;

  for (const alvo of ALVOS) {
    const dossies = await prisma.dossieComercial.findMany({
      where: {
        titulo:  { contains: alvo.substring, mode: "insensitive" },
        status:  { notIn: ["ARQUIVADO", "ASSUMIDO"] },
      },
      select: { id: true, titulo: true, status: true, score: true },
    });

    if (dossies.length === 0) {
      console.log(`  ⚪ Não encontrado (ou já arquivado): "${alvo.substring}"`);
      continue;
    }

    for (const d of dossies) {
      totalEncontrados++;
      console.log(`  🗑️  [${d.status}] score=${d.score} "${d.titulo}" (${d.id})`);
      console.log(`       motivo: ${alvo.motivo}`);

      if (EXECUTAR) {
        await prisma.$transaction([
          prisma.dossieComercial.update({
            where: { id: d.id },
            data: {
              status:          "ARQUIVADO",
              motivoDescarte:  alvo.motivo,
              ultimaAtividade: new Date(),
            },
          }),
          prisma.atualizacaoDossie.create({
            data: {
              dossieId: d.id,
              tipo:     "MONITORAMENTO",
              titulo:   "Dossiê arquivado — revisão manual 27/10/2026",
              conteudo: alvo.motivo,
              agente:   "script-arquivar-pontuais",
            },
          }),
        ]);
        totalArquivados++;
        console.log(`       ✅ Arquivado.`);
      }
    }
    console.log();
  }

  console.log(`\n📊  Resumo: ${totalEncontrados} encontrado(s)${EXECUTAR ? `, ${totalArquivados} arquivado(s)` : " (dry-run — nada alterado)"}.\n`);

  if (!EXECUTAR && totalEncontrados > 0) {
    console.log("ℹ️   Para executar: npx tsx --env-file=.env.local scripts/inteligencia/arquivar-pontuais.ts --executar\n");
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Erro:", err);
  prisma.$disconnect();
  process.exit(1);
});
