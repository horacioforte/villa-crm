import { NextResponse } from "next/server";

export const maxDuration = 60;

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || getBearerToken(request) !== secret) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 });
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://villa-crm.vercel.app");
  const response = await fetch(`${baseUrl}/api/email/processar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${secret}`,
    },
  });
  const data = await response.json().catch(() => null);

  return NextResponse.json(data ?? { erro: "Resposta invalida." }, {
    status: response.status,
  });
}
