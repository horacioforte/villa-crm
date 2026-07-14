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

  const stream = new ReadableStream({
    async start(controller) {
      for (const d of destinatarios) {
        const subject = gerarSubject(tipo, d, equipamentoDestaque);
        const html = gerarHtmlEmail(tipo, d, equipamentoDestaque);

        // small delay to avoid aggressive bursts
        await new Promise((r) => setTimeout(r, 250));

        const res = await enviarEmailBrevo(d, subject, html);
        const payloadLine = JSON.stringify({ email: d.email, empresa: d.empresa, status: res.ok ? 'enviado' : 'erro', detalhe: res.ok ? undefined : res.body });
        controller.enqueue(new TextEncoder().encode(payloadLine + "\n"));
      }

      // End marker
      controller.enqueue(new TextEncoder().encode(JSON.stringify({ finished: true }) + "\n"));
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
