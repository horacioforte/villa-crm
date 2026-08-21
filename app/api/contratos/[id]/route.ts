import { NextResponse } from "next/server";

import { Prisma } from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const analiseDetalheSelect = {
  id: true,
  nomeArquivo: true,
  tipoContrato: true,
  tipoDetectado: true,
  partes: true,
  prazo: true,
  valor: true,
  reajuste: true,
  riscoGeral: true,
  resumo: true,
  resultado: true,
  textoAnalisado: true,
  createdAt: true,
  empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
  oportunidade: { select: { id: true, titulo: true } },
  createdBy: { select: { id: true, nome: true } },
} satisfies Prisma.AnaliseContratoSelect;

export async function GET(request: Request, context: RouteContext) {
  const authResult = await requirePermission("contratos", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;

  const analise = await prisma.analiseContrato.findUnique({
    where: { id },
    select: analiseDetalheSelect,
  });

  if (!analise) {
    return NextResponse.json({ message: "Análise não encontrada." }, { status: 404 });
  }

  return NextResponse.json(analise);
}

export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await requirePermission("contratos", "delete", request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;

  const existing = await prisma.analiseContrato.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ message: "Análise não encontrada." }, { status: 404 });
  }

  await prisma.analiseContrato.delete({ where: { id } });

  await auditLog({
    action: "ANALISE_CONTRATO_DELETED",
    entity: "AnaliseContrato",
    entityId: id,
    before: existing,
    userId: authResult.id,
    request,
  });

  return NextResponse.json({ ok: true });
}
