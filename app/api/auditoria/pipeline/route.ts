import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const ACOES_PIPELINE = [
  "OPORTUNIDADE_STATUS_CHANGED",
  "OPORTUNIDADE_RESPONSAVEL_ALTERADO",
  // (21/09/2026) Incluídos para rastrear updates silenciosos (ex.: marcar estratégica,
  // atualizar temperatura) que antes podiam resetar status sem aparecer aqui.
  "OPORTUNIDADE_UPDATED",
  "OPORTUNIDADE_DEACTIVATED",
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

  // Filtro por data: ?de=YYYY-MM-DD&ate=YYYY-MM-DD
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");

  const filtrados = registros.filter((r) => {
    if (origem) {
      const meta = r.metadata as { origem?: string } | null;
      if ((meta?.origem ?? "MANUAL") !== origem) return false;
    }
    if (de && r.createdAt < new Date(de + "T00:00:00.000Z")) return false;
    if (ate && r.createdAt > new Date(ate + "T23:59:59.999Z")) return false;
    return true;
  });

  const historico = filtrados.map((r) => {
    const before = r.before as {
      status?: string;
      estrategica?: boolean;
      temperatura?: string;
      responsavel?: { nome?: string } | null;
      ativa?: boolean;
    } | null;
    const after = r.after as {
      titulo?: string;
      status?: string;
      estrategica?: boolean;
      temperatura?: string;
      motivoPerda?: string | null;
      responsavel?: { nome?: string } | null;
      ativa?: boolean;
    } | null;
    const meta = r.metadata as { origem?: string } | null;

    // Detecta campos que mudaram neste update (útil para OPORTUNIDADE_UPDATED)
    const camposMudados: string[] = [];
    if (r.action === "OPORTUNIDADE_UPDATED") {
      if (before?.status !== after?.status) camposMudados.push("status");
      if (before?.estrategica !== after?.estrategica) camposMudados.push("estrategica");
      if (before?.temperatura !== after?.temperatura) camposMudados.push("temperatura");
      if (before?.ativa !== after?.ativa) camposMudados.push("ativa");
    }

    return {
      id: r.id,
      data: r.createdAt,
      acao: r.action,
      origem: meta?.origem ?? "MANUAL",
      oportunidadeId: r.entityId,
      oportunidadeTitulo: after?.titulo ?? null,
      statusAnterior: before?.status ?? null,
      statusNovo: after?.status ?? null,
      estrategicaAntes: before?.estrategica ?? null,
      estrategicaDepois: after?.estrategica ?? null,
      temperaturaAntes: before?.temperatura ?? null,
      temperaturaDepois: after?.temperatura ?? null,
      motivoPerda: after?.motivoPerda ?? null,
      responsavelAnterior: before?.responsavel?.nome ?? null,
      responsavelNovo: after?.responsavel?.nome ?? null,
      camposMudados: camposMudados.length ? camposMudados : null,
      realizadoPor: r.user?.nome ?? "Sistema",
      realizadoPorEmail: r.user?.email ?? null,
      realizadoPorPapel: r.user?.papel ?? null,
    };
  });

  return NextResponse.json(historico);
}
