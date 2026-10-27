// ARQUIVO: scripts/inteligencia/limpar-duplicatas.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Identifica e arquiva dossiês duplicados: mesma obra com títulos ligeiramente
// diferentes ("Bracell" vs "Bracell (RGE)", "Radar João — Pilar 1 / X" vs "X enriquecido").
//
// Estratégia de desempate: sempre preserva o dossiê mais maduro (status mais avançado
// ou, quando igual, o mais enriquecido — maior score/completude). Nunca toca em
// dossiês ASSUMIDO ou ARQUIVADO.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/inteligencia/limpar-duplicatas.ts           # dry-run (padrão)
//   npx tsx --env-file=.env.local scripts/inteligencia/limpar-duplicatas.ts --executar # arquiva de verdade

import { prisma } from "@/lib/prisma";
import { palavrasDistintivas } from "@/lib/inteligencia/historico-oportunidades";

const EXECUTAR = process.argv.includes("--executar");

// Ordem de maturidade dos status (maior = mais avançado)
const ORDEM_STATUS: Record<string, number> = {
  INVESTIGANDO: 1,
  PEDIR_MAIS_PESQUISA: 1,
  AGUARDANDO_VALIDACAO: 2,
  EM_ANALISE: 3,
  PRONTO_PARA_ASSUMIR: 4,
  ASSUMIDO: 99,  // nunca toca
  ARQUIVADO: 99, // nunca toca
};

type Dossie = {
  id: string;
  titulo: string;
  status: string;
  score: number;
  completude: number;
  createdAt: Date;
};

/** Retorna qual dos dois deve ser preservado (o mais maduro/enriquecido). */
function elegerSobrevivente(a: Dossie, b: Dossie): { preservar: Dossie; arquivar: Dossie } {
  const ordemA = ORDEM_STATUS[a.status] ?? 1;
  const ordemB = ORDEM_STATUS[b.status] ?? 1;
  if (ordemA !== ordemB) {
    return ordemA > ordemB ? { preservar: a, arquivar: b } : { preservar: b, arquivar: a };
  }
  // Mesma etapa: preservar o de maior score; em empate, o de maior completude
  const scoreA = a.score + a.completude / 100;
  const scoreB = b.score + b.completude / 100;
  return scoreA >= scoreB ? { preservar: a, arquivar: b } : { preservar: b, arquivar: a };
}

async function main() {
  console.log(`\n🔍  Modo: ${EXECUTAR ? "EXECUTAR (arquiva de verdade)" : "DRY-RUN (somente leitura)"}\n`);

  const todos = await prisma.dossieComercial.findMany({
    where: { status: { notIn: ["ASSUMIDO", "ARQUIVADO"] } },
    select: { id: true, titulo: true, status: true, score: true, completude: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📋  Dossiês ativos (não assumidos/arquivados): ${todos.length}\n`);

  // Mapa titulo-normalizado → lista de dossiês
  type GrupoDup = { preservar: Dossie; arquivar: Dossie[] };
  const jaAgrupado = new Set<string>();
  const grupos: GrupoDup[] = [];

  for (let i = 0; i < todos.length; i++) {
    const a = todos[i];
    if (jaAgrupado.has(a.id)) continue;

    const palavrasA = palavrasDistintivas(a.titulo);
    const tituloANorm = a.titulo.toLowerCase();
    const grupo: Dossie[] = [a];

    for (let j = i + 1; j < todos.length; j++) {
      const b = todos[j];
      if (jaAgrupado.has(b.id)) continue;

      const tituloBNorm = b.titulo.toLowerCase();
      // Critério 1: substring (um contém o outro, mín. 8 chars)
      const ehSubstring =
        (tituloANorm.length >= 8 && tituloBNorm.includes(tituloANorm)) ||
        (tituloBNorm.length >= 8 && tituloANorm.includes(tituloBNorm));

      // Critério 2: 2+ palavras distintivas em comum
      const palavrasB = palavrasDistintivas(b.titulo);
      const emComum = palavrasA.filter(p => new Set(palavrasB).has(p));
      const temPalavrasComuns = emComum.length >= 2;

      if (ehSubstring || temPalavrasComuns) {
        grupo.push(b);
      }
    }

    if (grupo.length < 2) continue;

    // Elege sobrevivente entre todos do grupo
    let sobrevivente = grupo[0];
    const aArquivar: Dossie[] = [];
    for (let k = 1; k < grupo.length; k++) {
      const { preservar, arquivar } = elegerSobrevivente(sobrevivente, grupo[k]);
      sobrevivente = preservar;
      aArquivar.push(arquivar);
    }
    // Garante que o sobrevivente não está na lista de arquivar
    for (const d of grupo) {
      if (d.id !== sobrevivente.id) jaAgrupado.add(d.id);
    }
    jaAgrupado.add(sobrevivente.id);

    grupos.push({ preservar: sobrevivente, arquivar: aArquivar });
  }

  if (grupos.length === 0) {
    console.log("✅  Nenhum grupo de duplicatas encontrado.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`⚠️   ${grupos.length} grupos de duplicatas encontrados:\n`);
  let totalArquivar = 0;

  for (const g of grupos) {
    console.log(`  ✅ PRESERVAR [${g.preservar.status}] score=${g.preservar.score} completude=${g.preservar.completude}%`);
    console.log(`     "${g.preservar.titulo}" (${g.preservar.id})`);
    for (const d of g.arquivar) {
      totalArquivar++;
      console.log(`  🗑️  ARQUIVAR  [${d.status}] score=${d.score} completude=${d.completude}%`);
      console.log(`     "${d.titulo}" (${d.id})`);
    }
    console.log();
  }

  console.log(`\n📊  Resumo: ${totalArquivar} dossiê(s) para arquivar em ${grupos.length} grupo(s).\n`);

  if (!EXECUTAR) {
    console.log("ℹ️   Dry-run — nenhuma alteração feita.");
    console.log("    Para executar: npx tsx --env-file=.env.local scripts/inteligencia/limpar-duplicatas.ts --executar\n");
    await prisma.$disconnect();
    return;
  }

  // ── Arquivamento real ──────────────────────────────────────────────────────
  console.log("🚀  Arquivando...\n");
  let arquivados = 0;

  for (const g of grupos) {
    for (const d of g.arquivar) {
      await prisma.$transaction([
        prisma.dossieComercial.update({
          where: { id: d.id },
          data: {
            status: "ARQUIVADO",
            motivoDescarte: `Duplicata de "${g.preservar.titulo}" (${g.preservar.id}) — arquivado pelo script limpar-duplicatas em ${new Date().toISOString().slice(0, 10)}.`,
            ultimaAtividade: new Date(),
          },
        }),
        prisma.atualizacaoDossie.create({
          data: {
            dossieId: d.id,
            tipo: "MONITORAMENTO",
            titulo: "Dossiê arquivado — duplicata identificada automaticamente",
            conteudo: `Este dossiê é duplicata de "${g.preservar.titulo}" (ID: ${g.preservar.id}), que foi preservado por ter status mais avançado ou maior score/completude.\nArquivado pelo script limpar-duplicatas.ts em ${new Date().toISOString().slice(0, 10)}.`,
            agente: "script-limpar-duplicatas",
          },
        }),
      ]);
      console.log(`  ✅ Arquivado: "${d.titulo}" (${d.id})`);
      arquivados++;
    }
  }

  console.log(`\n✅  Concluído: ${arquivados} dossiê(s) arquivado(s).\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erro:", err);
  prisma.$disconnect();
  process.exit(1);
});
