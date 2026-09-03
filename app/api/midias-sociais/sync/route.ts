// ARQUIVO: app/api/midias-sociais/sync/route.ts
// Central de Mídias Sociais — Sprint 2 (Instagram Analytics Real), C4.
// Ver Proposta_Tecnica_Sprint2_Instagram_Analytics.docx, itens 7 e 15.
//
// Dispara a sincronização de uma conta de rede social (hoje só Instagram).
// Dois caminhos de autenticação, mesmo padrão de
// app/api/cron/joao-investigar/route.ts:
// - Sessão de usuário ADMIN (uso manual, botão "Sincronizar agora" no cockpit).
// - CRON_SECRET / AGENT_API_KEY via header Authorization: Bearer — uso pelo
//   Vercel Cron ou teste manual via curl. Autenticação de sistema, não de
//   usuário comum.
//
// Nunca lança exceção não tratada por falha da Meta — sincronizarInstagram
// já captura isso e retorna status SUCESSO/PARCIAL/ERRO; esta rota só
// traduz esse resultado para HTTP.
//
// GET existe só para o Vercel Cron (que dispara com GET, sem corpo — mesmo
// padrão de app/api/cron/joao-investigar/route.ts e
// app/api/saude-comercial/joao/route.ts, nenhum dos dois usa POST). Sem
// corpo, cai automaticamente no caminho "sincroniza todas as contas ativas"
// abaixo. POST continua existindo para o botão manual do cockpit e para
// teste via curl com um redeSocialContaId específico no corpo.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { sincronizarInstagram } from "@/lib/instagram/sync-engine";
import { ContaInstagramInvalidaError } from "@/lib/meta/instagram-client";

export const maxDuration = 60;

function autenticadoPorSistema(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  return Boolean(
    (secret && auth === `Bearer ${secret}`) ||
      (process.env.AGENT_API_KEY && auth === `Bearer ${process.env.AGENT_API_KEY}`),
  );
}

async function handleSync(request: NextRequest) {
  if (!autenticadoPorSistema(request)) {
    const authResult = await requirePermission("midias_sociais", "create", request);
    if (authResult instanceof NextResponse) return authResult;
  }

  let redeSocialContaId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { redeSocialContaId?: unknown };
    redeSocialContaId = typeof body?.redeSocialContaId === "string" ? body.redeSocialContaId : undefined;
  } catch {
    redeSocialContaId = undefined;
  }

  if (redeSocialContaId) {
    try {
      const resultado = await sincronizarInstagram(redeSocialContaId);
      return NextResponse.json({ redeSocialContaId, ...resultado });
    } catch (err) {
      if (err instanceof ContaInstagramInvalidaError) {
        return NextResponse.json({ message: err.message }, { status: 404 });
      }
      console.error("Erro inesperado ao sincronizar Instagram:", err);
      return NextResponse.json({ message: "Erro inesperado ao sincronizar." }, { status: 500 });
    }
  }

  // Sem id explícito: sincroniza toda conta Instagram ativa cadastrada
  // (uso típico do cron — não precisa saber o id de antemão).
  const contas = await prisma.redeSocialConta.findMany({
    where: { rede: "INSTAGRAM", ativo: true },
    select: { id: true },
  });

  if (contas.length === 0) {
    return NextResponse.json({ message: "Nenhuma conta Instagram ativa cadastrada." }, { status: 404 });
  }

  const resultados = [];
  for (const conta of contas) {
    try {
      const resultado = await sincronizarInstagram(conta.id);
      resultados.push({ redeSocialContaId: conta.id, ...resultado });
    } catch (err) {
      resultados.push({
        redeSocialContaId: conta.id,
        status: "ERRO" as const,
        erro: err instanceof Error ? err.message : "Erro desconhecido.",
      });
    }
  }

  return NextResponse.json({ resultados });
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

// Vercel Cron só dispara GET.
export const GET = handleSync;
