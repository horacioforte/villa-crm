import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { renderPropostaPdfBuffer } from "@/lib/propostas/pdf";
import { getPropostaAccessWhere, propostaInclude } from "@/lib/propostas/service";

type PropostaPdfRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const runtime = "nodejs";

export async function GET(request: Request, context: PropostaPdfRouteContext) {
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

  if (proposta.excecoes.some((excecao) => excecao.status === "PENDENTE")) {
    return NextResponse.json(
      { message: "PDF final bloqueado ate decisao das excecoes pendentes." },
      { status: 400 },
    );
  }

  const buffer = await renderPropostaPdfBuffer({
    numeroProposta: proposta.numeroProposta,
    versao: proposta.versao,
    templateUtilizado: proposta.templateUtilizado,
    cliente:
      proposta.oportunidade.empresa.nomeFantasia ??
      proposta.oportunidade.empresa.razaoSocial,
    obra: proposta.oportunidade.obra?.nome ?? "Obra nao informada",
    cidade: proposta.oportunidade.obra?.cidade,
    estado: proposta.oportunidade.obra?.estado,
    valorTotal: proposta.valorTotal,
    horaExtra: proposta.horaExtra,
    validadeProposta: proposta.validadeProposta,
    prazoExecucao: proposta.prazoExecucao,
    responsavel: proposta.oportunidade.responsavel?.nome,
    observacoesComerciais: proposta.observacoesComerciais,
    observacoesTecnicas: proposta.observacoesTecnicas,
    condicoesPagamento: proposta.condicoesPagamento,
    blocos: proposta.blocos,
    data: proposta.createdAt,
  });

  const body = new Blob([new Uint8Array(buffer)], {
    type: "application/pdf",
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${proposta.numeroProposta}-v${proposta.versao}.pdf"`,
    },
  });
}
