// ARQUIVO: app/api/webhook/whatsapp/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint exclusivo da Maria (inbound). João usa /api/webhook/whatsapp/joao.
// A lógica da Maria foi extraída para lib/agentes/maria/ — não alterar comportamento.

import { NextResponse } from "next/server";

// ── Agente Maria (importações do módulo isolado) ──────────────────────────────
import { analisarMensagem, classificarTermometroLead } from "@/lib/agentes/maria/handler";
import { getContextoConversa } from "@/lib/agentes/maria/contexto";
import { enviarWhatsapp, registrarLeadQualificado, registrarInteracaoParcial } from "@/lib/agentes/maria/crm";

export const maxDuration = 90;

// ─── Tipos do payload Evolution API ──────────────────────────────────────────

type EvolutionWebhookPayload = {
  event?: string;
  instance?: string; // nome da instância que recebeu o evento (ex: "maria-villa")
  data?: {
    key?: {
      fromMe?: boolean;
      remoteJid?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
    };
    pushName?: string;
  };
};

// ─── Helpers de parsing do payload ───────────────────────────────────────────

function getTextMessage(payload: EvolutionWebhookPayload) {
  return (
    payload.data?.message?.conversation ??
    payload.data?.message?.extendedTextMessage?.text ??
    ""
  ).trim();
}

function getWhatsappNumber(remoteJid?: string) {
  if (!remoteJid || remoteJid.endsWith("@g.us")) {
    return null;
  }

  const [number] = remoteJid.split("@");
  const digits = number?.replace(/\D/g, "");
  return digits || null;
}

// ─── Handler principal (Maria — inbound) ─────────────────────────────────────

export async function POST(request: Request) {
  let body: EvolutionWebhookPayload;

  try {
    body = (await request.json()) as EvolutionWebhookPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload JSON invalido." }, { status: 400 });
  }

  if (body.event !== "messages.upsert") {
    return NextResponse.json({ ok: true });
  }

  if (body.data?.key?.fromMe) {
    return NextResponse.json({ ok: true });
  }

  const texto = getTextMessage(body);

  if (!texto) {
    return NextResponse.json({ ok: true });
  }

  const telefone = getWhatsappNumber(body.data?.key?.remoteJid);

  if (!telefone) {
    return NextResponse.json({ ok: true });
  }

  const nomeContato = body.data?.pushName?.trim() || "Cliente";

  // ── Rota: Maria (inbound — lógica completa) ──────────────────────────────
  try {
    const contexto = await getContextoConversa(telefone);
    let dados = await analisarMensagem({ nomeContato, texto, contexto });
    await enviarWhatsapp({ telefone, texto: dados.resposta });

    let classificacaoInterna: {
      aderencia?: string | null;
      potencialEstrategico?: string | null;
      potencialMotivo?: string | null;
    } = {};

    if (dados.isLead && dados.qualificado) {
      const termometro = await classificarTermometroLead({
        dados,
        nomeContato,
        telefone,
        texto,
        contexto,
      });
      dados = {
        ...dados,
        temperatura: termometro.temperatura,
        temperaturaMotivo: termometro.motivo,
        urgente: termometro.urgente,
      };
      classificacaoInterna = {
        aderencia: termometro.aderencia,
        potencialEstrategico: termometro.potencialEstrategico,
        potencialMotivo: termometro.potencialMotivo,
      };
    }

    const lead = dados.isLead && dados.qualificado
      ? await registrarLeadQualificado({ dados, nomeContato, telefone, texto, classificacaoInterna })
      : { oportunidadeId: null, criada: false };

    if (dados.isLead && !dados.qualificado) {
      await registrarInteracaoParcial({ dados, nomeContato, telefone, texto });
    }

    return NextResponse.json({
      ok: true,
      leadQualificado: Boolean(lead.oportunidadeId),
      oportunidadeId: lead.oportunidadeId,
      oportunidadeCriada: lead.criada,
    });
  } catch (error) {
    console.error("[WEBHOOK_WHATSAPP] Erro ao processar mensagem:", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message.includes("configurada") ? 503 : 500;

    return NextResponse.json({ ok: false, message }, { status });
  }
}
