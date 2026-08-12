// ARQUIVO: app/api/agent/meta-taciane-webhook-override/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint de USO ÚNICO E ESTREITO: configura o override de webhook por número (Meta
// Cloud API / WhatsApp Business Management) exclusivamente para o phone_number_id da
// Taciane (1238399969356190), apontando para a rota dedicada dela
// (/api/webhook/whatsapp/taciane). Nunca aceita phone_number_id, callback URL nem nome
// de env var do chamador — tudo hardcoded, de propósito, para eliminar qualquer
// possibilidade de uso deste endpoint para alterar o callback de Maria, João, Morgana
// ou o callback padrão do App (esse último exigiria uma chamada diferente, contra o
// App, não contra este phone_number_id — este endpoint nunca faz essa chamada).
//
// Autenticação via AGENT_API_KEY (mesmo padrão de evolution-admin/meta-diagnostico).
// Exige um campo "confirmar" com valor exato — esta é uma chamada de ESCRITA real
// contra a Meta, diferente de meta-diagnostico (que é só leitura).

import { NextRequest, NextResponse } from "next/server";
import {
  resolveWhatsappEnvVar,
  EnvVarNaoPermitidaError,
  EnvVarNaoConfiguradaError,
} from "@/lib/whatsapp/env-allowlist";

const GRAPH_API_VERSION = "v20.0";
const PHONE_NUMBER_ID_TACIANE = "1238399969356190";
const CALLBACK_URL_TACIANE = "https://villa-crm.vercel.app/api/webhook/whatsapp/taciane";
const CONFIRMACAO_ESPERADA = "taciane-override-1238399969356190";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if ((body as { confirmar?: unknown })?.confirmar !== CONFIRMACAO_ESPERADA) {
    return NextResponse.json(
      { error: `Confirmação obrigatória ausente ou incorreta. Envie { "confirmar": "${CONFIRMACAO_ESPERADA}" }.` },
      { status: 400 },
    );
  }

  let accessToken: string;
  let verifyToken: string;
  try {
    accessToken = await resolveWhatsappEnvVar("TACIANE_META_ACCESS_TOKEN", "access_token", { canalId: null });
    verifyToken = await resolveWhatsappEnvVar("TACIANE_META_VERIFY_TOKEN", "verify_token", { canalId: null });
  } catch (err) {
    const message =
      err instanceof EnvVarNaoPermitidaError
        ? "Credencial não permitida (fora da allowlist)."
        : err instanceof EnvVarNaoConfiguradaError
          ? "Credencial permitida, mas não configurada no servidor."
          : "Erro ao resolver credenciais.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID_TACIANE}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook_configuration: {
          override_callback_uri: CALLBACK_URL_TACIANE,
          verify_token: verifyToken,
        },
      }),
    });
    const corpo = await res.json().catch(() => null);

    // Nunca inclui accessToken/verifyToken na resposta — só o resultado da Graph API.
    return NextResponse.json({ httpStatus: res.status, corpo }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro ao chamar a Graph API.", detalhe: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
