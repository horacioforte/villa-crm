// ARQUIVO: app/api/admin/backfill-contatos/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Retroativamente vincula Pessoa + nomeContato às conversas que ficaram sem nome
// porque foram criadas antes do fix de normalização de DDI 55.
//
// GET  → dry run: mostra quantas conversas seriam atualizadas e quais
// POST → aplica as atualizações de fato

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

function normalizarSem55(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Conversas sem nomeContato E sem pessoaId mas com telefone preenchido
  const conversas = await prisma.conversa.findMany({
    where: {
      telefone: { not: null },
      nomeContato: null,
      pessoaId: null,
    },
    select: { id: true, telefone: true, instanceName: true },
    orderBy: { ultimaMensagemEm: "desc" },
  });

  const resultado = [];
  for (const c of conversas) {
    if (!c.telefone) continue;
    const sem55 = normalizarSem55(c.telefone);
    const pessoa = await prisma.pessoa.findFirst({
      where: {
        OR: [
          { whatsapp: { contains: sem55 } },
          { telefone: { contains: sem55 } },
        ],
      },
      select: { id: true, nome: true },
    });
    if (pessoa) {
      resultado.push({
        conversaId: c.id,
        telefone: c.telefone,
        instanceName: c.instanceName,
        pessoaNome: pessoa.nome,
        pessoaId: pessoa.id,
      });
    }
  }

  return NextResponse.json({
    totalSemNome: conversas.length,
    encontrados: resultado.length,
    preview: resultado,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Lê o body — se vier { ids: [...] }, aplica só esses; senão aplica todos
  const body = await req.json().catch(() => ({}));
  const filtroIds: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;

  const conversas = await prisma.conversa.findMany({
    where: {
      telefone: { not: null },
      nomeContato: null,
      pessoaId: null,
      ...(filtroIds ? { id: { in: filtroIds } } : {}),
    },
    select: { id: true, telefone: true },
  });

  let atualizados = 0;
  const erros: { conversaId: string; motivo: string }[] = [];

  for (const c of conversas) {
    if (!c.telefone) continue;
    const sem55 = normalizarSem55(c.telefone);
    try {
      const pessoa = await prisma.pessoa.findFirst({
        where: {
          OR: [
            { whatsapp: { contains: sem55 } },
            { telefone: { contains: sem55 } },
          ],
        },
        select: { id: true, nome: true },
      });
      if (pessoa) {
        await prisma.conversa.update({
          where: { id: c.id },
          data: {
            nomeContato: pessoa.nome,
            pessoaId: pessoa.id,
          },
        });
        atualizados++;
      }
    } catch (err) {
      erros.push({ conversaId: c.id, motivo: err instanceof Error ? err.message : "Erro desconhecido" });
    }
  }

  return NextResponse.json({
    totalProcessado: conversas.length,
    atualizados,
    semMatch: conversas.length - atualizados - erros.length,
    erros,
  });
}
