// ARQUIVO: lib/whatsapp/verify-signature.ts
// Fase 2 — Central de Atendimento WhatsApp.
//
// Validação da assinatura HMAC-SHA256 que a Meta envia no header X-Hub-Signature-256
// em todo POST de webhook. Usa o App Secret da aplicação Meta (não o verify token —
// são credenciais diferentes, para propósitos diferentes: verify token só serve para o
// handshake GET de assinatura do webhook; App Secret assina o corpo de cada POST).

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * @param rawBody corpo bruto exato recebido (antes de qualquer JSON.parse) — a
 *   assinatura é calculada sobre os bytes exatos enviados pela Meta.
 * @param signatureHeader valor do header "x-hub-signature-256" (formato "sha256=<hex>").
 * @param appSecret App Secret da aplicação Meta, já resolvido via env-allowlist.
 */
export function verificarAssinaturaMeta({
  rawBody,
  signatureHeader,
  appSecret,
}: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string;
}): boolean {
  if (!signatureHeader) return false;

  const [algoritmo, recebidoHex] = signatureHeader.split("=");
  if (algoritmo !== "sha256" || !recebidoHex) return false;

  const esperadoHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const recebidoBuf = Buffer.from(recebidoHex, "hex");
  const esperadoBuf = Buffer.from(esperadoHex, "hex");

  // Buffers de tamanho diferente não podem ir para timingSafeEqual (lança exceção).
  if (recebidoBuf.length !== esperadoBuf.length) return false;

  return timingSafeEqual(recebidoBuf, esperadoBuf);
}
