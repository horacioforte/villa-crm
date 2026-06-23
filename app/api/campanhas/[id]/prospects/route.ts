// ARQUIVO: app/api/campanhas/[id]/prospects/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Importa lista de prospects em bulk para uma campanha.
// Recebe array de { telefone, nomeContato? } e cria Prospects com status PROSPECTADO.
// Ignora números já cadastrados nesta campanha (idempotente).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

type ProspectInput = {
  telefone: string;
  nomeContato?: string;
  email?: string;
  origem?: string;
};

function normalizarTelefone(raw: string): string {
  // Remove tudo exceto dígitos e "+"
  const num = raw.replace(/[^\d+]/g, "");
  // Garante "+" no início se for número internacional sem ele
  if (!num.startsWith("+") && num.length >= 10) return `+${num}`;
  return num;
}

export async function POST(
  req: NextRequest,
  context: any
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;

  const campanha = await prisma.campanha.findUnique({
    where: { id },
    select: { id: true, nome: true, agente: true },
  });

  if (!campanha) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { prospects: lista } = body as { prospects?: ProspectInput[] };

  if (!Array.isArray(lista) || lista.length === 0) {
    return NextResponse.json({ error: "Envie um array 'prospects' com ao menos um item." }, { status: 400 });
  }

  // Normaliza e remove duplicatas dentro do próprio payload
  const vistos = new Set<string>();
  const normalizados: ProspectInput[] = [];
  for (const item of lista) {
    if (!item.telefone) continue;
    const tel = normalizarTelefone(item.telefone);
    if (!tel || vistos.has(tel)) continue;
    vistos.add(tel);
    normalizados.push({ ...item, telefone: tel });
  }

  if (normalizados.length === 0) {
    return NextResponse.json({ error: "Nenhum número válido encontrado no payload." }, { status: 400 });
  }

  // Descobre quais já existem nesta campanha para não duplicar
  const telefones = normalizados.map((p) => p.telefone);
  const existentes = await prisma.prospect.findMany({
    where: { campanhaId: id, telefone: { in: telefones } },
    select: { telefone: true },
  });
  const telefonesExistentes = new Set(existentes.map((e) => e.telefone));

  const novos = normalizados.filter((p) => !telefonesExistentes.has(p.telefone));

  if (novos.length === 0) {
    return NextResponse.json({
      ok: true,
      criados: 0,
      ignorados: normalizados.length,
      mensagem: "Todos os números já estavam cadastrados nesta campanha.",
    });
  }

  // Cria em batch
  await prisma.prospect.createMany({
    data: novos.map((p) => ({
      agente: campanha.agente ?? "joao-villa",
      status: "PROSPECTADO",
      telefone: p.telefone,
      nomeContato: p.nomeContato ?? null,
      email: p.email ?? null,
      origem: p.origem ?? "importacao",
      campanhaId: id,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    ok: true,
    criados: novos.length,
    ignorados: normalizados.length - novos.length,
    total: normalizados.length,
  }, { status: 201 });
}
