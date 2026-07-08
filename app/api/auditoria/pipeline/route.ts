import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const ACOES_PIPELINE = [
  "OPORTUNIDADE_STATUS_CHANGED",
  "OPORTUNIDADE_RESPONSAVEL_ALTERADO",
];

export async function GET(request: Request) {
  const authResult = await requirePermission("auditoria", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const oportunidadeId = searchParams.get("oportunidadeId");
  const origem = searchParams.get("origem");
  const limite = Math.min(Number(searchParams.get("limite")) || 100, 500);

  const registros = await prisma.auditLog.findMany({
    where: {
      entity: "Oportunidade",
      action: { in: ACOES_PIPELINE },
      ...(oportunidadeId ? { entityId: oportunidadeId } : {}),
    },
    include: {
      user: {
        select: { id: true, nome: true, email: true, papel: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limite,
  });

  const filtrados = origem
    ? registros.filter((r) => {
        const meta = r.metadata as { origem?: string } | null;
        return (meta?.origem ?? "MANUAL") === origem;
      })
    : registros;

  const historico = filtrados.map((r) => {
    const before = r.before as { status?: string; responsavel?: { nome?: string } | null } | null;
    const after = r.after as {
      titulo?: string;
      status?: string;
      motivoPerda?: string | null;
      responsavel?: { nome?: string } | null;
    } | null;
    const meta = r.metadata as { origem?: string } | null;

    return {
      id: r.id,
      data: r.createdAt,
      acao: r.action,
      origem: meta?.origem ?? "MANUAL",
      oportunidadeId: r.entityId,
      oportunidadeTitulo: after?.titulo ?? null,
      statusAnterior: before?.status ?? null,
      statusNovo: after?.status ?? null,
      motivoPerda: after?.motivoPerda ?? null,
      responsavelAnterior: before?.responsavel?.nome ?? null,
      responsavelNovo: after?.responsavel?.nome ?? null,
      realizadoPor: r.user?.nome ?? "Sistema",
      realizadoPorEmail: r.user?.email ?? null,
      realizadoPorPapel: r.user?.papel ?? null,
    };
  });

  return NextResponse.json(historico);
}
