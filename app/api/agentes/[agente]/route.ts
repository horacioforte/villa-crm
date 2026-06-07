import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { gerarPromptCompleto } from "@/lib/agentes";
import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { agenteUpdateSchema } from "@/lib/validations/agente";

type AgenteRouteContext = {
  params: Promise<{
    agente: string;
  }>;
};

function normalizeAgente(value: string) {
  const agente = value.toUpperCase();
  return agente === "MARIA" || agente === "JOAO" ? agente : null;
}

export async function GET(request: Request, context: AgenteRouteContext) {
  const authResult = await requirePermission("agentes", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { agente: agenteParam } = await context.params;
  const agente = normalizeAgente(agenteParam);

  if (!agente) {
    return NextResponse.json({ message: "Agente invalido." }, { status: 400 });
  }

  const config = await prisma.agenteConfig.findUnique({
    where: {
      agente,
    },
  });

  if (!config) {
    return NextResponse.json(
      { message: "Configuracao do agente nao encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(config);
}

export async function PUT(request: Request, context: AgenteRouteContext) {
  const authResult = await requirePermission("agentes", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { agente: agenteParam } = await context.params;
  const agente = normalizeAgente(agenteParam);

  if (!agente) {
    return NextResponse.json({ message: "Agente invalido." }, { status: 400 });
  }

  try {
    const data = agenteUpdateSchema.parse(await request.json());
    const before = await prisma.agenteConfig.findUnique({
      where: {
        agente,
      },
    });

    if (!before) {
      return NextResponse.json(
        { message: "Configuracao do agente nao encontrada." },
        { status: 404 },
      );
    }

    const promptCompleto = gerarPromptCompleto({
      nome: before.nome,
      descricao: data.descricao,
      personalidade: data.personalidade,
      regrasQuente: data.regrasQuente,
      regrasMedia: data.regrasMedia,
      regrasFria: data.regrasFria,
      ignorar: data.ignorar,
      exemplosLead: data.exemplosLead,
      exemplosNaoLead: data.exemplosNaoLead,
      historicoErros: data.historicoErros,
    });

    const config = await prisma.agenteConfig.update({
      where: {
        agente,
      },
      data: {
        ...data,
        promptCompleto,
        atualizadoPor: authResult.email ?? authResult.nome ?? authResult.id,
      },
    });

    await auditLog({
      action: "AGENTE_CONFIG_UPDATED",
      entity: "AgenteConfig",
      entityId: config.id,
      before,
      after: config,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(config);
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

    console.error("[AGENTES] Falha ao atualizar configuracao:", error);
    return NextResponse.json(
      { message: "Nao foi possivel atualizar a configuracao do agente." },
      { status: 500 },
    );
  }
}
