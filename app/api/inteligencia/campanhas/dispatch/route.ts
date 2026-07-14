import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

// Proxy seguro: recebe requisição autenticada do cliente e encaminha ao endpoint
// interno /api/agent/campanha-email usando AGENT_API_KEY para não expor a chave
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

  const agentKey = process.env.AGENT_API_KEY;
  if (!agentKey) return NextResponse.json({ error: "AGENT_API_KEY não configurada." }, { status: 500 });

  try {
    const r = await fetch(`${process.env.NEXTAUTH_URL ?? ""}/api/agent/campanha-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text().catch(() => "");
    return NextResponse.json(JSON.parse(text || "{}"), { status: r.status });
  } catch (err) {
    console.error("[campanhas/dispatch] erro:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
