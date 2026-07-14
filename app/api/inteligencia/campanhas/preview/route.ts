import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

type Dest = { nome: string; email: string; empresa: string; cidade?: string; estado?: string; cargo?: string };

function gerarSubject(tipo: string, d: Dest) {
  if (tipo === "PRE_MOLDADO") return `Caminhões betoneira e autobomba seminovos disponíveis`;
  if (tipo === "OBRA") return `Solução em bombeamento de concreto para ${d.empresa} — Villa Empreendimentos`;
  return `Villa Empreendimentos — Soluções em bombeamento de concreto`;
}

function gerarHtmlEmail(tipo: string, d: Dest) {
  const saudacao = d.cargo ? `${d.cargo} ${d.nome.split(" ")[0]}` : d.nome.split(" ")[0];
  const cidade = d.cidade && d.estado ? ` em ${d.cidade}/${d.estado}` : "";

  const corpos: Record<string, string> = {
    PRE_MOLDADO: `<p>Olá, tudo bem?</p><p>Meu nome é João e faço parte do <strong>Grupo Villa Empreendimentos</strong>.</p><p>Estamos renovando parte da nossa frota e disponibilizando caminhões seminovos.</p>`,
    OBRA: `<p>Olá, ${saudacao}!</p><p>Identificamos que a <strong>${d.empresa}</strong> tem projetos${cidade} onde podemos contribuir.</p>`,
    GENERICO: `<p>Olá, ${saudacao}!</p><p>Meu nome é João e faço parte do time comercial da <strong>Villa Empreendimentos</strong>.</p>`,
  };

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;">${corpos[tipo] || corpos.GENERICO}</body></html>`;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const payload = await req.json().catch(() => null);
  if (!payload || !payload.destinatario) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

  const { tipo, destinatario } = payload as { tipo: string; destinatario: Dest };
  const subject = gerarSubject(tipo, destinatario);
  const html = gerarHtmlEmail(tipo, destinatario);

  return NextResponse.json({ subject, html }, { status: 200 });
}
