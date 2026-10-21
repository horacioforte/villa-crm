import { prisma } from "@/lib/prisma";

async function main() {
  const result = await prisma.dossieComercial.updateMany({
    where: {
      segmento: { contains: "Revenda de Caminhões", mode: "insensitive" },
      score: 0,
      status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
    },
    data: { status: "ARQUIVADO" },
  });
  console.log("Arquivados:", result.count);
  await prisma.$disconnect();
}

main().catch(console.error);
