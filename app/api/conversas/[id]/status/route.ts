// ARQUIVO: app/api/conversas/[id]/status/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ciclo de Atendimento — mudança MANUAL de Conversa.status (ABERTA/PENDENTE/
// CONCLUIDA/SPAM). "Aguardando resposta" nunca passa por aqui — é sempre calculado
// (ver lib/conversas/aguardando-resposta.ts), nunca setado manualmente.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { auditLog } from "@/lib/audit";

const STATUS_VALIDOS = ["ABERTA", "PENDENTE", "CONCLUIDA", "SPAM"] as const;
type StatusConversa = (typeof STATUS_VALIDOS)[number];

function isStatusValido(valor: unknown): valor is StatusConversa {
  return typeof valor === "string" && (STATUS_VALIDOS as readonly string[]).includes(valor);
}

export async function PATCH(req: NextRequest, context: any) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: unknown };

  if (!isStatusValido(status)) {
    return NextResponse.json(
      { error: `status deve ser um de: ${STATUS_VALIDOS.join(", ")}.` },
      { status: 400 },
    );
  }

  const conversa = await prisma.conversa.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const atualizada = await prisma.conversa.update({
    where: { id },
    data: { status },
    include: {
      atendidoPor: { select: { nome: true } },
      canalWhatsapp: { select: { nome: true, displayPhoneNumber: true } },
    },
  });

  await auditLog({
    action: "CONVERSA_STATUS_ALTERADO_MANUALMENTE",
    entity: "Conversa",
    entityId: id,
    before: { status: conversa.status },
    after: { status },
    userId: user.id,
    request: req,
  });

  return NextResponse.json(atualizada);
}
