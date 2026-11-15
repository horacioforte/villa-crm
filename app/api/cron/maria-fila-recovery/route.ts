// ARQUIVO: app/api/cron/maria-fila-recovery/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Recovery periódico de mensagens travadas na FilaMensagem.
// Chamado pelo Vercel Cron Jobs a cada 5 minutos.
//
// Propósito:
//   Sem este cron, uma mensagem que caiu no timeout do after() ficaria presa em PROCESSANDO
//   indefinidamente — a menos que um novo webhook chegasse para o mesmo telefone.
//   Este cron garante que mensagens travadas são recuperadas sem depender de novo WhatsApp.
//
// Fluxo:
//   1. Encontra telefones únicos com mensagens AGUARDANDO ou PROCESSANDO expiradas.
//   2. Retorna HTTP 200 imediatamente.
//   3. Via after(), processa a fila de cada telefone usando processarMensagemMariaDaFila.
//
// Segurança:
//   - Requer CRON_SECRET no header Authorization (Bearer <secret>).
//   - Se CRON_SECRET não estiver configurado, qualquer chamada é aceita (apenas em dev).
//   - Vercel injeta automaticamente o secret em chamadas de cron agendadas.
//
// ACRESCENTADO (15/11/2026 — Recovery Periódico v1)

import { NextResponse, after } from "next/server";
import {
  buscarTelefonesPendentes,
  processarFilaParaTelefone,
} from "@/lib/agentes/maria/fila";
import { processarMensagemMariaDaFila } from "@/lib/agentes/maria/handler-fila";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // ─── Autenticação do cron ──────────────────────────────────────────────────
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      console.warn("[cron/maria-fila-recovery] Requisição não autorizada — header inválido.");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // ─── Busca telefones com pendências ───────────────────────────────────────
  // (a lógica de TTL é centralizada em buscarTelefonesPendentes dentro de fila.ts)
  let pendentes: { telefone: string; nomeContato: string }[] = [];
  try {
    pendentes = await buscarTelefonesPendentes(20);
  } catch (err) {
    console.error("[cron/maria-fila-recovery] Erro ao buscar pendentes:", err);
    return NextResponse.json({ ok: false, error: "Erro ao consultar banco" }, { status: 500 });
  }

  if (pendentes.length === 0) {
    return NextResponse.json({ ok: true, recuperados: 0, mensagem: "Nenhuma mensagem pendente." });
  }

  console.info("[cron/maria-fila-recovery] Telefones com pendências:", pendentes.map((p) => p.telefone));

  // ─── Processa em background (após HTTP 200) ────────────────────────────────
  const telefones = pendentes.map((p) => p.telefone);

  after(async () => {
    for (const telefone of telefones) {
      try {
        const { lotesProcessados, erros } = await processarFilaParaTelefone(
          telefone,
          processarMensagemMariaDaFila,
        );
        console.info("[cron/maria-fila-recovery] Telefone processado:", {
          telefone,
          lotesProcessados,
          erros,
        });
      } catch (err) {
        console.error("[cron/maria-fila-recovery] Erro ao processar telefone:", telefone, err);
      }
    }
  });

  return NextResponse.json({
    ok: true,
    telefonesEnfileirados: pendentes.length,
    telefones,
  });
}
