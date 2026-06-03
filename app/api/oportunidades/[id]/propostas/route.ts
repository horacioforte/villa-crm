import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  buildPropostaBlocosSnapshot,
  buildPropostaHtmlSnapshot,
  gerarNumeroProposta,
  getOportunidadeAccessWhere,
  propostaInclude,
} from "@/lib/propostas/service";
import { getPropostaTemplate } from "@/lib/propostas/templates";
import { propostaCreateSchema } from "@/lib/validations/proposta";

const BOMBA_TEMPLATE_ID = "locacao-bomba-concreto-com-operacao";
const STATUS_EXCLUIDOS_TOTAL = new Set(["CANCELADA", "REJEITADA"]);

type OportunidadePropostasRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function calcularValorItem(item: {
  quantidade: number;
  precoM3: number | null;
  volumeMinimoM3: number | null;
  precoUnitario: number | null;
}) {
  if (item.precoM3 && item.volumeMinimoM3) {
    return Math.round(item.quantidade * item.precoM3 * item.volumeMinimoM3 * 100) / 100;
  }

  return Math.round(item.quantidade * (item.precoUnitario ?? 0) * 100) / 100;
}

export async function GET(
  request: Request,
  context: OportunidadePropostasRouteContext,
) {
  const authResult = await requirePermission("propostas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const oportunidade = await prisma.oportunidade.findFirst({
    where: getOportunidadeAccessWhere(id, authResult),
    select: { id: true },
  });

  if (!oportunidade) {
    return NextResponse.json(
      { message: "Oportunidade nao encontrada." },
      { status: 404 },
    );
  }

  try {
    const grupos = await prisma.proposta.findMany({
      where: {
        oportunidadeId: id,
      },
      orderBy: {
        criadoEm: "asc",
      },
      include: {
        versoes: {
          orderBy: [
            {
              versao: "desc",
            },
            {
              createdAt: "desc",
            },
          ],
          include: propostaInclude,
        },
      },
    });
    const legadas = await prisma.propostaComercial.findMany({
      where: {
        oportunidadeId: id,
        propostaId: null,
      },
      orderBy: [
        {
          versao: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: propostaInclude,
    });
    const totalProposto =
      Math.round(
        grupos.reduce((soma, grupo) => {
          const ativa = grupo.versoes.find(
            (versao) =>
              versao.ativa && !STATUS_EXCLUIDOS_TOTAL.has(versao.status),
          );

          return soma + Number(ativa?.valorTotal ?? 0);
        }, 0) * 100,
      ) / 100;

    return NextResponse.json({ grupos, legadas, totalProposto });
  } catch (error) {
    console.error("Falha ao carregar propostas da oportunidade", error);

    try {
      const propostasLegadas = await prisma.propostaComercial.findMany({
        where: {
          oportunidadeId: id,
        },
        orderBy: [
          {
            versao: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        select: {
          id: true,
          numeroProposta: true,
          versao: true,
          status: true,
          templateUtilizado: true,
          valorTotal: true,
          validadeProposta: true,
          createdAt: true,
          excecoes: {
            select: {
              status: true,
            },
          },
        },
      });

      return NextResponse.json(propostasLegadas);
    } catch (fallbackError) {
      console.error("Falha ao carregar propostas legadas", fallbackError);
      return NextResponse.json({ grupos: [], legadas: [], totalProposto: 0 });
    }
  }
}

export async function POST(
  request: Request,
  context: OportunidadePropostasRouteContext,
) {
  const authResult = await requirePermission("propostas", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = propostaCreateSchema.parse(await request.json());

    const oportunidade = await prisma.oportunidade.findFirst({
      where: getOportunidadeAccessWhere(id, authResult),
      include: {
        empresa: true,
        pessoa: true,
        obra: true,
        responsavel: true,
        equipamento: true,
      },
    });

    if (!oportunidade) {
      return NextResponse.json(
        { message: "Oportunidade nao encontrada." },
        { status: 404 },
      );
    }

    if (!oportunidade.empresa || !oportunidade.obra) {
      return NextResponse.json(
        {
          message:
            "A oportunidade precisa ter empresa e obra vinculadas para gerar proposta.",
        },
        { status: 400 },
      );
    }

    const modo = data.modo ?? "nova_proposta";
    const templateUtilizado = data.templateUtilizado;
    const modeloPorM3 = templateUtilizado === BOMBA_TEMPLATE_ID;
    const template = getPropostaTemplate(templateUtilizado);

    if (!template?.disponivel) {
      return NextResponse.json(
        { message: "Template indisponivel ate aprovacao do documento master." },
        { status: 400 },
      );
    }

    const grupoRevisao =
      modo === "revisao"
        ? await prisma.proposta.findFirst({
            where: {
              id: data.propostaId ?? "",
              oportunidadeId: oportunidade.id,
            },
            include: {
              versoes: {
                orderBy: {
                  versao: "desc",
                },
                take: 1,
                select: {
                  versao: true,
                },
              },
            },
          })
        : null;

    if (modo === "revisao" && !grupoRevisao) {
      return NextResponse.json(
        { message: "Proposta para revisao nao encontrada." },
        { status: 404 },
      );
    }

    const numeroProposta =
      modo === "revisao" && grupoRevisao
        ? grupoRevisao.numero
        : await gerarNumeroProposta(prisma);
    const versao =
      modo === "revisao" && grupoRevisao
        ? (grupoRevisao.versoes[0]?.versao ?? 0) + 1
        : 1;

    const itensNormalizados = (data.itens?.length
      ? data.itens
      : [
          {
            equipamentoId: oportunidade.equipamentoId,
            descricao:
              data.descricaoComercial ??
              oportunidade.equipamento?.nome ??
              template.defaults.descricaoComercial,
            quantidade: Number(data.quantidade),
            precoM3: data.precoM3,
            volumeMinimoM3: data.volumeMinimoM3,
            horasGarantidas: data.horasGarantidas,
            precoUnitario: data.precoUnitario,
            horaExtra: data.horaExtra,
            ordem: 0,
          },
        ]).map((item, index) => {
      const itemNormalizado = {
        ...item,
        precoM3: modeloPorM3 ? item.precoM3 : null,
        volumeMinimoM3: modeloPorM3 ? item.volumeMinimoM3 : null,
        precoUnitario: modeloPorM3 ? null : item.precoUnitario,
      };
      const valorTotal = calcularValorItem(itemNormalizado);

      return {
        ...itemNormalizado,
        ordem: item.ordem ?? index,
        valorTotal,
      };
    });
    const primeiroItem = itensNormalizados[0];
    const valorTotalCalculado =
      Math.round(
        itensNormalizados.reduce((sum, item) => sum + item.valorTotal, 0) * 100,
      ) / 100;

    if (
      templateUtilizado === BOMBA_TEMPLATE_ID &&
      itensNormalizados.some((item) => !item.precoM3 || item.precoM3 <= 0)
    ) {
      return NextResponse.json(
        { message: "Proposta de bomba requer preco por m3." },
        { status: 400 },
      );
    }

    if (
      modeloPorM3 &&
      itensNormalizados.some(
        (item) => item.precoM3 && (!item.volumeMinimoM3 || item.volumeMinimoM3 <= 0),
      )
    ) {
      return NextResponse.json(
        { message: "Informe o volume minimo para proposta por m3." },
        { status: 400 },
      );
    }

    if (Math.abs(valorTotalCalculado - data.valorTotal) > 0.01) {
      return NextResponse.json(
        {
          message:
            modeloPorM3
              ? "O valor total da proposta deve ser igual ao preco por m3 multiplicado pelo volume minimo."
              : "O valor total da proposta deve ser igual a quantidade multiplicada pelo valor unitario.",
        },
        { status: 400 },
      );
    }

    const snapshotInput = {
      ...data,
      templateUtilizado,
      valorTotal: valorTotalCalculado,
      quantidade: String(primeiroItem?.quantidade ?? data.quantidade),
      descricaoComercial: primeiroItem?.descricao ?? data.descricaoComercial,
      horasGarantidas: modeloPorM3 ? null : primeiroItem?.horasGarantidas,
      precoUnitario: modeloPorM3
        ? primeiroItem?.precoM3 ?? data.precoUnitario
        : primeiroItem?.precoUnitario ?? data.precoUnitario,
      horaExtra: modeloPorM3 ? null : primeiroItem?.horaExtra,
      precoM3: modeloPorM3 ? primeiroItem?.precoM3 : null,
      volumeMinimoM3: modeloPorM3 ? primeiroItem?.volumeMinimoM3 : null,
      itens: itensNormalizados,
      numeroProposta,
      versao,
    };
    const blocos = buildPropostaBlocosSnapshot(snapshotInput, oportunidade);
    const htmlSnapshot = buildPropostaHtmlSnapshot(
      {
        ...snapshotInput,
        blocos,
      },
      oportunidade,
    );

    const proposta = await prisma.$transaction(async (tx) => {
      const grupo =
        modo === "revisao" && grupoRevisao
          ? grupoRevisao
          : await tx.proposta.create({
              data: {
                numero: numeroProposta,
                tipoProposta: data.tipoProposta ?? "OUTRO",
                descricao: data.descricaoProposta,
                oportunidadeId: oportunidade.id,
                createdById: authResult.id,
              },
            });

      if (modo === "revisao") {
        await tx.propostaComercial.updateMany({
          where: {
            propostaId: grupo.id,
            ativa: true,
          },
          data: {
            ativa: false,
          },
        });
      }

      const created = await tx.propostaComercial.create({
        data: {
          templateUtilizado,
          valorTotal: valorTotalCalculado,
          validadeProposta: data.validadeProposta,
          prazoExecucao: data.prazoExecucao,
          observacoesComerciais: data.observacoesComerciais,
          observacoesTecnicas: data.observacoesTecnicas,
          condicoesPagamento: data.condicoesPagamento,
          horaExtra: modeloPorM3 ? null : primeiroItem?.horaExtra,
          precoM3: modeloPorM3 ? primeiroItem?.precoM3 : null,
          volumeMinimoM3: modeloPorM3 ? primeiroItem?.volumeMinimoM3 : null,
          numeroProposta,
          versao,
          ativa: true,
          propostaId: grupo.id,
          htmlSnapshot,
          oportunidadeId: oportunidade.id,
          createdById: authResult.id,
          updatedById: authResult.id,
          blocos: {
            create: blocos.map((item) => ({
              chave: item.chave,
              titulo: item.titulo,
              tipo: item.tipo,
              ordem: item.ordem,
              conteudoOriginal: item.conteudoOriginal,
              conteudoAtual: item.conteudoAtual,
            })),
          },
          itens: {
            create: itensNormalizados.map((item) => ({
              ordem: item.ordem,
              descricao: item.descricao,
              quantidade: item.quantidade,
              equipamentoId: item.equipamentoId,
              precoM3: item.precoM3,
              volumeMinimoM3: item.volumeMinimoM3,
              horasGarantidas: item.horasGarantidas,
              precoUnitario: item.precoUnitario,
              horaExtra: item.horaExtra,
              valorTotal: item.valorTotal,
            })),
          },
          auditorias: {
            create: {
              campo: "proposta",
              valorNovo: {
                status: "RASCUNHO",
                template: templateUtilizado,
              },
              justificativa:
                "Criacao da proposta a partir de template oficial Villa.",
              statusNovo: "RASCUNHO",
              versao,
              usuarioId: authResult.id,
            },
          },
        },
      });

      return tx.propostaComercial.findUniqueOrThrow({
        where: {
          id: created.id,
        },
        include: propostaInclude,
      });
    });

    await auditLog({
      action: "PROPOSTA_COMERCIAL_CREATED",
      entity: "PropostaComercial",
      entityId: proposta.id,
      after: proposta,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(proposta, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: error.issues[0]?.message ?? "Dados invalidos.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    console.error("Falha ao salvar proposta da oportunidade", error);

    return NextResponse.json(
      {
        message: "Nao foi possivel salvar o rascunho da proposta.",
      },
      { status: 500 },
    );
  }
}
