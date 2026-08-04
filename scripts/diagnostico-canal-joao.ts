// ARQUIVO: scripts/diagnostico-canal-joao.ts
// Diagnóstico somente-leitura do histórico da instância "joao-villa" antes do backfill
// para o canal João (Fase 2 — Central de Atendimento). Não escreve nada no banco.
//
// Uso: npx tsx scripts/diagnostico-canal-joao.ts

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const conversas = await prisma.conversa.findMany({
    where: { instanceName: "joao-villa" },
    select: { id: true, telefone: true, nomeContato: true, createdAt: true },
  });

  const conversaIds = conversas.map((c) => c.id);

  const totalMensagens = conversaIds.length
    ? await prisma.mensagem.count({ where: { conversaId: { in: conversaIds } } })
    : 0;

  const mensagensComWaId = conversaIds.length
    ? await prisma.mensagem.count({
        where: { conversaId: { in: conversaIds }, waMessageId: { not: null } },
      })
    : 0;

  const mensagensSemWaId = totalMensagens - mensagensComWaId;

  // Duplicidade de waMessageId DENTRO do escopo joao-villa
  // (é o que viraria colisão em (canalWhatsappId=canal_joao, externalMessageId) após o backfill)
  const duplicatasNoEscopoJoao = conversaIds.length
    ? await prisma.$queryRawUnsafe<Array<{ waMessageId: string; qtd: bigint }>>(
        `
        SELECT m."waMessageId", COUNT(*) as qtd
        FROM "Mensagem" m
        WHERE m."conversaId" = ANY($1::text[])
          AND m."waMessageId" IS NOT NULL
        GROUP BY m."waMessageId"
        HAVING COUNT(*) > 1
        ORDER BY qtd DESC
        `,
        conversaIds
      )
    : [];

  // waMessageId de joao-villa que já colide com waMessageId de OUTRAS instâncias
  // (não bloqueia o backfill do João, mas é sinal de possível ID reaproveitado entre instâncias)
  const colisaoComOutrasInstancias = conversaIds.length
    ? await prisma.$queryRawUnsafe<Array<{ waMessageId: string; instanceName: string; qtd: bigint }>>(
        `
        SELECT m2."waMessageId", c2."instanceName", COUNT(*) as qtd
        FROM "Mensagem" m2
        JOIN "Conversa" c2 ON c2.id = m2."conversaId"
        WHERE m2."waMessageId" IN (
          SELECT m."waMessageId" FROM "Mensagem" m
          WHERE m."conversaId" = ANY($1::text[]) AND m."waMessageId" IS NOT NULL
        )
        AND c2."instanceName" != 'joao-villa'
        GROUP BY m2."waMessageId", c2."instanceName"
        `,
        conversaIds
      )
    : [];

  console.log(
    JSON.stringify(
      {
        totalConversasJoaoVilla: conversas.length,
        totalMensagens,
        mensagensComWaId,
        mensagensSemWaId,
        duplicatasNoEscopoJoao: duplicatasNoEscopoJoao.map((d) => ({
          waMessageId: d.waMessageId,
          qtd: Number(d.qtd),
        })),
        colisaoComOutrasInstancias: colisaoComOutrasInstancias.map((d) => ({
          waMessageId: d.waMessageId,
          instanceName: d.instanceName,
          qtd: Number(d.qtd),
        })),
        amostraConversas: conversas.slice(0, 10),
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
