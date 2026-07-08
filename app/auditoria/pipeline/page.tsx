import { redirect } from "next/navigation";

import { AuditoriaPipelineClient } from "@/components/auditoria/AuditoriaPipelineClient";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const ACOES_PIPELINE = [
  "OPORTUNIDADE_STATUS_CHANGED",
  "OPORTUNIDADE_RESPONSAVEL_ALTERADO",
];

export default async function AuditoriaPipelinePage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.papel !== "ADMIN" && currentUser.papel !== "GERENTE") {
    redirect("/");
  }

  const registros = await prisma.auditLog.findMany({
    where: {
      entity: "Oportunidade",
      action: { in: ACOES_PIPELINE },
    },
    include: {
      user: {
        select: { id: true, nome: true, email: true, papel: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const historico = registros.map((r) => {
    const before = r.before as {
      status?: string;
      responsavel?: { nome?: string } | null;
    } | null;
    const after = r.after as {
      titulo?: string;
      status?: string;
      motivoPerda?: string | null;
      responsavel?: { nome?: string } | null;
    } | null;
    const meta = r.metadata as { origem?: string } | null;

    return {
      id: r.id,
      data: r.createdAt.toISOString(),
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

  return <AuditoriaPipelineClient registrosIniciais={historico} />;
}
