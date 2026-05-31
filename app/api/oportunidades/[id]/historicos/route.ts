import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const historicoCreateSchema = z.object({
  tipo: z.enum(["TELEFONE", "WHATSAPP", "EMAIL", "REUNIAO", "VISITA", "OUTRO"]),
  resumo: z.string().trim().min(1, "Informe um resumo do contato."),
  detalhes: z.string().trim().optional().nullable(),
  proximoContato: z.string().datetime({ offset: true }).optional().nullable(),
});

export async function GET(request: Request, context: RouteContext) {
  const authResult = await requirePermission("oportunidades", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;

  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id, ativa: true },
    select: { id: true },
  });

  if (!oportunidade) {
    return NextResponse.json({ message: "Oportunidade não encontrada." }, { status: 404 });
  }

  const historicos = await prisma.historicoContato.findMany({
    where: { oportunidadeId: id },
    orderBy: { dataContato: "desc" },
    include: {
      usuario: { select: { nome: true } },
    },
  });

  return NextResponse.json(historicos);
}

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requirePermission("oportunidades", "update", request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;

  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id, ativa: true },
    select: { id: true },
  });

  if (!oportunidade) {
    return NextResponse.json({ message: "Oportunidade não encontrada." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = historicoCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { tipo, resumo, detalhes, proximoContato } = parsed.data;

  const historico = await prisma.historicoContato.create({
    data: {
      tipo,
      resumo,
      detalhes: detalhes ?? null,
      proximoContato: proximoContato ? new Date(proximoContato) : null,
      oportunidadeId: id,
      usuarioId: authResult.id,
      createdById: authResult.id,
    },
    include: {
      usuario: { select: { nome: true } },
    },
  });

  await auditLog({
    action: "HISTORICO_CREATED",
    entity: "HistoricoContato",
    entityId: historico.id,
    after: historico,
    userId: authResult.id,
    request,
  });

  return NextResponse.json(historico, { status: 201 });
}
