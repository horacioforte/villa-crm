// ARQUIVO: app/api/conversas/por-contato/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Retorna a conversa mais recente (não-SPAM) de uma pessoa/contato,
// junto com o telefone e nome dela — usado pelo botão "Abrir no WhatsApp"
// das tarefas para redirecionar diretamente para a conversa certa.
//
// GET ?pessoaId=xxx   → busca pela pessoa no banco
// Resposta: { conversaId, telefone, nome, encontrada: true/false }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const pessoaId = searchParams.get("pessoaId");

  if (!pessoaId) {
    return NextResponse.json({ error: "pessoaId é obrigatório." }, { status: 400 });
  }

  // Busca dados da pessoa (nome + telefone)
  const pessoa = await prisma.pessoa.findUnique({
    where: { id: pessoaId },
    select: { id: true, nome: true, whatsapp: true, telefone: true },
  });

  if (!pessoa) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  const telRaw = pessoa.whatsapp ?? pessoa.telefone ?? null;

  // Normaliza telefone (garante DDI 55)
  function normalizarTel(raw: string): string {
    const d = raw.replace(/\D/g, "");
    return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
  }

  const telSem55 = telRaw
    ? telRaw.replace(/\D/g, "").replace(/^55/, "").slice(0, 11)
    : null;

  // Busca conversa mais recente para essa pessoa (por pessoaId ou telefone)
  const conversa = await prisma.conversa.findFirst({
    where: {
      status: { not: "SPAM" },
      OR: [
        ...(pessoaId ? [{ pessoaId }] : []),
        ...(telSem55 ? [{ telefone: { contains: telSem55 } }] : []),
      ],
    },
    orderBy: { ultimaMensagemEm: "desc" },
    select: { id: true, instanceName: true, telefone: true, nomeContato: true },
  });

  return NextResponse.json({
    encontrada: Boolean(conversa),
    conversaId: conversa?.id ?? null,
    instanceName: conversa?.instanceName ?? null,
    telefone: conversa?.telefone ?? (telRaw ? normalizarTel(telRaw) : null),
    nome: pessoa.nome,
    pessoaId: pessoa.id,
  });
}
