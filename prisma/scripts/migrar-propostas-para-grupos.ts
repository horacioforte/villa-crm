/**
 * Retroalimenta grupos Proposta a partir das PropostaComercial existentes.
 *
 * Executar uma vez apos aplicar a migration de schema:
 * DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-) \
 *   npx tsx prisma/scripts/migrar-propostas-para-grupos.ts
 */
import { TipoProposta } from "../../app/generated/prisma/client";
import { prisma } from "../../lib/prisma";


function inferirTipo(templateUtilizado: string): TipoProposta {
  if (templateUtilizado.includes("bomba")) return TipoProposta.BOMBA;
  if (templateUtilizado.includes("betoneira")) return TipoProposta.BETONEIRA;
  if (templateUtilizado.includes("central")) return TipoProposta.CENTRAL;
  if (templateUtilizado.includes("telebelt")) return TipoProposta.TELEBELT;

  return TipoProposta.OUTRO;
}

async function main() {
  const propostas = await prisma.propostaComercial.findMany({
    where: { propostaId: null },
    orderBy: [{ numeroProposta: "asc" }, { versao: "asc" }],
  });

  console.log(`Total de PropostaComercial para migrar: ${propostas.length}`);

  const grupos = new Map<string, typeof propostas>();
  for (const proposta of propostas) {
    const grupo = grupos.get(proposta.numeroProposta) ?? [];
    grupo.push(proposta);
    grupos.set(proposta.numeroProposta, grupo);
  }

  console.log(`Total de grupos a criar: ${grupos.size}`);

  let contador = 1;
  for (const [numero, versoes] of grupos.entries()) {
    const primeira = versoes[0];
    const maisRecente = [...versoes].sort((a, b) => b.versao - a.versao)[0];

    await prisma.$transaction(async (tx) => {
      const grupoExistente = await tx.proposta.findUnique({
        where: { numero },
        select: { id: true },
      });
      const grupo =
        grupoExistente ??
        (await tx.proposta.create({
          data: {
            numero,
            tipoProposta: inferirTipo(primeira.templateUtilizado),
            oportunidadeId: primeira.oportunidadeId,
            createdById: primeira.createdById,
            criadoEm: primeira.createdAt,
          },
          select: { id: true },
        }));

      for (const versao of versoes) {
        await tx.propostaComercial.update({
          where: { id: versao.id },
          data: {
            propostaId: grupo.id,
            ativa: versao.id === maisRecente.id,
          },
        });
      }
    });

    console.log(
      `[${contador++}/${grupos.size}] Grupo criado: ${numero} (${versoes.length} versoes)`,
    );
  }

  console.log("Migracao concluida.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
