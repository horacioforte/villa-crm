import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  buildNumeroProposta,
  buildPropostaHtmlSnapshot,
  getOportunidadeAccessWhere,
  propostaInclude,
} from "@/lib/propostas/service";
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
    const htmlSnapshot = buildPropostaHtmlSnapshot(
      {
        ...data,
        numeroProposta,
        versao,
      },
      oportunidade,
    );

    const proposta = await prisma.propostaComercial.create({
      data: {
        ...data,
        numeroProposta,
        versao,
        htmlSnapshot,
        oportunidadeId: oportunidade.id,
        createdById: authResult.id,
        updatedById: authResult.id,
      },
      include: propostaInclude,
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
      { message: "Nao foi possivel criar a proposta comercial." },
      { status: 500 },
    );
  }
}
