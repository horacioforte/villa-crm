import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  buildPropostaHtmlSnapshot,
  getPropostaAccessWhere,
  propostaInclude,
} from "@/lib/propostas/service";
import { propostaPatchSchema } from "@/lib/validations/proposta";

type PropostaRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: PropostaRouteContext) {
  const authResult = await requirePermission("propostas", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const proposta = await prisma.propostaComercial.findFirst({
    where: getPropostaAccessWhere(id, authResult),
    include: propostaInclude,
  });

  if (!proposta) {
    return NextResponse.json(
      { message: "Proposta comercial nao encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(proposta);
}

export async function PATCH(request: Request, context: PropostaRouteContext) {
  const authResult = await requirePermission("propostas", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = propostaPatchSchema.parse(await request.json());
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

    if (before.status !== "RASCUNHO") {
      return NextResponse.json(
        { message: "Somente propostas em rascunho podem ser editadas." },
        { status: 400 },
      );
    }

    const snapshotInput = {
      numeroProposta: before.numeroProposta,
      versao: before.versao,
      templateUtilizado: data.templateUtilizado ?? before.templateUtilizado,
      valorTotal: data.valorTotal ?? before.valorTotal,
      validadeProposta: data.validadeProposta ?? before.validadeProposta,
      prazoExecucao:
        data.prazoExecucao === undefined
          ? before.prazoExecucao
          : data.prazoExecucao,
      observacoesComerciais:
        data.observacoesComerciais === undefined
          ? before.observacoesComerciais
          : data.observacoesComerciais,
      observacoesTecnicas:
        data.observacoesTecnicas === undefined
          ? before.observacoesTecnicas
          : data.observacoesTecnicas,
      condicoesPagamento:
        data.condicoesPagamento === undefined
          ? before.condicoesPagamento
          : data.condicoesPagamento,
      createdAt: before.createdAt,
    };

    const htmlSnapshot = buildPropostaHtmlSnapshot(
      snapshotInput,
      before.oportunidade,
    );

    const proposta = await prisma.propostaComercial.update({
      where: {
        id: before.id,
      },
      data: {
        ...data,
        htmlSnapshot,
        updatedById: authResult.id,
      },
      include: propostaInclude,
    });

    await auditLog({
      action: "PROPOSTA_COMERCIAL_UPDATED",
      entity: "PropostaComercial",
      entityId: proposta.id,
      before,
      after: proposta,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(proposta);
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
      { message: "Nao foi possivel editar a proposta comercial." },
      { status: 500 },
    );
  }
}
