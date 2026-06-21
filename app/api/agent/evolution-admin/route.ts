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

  const { action, instance } = await req.json().catch(() => ({}));
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "Evolution API não configurada." }, { status: 500 });
  }

  if (action === "create") {
    const res = await fetch(`${apiUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ instanceName: instance, qrcode: true }),
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

  return NextResponse.json({ error: "Action inválida. Use: create, connect, status" }, { status: 400 });
}
