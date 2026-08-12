// ARQUIVO: app/api/inteligencia/solicitacoes/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Cria dossiê marcado como "Solicitado por Horácio" via formulário direto.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  let body: {
    titulo: string;
    cidade?: string;
    estado?: string;
    segmento?: string;
    clienteFinal?: string;
    resumo?: string;
    missaoInicial?: string;
    prioridade?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "Título obrigatório." }, { status: 400 });
  }

  const nomeUsuario = authResult.nome ?? "Usuário";
  const primeiroNome = nomeUsuario.split(" ")[0];

  const dossie = await prisma.dossieComercial.create({
    data: {
      titulo:          body.titulo.trim(),
      origem:          "MANUAL",
      tipo:            "OBRA",
      status:          "INVESTIGANDO",
      segmento:        body.segmento?.trim() || null,
      cidade:          body.cidade?.trim() || null,
      estado:          body.estado?.trim().toUpperCase() || null,
      clienteFinal:    body.clienteFinal?.trim() || null,
      resumo:          body.resumo?.trim() || null,
      missaoAtual:     body.missaoInicial?.trim() ||
                       `Investigação solicitada por ${primeiroNome} — levantar decisores, contatos e potencial da obra/empresa.`,
      prioridade:      (body.prioridade as any) ?? "MEDIA",
      fonteInformacao: `Solicitado por ${primeiroNome}`,
      criadoPorAgente: primeiroNome,
      score:           0,
      completude:      0,
    },
    select: { id: true, titulo: true },
  });

  // ── Disparo automático de investigação ────────────────────────────────────
  // Fire-and-forget: não bloqueia a resposta. Investiga o dossiê imediatamente
  // com Claude + GPT-4o em paralelo, sem esperar o cron de segunda/quarta.
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://villa-crm.vercel.app";
  const apiKey  = process.env.AGENT_API_KEY ?? "";
  fetch(`${baseUrl}/api/cron/joao-investigar?dossieId=${dossie.id}`, {
    method:  "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch((err) => {
    console.warn("[solicitacoes] Disparo de investigação falhou (não crítico):", err);
  });

  return NextResponse.json({ id: dossie.id, titulo: dossie.titulo });
}
