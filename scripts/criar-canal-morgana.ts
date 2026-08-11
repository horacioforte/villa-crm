// ARQUIVO: scripts/criar-canal-morgana.ts
// Cria o canal WhatsApp da Morgana (Fase 2 — Central de Atendimento / Workspace
// Comercial). Morgana é humana — agenteIA fica sempre null, nunca mapeado a nenhum
// processador automático.
//
// Só grava NOME de variável de ambiente (accessTokenEnvVar) — nunca o valor do
// segredo. MORGANA_EVOLUTION_API_KEY precisa estar na allowlist de
// lib/whatsapp/env-allowlist.ts (já está) antes de qualquer código resolver esse nome
// para um valor real.
//
// O canal fica ativo:true, mas permanece inerte até WHATSAPP_MORGANA_CONVERSAS_V2 ser
// ligada em app/api/webhook/whatsapp/morgana/route.ts — nenhum código lê esse canal
// fora desse caminho, e mesmo esse caminho não persiste nada com a flag desligada.
//
// Modo padrão: DRY RUN (só relatório, nenhuma escrita). Passe --apply para gravar de fato.
//
// Uso:
//   npx tsx scripts/criar-canal-morgana.ts            (dry run)
//   npx tsx scripts/criar-canal-morgana.ts --apply     (grava)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const APLICAR = process.argv.includes("--apply");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const INSTANCE_NAME = "morgana-villa";

async function main() {
  const relatorio: Record<string, unknown> = { modo: APLICAR ? "APLICAR" : "DRY_RUN" };

  await prisma.$transaction(async (tx) => {
    // ── Passo 1: localizar o usuário Morgana existente (nunca inventar um id) ──
    const usuarioMorgana = await tx.usuario.findFirst({
      where: { nome: { equals: "Morgana", mode: "insensitive" } },
      select: { id: true, nome: true, email: true, papel: true, ativo: true },
    });

    relatorio.usuarioMorganaEncontrado = usuarioMorgana;

    if (!usuarioMorgana) {
      relatorio.erro = "Usuário 'Morgana' não encontrado — canal NÃO será criado (nenhum responsavelPadraoId é inventado).";
      return;
    }

    // ── Passo 2: canal da Morgana (upsert idempotente por instanceName) ────────
    let canal = await tx.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });

    if (!canal) {
      relatorio.canalACriar = true;
      if (APLICAR) {
        canal = await tx.canalWhatsapp.create({
          data: {
            nome: "Morgana — Evolution API",
            tipo: "EVOLUTION",
            instanceName: INSTANCE_NAME,
            agenteIA: null,
            responsavelPadraoId: usuarioMorgana.id,
            accessTokenEnvVar: "MORGANA_EVOLUTION_API_KEY",
            ativo: true,
          },
        });
      }
    } else {
      relatorio.canalACriar = false;
      relatorio.canalExistente = canal;

      // Detecta divergência sem nunca sobrescrever sozinho — só relata.
      const divergencias: string[] = [];
      if (canal.tipo !== "EVOLUTION") divergencias.push(`tipo atual=${canal.tipo}, esperado=EVOLUTION`);
      if (canal.agenteIA !== null) divergencias.push(`agenteIA atual=${canal.agenteIA}, esperado=null`);
      if (canal.responsavelPadraoId !== usuarioMorgana.id) {
        divergencias.push(`responsavelPadraoId atual=${canal.responsavelPadraoId}, esperado=${usuarioMorgana.id}`);
      }
      if (canal.accessTokenEnvVar !== "MORGANA_EVOLUTION_API_KEY") {
        divergencias.push(`accessTokenEnvVar atual=${canal.accessTokenEnvVar}, esperado=MORGANA_EVOLUTION_API_KEY`);
      }
      relatorio.divergenciasComCanalExistente = divergencias;
    }

    relatorio.canalFinal = canal;
  });

  console.log(JSON.stringify(relatorio, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nenhuma escrita foi feita. Rode com --apply para gravar.");
  }
}

main().finally(() => prisma.$disconnect());
