import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";
import {
  gerarPromptCompleto,
  initialAgenteConfigs,
  type InitialAgenteConfig,
} from "../lib/agentes";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function upsertAgente(config: InitialAgenteConfig) {
  const promptCompleto = gerarPromptCompleto(config);

  await prisma.agenteConfig.upsert({
    where: {
      agente: config.agente,
    },
    update: {},
    create: {
      ...config,
      promptCompleto,
    },
  });
}

async function main() {
  for (const config of initialAgenteConfigs) {
    await upsertAgente(config);
  }

  console.log("Configs iniciais dos agentes prontas.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
