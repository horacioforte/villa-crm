// ARQUIVO: app/api/saude-comercial/joao/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Health check diário do João — roda às 6h via Vercel Cron.
// Testa: Meta Cloud API, banco de dados, webhook endpoint.
// Em caso de erro: envia WhatsApp para Horacio + email.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HORACIO_WHATSAPP = "5581994750422"; // número do Horacio
const HORACIO_EMAIL = "horacio@villaempreendimentos.com.br";

// ─── Auth via CRON_SECRET ─────────────────────────────────────────────────────

function autenticado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(secret && auth === `Bearer ${secret}`);
}

// ─── Testes individuais ───────────────────────────────────────────────────────

async function testarMetaAPI(): Promise<{ ok: boolean; detalhe: string }> {
  const phoneId = process.env.META_JOAO_PHONE_NUMBER_ID;
  const token = process.env.META_JOAO_ACCESS_TOKEN;

  if (!phoneId || !token) {
    return { ok: false, detalhe: "META_JOAO_PHONE_NUMBER_ID ou META_JOAO_ACCESS_TOKEN não configurados." };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}?fields=id,display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    const data = await r.json();
    if (!r.ok || data.error) {
      return { ok: false, detalhe: `Meta API erro ${r.status}: ${data.error?.message ?? "desconhecido"}` };
    }
    return { ok: true, detalhe: `Número: ${data.display_phone_number} | Nome: ${data.verified_name}` };
  } catch (err) {
    return { ok: false, detalhe: `Meta API inacessível: ${String(err)}` };
  }
}

async function testarBancoDeDados(): Promise<{ ok: boolean; detalhe: string }> {
  try {
    const count = await prisma.prospect.count({ where: { agente: "joao-villa" } });
    return { ok: true, detalhe: `${count} prospects do João no banco.` };
  } catch (err) {
    return { ok: false, detalhe: `Banco de dados inacessível: ${String(err)}` };
  }
}

async function testarWebhook(): Promise<{ ok: boolean; detalhe: string }> {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const baseUrl = process.env.NEXTAUTH_URL?.replace("localhost:3000", "villa-crm.vercel.app") ?? "https://villa-crm.vercel.app";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const url = `${baseUrl}/api/webhook/whatsapp/joao?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=ping123`;
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const text = await r.text();
    if (r.ok && text === "ping123") {
      return { ok: true, detalhe: "Webhook respondendo corretamente." };
    }
    return { ok: false, detalhe: `Webhook status ${r.status}: resposta inesperada "${text.substring(0, 100)}"` };
  } catch (err) {
    return { ok: false, detalhe: `Webhook inacessível: ${String(err)}` };
  }
}

// ─── Alertas ──────────────────────────────────────────────────────────────────

async function enviarAlertaWhatsapp(mensagem: string): Promise<void> {
  const phoneId = process.env.META_JOAO_PHONE_NUMBER_ID;
  const token = process.env.META_JOAO_ACCESS_TOKEN;
  if (!phoneId || !token) return;

  await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: HORACIO_WHATSAPP,
      type: "text",
      text: { body: mensagem },
    }),
  }).catch((err) => console.error("[saude/joao] Falha ao enviar alerta WhatsApp:", err));
}

async function enviarAlertaEmail(assunto: string, corpo: string): Promise<void> {
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) return;

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: { name: "João — Villa CRM", email: "joao.comercial@villaempreendimentos.com.br" },
      to: [{ email: HORACIO_EMAIL, name: "Horacio" }],
      subject: assunto,
      htmlContent: `<pre style="font-family:monospace;font-size:14px">${corpo}</pre>`,
    }),
  }).catch((err) => console.error("[saude/joao] Falha ao enviar alerta email:", err));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!autenticado(request)) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Recife" });

  const [metaAPI, bancoDados, webhook] = await Promise.all([
    testarMetaAPI(),
    testarBancoDeDados(),
    testarWebhook(),
  ]);

  const tudo_ok = metaAPI.ok && bancoDados.ok && webhook.ok;

  const resultado = {
    timestamp: agora,
    tudo_ok,
    testes: {
      meta_api: metaAPI,
      banco_de_dados: bancoDados,
      webhook: webhook,
    },
  };

  console.info("[saude/joao]", JSON.stringify(resultado));

  // Dispara alertas apenas se houver falha
  if (!tudo_ok) {
    const erros = [
      !metaAPI.ok ? `❌ Meta API: ${metaAPI.detalhe}` : null,
      !bancoDados.ok ? `❌ Banco: ${bancoDados.detalhe}` : null,
      !webhook.ok ? `❌ Webhook: ${webhook.detalhe}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const mensagem = `⚠️ *João — Alerta de Saúde (${agora})*\n\n${erros}\n\nVerifique: https://villa-crm.vercel.app`;

    await Promise.all([
      enviarAlertaWhatsapp(mensagem),
      enviarAlertaEmail(
        `⚠️ João — Falha detectada no health check (${agora})`,
        mensagem.replace(/\*/g, ""),
      ),
    ]);
  }

  return NextResponse.json(resultado, { status: tudo_ok ? 200 : 500 });
}
