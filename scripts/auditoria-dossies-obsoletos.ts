import { prisma } from "@/lib/prisma";

async function main() {
  const hoje = new Date();
  const diasAtras = (n: number) => new Date(hoje.getTime() - n * 24 * 60 * 60 * 1000);

  // 1. Score 0 + completude < 30% + criados há mais de 60 dias
  const scoreZero = await prisma.dossieComercial.findMany({
    where: {
      status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
      score: 0,
      completude: { lt: 30 },
      createdAt: { lt: diasAtras(60) },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, titulo: true, segmento: true, cidade: true, estado: true, score: true, completude: true, createdAt: true, fonteInformacao: true },
  });

  console.log(`\n=== GRUPO 1: Score 0 + completude < 30% + mais de 60 dias (${scoreZero.length} dossiês) ===`);
  for (const d of scoreZero) {
    console.log(`[${d.createdAt.toISOString().slice(0,10)}] ${d.titulo} | ${d.cidade}/${d.estado} | completude: ${d.completude}%`);
    console.log(`  ID: ${d.id}`);
  }

  // 2. Sem nenhuma atualização nos últimos 90 dias + completude < 40%
  const parados = await prisma.dossieComercial.findMany({
    where: {
      status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
      completude: { lt: 40 },
      ultimaAtividade: { lt: diasAtras(90) },
    },
    orderBy: { ultimaAtividade: "asc" },
    take: 50,
    select: { id: true, titulo: true, segmento: true, cidade: true, estado: true, completude: true, ultimaAtividade: true, createdAt: true },
  });

  console.log(`\n=== GRUPO 2: Parados há mais de 90 dias + completude < 40% (${parados.length} dossiês) ===`);
  for (const d of parados) {
    const diasParado = d.ultimaAtividade ? Math.floor((hoje.getTime() - d.ultimaAtividade.getTime()) / (24*60*60*1000)) : "?";
    console.log(`[parado há ${diasParado}d] ${d.titulo} | ${d.cidade}/${d.estado} | completude: ${d.completude}%`);
    console.log(`  ID: ${d.id}`);
  }

  // 3. Segmentos "revendas / caminhões / outros" com score 0
  const irrelevantes = await prisma.dossieComercial.findMany({
    where: {
      status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
      score: 0,
      OR: [
        { segmento: { contains: "Revenda", mode: "insensitive" } },
        { segmento: { contains: "Caminhão", mode: "insensitive" } },
        { segmento: { contains: "Caminhao", mode: "insensitive" } },
        { segmento: { contains: "Outros", mode: "insensitive" } },
        { titulo: { contains: "Revenda", mode: "insensitive" } },
        { titulo: { contains: "Usados", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, titulo: true, segmento: true, score: true, completude: true, createdAt: true },
  });

  console.log(`\n=== GRUPO 3: Segmentos irrelevantes (revendas, caminhões, outros) com score 0 (${irrelevantes.length} dossiês) ===`);
  for (const d of irrelevantes) {
    console.log(`[${d.createdAt.toISOString().slice(0,10)}] ${d.titulo} | ${d.segmento} | score: ${d.score} | completude: ${d.completude}%`);
    console.log(`  ID: ${d.id}`);
  }

  // Totais
  const totalInvestigando = await prisma.dossieComercial.count({
    where: { status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] } },
  });

  console.log(`\n=== RESUMO ===`);
  console.log(`Total na fila de investigação: ${totalInvestigando}`);
  console.log(`Grupo 1 (score 0 + baixa completude + antigos): ${scoreZero.length}`);
  console.log(`Grupo 2 (parados há 90+ dias): ${parados.length}`);
  console.log(`Grupo 3 (segmentos irrelevantes): ${irrelevantes.length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
