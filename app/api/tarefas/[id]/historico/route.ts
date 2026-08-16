// ARQUIVO: app/api/tarefas/[id]/historico/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Retorna a timeline de eventos de uma tarefa, montada a partir do AuditLog
// e dos campos da própria tarefa (criação, conclusão).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { getTarefaByIdWhere } from "@/lib/tarefas/service";

type TarefaHistoricoRouteContext = {
  params: Promise<{ id: string }>;
};

// Traduz o código de action do audit log em descrição legível
function traduzirAcao(action: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  switch (action) {
    case "TAREFA_CREATED":
      return "Tarefa criada";
    case "TAREFA_STATUS_CHANGED": {
      const statusLabels: Record<string, string> = {
        PENDENTE: "Pendente",
        EM_ANDAMENTO: "Em andamento",
        CONCLUIDA: "Concluída",
        CANCELADA: "Cancelada",
      };
      const de = before?.status ? (statusLabels[before.status as string] ?? String(before.status)) : "?";
      const para = after?.status ? (statusLabels[after.status as string] ?? String(after.status)) : "?";
      if (after?.status === "CONCLUIDA") return `Tarefa concluída (era: ${de})`;
      return `Status alterado: ${de} → ${para}`;
    }
    case "TAREFA_UPDATED": {
      // Detecta campos que mudaram para descrever a edição
      const campos: string[] = [];
      if (before && after) {
        if (before.titulo !== after.titulo) campos.push("título");
        if (before.descricao !== after.descricao) campos.push("descrição");
        if (before.dataVencimento !== after.dataVencimento) campos.push("vencimento");
        if (before.prioridade !== after.prioridade) campos.push("prioridade");
        if (before.responsavelId !== after.responsavelId) campos.push("responsável");
        if (before.observacoes !== after.observacoes) campos.push("observações");
        if (before.tipo !== after.tipo) campos.push("tipo");
        if (before.oportunidadeId !== after.oportunidadeId) campos.push("oportunidade vinculada");
        if (before.empresaId !== after.empresaId) campos.push("empresa vinculada");
      }
      return campos.length > 0
        ? `Editada — ${campos.join(", ")}`
        : "Tarefa editada";
    }
    case "TAREFA_DELETED":
      return "Tarefa excluída";
    default:
      return action.replace(/_/g, " ").toLowerCase();
  }
}

function iconeEvento(action: string): string {
  switch (action) {
    case "TAREFA_CREATED": return "🟢";
    case "TAREFA_STATUS_CHANGED": return "🔄";
    case "TAREFA_UPDATED": return "✏️";
    case "TAREFA_DELETED": return "🗑️";
    default: return "•";
  }
}

export async function GET(request: Request, context: TarefaHistoricoRouteContext) {
  const authResult = await requirePermission("tarefas", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;

  // Garante que o usuário tem acesso a esta tarefa
  const tarefa = await prisma.tarefa.findFirst({
    where: getTarefaByIdWhere(id, authResult),
    select: {
      id: true,
      titulo: true,
      createdAt: true,
      concluidaEm: true,
      createdBy: { select: { id: true, nome: true } },
      updatedBy: { select: { id: true, nome: true } },
    },
  });

  if (!tarefa) {
    return NextResponse.json({ message: "Tarefa não encontrada." }, { status: 404 });
  }

  // Busca o audit log desta tarefa
  const logs = await prisma.auditLog.findMany({
    where: { entity: "Tarefa", entityId: id },
    include: { user: { select: { id: true, nome: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Monta a timeline de eventos
  const eventos = logs.map((log) => {
    const before = (log.before as Record<string, unknown> | null) ?? null;
    const after = (log.after as Record<string, unknown> | null) ?? null;
    return {
      id: log.id,
      icone: iconeEvento(log.action),
      descricao: traduzirAcao(log.action, before, after),
      usuario: log.user?.nome ?? null,
      data: log.createdAt.toISOString(),
      action: log.action,
    };
  });

  // Se não houver log de criação no audit (tarefas antigas), sintetiza a partir da tarefa
  const temCriacao = eventos.some((e) => e.action === "TAREFA_CREATED");
  if (!temCriacao) {
    eventos.unshift({
      id: `synth-created-${tarefa.id}`,
      icone: "🟢",
      descricao: "Tarefa criada",
      usuario: tarefa.createdBy?.nome ?? null,
      data: tarefa.createdAt.toISOString(),
      action: "TAREFA_CREATED",
    });
  }

  return NextResponse.json(eventos);
}
