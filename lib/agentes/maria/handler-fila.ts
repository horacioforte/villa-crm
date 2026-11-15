// ARQUIVO: lib/agentes/maria/handler-fila.ts
// REGRA: nunca remover. Apenas acrescentar.
// Adaptador entre FilaMensagem e o processamento da Maria.
// Extrai a lógica de processamento de texto para ser reutilizável pelo webhook e pelo
// cron de recovery — sem depender de route.ts (que é um arquivo de rota Next.js).
//
// Tratamento de falha pós-envio (design intencional):
//   - Se WhatsApp for enviado com sucesso e o CRM falhar, o erro é logado mas NÃO relançado.
//     Isso evita que a fila reprocesse e reenvie a mensagem ao cliente.
//   - Se o envio do WhatsApp falhar, o erro É relançado. A fila vai retentar (até MAX_TENTATIVAS).
//
// Integração com after() e Vercel:
//   - after() de next/server executa dentro do mesmo maxDuration (90s) da requisição.
//   - Tempo médio por lote: ~8s (IA: 2-5s, WhatsApp: 1-2s, CRM+DB: 0.5s).
//   - Vercel cobra execução enquanto after() ainda roda — dentro do mesmo billing window.
//   - Se after() for interrompido (timeout de 90s), processandoAte expira e a mensagem
//     volta automaticamente para AGUARDANDO após 90s (recovery da FilaMensagem).
//
// ACRESCENTADO (15/11/2026 — Fila Persistente Maria v1)

import { analisarMensagem, classificarTermometroLead } from "@/lib/agentes/maria/handler";
import { getContextoConversa } from "@/lib/agentes/maria/contexto";
import {
  enviarWhatsappMeta,
  registrarLeadQualificado,
  registrarInteracaoParcial,
} from "@/lib/agentes/maria/crm";
import {
  getCanalMaria,
  mensagemJaProcessada,
  persistirConversaMaria,
} from "@/lib/whatsapp/agentes/maria";
import type { FilaMensagemRecord } from "@/lib/agentes/maria/fila";

/**
 * Processa um lote de mensagens da FilaMensagem para um único telefone.
 *
 * Lote com N mensagens (debounce 4s):
 *   - Os textos são concatenados com "\n---\n" e enviados como uma única chamada à IA.
 *   - O messageId da primeira mensagem é usado para idempotência V2.
 *
 * Falha pós-envio:
 *   - WhatsApp enviado → erros de CRM são capturados e logados, nunca relançados.
 *   - WhatsApp não enviado → erro relançado para o mecanismo de retry da fila.
 *
 * Esta função é o processarLote callback para processarFilaParaTelefone().
 * Chamada pelo route.ts (via after()) e pelo cron de recovery.
 */
export async function processarMensagemMariaDaFila(lote: FilaMensagemRecord[]): Promise<void> {
  if (lote.length === 0) return;

  const { telefone, nomeContato } = lote[0];

  // Concatena textos de múltiplas mensagens (debounce natural)
  const texto =
    lote.length === 1
      ? lote[0].texto
      : lote.map((m, i) => (i === 0 ? m.texto : `---\n${m.texto}`)).join("\n");

  // Usa o messageId da primeira mensagem para a checagem de idempotência V2
  const messageId = lote[0].messageId;
  const messageType = lote[0].messageType;
  // rawPayload não está no FilaMensagemRecord (apenas no banco) — passa null para V2.
  // O texto já está em textoCliente, que é o campo essencial para a persistência.
  const referral = null;

  // ─── Checagem de idempotência V2 ─────────────────────────────────────────────
  const conversasV2Ligada = process.env.WHATSAPP_MARIA_CONVERSAS_V2 === "true";
  let canal = null;

  if (conversasV2Ligada && messageId) {
    try {
      canal = await getCanalMaria();
      if (canal) {
        const jaProcessada = await mensagemJaProcessada({ canal, externalMessageId: messageId });
        if (jaProcessada) {
          console.info("[handler-fila] Mensagem já processada (idempotência V2) — ignorando.", {
            messageId,
            telefone,
          });
          return;
        }
      }
    } catch (err) {
      console.error(
        "[handler-fila] Falha ao checar idempotência V2 — seguindo sem persistência adicional:",
        err,
      );
      canal = null;
    }
  }

  // ─── Chamada à IA ─────────────────────────────────────────────────────────────
  const contexto = await getContextoConversa(telefone);
  let dados = await analisarMensagem({ nomeContato, texto, contexto, referral });

  // ─── Envio do WhatsApp — ponto de não-retorno ─────────────────────────────────
  // Após esta linha, qualquer erro NÃO deve relançar para o retry da fila.
  // O cliente já recebeu a resposta; reprocessar causaria duplo envio.
  await enviarWhatsappMeta({ telefone, texto: dados.resposta });

  // A partir daqui: erros são logados mas nunca relançados.
  try {
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
      await registrarLeadQualificado({
        dados,
        nomeContato,
        telefone,
        texto,
        classificacaoInterna,
      });
    } else if (dados.isLead) {
      await registrarInteracaoParcial({ dados, nomeContato, telefone, texto });
    }
  } catch (crmErr) {
    // CRM write falhou APÓS WhatsApp enviado.
    // O cliente recebeu a resposta normalmente — apenas logamos o erro.
    console.error(
      "[handler-fila] CRM write falhou após WhatsApp enviado — cliente recebeu resposta normalmente:",
      crmErr,
    );
  }

  // ─── Persistência adicional (Workspace V2) ───────────────────────────────────
  if (conversasV2Ligada && canal && messageId) {
    try {
      await persistirConversaMaria({
        canal,
        telefone,
        nomeContato,
        externalMessageId: messageId,
        messageType,
        textoCliente: texto,
        rawPayload: null,
        textoResposta: dados.resposta,
      });
    } catch (err) {
      console.error(
        "[handler-fila] Falha ao persistir Conversa/Mensagem (Workspace V2) — fluxo principal concluído:",
        err,
      );
    }
  }
}
