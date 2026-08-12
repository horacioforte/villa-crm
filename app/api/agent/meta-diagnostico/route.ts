// ARQUIVO: app/api/agent/meta-diagnostico/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint de auditoria SOMENTE LEITURA da Graph API (Meta Cloud API) — nunca faz
// POST/PUT/DELETE contra a Meta, só GET de leitura de um phone_number_id. Nunca altera
// nenhuma configuração de webhook/canal, nem no Meta nem no banco.
//
// Existe porque variáveis de ambiente marcadas "Sensitive" na Vercel não podem ser
// lidas via `vercel env pull`/CLI/dashboard depois de criadas — só dentro de uma
// Function em runtime. Este endpoint roda no runtime de produção, resolve o token só
// pelo nome (nunca aceita um valor de token do chamador) e o nome só é aceito se já
// estiver na allowlist de lib/whatsapp/env-allowlist.ts — o chamador nunca escolhe uma
// env var arbitrária. O token em si nunca é retornado, nunca é logado.
//
// Autenticação via AGENT_API_KEY (mesmo padrão de evolution-admin).

import { NextRequest, NextResponse } from "next/server";
import {
  resolveWhatsappEnvVar,
  EnvVarNaoPermitidaError,
  EnvVarNaoConfiguradaError,
} from "@/lib/whatsapp/env-allowlist";

const GRAPH_API_VERSION = "v20.0";

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
  const { phoneNumberId, accessTokenEnvVar } = body as {
    phoneNumberId?: unknown;
    accessTokenEnvVar?: unknown;
  };

  if (typeof phoneNumberId !== "string" || !phoneNumberId || typeof accessTokenEnvVar !== "string" || !accessTokenEnvVar) {
    return NextResponse.json(
      { error: "phoneNumberId e accessTokenEnvVar (string) são obrigatórios." },
      { status: 400 },
    );
  }

  let accessToken: string;
  try {
    accessToken = await resolveWhatsappEnvVar(accessTokenEnvVar, "access_token", { canalId: null });
  } catch (err) {
    if (err instanceof EnvVarNaoPermitidaError) {
      return NextResponse.json({ error: "accessTokenEnvVar fora da allowlist — recusado." }, { status: 400 });
    }
    if (err instanceof EnvVarNaoConfiguradaError) {
      return NextResponse.json({ error: "accessTokenEnvVar permitida, mas não configurada no servidor." }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao resolver credencial." }, { status: 500 });
  }

  const fields = [
    "id",
    "display_phone_number",
    "verified_name",
    "quality_rating",
    "code_verification_status",
    "webhook_configuration",
  ].join(",");

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=${fields}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, method: "GET" },
    );
    const corpo = await res.json().catch(() => null);

    // Nunca inclui o access token na resposta — só o resultado (público/interno) da
    // Graph API, que por definição nunca contém o token usado para consultá-la.
    return NextResponse.json({ httpStatus: res.status, corpo }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: "Erro ao consultar a Graph API.", detalhe: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
