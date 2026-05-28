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

  return NextResponse.json({
    ...proposta,
    currentUser: {
      papel: authResult.papel,
    },
  });
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

    const proposta = await prisma.$transaction(async (tx) => {
      let nextStatus = before.status;
      const currentBlocos = [...before.blocos];

      for (const blocoPatch of data.blocos ?? []) {
        const bloco = currentBlocos.find((item) => item.id === blocoPatch.id);

        if (!bloco) {
          throw new Error("BLOCO_NAO_ENCONTRADO");
        }

        if (bloco.conteudoAtual === blocoPatch.conteudoAtual) {
          continue;
        }

        if (bloco.tipo === "BLOQUEADO") {
          throw new Error("BLOCO_BLOQUEADO");
        }

        if (bloco.tipo === "EDITAVEL_COM_APROVACAO") {
          if (!blocoPatch.justificativa) {
            throw new Error("JUSTIFICATIVA_OBRIGATORIA");
          }

          const excecao = await tx.propostaExcecaoAprovacao.create({
            data: {
              propostaId: before.id,
              blocoId: bloco.id,
              campo: `bloco.${bloco.chave}`,
              valorAnterior: bloco.conteudoAtual,
              valorProposto: blocoPatch.conteudoAtual,
              justificativa: blocoPatch.justificativa,
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
              valorNovo: blocoPatch.conteudoAtual,
              justificativa: blocoPatch.justificativa,
              statusAnterior: before.status,
              statusNovo: "AGUARDANDO_APROVACAO",
              versao: before.versao,
            },
          });
          nextStatus = "AGUARDANDO_APROVACAO";
          continue;
        }

        const valorAnterior = bloco.conteudoAtual;
        await tx.propostaBloco.update({
          where: {
            id: bloco.id,
          },
          data: {
            conteudoAtual: blocoPatch.conteudoAtual,
            editado: true,
          },
        });

        bloco.conteudoAtual = blocoPatch.conteudoAtual;
        bloco.editado = true;

        await tx.propostaAuditoriaCampo.create({
          data: {
            propostaId: before.id,
            blocoId: bloco.id,
            usuarioId: authResult.id,
            campo: `bloco.${bloco.chave}`,
            valorAnterior,
            valorNovo: blocoPatch.conteudoAtual,
            justificativa: blocoPatch.justificativa ?? data.justificativa,
            statusAnterior: before.status,
            statusNovo: nextStatus,
            versao: before.versao,
          },
        });
      }

      const topLevelData = {
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
      };

      const htmlSnapshot = buildPropostaHtmlSnapshot(
        {
          numeroProposta: before.numeroProposta,
          versao: before.versao,
          ...topLevelData,
          createdAt: before.createdAt,
          blocos: currentBlocos,
        },
        before.oportunidade,
      );

      await tx.propostaComercial.update({
        where: {
          id: before.id,
        },
        data: {
          ...topLevelData,
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

    if (error instanceof Error) {
      const messages: Record<string, string> = {
        BLOCO_NAO_ENCONTRADO: "Bloco da proposta nao encontrado.",
        BLOCO_BLOQUEADO: "Este bloco e bloqueado e nao pode ser editado.",
        JUSTIFICATIVA_OBRIGATORIA:
          "Informe uma justificativa para solicitar excecao.",
      };
      const message = messages[error.message];

      if (message) {
        return NextResponse.json({ message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { message: "Nao foi possivel editar a proposta comercial." },
      { status: 500 },
    );
  }
}
