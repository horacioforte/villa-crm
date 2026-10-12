// ARQUIVO: app/api/base-nacional/robo/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Executa UM LOTE do robô gratuito para um estado (somente ADMIN), direto pela tela — sem terminal.
// Trava: só roda quando o banco configurado é o branch isolado autorizado (nunca produção).
// Não usa API paga, Google, Maps, redes sociais nem Claude. Não agenda nada (sem cron).

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { endpointNeon } from "@/lib/base-nacional/ambiente";
import { executarRobo } from "@/lib/base-nacional/robo/executar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export async function POST(req: Request) {
  const usuario = await getCurrentUser();
  if (!usuario) return NextResponse.json({ ok: false, erros: ["Faça login novamente."] }, { status: 401 });
  if (usuario.papel !== "ADMIN") return NextResponse.json({ ok: false, erros: ["Somente administradores executam o robô."] }, { status: 403 });
  if (endpointNeon(process.env.DATABASE_URL ?? "") !== ENDPOINT_AUTORIZADO) {
    return NextResponse.json({ ok: false, erros: ["Bloqueado: o robô só roda no branch de testes autorizado."] }, { status: 423 });
  }
  const corpo = (await req.json().catch(() => ({}))) as { uf?: string; limite?: number };
  const uf = (corpo.uf ?? "").toUpperCase();
  if (!UFS.includes(uf)) return NextResponse.json({ ok: false, erros: ["Escolha um estado."] }, { status: 400 });
  // Nesta etapa só Pernambuco está autorizado (teste). Brasil depende de autorização do Horácio.
  if (uf !== "PE" && process.env.BASE_NACIONAL_ROBO_UFS?.split(",").map(s => s.trim().toUpperCase()).includes(uf) !== true) {
    return NextResponse.json({ ok: false, erros: [`O robô ainda não está liberado para ${uf}. Nesta etapa só Pernambuco.`] }, { status: 403 });
  }
  const limite = Math.min(Math.max(Number(corpo.limite) || 25, 1), 100);
  try {
    const r = await executarRobo({ db: prisma, uf, limite });
    return NextResponse.json({ ok: true, resumo: { ...r, itens: r.itens.slice(0, 100) } });
  } catch (e) {
    console.error("[base-nacional] robô falhou", e instanceof Error ? e.message.slice(0, 300) : e);
    return NextResponse.json({ ok: false, erros: ["O robô parou com erro. O que já foi gravado continua salvo; rode de novo para continuar."] }, { status: 500 });
  }
}
