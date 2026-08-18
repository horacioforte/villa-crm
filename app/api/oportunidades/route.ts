import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { oportunidadeSchema } from "@/lib/validations/oportunidade";

export async function GET(request: Request) {
  const authResult = await requirePermission("oportunidades", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      ativa: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      empresa: true,
      pessoa: true,
      obra: true,
      responsavel: true,
      equipamento: true,
      propostas: {
        where: {
          status: {
            in: ["ENVIADA", "APROVADA", "ACEITA"],
          },
        },
        // GOVERNANÇA (17/08/2026): prioriza a versão vigente (ativa=true); só cai
        // para a versão mais recente quando nenhuma estiver marcada como vigente.
        orderBy: [{ ativa: "desc" }, { versao: "desc" }],
        take: 1,
        select: {
          valorTotal: true,
          status: true,
        },
      },
      tarefas: {
        select: {
          status: true,
        },
      },
    },
  });

  return NextResponse.json(oportunidades);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("oportunidades", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // confirmacaoPotencialExcepcional é um campo Zod de validação UI — não existe
    // no banco, por isso é extraído antes de criar o registro (evita erro Prisma).
    const { confirmacaoPotencialExcepcional: _skip, ...dbData } =
      oportunidadeSchema.parse(await request.json());

    const oportunidade = await prisma.oportunidade.create({
      data: {
        ...dbData,
        responsavelId: dbData.responsavelId ?? authResult.id,
        createdById: authResult.id,
        updatedById: authResult.id,
      },
      include: {
        empresa: true,
        pessoa: true,
        obra: true,
        responsavel: true,
        equipamento: true,
        propostas: {
          where: {
            status: {
              in: ["ENVIADA", "APROVADA", "ACEITA"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            valorTotal: true,
            status: true,
          },
        },
        tarefas: {
          select: {
            status: true,
          },
        },
      },
    });

    await auditLog({
      action: "OPORTUNIDADE_CREATED",
      entity: "Oportunidade",
      entityId: oportunidade.id,
      after: oportunidade,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(oportunidade, { status: 201 });
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
      { message: "Nao foi possivel criar a oportunidade." },
      { status: 500 },
    );
  }
}
