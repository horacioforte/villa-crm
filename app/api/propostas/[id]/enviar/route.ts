import { NextResponse } from "next/server";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getPropostaAccessWhere, propostaInclude } from "@/lib/propostas/service";

type PropostaEnviarRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: Request,
  context: PropostaEnviarRouteContext,
) {
  const authResult = await requirePermission("propostas", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
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
        { message: "Somente propostas em rascunho podem ser enviadas." },
        { status: 400 },
      );
    }

    const proposta = await prisma.$transaction(async (tx) => {
      const updated = await tx.propostaComercial.update({
        where: {
          id: before.id,
        },
        data: {
          status: "ENVIADA",
          updatedById: authResult.id,
        },
        include: propostaInclude,
      });

      await tx.oportunidade.update({
        where: {
          id: before.oportunidadeId,
        },
        data: {
          status: "PROPOSTA_ENVIADA",
          updatedById: authResult.id,
        },
      });

      await tx.historicoContato.create({
        data: {
          tipo: "EMAIL",
          resumo: "Proposta comercial enviada",
          detalhes: `Proposta ${before.numeroProposta} versao ${before.versao} enviada ao cliente.`,
          oportunidadeId: before.oportunidadeId,
          empresaId: before.oportunidade.empresa.id,
          pessoaId: before.oportunidade.pessoa?.id,
          usuarioId: authResult.id,
          createdById: authResult.id,
          updatedById: authResult.id,
        },
      });

      return updated;
    });

    await auditLog({
      action: "PROPOSTA_COMERCIAL_SENT",
      entity: "PropostaComercial",
      entityId: proposta.id,
      before,
      after: proposta,
      metadata: {
        oportunidadeId: proposta.oportunidadeId,
      },
      userId: authResult.id,
      request,
    });

    return NextResponse.json(proposta);
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel enviar a proposta comercial." },
      { status: 500 },
    );
  }
}
