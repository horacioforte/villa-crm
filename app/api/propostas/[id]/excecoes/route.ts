import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getPropostaAccessWhere, propostaInclude } from "@/lib/propostas/service";
import { propostaExcecaoCreateSchema } from "@/lib/validations/proposta";

type PropostaExcecoesRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: PropostaExcecoesRouteContext,
) {
  const authResult = await requirePermission("propostas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;
  const proposta = await prisma.propostaComercial.findFirst({
    where: getPropostaAccessWhere(id, authResult),
    select: {
      id: true,
    },
  });

  if (!proposta) {
    return NextResponse.json(
      { message: "Proposta comercial nao encontrada." },
      { status: 404 },
    );
  }

  const excecoes = await prisma.propostaExcecaoAprovacao.findMany({
    where: {
      propostaId: proposta.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      bloco: true,
      solicitante: true,
      aprovador: true,
    },
  });

  return NextResponse.json(excecoes);
}

export async function POST(
  request: Request,
  context: PropostaExcecoesRouteContext,
) {
  const authResult = await requirePermission("propostas", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = propostaExcecaoCreateSchema.parse(await request.json());
    const before = await prisma.propostaComercial.findFirst({
      where: getPropostaAccessWhere(id, authResult),
      include: propostaInclude,
    });

    if (!before) {
      return NextResponse.json(
        { message: "Proposta comercial nao encontrada." },
        { status: 404 },
      );
    }

    const bloco = before.blocos.find((item) => item.id === data.blocoId);

    if (!bloco) {
      return NextResponse.json(
        { message: "Bloco da proposta nao encontrado." },
        { status: 404 },
      );
    }

    if (bloco.tipo !== "EDITAVEL_COM_APROVACAO") {
      return NextResponse.json(
        { message: "Somente blocos sensiveis podem gerar excecao." },
        { status: 400 },
      );
    }

    const proposta = await prisma.$transaction(async (tx) => {
      const excecao = await tx.propostaExcecaoAprovacao.create({
        data: {
          propostaId: before.id,
          blocoId: bloco.id,
          campo: `bloco.${bloco.chave}`,
          valorAnterior: bloco.conteudoAtual,
          valorProposto: data.conteudoProposto,
          justificativa: data.justificativa,
          solicitanteId: authResult.id,
        },
      });

      await tx.propostaAuditoriaCampo.create({
        data: {
          propostaId: before.id,
          blocoId: bloco.id,
          excecaoId: excecao.id,
          usuarioId: authResult.id,
          campo: `bloco.${bloco.chave}`,
          valorAnterior: bloco.conteudoAtual,
          valorNovo: data.conteudoProposto,
          justificativa: data.justificativa,
          statusAnterior: before.status,
          statusNovo: "AGUARDANDO_APROVACAO",
          versao: before.versao,
        },
      });

      await tx.propostaComercial.update({
        where: {
          id: before.id,
        },
        data: {
          status: "AGUARDANDO_APROVACAO",
          updatedById: authResult.id,
        },
      });

      return tx.propostaComercial.findUniqueOrThrow({
        where: {
          id: before.id,
        },
        include: propostaInclude,
      });
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
      { message: "Nao foi possivel solicitar a excecao." },
      { status: 500 },
    );
  }
}
