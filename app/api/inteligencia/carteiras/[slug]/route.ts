import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";
import { buildCarteiraExtras } from "@/lib/inteligencia/carteiras";

const slugsPermitidos = new Set([
  "mcmv",
  "construtoras-brasil",
  "concreteiras",
  "pre-moldados",
  "revendas-caminhoes",
]);

const slugToCarteira = {
  mcmv: "MCMV",
  "construtoras-brasil": "CONSTRUTORA_BRASIL",
  concreteiras: "CONCRETEIRAS",
  "pre-moldados": "PRE_MOLDADOS",
  "revendas-caminhoes": "REVENDAS_CAMINHOES",
} as const;

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { slug } = await context.params;
  if (!slugsPermitidos.has(slug)) {
    return NextResponse.json({ error: "Carteira não encontrada" }, { status: 404 });
  }

  const carteira = slugToCarteira[slug as keyof typeof slugToCarteira];
  const searchParams = req.nextUrl?.searchParams ?? new URL(req.url ?? "https://localhost").searchParams;
  const termo = searchParams.get("q")?.trim();
  const statusFiltro = searchParams.get("status")?.trim();
  const estado = searchParams.get("estado")?.trim();
  const cidade = searchParams.get("cidade")?.trim();
  const scoreMinRaw = searchParams.get("scoreMin")?.trim();
  const scoreMaxRaw = searchParams.get("scoreMax")?.trim();
  const scoreMin = scoreMinRaw !== null && scoreMinRaw !== "" ? Number(scoreMinRaw) : null;
  const scoreMax = scoreMaxRaw !== null && scoreMaxRaw !== "" ? Number(scoreMaxRaw) : null;
  const apenasComDecisor = searchParams.get("comDecisor") === "true";
  const apenasSemDecisor = searchParams.get("semDecisor") === "true";
  const emCampanha = searchParams.get("emCampanha") === "true";
  const interessado = searchParams.get("interessado") === "true";
  const movimentoRecente = searchParams.get("movimentoRecente") === "true";
  const semAtualizacaoRecente = searchParams.get("semAtualizacaoRecente") === "true";

  const where: Record<string, unknown> = { carteira };
  if (statusFiltro && statusFiltro !== "TODAS") {
    where.status = statusFiltro;
  }
  if (estado) {
    where.dossie = { ...(where.dossie as Record<string, unknown> | undefined), estado: { equals: estado, mode: "insensitive" } };
  }
  if (cidade) {
    where.dossie = { ...(where.dossie as Record<string, unknown> | undefined), cidade: { equals: cidade, mode: "insensitive" } };
  }
  if (scoreMin !== null && Number.isFinite(scoreMin)) {
    where.score = { gte: scoreMin };
  }
  if (scoreMax !== null && Number.isFinite(scoreMax)) {
    where.score = { ...(where.score as Record<string, unknown> | undefined), lte: scoreMax };
  }
  if (apenasComDecisor) {
    where.decisores = { gt: 0 };
  }
  if (apenasSemDecisor) {
    where.decisores = { equals: 0 };
  }
  if (emCampanha) {
    where.emCampanha = true;
  }
  if (interessado) {
    where.interessado = true;
  }
  if (movimentoRecente || semAtualizacaoRecente) {
    const limit = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    where.ultimaAtualizacao = movimentoRecente ? { gte: limit } : { lt: limit };
  }

  if (termo) {
    const dossieWhere: Record<string, unknown> = {
      OR: [
        { titulo: { contains: termo, mode: "insensitive" } },
        { resumo: { contains: termo, mode: "insensitive" } },
        { cidade: { contains: termo, mode: "insensitive" } },
        { estado: { contains: termo, mode: "insensitive" } },
        { empresa: { is: { razaoSocial: { contains: termo, mode: "insensitive" } } } },
      ],
    };
    where.dossie = { ...(where.dossie as Record<string, unknown> | undefined), ...dossieWhere };
  }

  const itens = await prisma.dossieCarteira.findMany({
    where,
    take: 50,
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    include: {
      dossie: {
        include: {
          empresa: { select: { razaoSocial: true, cidade: true, estado: true, segmento: true } },
          decisores: { select: { nome: true }, take: 10 },
        },
      },
    },
  });

  const items = itens.map((item: any) => {
    const dossie = item.dossie;
    return {
      id: dossie.id,
      empresa: dossie.empresa?.razaoSocial ?? dossie.clienteFinal ?? dossie.titulo,
      cidade: dossie.cidade ?? dossie.empresa?.cidade ?? "-",
      uf: dossie.estado ?? dossie.empresa?.estado ?? "-",
      segmento: dossie.segmento ?? dossie.empresa?.segmento ?? "-",
      score: dossie.score ?? item.score ?? 0,
      ultimaInvestigacao: item.ultimaInvestigacao ? new Date(item.ultimaInvestigacao).toLocaleDateString("pt-BR") : new Date(dossie.updatedAt).toLocaleDateString("pt-BR"),
      principalSinal: item.principalSinal ?? dossie.resumo ?? "Sem sinal registrado.",
      decisores: dossie.decisores.length || item.decisores || 0,
      proximaAcao: item.proximaAcao ?? dossie.proximaAcaoSugerida ?? "Aguardando investigação",
      tempoSemAtualizacao: dossie.ultimaAtividade ? `${Math.max(0, Math.floor((Date.now() - new Date(dossie.ultimaAtividade).getTime()) / 86400000))}d` : "Sem dados",
      estagio: (item.status ?? "MONITORANDO") as any,
      dossieId: dossie.id,
      emCampanha: item.emCampanha ?? false,
      interessado: item.interessado ?? false,
      extras: buildCarteiraExtras(
        {
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
          empresasRelacionadas: dossie.empresa ? [{ razaoSocial: dossie.empresa.razaoSocial, papel: "EMPRESA" }] : [],
        },
        carteira,
      ),
    };
  });

  return NextResponse.json({ slug, items });
}
