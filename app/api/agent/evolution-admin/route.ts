// ARQUIVO: app/api/agent/evolution-admin/route.ts
// Endpoint temporário para gerenciar instâncias Evolution API via servidor Vercel
// Autenticação via AGENT_API_KEY
// REGRA: nunca remover. Apenas acrescentar.

import { NextRequest, NextResponse } from "next/server";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const reqBody = await req.json().catch(() => ({}));
  const { action, instance, webhookUrl } = reqBody;
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  // Cada instância tem seu próprio token na Evolution API
  const apiKey = instance?.startsWith("joao")
    ? (process.env.JOAO_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY)
    : instance?.startsWith("morgana")
    ? (process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY)
    : instance?.startsWith("taciane")
    ? (process.env.TACIANE_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY)
    : process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "Evolution API não configurada." }, { status: 500 });
  }

  if (action === "create") {
    // Tenta com apikey header; se vier 401, tenta com Authorization: Bearer
    const tryCreate = async (headers: Record<string, string>) => {
      const res = await fetch(`${apiUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          instanceName: instance,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      return { res, data: await res.json() };
    };

    // Tenta 3 formatos de auth diferentes
    let { res, data } = await tryCreate({ apikey: apiKey });
    if (res.status === 401) {
      ({ res, data } = await tryCreate({ Authorization: `Bearer ${apiKey}` }));
    }
    if (res.status === 401) {
      // Tenta com query param
      const url = `${apiUrl}/instance/create?apikey=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });
      data = await r.json();
      res = r;
    }
    return NextResponse.json({ ...data, _debugStatus: res.status }, { status: res.status });
  }

  if (action === "list") {
    const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === "connect") {
    const res = await fetch(`${apiUrl}/instance/connect/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === "status") {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === "getWebhook") {
    const res = await fetch(`${apiUrl}/webhook/find/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === "setWebhook") {
    const baseUrl = ((webhookUrl as string | undefined) ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
    const suffix = instance?.startsWith("joao") ? "/api/webhook/whatsapp/joao" : "/api/webhook/whatsapp";
    const url = `${baseUrl}${suffix}`;

    const res = await fetch(`${apiUrl}/webhook/set/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        url,
        webhook_by_events: false,
        webhook_base64: false,
        events: ["MESSAGES_UPSERT"],
      }),
    });
    const data = await res.json();
    return NextResponse.json({ ...data, webhookUrl: url, _debugStatus: res.status }, { status: res.status });
  }

  return NextResponse.json({ error: "Action inválida. Use: create, connect, status, getWebhook, setWebhook" }, { status: 400 });
}
