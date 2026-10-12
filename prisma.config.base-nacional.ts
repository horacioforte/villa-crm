// ARQUIVO: prisma.config.base-nacional.ts
// REGRA: nunca remover. Apenas acrescentar.
// Configuração Prisma EXCLUSIVA do branch isolado do Neon "base-nacional-concreteiras".
//
// Por que existe: o prisma.config.ts padrão carrega .env.local com override=true,
// ou seja, qualquer comando Prisma sem esta config aponta para PRODUÇÃO.
// Este arquivo lê SOMENTE .env.branch-base-nacional e se recusa a rodar se a URL
// apontar para o mesmo endpoint Neon de produção.
//
// Uso (sempre com --config):
//   npx prisma migrate status --config prisma.config.base-nacional.ts
//   npx prisma migrate deploy --config prisma.config.base-nacional.ts

import { defineConfig } from "prisma/config";
import { carregarAmbienteIsolado } from "./lib/base-nacional/ambiente";

const ambiente = carregarAmbienteIsolado(process.cwd());
console.log(`[base-nacional] Prisma usando branch isolado — endpoint ${ambiente.endpointMascarado}`);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: ambiente.url,
  },
});
