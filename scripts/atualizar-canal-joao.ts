// ARQUIVO: scripts/atualizar-canal-joao.ts
// Fase 2 — Etapa 3. Preenche os campos de configuração do canal joao-villa.
// Só grava NOMES de variáveis de ambiente (verifyTokenEnvVar, appSecretEnvVar) —
// nunca o valor de nenhum segredo. phoneNumberId não é segredo (é o identificador do
// número usado na própria URL da Graph API), por isso é armazenado direto.
//
// businessAccountId e displayPhoneNumber não têm variável de ambiente disponível hoje
// (não existem em .env.local) — ficam null até serem configurados manualmente ou
// obtidos via consulta à Graph API (fora do escopo deste script).
//
// Uso: npx tsx scripts/atualizar-canal-joao.ts

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const phoneNumberId = process.env.META_JOAO_PHONE_NUMBER_ID ?? null;

  const canal = await prisma.canalWhatsapp.update({
    where: { instanceName: "joao-villa" },
    data: {
      phoneNumberId,
      verifyTokenEnvVar: "META_WEBHOOK_VERIFY_TOKEN",
      appSecretEnvVar: "META_JOAO_APP_SECRET",
      // businessAccountId e displayPhoneNumber: não disponíveis, mantidos null.
    },
    select: {
      id: true,
      nome: true,
      tipo: true,
      instanceName: true,
      agenteIA: true,
      ativo: true,
      phoneNumberId: true,
      businessAccountId: true,
      displayPhoneNumber: true,
      accessTokenEnvVar: true,
      verifyTokenEnvVar: true,
      appSecretEnvVar: true,
    },
  });

  console.log(JSON.stringify(canal, null, 2));
}

main().finally(() => prisma.$disconnect());
