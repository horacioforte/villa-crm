import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não está configurada.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const rows = await prisma.dossieComercial.findMany({
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: {
      id: true,
      titulo: true,
      segmento: true,
      clienteFinal: true,
      cidade: true,
      estado: true,
      construtora: true,
      epc: true,
      epcm: true,
      faseObra: true,
      status: true,
      score: true,
      ultimaAtividade: true,
      updatedAt: true,
      fonteInformacao: true,
      linkFonte: true,
      resumo: true,
      proximaAcaoSugerida: true,
    },
  });

  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("joao_audit failed", error);
  process.exitCode = 1;
});
