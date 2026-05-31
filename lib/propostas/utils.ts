import { prisma } from "@/lib/prisma";

/**
 * Retorna o valorTotal da proposta mais recente enviada/aprovada
 * de uma oportunidade. Retorna null se nao houver proposta.
 */
export async function getValorPropostaAtiva(
  oportunidadeId: string,
): Promise<number | null> {
  const proposta = await prisma.propostaComercial.findFirst({
    where: {
      oportunidadeId,
      status: {
        in: ["ENVIADA", "APROVADA", "ACEITA"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      valorTotal: true,
    },
  });

  return proposta ? Number(proposta.valorTotal) : null;
}
