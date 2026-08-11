// ARQUIVO: app/api/webhook/whatsapp/maria/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Webhook exclusivo da Maria via Meta Cloud API (WhatsApp Business API oficial).
// Formato Meta — diferente do Evolution API usado anteriormente.
//
// Fase 2 — ACRESCENTADO: persistência aditiva em Conversa/Mensagem (Workspace
// Comercial), atrás da feature flag WHATSAPP_MARIA_CONVERSAS_V2.
//   - Ausente ou "false" (padrão): comportamento idêntico ao que já roda em produção,
//     nenhuma chamada nova é feita.
//   - "true": além do fluxo atual (inalterado), a mensagem de entrada e a resposta da
//     Maria passam a ser espelhadas em Conversa/Mensagem via lib/whatsapp/agentes/maria.ts.
// Reentrega do mesmo message.id da Meta é detectada ANTES de qualquer chamada de IA/
// envio/CRM (não só na gravação) — nunca dispara uma segunda resposta real ao cliente
// nem um segundo efeito comercial. Falha na persistência adicional é sempre capturada
// e logada, nunca interrompe o fluxo comercial (que já rodou e terminou com sucesso).

import { NextRequest, NextResponse } from "next/server";
import { analisarMensagem, classificarTermometroLead } from "@/lib/agentes/maria/handler";
import { getContextoConversa } from "@/lib/agentes/maria/contexto";
import {
  enviarWhatsappMeta,
  registrarLeadQualificado,
  registrarInteracaoParcial,
} from "@/lib/agentes/maria/crm";
import { getCanalMaria, mensagemJaProcessada, persistirConversaMaria } from "@/lib/whatsapp/agentes/maria";
import type { CanalWhatsapp } from "@/app/generated/prisma/client";

export const maxDuration = 90;

// ─── Verificação do webhook (GET) ────────────────────────────────────────────
// A Meta chama este endpoint com hub.mode, hub.verify_token e hub.challenge
// para confirmar que o servidor é válido.

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.MARIA_META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[maria/meta-webhook] Webhook verificado com sucesso.");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[maria/meta-webhook] Verificação falhou. Token inválido.");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ─── Recebimento de mensagens (POST) ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  // Ignora eventos que não são do WhatsApp Business Account
  if (body.object !== "whatsapp_business_account") {
    return NextResponse.json({ ok: true });
  }

  // ─── Roteamento: detecta phone_number_id e delega ao agente correto ──────
  // ACRESCENTADO: roteamento para João sem alterar o webhook URL no Meta.
  const primeiraEntry = (body.entry as Record<string, unknown>[] | undefined)?.[0];
  const primeiraChange = (primeiraEntry?.changes as Record<string, unknown>[] | undefined)?.[0];
  const metadataValue = (primeiraChange?.value as Record<string, unknown> | undefined);
  const metadataObj = metadataValue?.metadata as Record<string, string> | undefined;
  const phoneNumberId = metadataObj?.phone_number_id;
  const joaoPhoneId = process.env.META_JOAO_PHONE_NUMBER_ID;

  if (phoneNumberId && joaoPhoneId && phoneNumberId === joaoPhoneId) {
    // Mensagem é do número do João — delega para o handler do João
    try {
      const url = new URL(request.url);
      const joaoUrl = `${url.origin}/api/webhook/whatsapp/joao`;
      await fetch(joaoUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("[maria/meta-webhook] Erro ao delegar para João:", err);
    }
    return NextResponse.json({ ok: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const entries = (body.entry as Record<string, unknown>[] | undefined) ?? [];

  for (const entry of entries) {
    const changes = (entry.changes as Record<string, unknown>[] | undefined) ?? [];

    for (const change of changes) {
      if (change.field !== "messages") continue;

      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const messages = (value.messages as Record<string, unknown>[] | undefined) ?? [];
      const contacts = (value.contacts as Record<string, unknown>[] | undefined) ?? [];

      for (const message of messages) {
        // Ignora mensagens enviadas por nós
        if ((message.from as string) === process.env.MARIA_META_PHONE_NUMBER_ID) continue;

        // Só processa mensagens de texto
        if (message.type !== "text") continue;

        const texto = ((message.text as Record<string, unknown>)?.body as string)?.trim();
        if (!texto) continue;

        const telefone = message.from as string;
        if (!telefone) continue;

        // Nome do contato
        const contact = contacts.find(
          (c) => (c.wa_id as string) === telefone
        );
        const nomeContato =
          ((contact?.profile as Record<string, unknown>)?.name as string)?.trim() || "Cliente";

        // Usado só pela persistência adicional (Workspace) — nunca inventado; se
        // ausente, a persistência adicional é pulada para este evento (ver abaixo).
        const messageId = (message.id as string | undefined) ?? null;
        const messageType = (message.type as string | undefined) ?? "text";

        // Aguarda o processamento antes de retornar (Vercel mata execução ao retornar 200)
        await processarMensagemMaria({ telefone, nomeContato, texto, messageId, messageType, rawMessage: message }).catch((err) => {
          console.error("[maria/meta-webhook] Erro ao processar mensagem:", err);
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Processamento assíncrono ─────────────────────────────────────────────────

async function processarMensagemMaria({
  telefone,
  nomeContato,
  texto,
  messageId,
  messageType,
  rawMessage,
}: {
  telefone: string;
  nomeContato: string;
  texto: string;
  messageId: string | null;
  messageType: string;
  rawMessage: unknown;
}) {
  // ─── Persistência adicional (Workspace) — checagem de idempotência ──────────
  // Roda ANTES do fluxo comercial: em caso de reentrega do mesmo message.id pela
  // Meta, pula IA/envio/CRM inteiramente (nunca só a gravação) — nenhuma segunda
  // resposta real chega ao cliente. Qualquer falha nesta checagem (canal ausente,
  // erro de banco) faz a função seguir exatamente como se a flag estivesse
  // desligada — a persistência adicional é opcional, o fluxo comercial não é.
  const conversasV2Ligada = process.env.WHATSAPP_MARIA_CONVERSAS_V2 === "true";
  let canal: CanalWhatsapp | null = null;

  if (conversasV2Ligada) {
    if (!messageId) {
      console.warn("[maria/meta-webhook] Mensagem sem id da Meta — persistência adicional pulada para este evento (nenhum identificador é inventado).");
    } else {
      try {
        canal = await getCanalMaria();
        if (!canal) {
          console.warn("[maria/meta-webhook] WHATSAPP_MARIA_CONVERSAS_V2 ligada mas CanalWhatsapp 'maria-villa' não encontrado — persistência adicional desativada para este evento.");
        } else {
          const jaProcessada = await mensagemJaProcessada({ canal, externalMessageId: messageId });
          if (jaProcessada) {
            console.info("[maria/meta-webhook] Evento duplicado (reentrega da Meta) — ignorado.", { messageId });
            return;
          }
        }
      } catch (err) {
        console.error("[maria/meta-webhook] Falha ao checar idempotência da persistência adicional — seguindo sem ela:", err);
        canal = null;
      }
    }
  }

  try {
    const contexto = await getContextoConversa(telefone);
    let dados = await analisarMensagem({ nomeContato, texto, contexto });
    await enviarWhatsappMeta({ telefone, texto: dados.resposta });

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

    if (dados.isLead && dados.qualificado) {
      await registrarLeadQualificado({ dados, nomeContato, telefone, texto, classificacaoInterna });
    } else if (dados.isLead) {
      await registrarInteracaoParcial({ dados, nomeContato, telefone, texto });
    }

    // ─── Persistência adicional (Workspace) — gravação ─────────────────────────
    // Só chega aqui depois que IA + envio + CRM já terminaram com sucesso. Falha
    // aqui é logada e nunca propagada — o fluxo comercial já concluiu normalmente.
    if (conversasV2Ligada && canal && messageId) {
      try {
        await persistirConversaMaria({
          canal,
          telefone,
          nomeContato,
          externalMessageId: messageId,
          messageType,
          textoCliente: texto,
          rawPayload: rawMessage,
          textoResposta: dados.resposta,
        });
      } catch (err) {
        console.error("[maria/meta-webhook] Falha ao persistir Conversa/Mensagem (Workspace) — fluxo comercial já concluído normalmente:", err);
      }
    }
  } catch (err) {
    console.error("[maria/meta-webhook] Erro interno:", err);
  }
}
