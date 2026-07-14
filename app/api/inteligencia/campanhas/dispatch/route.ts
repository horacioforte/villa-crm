import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

type Dest = { nome: string; email: string; empresa: string; cidade?: string; estado?: string; cargo?: string; segmento?: string; observacoes?: string };

function gerarSubject(tipo: string, d: Dest, equipamento?: string) {
  if (tipo === "PRE_MOLDADO") return `Caminhões betoneira e autobomba seminovos disponíveis`;
  if (tipo === "OBRA") return `Solução em bombeamento de concreto para ${d.empresa} — Villa Empreendimentos`;
  return `Villa Empreendimentos — Soluções em bombeamento de concreto`;
}

function gerarHtmlEmail(tipo: string, d: Dest, equipamento?: string) {
  const saudacao = d.cargo ? `${d.cargo} ${d.nome.split(" ")[0]}` : d.nome.split(" ")[0];
  const cidade = d.cidade && d.estado ? ` em ${d.cidade}/${d.estado}` : "";

  const corpos: Record<string, string> = {
    PRE_MOLDADO: `<p>Olá, tudo bem?</p><p>Meu nome é João e faço parte do <strong>Grupo Villa Empreendimentos</strong>.</p><p>Estamos renovando parte da nossa frota e disponibilizando caminhões seminovos.</p>`,
    OBRA: `<p>Olá, ${saudacao}!</p><p>Meu nome é João e sou do time comercial da <strong>Villa Empreendimentos</strong>.</p><p>Identificamos que a <strong>${d.empresa}</strong> tem projetos${cidade} onde podemos contribuir.</p>`,
    GENERICO: `<p>Olá, ${saudacao}!</p><p>Meu nome é João e faço parte do time comercial da <strong>Villa Empreendimentos</strong>.</p>`,
  };

  return `<!doctype html><html><body>${corpos[tipo] || corpos.GENERICO}</body></html>`;
}

async function enviarEmailBrevo(destinatario: Dest, subject: string, htmlContent: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, status: 500, body: "BREVO_API_KEY não configurada." };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { name: "João — Villa Empreendimentos", email: "joao.comercial@villaempreendimentos.com.br" },
        to: [{ email: destinatario.email, name: destinatario.nome }],
        replyTo: { email: "joao.comercial@villaempreendimentos.com.br", name: "João — Villa Empreendimentos" },
        subject,
        htmlContent,
      }),
    });

    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, body: text };
  } catch (err) {
    return { ok: false, status: 500, body: String(err) };
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const payload = await req.json().catch(() => null);
  if (!payload || !Array.isArray(payload.destinatarios)) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { tipo, destinatarios, equipamentoDestaque } = payload as { tipo: string; destinatarios: Dest[]; equipamentoDestaque?: string };

  const agentKey = process.env.AGENT_API_KEY;
  if (!agentKey) return NextResponse.json({ error: "AGENT_API_KEY não configurada." }, { status: 500 });

  try {
    const agentUrl = `${process.env.NEXTAUTH_URL ?? ""}/api/agent/campanha-email`;
    const r = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentKey}`,
      },
      body: JSON.stringify({ tipo, destinatarios, equipamentoDestaque }),
    });

    const text = await r.text().catch(() => "");
    let parsed: any = {};
    try {
      parsed = JSON.parse(text || "{}");
    } catch (e) {
      console.error('[campanhas/dispatch] resposta inválida do agent:', text);
      return NextResponse.json({ error: 'Resposta inválida do serviço de envio.' }, { status: 502 });
    }

    const resultados = Array.isArray(parsed.resultados) ? parsed.resultados : parsed.resultados || parsed.result || [];

    const stream = new ReadableStream({
      start(controller) {
        for (const resItem of resultados) {
          const line = JSON.stringify(resItem) + "\n";
          controller.enqueue(new TextEncoder().encode(line));
        }
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ finished: true }) + "\n"));
        controller.close();
      },
    });

    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
  } catch (err) {
    console.error('[campanhas/dispatch] erro ao chamar agent:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
