// ARQUIVO: app/api/agent/morgana-frias/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Recebe lista de leads FRIAS do Radar João (score 0–49) e envia
// email semanal para Morgana toda segunda-feira ao final do radar.

import { NextRequest, NextResponse } from "next/server";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${apiKey}`;
}

interface LeadFria {
  empresa: string;
  obra: string;
  cidade?: string;
  estado?: string;
  score: number;
  motivo?: string;
  segmento?: string;
  equipamentosRecomendados?: string;
  linkNoticia?: string;
  proximaAcaoComercial?: string;
}

const MORGANA_EMAIL = "comercial@villaempreendimentos.com.br";

export async function POST(req: NextRequest) {
  // 1. Autenticar
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // 2. Parsear payload
  let body: { leads: LeadFria[]; semana: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }

  const { leads, semana } = body;

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ mensagem: "Nenhum lead frio para enviar." });
  }

  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    return NextResponse.json({ error: "BREVO_API_KEY não configurada." }, { status: 500 });
  }

  // 3. Montar HTML do email
  const linhas = leads
    .map(
      (l, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#ffffff"}">
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${l.empresa}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${l.obra}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;white-space:nowrap">${[l.cidade, l.estado].filter(Boolean).join("/") || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${l.segmento ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">
          <span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:12px;font-weight:700;font-size:12px">${l.score}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#555">${l.motivo ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${l.equipamentosRecomendados ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">
          ${l.linkNoticia ? `<a href="${l.linkNoticia}" style="color:#0066cc;text-decoration:none">🔗 ver</a>` : "—"}
        </td>
      </tr>`,
    )
    .join("");

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:960px;margin:0 auto;color:#222">

      <!-- Header -->
      <div style="background:#1a1a2e;color:#fff;padding:20px 28px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;font-size:20px">📋 Radar João — Leads Frias da Semana</h2>
        <p style="margin:6px 0 0;opacity:.75;font-size:14px">
          Semana: <strong>${semana}</strong> &nbsp;·&nbsp;
          ${leads.length} lead${leads.length !== 1 ? "s" : ""} com score abaixo de 50
        </p>
      </div>

      <!-- Intro -->
      <div style="padding:20px 28px;background:#fff;border:1px solid #e5e7eb;border-top:none">
        <p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.6">
          Morgana, estas oportunidades foram descartadas pelo critério de score do Radar João
          <strong>(score &lt; 50)</strong> mas podem ser úteis para campanhas de aquecimento,
          follow-up de longo prazo ou prospecção complementar.
        </p>

        <!-- Tabela -->
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Empresa</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Obra</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Cidade/UF</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Segmento</th>
                <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Score</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Por que fria</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Equipamentos</th>
                <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #d1d5db;font-size:12px;text-transform:uppercase;letter-spacing:.5px">Fonte</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:14px 28px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:12px;color:#9ca3af">
        Gerado automaticamente pelo João &nbsp;·&nbsp; Villa Empreendimentos &nbsp;·&nbsp;
        <a href="https://villa-crm.vercel.app/oportunidades" style="color:#6b7280">villa-crm.vercel.app</a>
      </div>

    </div>
  `;

  // 4. Enviar via Brevo
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: {
        name: "João — Radar Villa",
        email: "joao.comercial@villaempreendimentos.com.br",
      },
      to: [{ email: MORGANA_EMAIL, name: "Morgana" }],
      subject: `📋 Radar João — ${leads.length} lead${leads.length !== 1 ? "s" : ""} fria${leads.length !== 1 ? "s" : ""} · Semana ${semana}`,
      htmlContent,
    }),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    console.error("[morgana-frias] Brevo error:", r.status, err);
    return NextResponse.json(
      { error: `Brevo retornou ${r.status}`, detalhe: err },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sucesso: true,
    mensagem: `Email enviado para Morgana com ${leads.length} lead${leads.length !== 1 ? "s" : ""} fria${leads.length !== 1 ? "s" : ""}.`,
    semana,
    total: leads.length,
  });
}
