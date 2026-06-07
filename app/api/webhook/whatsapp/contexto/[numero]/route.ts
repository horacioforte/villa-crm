import { NextResponse } from "next/server";

import { CanalOrigem, StatusOportunidade, TipoContato } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ numero: string }>;
};

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
}

function isAuthorized(request: Request) {
  const validTokens = [process.env.CRON_SECRET, process.env.AGENT_API_KEY].filter(Boolean);

  if (validTokens.length === 0) {
    console.error("[WEBHOOK_WHATSAPP_CONTEXTO] Nenhum token de reset configurado.");
    return false;
  }

  return validTokens.includes(getBearerToken(request));
}

function normalizeNumero(numero: string) {
  return decodeURIComponent(numero).replace(/\D/g, "");
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Nao autorizado." }, { status: 401 });
  }

  const { numero } = await context.params;
  const telefone = normalizeNumero(numero);

  if (telefone.length < 8) {
    return NextResponse.json(
      { ok: false, message: "Numero de WhatsApp invalido." },
      { status: 400 },
    );
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const pessoas = await tx.pessoa.findMany({
        where: {
          OR: [
            { whatsapp: telefone },
            { telefone },
            { whatsapp: { contains: telefone } },
            { telefone: { contains: telefone } },
          ],
        },
        select: {
          id: true,
          empresaId: true,
        },
      });

      const pessoaIds = pessoas.map((pessoa) => pessoa.id);
      const empresaIds = [...new Set(pessoas.map((pessoa) => pessoa.empresaId))];

      if (pessoaIds.length === 0) {
        return {
          pessoasEncontradas: 0,
          historicosRemovidos: 0,
          oportunidadesResetadas: 0,
          tarefasCanceladas: 0,
        };
      }

      const oportunidades = await tx.oportunidade.findMany({
        where: {
          ativa: true,
          canalOrigem: CanalOrigem.OUTROS,
          status: {
            notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
          },
          OR: [
            { pessoaId: { in: pessoaIds } },
            { empresaId: { in: empresaIds } },
          ],
          AND: [
            {
              OR: [
                { titulo: { startsWith: "WhatsApp" } },
                { descricao: { contains: "Lead recebido via WhatsApp" } },
              ],
            },
          ],
        },
        select: {
          id: true,
        },
      });
      const oportunidadeIds = oportunidades.map((oportunidade) => oportunidade.id);

      const tarefasCanceladas = oportunidadeIds.length
        ? await tx.tarefa.updateMany({
            where: {
              oportunidadeId: { in: oportunidadeIds },
              status: {
                in: ["PENDENTE", "EM_ANDAMENTO"],
              },
            },
            data: {
              status: "CANCELADA",
              observacoes: "Cancelada por reset de contexto WhatsApp.",
            },
          })
        : { count: 0 };

      const oportunidadesResetadas = oportunidadeIds.length
        ? await tx.oportunidade.updateMany({
            where: {
              id: { in: oportunidadeIds },
            },
            data: {
              ativa: false,
              temperaturaMotivo: "Reset de contexto WhatsApp para novo teste.",
            },
          })
        : { count: 0 };

      const historicosRemovidos = await tx.historicoContato.deleteMany({
        where: {
          tipo: TipoContato.WHATSAPP,
          OR: [
            { pessoaId: { in: pessoaIds } },
            { empresaId: { in: empresaIds } },
            { detalhes: { contains: telefone } },
            { resumo: { contains: telefone } },
          ],
        },
      });

      return {
        pessoasEncontradas: pessoaIds.length,
        historicosRemovidos: historicosRemovidos.count,
        oportunidadesResetadas: oportunidadesResetadas.count,
        tarefasCanceladas: tarefasCanceladas.count,
      };
    });

    return NextResponse.json({
      ok: true,
      numero: telefone,
      ...resultado,
    });
  } catch (error) {
    console.error("[WEBHOOK_WHATSAPP_CONTEXTO] Erro ao resetar contexto:", error);
    return NextResponse.json(
      { ok: false, message: "Erro interno ao resetar contexto." },
      { status: 500 },
    );
  }
}
