// ARQUIVO: scripts/backfill-canal-joao.ts
// Backfill do canal WhatsApp do João (Fase 2 — Central de Atendimento).
//
// PRÉ-REQUISITO: a migration "fase2_canal_whatsapp_idempotencia" precisa estar aplicada
// (CanalWhatsapp, Conversa.canalWhatsappId, Mensagem.canalWhatsappId/externalMessageId
// já precisam existir no banco). Rodar este script antes disso vai falhar — é esperado.
//
// Modo padrão: DRY RUN (só relatório, nenhuma escrita). Passe --apply para gravar de fato.
//
// Uso:
//   npx tsx scripts/backfill-canal-joao.ts            (dry run)
//   npx tsx scripts/backfill-canal-joao.ts --apply     (grava)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const APLICAR = process.argv.includes("--apply");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const INSTANCE_NAME = "joao-villa";

async function main() {
  const relatorio: Record<string, unknown> = { modo: APLICAR ? "APLICAR" : "DRY_RUN" };

  await prisma.$transaction(async (tx) => {
    // ── Passo 1: canal do João (upsert idempotente por instanceName) ─────────
    let canal = await tx.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });

    if (!canal) {
      relatorio.canalCriado = true;
      if (APLICAR) {
        canal = await tx.canalWhatsapp.create({
          data: {
            nome: "João — Meta Cloud API",
            tipo: "META_CLOUD_API",
            instanceName: INSTANCE_NAME,
            phoneNumberId: process.env.META_JOAO_PHONE_NUMBER_ID ?? null,
            accessTokenEnvVar: "META_JOAO_ACCESS_TOKEN",
            verifyTokenEnvVar: "META_WEBHOOK_VERIFY_TOKEN",
            agenteIA: "joao",
            ativo: true,
          },
        });
      }
    } else {
      relatorio.canalCriado = false;
      relatorio.canalExistenteId = canal.id;
    }

    // ── Passo 2: conversas joao-villa ainda não vinculadas ────────────────────
    const conversasParaVincular = await tx.conversa.findMany({
      where: { instanceName: INSTANCE_NAME, canalWhatsappId: null },
      select: { id: true },
    });
    relatorio.conversasParaVincular = conversasParaVincular.length;

    if (APLICAR && canal) {
      await tx.conversa.updateMany({
        where: { instanceName: INSTANCE_NAME, canalWhatsappId: null },
        data: { canalWhatsappId: canal.id },
      });
    }

    // ── Passo 3: mensagens dessas conversas — canalWhatsappId = canal da própria conversa ──
    // (garante a invariante: Mensagem.canalWhatsappId sempre igual ao da Conversa)
    const todasConversasJoao = await tx.conversa.findMany({
      where: { instanceName: INSTANCE_NAME },
      select: { id: true },
    });
    const todosConversaIds = todasConversasJoao.map((c) => c.id);

    const mensagensParaVincular = todosConversaIds.length
      ? await tx.mensagem.count({
          where: { conversaId: { in: todosConversaIds }, canalWhatsappId: null },
        })
      : 0;
    relatorio.mensagensParaVincular = mensagensParaVincular;

    if (APLICAR && canal && todosConversaIds.length) {
      await tx.mensagem.updateMany({
        where: { conversaId: { in: todosConversaIds }, canalWhatsappId: null },
        data: { canalWhatsappId: canal.id },
      });
    }

    // ── Passo 4: copiar waMessageId → externalMessageId, só sem conflito ──────
    // Conflito = já existe outra mensagem no MESMO canal com esse externalMessageId,
    // OU há mais de uma mensagem no escopo com o mesmo waMessageId (duplicidade interna).
    // IMPORTANTE: nenhum identificador é inventado. Mensagens históricas sem waMessageId
    // (todo o histórico atual do João, hoje) ficam só vinculadas ao canal via Passo 3 —
    // seu externalMessageId permanece NULL para sempre. A unicidade/idempotência por
    // externalMessageId passa a valer apenas para mensagens novas do fluxo V2, que
    // chegam com um ID real da Meta.
    const candidatas = todosConversaIds.length
      ? await tx.mensagem.findMany({
          where: {
            conversaId: { in: todosConversaIds },
            waMessageId: { not: null },
            externalMessageId: null,
          },
          select: { id: true, waMessageId: true },
        })
      : [];

    const contagemPorWaId = new Map<string, number>();
    for (const m of candidatas) {
      const key = m.waMessageId as string;
      contagemPorWaId.set(key, (contagemPorWaId.get(key) ?? 0) + 1);
    }

    const ambiguas: Array<{ id: string; waMessageId: string; motivo: string }> = [];
    const seguras: Array<{ id: string; waMessageId: string }> = [];

    for (const m of candidatas) {
      const waId = m.waMessageId as string;

      if ((contagemPorWaId.get(waId) ?? 0) > 1) {
        ambiguas.push({ id: m.id, waMessageId: waId, motivo: "waMessageId duplicado dentro do escopo joao-villa" });
        continue;
      }

      const conflito = canal
        ? await tx.mensagem.findFirst({
            where: { canalWhatsappId: canal.id, externalMessageId: waId, id: { not: m.id } },
            select: { id: true },
          })
        : null;

      if (conflito) {
        ambiguas.push({ id: m.id, waMessageId: waId, motivo: `já existe mensagem ${conflito.id} com esse externalMessageId no canal` });
        continue;
      }

      seguras.push({ id: m.id, waMessageId: waId });
    }

    relatorio.candidatasACopiar = candidatas.length;
    relatorio.copiadasComSeguranca = seguras.length;
    relatorio.ambiguasNaoCopiadas = ambiguas;

    if (APLICAR) {
      for (const s of seguras) {
        await tx.mensagem.update({
          where: { id: s.id },
          data: { externalMessageId: s.waMessageId },
        });
      }
    }
  });

  console.log(JSON.stringify(relatorio, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nenhuma escrita foi feita. Rode com --apply para gravar.");
  }
}

main().finally(() => prisma.$disconnect());
