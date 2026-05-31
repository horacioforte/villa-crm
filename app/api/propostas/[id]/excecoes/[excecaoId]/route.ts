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
import { criarTarefaAutomatica } from "@/lib/tarefas/automaticas";
import { propostaExcecaoDecisaoSchema } from "@/lib/validations/proposta";

type PropostaExcecaoRouteContext = {
  params: Promise<{
    id: string;
    excecaoId: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: PropostaExcecaoRouteContext,
) {
  const authResult = await requirePermission("propostas", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!["ADMIN", "GERENTE"].includes(authResult.papel)) {
    return NextResponse.json(
      { message: "Somente ADMIN ou GERENTE podem aprovar excecoes." },
      { status: 403 },
    );
  }

  const { id, excecaoId } = await context.params;

  try {
    const data = propostaExcecaoDecisaoSchema.parse(await request.json());
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

    const excecao = before.excecoes.find((item) => item.id === excecaoId);

    if (!excecao) {
      return NextResponse.json(
        { message: "Excecao nao encontrada." },
        { status: 404 },
      );
    }

    if (excecao.status !== "PENDENTE") {
      return NextResponse.json(
        { message: "Esta excecao ja foi decidida." },
        { status: 400 },
      );
    }

    const proposta = await prisma.$transaction(async (tx) => {
      const aprovado = data.decisao === "APROVAR";

      await tx.propostaExcecaoAprovacao.update({
        where: {
          id: excecao.id,
        },
        data: {
          status: aprovado ? "APROVADA" : "REJEITADA",
          decisaoMotivo: data.motivo,
          aprovadorId: authResult.id,
          decididoEm: new Date(),
        },
      });

      const bloco = excecao.bloco;
      let blocos = [...before.blocos];

      if (aprovado && bloco) {
        const novoConteudo = String(excecao.valorProposto ?? "");
        await tx.propostaBloco.update({
          where: {
            id: bloco.id,
          },
          data: {
            conteudoAtual: novoConteudo,
            editado: true,
          },
        });
        blocos = blocos.map((item) =>
          item.id === bloco.id
            ? { ...item, conteudoAtual: novoConteudo, editado: true }
            : item,
        );
      }

      const pendentesRestantes = await tx.propostaExcecaoAprovacao.count({
        where: {
          propostaId: before.id,
          status: "PENDENTE",
          id: {
            not: excecao.id,
          },
        },
      });
      const nextStatus = pendentesRestantes > 0 ? before.status : "APROVADA";

      const htmlSnapshot = buildPropostaHtmlSnapshot(
        {
          numeroProposta: before.numeroProposta,
          versao: before.versao,
          templateUtilizado: before.templateUtilizado,
          valorTotal: before.valorTotal,
          validadeProposta: before.validadeProposta,
          prazoExecucao: before.prazoExecucao,
          observacoesComerciais: before.observacoesComerciais,
          observacoesTecnicas: before.observacoesTecnicas,
          condicoesPagamento: before.condicoesPagamento,
          horaExtra: before.horaExtra,
          createdAt: before.createdAt,
          blocos,
        },
        before.oportunidade,
      );

      await tx.propostaAuditoriaCampo.create({
        data: {
          propostaId: before.id,
          blocoId: bloco?.id,
          excecaoId: excecao.id,
          usuarioId: authResult.id,
          campo: excecao.campo,
          valorAnterior: excecao.valorAnterior ?? undefined,
          valorNovo: aprovado
            ? (excecao.valorProposto ?? undefined)
            : (excecao.valorAnterior ?? undefined),
          justificativa: data.motivo ?? excecao.justificativa,
          statusAnterior: before.status,
          statusNovo: nextStatus,
          versao: before.versao,
        },
      });

      await tx.propostaComercial.update({
        where: {
          id: before.id,
        },
        data: {
          status: nextStatus,
          htmlSnapshot,
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

    await auditLog({
      action:
        data.decisao === "APROVAR"
          ? "PROPOSTA_EXCECAO_APPROVED"
          : "PROPOSTA_EXCECAO_REJECTED",
      entity: "PropostaExcecaoAprovacao",
      entityId: excecao.id,
      before: excecao,
      after: proposta.excecoes.find((item) => item.id === excecao.id),
      userId: authResult.id,
      request,
    });

    if (before.status !== proposta.status && proposta.status === "APROVADA") {
      await criarTarefaAutomatica(
        "PROPOSTA_APROVADA",
        proposta.oportunidadeId,
        proposta.oportunidade.responsavelId,
        authResult.id,
      );
    }

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
      { message: "Nao foi possivel decidir a excecao." },
      { status: 500 },
    );
  }
}
