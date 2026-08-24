import { prisma } from "@/lib/prisma";
import { classificarDossieEmCarteiras } from "@/lib/inteligencia/carteiras";

const carteiraLabels = {
  MCMV: "MCMV",
  CONSTRUTORA_BRASIL: "Construtoras Brasil",
  CONCRETEIRAS: "Concreteiras",
  PRE_MOLDADOS: "Pré-Moldados",
  REVENDAS_CAMINHOES: "Revendas de Caminhões",
} as const;

async function run() {
  const total = await prisma.dossieComercial.count();
  const dossies = await prisma.dossieComercial.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      decisores: { select: { nome: true, cargo: true }, take: 5 },
      empresasRelacionadas: { select: { razaoSocial: true, papel: true } },
    },
  });

  let classificados = 0;
  let semClassificacao = 0;
  const contagemPorCarteira: Record<string, number> = {};
  let emMaisDeUma = 0;

  for (const dossie of dossies) {
    const classificacoes = classificarDossieEmCarteiras({
      id: dossie.id,
      titulo: dossie.titulo,
      resumo: dossie.resumo,
      segmento: dossie.segmento,
      cidade: dossie.cidade,
      estado: dossie.estado,
      clienteFinal: dossie.clienteFinal,
      construtora: dossie.construtora,
      epc: dossie.epc,
      epcm: dossie.epcm,
      faseObra: dossie.faseObra,
      valorEstimado: dossie.valorEstimado ? Number(dossie.valorEstimado) : null,
      proximaAcaoSugerida: dossie.proximaAcaoSugerida,
      equipamentosSugeridos: dossie.equipamentosSugeridos,
      concorrentes: dossie.concorrentes,
      concreteiras: dossie.concreteiras,
      empresasRelacionadas: (dossie as any).empresasRelacionadas?.map((empresa: { razaoSocial: string; papel: string }) => ({
        razaoSocial: empresa.razaoSocial,
        papel: empresa.papel,
      })) ?? [],
    });

    if (classificacoes.length === 0) {
      semClassificacao += 1;
      continue;
    }

    classificados += 1;

    for (const item of classificacoes) {
      const carteira = item.carteira;
      contagemPorCarteira[carteira] = (contagemPorCarteira[carteira] ?? 0) + 1;

      await prisma.dossieCarteira.upsert({
        where: { dossieId_carteira: { dossieId: dossie.id, carteira } },
        update: {
          status: "MONITORANDO",
          principalSinal: dossie.resumo ?? null,
          proximaAcao: dossie.proximaAcaoSugerida ?? null,
          ultimaInvestigacao: dossie.ultimaAtividade ?? new Date(),
          ultimaAtualizacao: dossie.updatedAt,
          score: dossie.score ?? 0,
          decisores: dossie.decisores.length ?? 0,
          emCampanha: false,
          interessado: false,
        },
        create: {
          dossieId: dossie.id,
          carteira,
          status: "MONITORANDO",
          principalSinal: dossie.resumo ?? null,
          proximaAcao: dossie.proximaAcaoSugerida ?? null,
          ultimaInvestigacao: dossie.ultimaAtividade ?? new Date(),
          ultimaAtualizacao: dossie.updatedAt,
          score: dossie.score ?? 0,
          decisores: dossie.decisores.length ?? 0,
          emCampanha: false,
          interessado: false,
        },
      });
    }

    if (classificacoes.length > 1) {
      emMaisDeUma += 1;
    }
  }

  const summary = {
    analisados: total,
    classificados,
    semClassificacao,
    porCarteira: Object.fromEntries(
      Object.entries(contagemPorCarteira).map(([carteira, count]) => [carteiraLabels[carteira as keyof typeof carteiraLabels], count]),
    ),
    emMaisDeUmaCarteira: emMaisDeUma,
  };

  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error("Erro ao classificar carteiras:", error);
  process.exit(1);
});
