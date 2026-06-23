// ARQUIVO: lib/agentes/maria/contexto.ts
// REGRA: nunca remover. Apenas acrescentar.
// Busca e formata o contexto de conversa para a Maria (histórico CRM + oportunidades abertas).

import { prisma } from "@/lib/prisma";
import { TipoContato, StatusOportunidade } from "@/app/generated/prisma/client";

export async function getContextoConversa(telefone: string) {
  const pessoa = await prisma.pessoa.findFirst({
    where: {
      OR: [{ whatsapp: telefone }, { telefone }],
    },
    select: {
      id: true,
      historicos: {
        where: {
          tipo: TipoContato.WHATSAPP,
        },
        orderBy: {
          dataContato: "desc",
        },
        take: 6,
        select: {
          resumo: true,
          detalhes: true,
          dataContato: true,
        },
      },
      oportunidades: {
        where: {
          ativa: true,
          status: {
            notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          titulo: true,
          descricao: true,
          tipoServico: true,
        },
      },
    },
  });

  if (!pessoa) {
    return "";
  }

  const oportunidade = pessoa.oportunidades[0];
  const linhasOportunidade = oportunidade
    ? [
        "Oportunidade aberta existente:",
        `- Titulo: ${oportunidade.titulo}`,
        oportunidade.tipoServico ? `- Tipo: ${oportunidade.tipoServico}` : null,
        oportunidade.descricao ? `- Descricao: ${oportunidade.descricao}` : null,
      ].filter(Boolean)
    : [];

  const linhasHistorico = pessoa.historicos
    .slice()
    .reverse()
    .map((historico) =>
      [
        `- ${historico.resumo}`,
        historico.detalhes ? historico.detalhes : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );

  return [...linhasOportunidade, ...linhasHistorico].join("\n").slice(0, 3000);
}
