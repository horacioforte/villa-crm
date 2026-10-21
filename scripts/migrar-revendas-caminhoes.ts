// ARQUIVO: scripts/migrar-revendas-caminhoes.ts
// Migra dossiês do segmento "Revenda de Caminhões" (score 0) para a Carteira Estratégica
// REVENDAS_CAMINHOES e arquiva o DossieComercial (tira da fila do Loop de Investigação).
// REGRA: nunca deleta nada — só cria DossieCarteira (idempotente, skipDuplicates) e
// atualiza o status do DossieComercial (dado preservado, nunca removido).
//
// Uso:
//   npx tsx scripts/migrar-revendas-caminhoes.ts              → dry-run (só mostra, nada grava)
//   npx tsx scripts/migrar-revendas-caminhoes.ts --commit      → grava de verdade

import { prisma } from "@/lib/prisma";

async function main() {
  const commit = process.argv.includes("--commit");

  // 1. Buscar os dossiês de revenda de caminhões
  const revendas = await prisma.dossieComercial.findMany({
    where: {
      segmento: { contains: "Revenda de Caminhões", mode: "insensitive" },
      score: 0,
    },
    select: { id: true, titulo: true, cidade: true, estado: true, status: true },
  });

  console.log(`\nEncontrados: ${revendas.length} dossiês de revenda de caminhões`);

  if (revendas.length === 0) {
    console.log("Nenhum dossiê encontrado. Verifique o filtro.");
    await prisma.$disconnect();
    return;
  }

  // 2. Verificar quantos já têm DossieCarteira REVENDAS_CAMINHOES
  const jaExistentes = await prisma.dossieCarteira.findMany({
    where: {
      carteira: "REVENDAS_CAMINHOES",
      dossieId: { in: revendas.map(d => d.id) },
    },
    select: { dossieId: true },
  });
  const idsJaExistentes = new Set(jaExistentes.map(d => d.dossieId));
  console.log(`Já na carteira: ${idsJaExistentes.size}`);

  const paracriar = revendas.filter(d => !idsJaExistentes.has(d.id));
  console.log(`Para criar na carteira: ${paracriar.length}`);

  const jaArquivados = revendas.filter(d => d.status === "ARQUIVADO").length;
  const paraArquivar = revendas.filter(d => d.status === "INVESTIGANDO" || d.status === "PEDIR_MAIS_PESQUISA").length;
  console.log(`Já ARQUIVADO: ${jaArquivados} · a arquivar agora (INVESTIGANDO/PEDIR_MAIS_PESQUISA): ${paraArquivar}`);

  if (!commit) {
    console.log(`\n[dry-run] nada foi gravado. Rode com --commit para gravar de verdade.`);
    await prisma.$disconnect();
    return;
  }

  // 3. Criar DossieCarteira para cada revenda (em lotes de 50)
  let criados = 0;
  const lote = 50;
  for (let i = 0; i < paracriar.length; i += lote) {
    const batch = paracriar.slice(i, i + lote);
    const r = await prisma.dossieCarteira.createMany({
      data: batch.map(d => ({
        dossieId: d.id,
        carteira: "REVENDAS_CAMINHOES",
        status: "MONITORANDO",
        observacoes: "Migrado automaticamente em " + new Date().toISOString().slice(0, 10) + " — aguarda campanha de caminhões usados",
      })),
      skipDuplicates: true,
    });
    criados += r.count;
    console.log(`Criados: ${criados}/${paracriar.length}`);
  }

  // 4. Mudar status dos DossieComercial de INVESTIGANDO/PEDIR_MAIS_PESQUISA para ARQUIVADO
  // (StatusDossie não tem "AGUARDANDO_CAMPANHA" — usa ARQUIVADO, que já significa
  // "descartado ou inativo"; tira da fila do Loop, dados preservados, nunca apagados.)
  const atualizados = await prisma.dossieComercial.updateMany({
    where: {
      id: { in: revendas.map(d => d.id) },
      status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
    },
    data: {
      status: "ARQUIVADO",
    },
  });

  console.log(`\n✅ Concluído:`);
  console.log(`   DossieCarteira criados: ${criados}`);
  console.log(`   DossieComercial atualizados para ARQUIVADO: ${atualizados.count}`);
  console.log(`\nAs revendas agora aparecem na aba Agências de Caminhões e saíram da fila do Loop.`);

  await prisma.$disconnect();
}

main().catch(console.error);
