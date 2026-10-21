// ARQUIVO: scripts/investigar-radar-joao.ts
// Investigação read-only: últimas inserções do Radar João na Central de Inteligência
// (DossieComercial). Não grava nada, não altera nada.
import { prisma } from "@/lib/prisma";

async function main() {
  const dossies = await prisma.dossieComercial.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      titulo: true,
      origem: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      fonteInformacao: true,
      linkFonte: true,
    },
  });

  console.log("\n=== ÚLTIMOS 20 DOSSIÊS CRIADOS ===\n");
  for (const d of dossies) {
    console.log(`[${d.createdAt.toISOString().slice(0, 10)}] ${d.titulo}`);
    console.log(`  Status: ${d.status} | Origem: ${d.origem} | Fonte: ${d.fonteInformacao ?? "—"}`);
    console.log(`  ID: ${d.id}`);
    console.log();
  }

  const porOrigem = await prisma.dossieComercial.groupBy({
    by: ["origem"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  console.log("=== TOTAL POR ORIGEM ===");
  for (const o of porOrigem) {
    console.log(`  ${o.origem}: ${o._count.id} dossiês`);
  }

  const atualizados = await prisma.dossieComercial.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, titulo: true, updatedAt: true, status: true },
  });
  console.log("\n=== ÚLTIMOS 10 DOSSIÊS ATUALIZADOS (LOOP) ===");
  for (const d of atualizados) {
    console.log(`[${d.updatedAt.toISOString().slice(0, 10)}] ${d.titulo} — ${d.status}`);
  }

  // Extra: contagem por dia nos últimos 30 dias, para ver quando parou
  const ultimos30 = await prisma.dossieComercial.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    select: { createdAt: true, origem: true },
  });
  const porDia = new Map<string, number>();
  for (const d of ultimos30) {
    const dia = d.createdAt.toISOString().slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  console.log("\n=== CRIAÇÕES POR DIA (ÚLTIMOS 30 DIAS) ===");
  for (const [dia, qtd] of [...porDia.entries()].sort()) {
    console.log(`  ${dia}: ${qtd}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
