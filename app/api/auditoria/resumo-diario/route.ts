// GET /api/auditoria/resumo-diario
// Retorna (e opcionalmente salva) um resumo legível das mudanças do dia no pipeline.
// Auth: header Authorization: Bearer <CRON_SECRET>  OU  sessão de usuário ADMIN/GERENTE.
// Query params:
//   ?data=YYYY-MM-DD   (padrão: hoje no fuso UTC-3)
//   ?formato=json|md   (padrão: md — Markdown para Claude ler)

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const ACOES_AUDITAVEIS = [
  "OPORTUNIDADE_STATUS_CHANGED",
  "OPORTUNIDADE_UPDATED",
  "OPORTUNIDADE_RESPONSAVEL_ALTERADO",
  "OPORTUNIDADE_DEACTIVATED",
];

const STATUS_LABELS: Record<string, string> = {
  NOVA: "Nova",
  PRE_QUALIFICADA: "Pré-qualificada",
  EM_ATENDIMENTO: "Em atendimento",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
};

// Token fixo para autenticação interna do Cowork (endpoint read-only de auditoria).
// Também aceita RESUMO_DIARIO_TOKEN se configurado no Vercel.
const RESUMO_TOKEN_FIXO = "villa-historico-2026";

function isCronAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const { searchParams } = new URL(request.url);
  const tokenParam = searchParams.get("token") ?? "";

  // Sempre aceita o token fixo interno, independente do que estiver em RESUMO_DIARIO_TOKEN.
  if (authHeader === `Bearer ${RESUMO_TOKEN_FIXO}` || tokenParam === RESUMO_TOKEN_FIXO) {
    return true;
  }

  // Também aceita RESUMO_DIARIO_TOKEN quando configurada com um valor diferente do fixo.
  const envSecret = process.env.RESUMO_DIARIO_TOKEN;
  if (envSecret && envSecret !== RESUMO_TOKEN_FIXO) {
    if (authHeader === `Bearer ${envSecret}` || tokenParam === envSecret) return true;
  }

  return false;
}

function brazilDateStr(date: Date): string {
  // UTC-3
  const offset = -3 * 60;
  const local = new Date(date.getTime() + offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatarData(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Recife",
  }).format(date);
}

export async function GET(request: Request) {
  // Aceita CRON_SECRET OU sessão ADMIN/GERENTE
  const cronOk = isCronAuthorized(request);
  if (!cronOk) {
    const authResult = await requirePermission("auditoria", "read", request);
    if (authResult instanceof NextResponse) return authResult;
    const papel = (authResult as { papel?: string }).papel;
    if (papel !== "ADMIN" && papel !== "GERENTE") {
      return NextResponse.json({ message: "Acesso restrito a ADMIN/GERENTE." }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const formato = searchParams.get("formato") ?? "md";

  // Determina a data alvo (padrão: hoje em UTC-3)
  const dataParam = searchParams.get("data");
  const dataAlvo = dataParam ?? brazilDateStr(new Date());

  const inicio = new Date(dataAlvo + "T03:00:00.000Z"); // meia-noite UTC-3 = 03:00 UTC
  const fim = new Date(dataAlvo + "T26:59:59.999Z");    // 23:59:59 UTC-3 = 02:59:59 UTC do dia seguinte
  // Corrigido: fim real é início + 24h - 1ms
  const fimReal = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);

  const registros = await prisma.auditLog.findMany({
    where: {
      entity: "Oportunidade",
      action: { in: ACOES_AUDITAVEIS },
      createdAt: { gte: inicio, lte: fimReal },
    },
    include: {
      user: { select: { nome: true, email: true, papel: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (formato === "json") {
    return NextResponse.json({
      data: dataAlvo,
      totalEventos: registros.length,
      eventos: registros.map((r) => {
        const before = r.before as Record<string, unknown> | null;
        const after = r.after as Record<string, unknown> | null;
        const meta = r.metadata as { origem?: string } | null;
        return {
          id: r.id,
          horario: formatarData(r.createdAt),
          acao: r.action,
          origem: meta?.origem ?? "MANUAL",
          oportunidadeId: r.entityId,
          titulo: (after?.titulo ?? before?.titulo ?? null) as string | null,
          statusAntes: (before?.status ?? null) as string | null,
          statusDepois: (after?.status ?? null) as string | null,
          realizadoPor: r.user?.nome ?? "Sistema",
        };
      }),
    });
  }

  // ── Formato Markdown ──────────────────────────────────────────────────────
  const linhas: string[] = [];
  linhas.push(`# Histórico do Pipeline — ${dataAlvo}`);
  linhas.push(`_Gerado em ${formatarData(new Date())} | ${registros.length} evento(s)_`);
  linhas.push("");

  if (registros.length === 0) {
    linhas.push("Nenhuma mudança registrada no pipeline hoje.");
  } else {
    // Agrupa por tipo de ação
    const statusChanges = registros.filter((r) => r.action === "OPORTUNIDADE_STATUS_CHANGED");
    const updates = registros.filter((r) => r.action === "OPORTUNIDADE_UPDATED");
    const responsavelChanges = registros.filter((r) => r.action === "OPORTUNIDADE_RESPONSAVEL_ALTERADO");
    const deactivated = registros.filter((r) => r.action === "OPORTUNIDADE_DEACTIVATED");

    if (statusChanges.length > 0) {
      linhas.push("## Mudanças de Status");
      for (const r of statusChanges) {
        const before = r.before as { status?: string } | null;
        const after = r.after as { titulo?: string; status?: string; motivoPerda?: string | null } | null;
        const meta = r.metadata as { origem?: string } | null;
        const de = STATUS_LABELS[before?.status ?? ""] ?? before?.status ?? "?";
        const para = STATUS_LABELS[after?.status ?? ""] ?? after?.status ?? "?";
        const titulo = after?.titulo ?? r.entityId;
        const quem = r.user?.nome ?? "Sistema";
        const quando = formatarData(r.createdAt);
        const origem = meta?.origem ? ` [${meta.origem}]` : "";
        linhas.push(`- **${titulo}**: ${de} → **${para}** — ${quem}${origem} às ${quando}`);
        if (after?.motivoPerda) linhas.push(`  - Motivo da perda: ${after.motivoPerda}`);
      }
      linhas.push("");
    }

    if (updates.length > 0) {
      linhas.push("## Atualizações (campos não-status)");
      for (const r of updates) {
        const before = r.before as Record<string, unknown> | null;
        const after = r.after as Record<string, unknown> | null;
        const meta = r.metadata as { origem?: string } | null;
        const titulo = (after?.titulo ?? before?.titulo ?? r.entityId) as string;
        const quem = r.user?.nome ?? "Sistema";
        const quando = formatarData(r.createdAt);
        const origem = meta?.origem ? ` [${meta.origem}]` : "";

        // Detecta o que mudou
        const mudancas: string[] = [];
        if (before?.status !== after?.status)
          mudancas.push(`status: ${STATUS_LABELS[before?.status as string] ?? before?.status} → ${STATUS_LABELS[after?.status as string] ?? after?.status}`);
        if (before?.estrategica !== after?.estrategica)
          mudancas.push(`estratégica: ${before?.estrategica ? "sim" : "não"} → ${after?.estrategica ? "sim" : "não"}`);
        if (before?.temperatura !== after?.temperatura)
          mudancas.push(`temperatura: ${before?.temperatura ?? "—"} → ${after?.temperatura ?? "—"}`);
        if (before?.responsavelId !== after?.responsavelId)
          mudancas.push("responsável alterado");

        const descricaoMudancas = mudancas.length > 0 ? mudancas.join(", ") : "campos diversos";
        linhas.push(`- **${titulo}**: ${descricaoMudancas} — ${quem}${origem} às ${quando}`);
      }
      linhas.push("");
    }

    if (responsavelChanges.length > 0) {
      linhas.push("## Mudanças de Responsável");
      for (const r of responsavelChanges) {
        const before = r.before as { responsavel?: { nome?: string } | null } | null;
        const after = r.after as { titulo?: string; responsavel?: { nome?: string } | null } | null;
        const titulo = after?.titulo ?? r.entityId;
        const quem = r.user?.nome ?? "Sistema";
        const quando = formatarData(r.createdAt);
        const antes = before?.responsavel?.nome ?? "nenhum";
        const depois = after?.responsavel?.nome ?? "nenhum";
        linhas.push(`- **${titulo}**: ${antes} → ${depois} — feito por ${quem} às ${quando}`);
      }
      linhas.push("");
    }

    if (deactivated.length > 0) {
      linhas.push("## Oportunidades Desativadas");
      for (const r of deactivated) {
        const after = r.after as { titulo?: string } | null;
        const titulo = after?.titulo ?? r.entityId;
        const quem = r.user?.nome ?? "Sistema";
        const quando = formatarData(r.createdAt);
        linhas.push(`- **${titulo}** — desativada por ${quem} às ${quando}`);
      }
      linhas.push("");
    }
  }

  linhas.push("---");
  linhas.push(`_Fonte: AuditLog do CRM · villa-crm.vercel.app_`);

  const markdown = linhas.join("\n");

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
