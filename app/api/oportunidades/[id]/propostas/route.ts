import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  buildNumeroProposta,
  buildPropostaBlocosSnapshot,
  buildPropostaHtmlSnapshot,
  getOportunidadeAccessWhere,
  propostaInclude,
} from "@/lib/propostas/service";
import { getPropostaTemplate } from "@/lib/propostas/templates";
import { propostaCreateSchema } from "@/lib/validations/proposta";

type OportunidadePropostasRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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
    const propostas = await prisma.propostaComercial.findMany({
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
      include: propostaInclude,
    });

    return NextResponse.json(propostas);
  } catch (error) {
    console.error("Falha ao carregar propostas da oportunidade", error);
    return NextResponse.json([]);
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

    const numeroProposta = buildNumeroProposta(oportunidade.id);
    const latest = await prisma.propostaComercial.findFirst({
      where: {
        numeroProposta,
      },
      orderBy: {
        versao: "desc",
      },
      select: {
        versao: true,
      },
    });
    const versao = (latest?.versao ?? 0) + 1;
    const template = getPropostaTemplate(data.templateUtilizado);

    if (!template?.disponivel) {
      return NextResponse.json(
        { message: "Template indisponivel ate aprovacao do documento master." },
        { status: 400 },
      );
    }

    const valorTotalCalculado =
      Math.round(Number(data.quantidade) * data.precoUnitario * 100) / 100;
    const snapshotInput = {
      ...data,
      valorTotal: valorTotalCalculado,
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
      const created = await tx.propostaComercial.create({
        data: {
          templateUtilizado: data.templateUtilizado,
          valorTotal: valorTotalCalculado,
          validadeProposta: data.validadeProposta,
          prazoExecucao: data.prazoExecucao,
          observacoesComerciais: data.observacoesComerciais,
          observacoesTecnicas: data.observacoesTecnicas,
          condicoesPagamento: data.condicoesPagamento,
          horaExtra: data.horaExtra,
          numeroProposta,
          versao,
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
          auditorias: {
            create: {
              campo: "proposta",
              valorNovo: {
                status: "RASCUNHO",
                template: data.templateUtilizado,
              },
              justificativa: "Criacao da proposta a partir do template master CBSO.",
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

    return NextResponse.json(
      {
        message:
          "O modulo de propostas ainda precisa da migration do banco para salvar rascunhos.",
      },
      { status: 503 },
    );
  }
}
