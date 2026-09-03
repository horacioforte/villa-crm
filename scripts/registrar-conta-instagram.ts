// ARQUIVO: scripts/registrar-conta-instagram.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Pré-requisito funcional para o Sprint 2 (Instagram Analytics Real): cria (ou
// atualiza) a linha de RedeSocialConta para o Instagram com
// instagramBusinessAccountId + accessTokenEnvVar preenchidos. Sem essa linha,
// sincronizarInstagram() (lib/instagram/sync-engine.ts) não tem o que
// sincronizar — /api/midias-sociais/sync devolve 404 "Nenhuma conta Instagram
// ativa cadastrada.".
//
// Por que um script e não o formulário de Configurações (Sprint 1): o campo
// instagramBusinessAccountId foi adicionado ao schema nesta Sprint 2 (C1) e
// ainda não está exposto em lib/validations/rede-social.ts nem no formulário
// — estender esses dois para uma configuração única (feita uma vez) trocaria
// mais superfície do que o necessário. Idempotente por (rede, nome), como
// scripts/criar-canal-morgana.ts.
//
// Só grava o NOME da variável de ambiente (accessTokenEnvVar) — nunca o
// valor do token em si. INSTAGRAM_ACCESS_TOKEN precisa estar na allowlist de
// lib/instagram/env-allowlist.ts (já está) e configurada na Vercel antes de
// qualquer sincronização real funcionar.
//
// Modo padrão: DRY RUN (só relatório, nenhuma escrita). Passe --apply para gravar de fato.
//
// Uso:
//   npx tsx scripts/registrar-conta-instagram.ts            (dry run)
//   npx tsx scripts/registrar-conta-instagram.ts --apply     (grava)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const APLICAR = process.argv.includes("--apply");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NOME_CONTA = "@villapumps";
const INSTAGRAM_BUSINESS_ACCOUNT_ID = "17841402587852701";
const ACCESS_TOKEN_ENV_VAR = "INSTAGRAM_ACCESS_TOKEN";

async function main() {
  const relatorio: Record<string, unknown> = { modo: APLICAR ? "APLICAR" : "DRY_RUN" };

  await prisma.$transaction(async (tx) => {
    let conta = await tx.redeSocialConta.findUnique({
      where: { rede_nome: { rede: "INSTAGRAM", nome: NOME_CONTA } },
    });

    if (!conta) {
      relatorio.contaACriar = true;
      if (APLICAR) {
        conta = await tx.redeSocialConta.create({
          data: {
            rede: "INSTAGRAM",
            nome: NOME_CONTA,
            instagramBusinessAccountId: INSTAGRAM_BUSINESS_ACCOUNT_ID,
            accessTokenEnvVar: ACCESS_TOKEN_ENV_VAR,
            ativo: true,
          },
        });
      }
    } else {
      relatorio.contaACriar = false;
      relatorio.contaExistente = conta;

      // Detecta divergência sem nunca sobrescrever sozinho — só relata.
      const divergencias: string[] = [];
      if (conta.instagramBusinessAccountId !== INSTAGRAM_BUSINESS_ACCOUNT_ID) {
        divergencias.push(
          `instagramBusinessAccountId atual=${conta.instagramBusinessAccountId}, esperado=${INSTAGRAM_BUSINESS_ACCOUNT_ID}`,
        );
      }
      if (conta.accessTokenEnvVar !== ACCESS_TOKEN_ENV_VAR) {
        divergencias.push(`accessTokenEnvVar atual=${conta.accessTokenEnvVar}, esperado=${ACCESS_TOKEN_ENV_VAR}`);
      }
      if (!conta.ativo) divergencias.push("ativo atual=false, esperado=true");
      relatorio.divergenciasComContaExistente = divergencias;
    }

    relatorio.contaFinal = conta;
  });

  console.log(JSON.stringify(relatorio, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nenhuma escrita foi feita. Rode com --apply para gravar.");
  }
}

main().finally(() => prisma.$disconnect());
