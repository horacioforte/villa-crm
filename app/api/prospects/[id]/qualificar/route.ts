// ARQUIVO: app/api/prospects/[id]/qualificar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Única forma de criar oportunidade a partir de um prospect do João.
// Requer ação manual do comercial — NUNCA chamado automaticamente pela IA.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      empresa: true,
      pessoa: true,
    },
  });

  if (!prospect) return NextResponse.json({ error: "Prospect não encontrado." }, { status: 404 });

  if (prospect.status === "OPORTUNIDADE_CRIADA") {
    return NextResponse.json({ error: "Oportunidade já criada para este prospect." }, { status: 400 });
  }

  // Garante empresa no CRM (cria se não existir)
  let empresaId = prospect.empresaId;
  if (!empresaId) {
    const empresa = await prisma.empresa.create({
      data: {
        razaoSocial: prospect.nomeContato ?? "Prospect WhatsApp",
        telefone: prospect.telefone ?? null,
        segmento: "Lead João",
        observacoes: `Prospect criado via prospecção ativa do João.\nOrigem: ${prospect.origem ?? "manual"}${prospect.origemDetalhe ? ` — ${prospect.origemDetalhe}` : ""}`,
        ativa: true,
      },
    });
    empresaId = empresa.id;
    await prisma.prospect.update({ where: { id }, data: { empresaId } });
  }

  // Cria oportunidade
  const oportunidade = await prisma.oportunidade.create({
    data: {
      titulo: `João — ${prospect.nomeContato ?? prospect.telefone ?? "Prospect"}`,
      descricao: `Lead qualificado pelo comercial via prospecção ativa do João.\nTelefone: ${prospect.telefone ?? "—"}\nOrigem: ${prospect.origem ?? "manual"}`,
      tipo: "LOCACAO",
      status: "NOVA",
      canalOrigem: "OUTROS",
      empresaId,
      pessoaId: prospect.pessoaId ?? null,
      ativa: true,
    },
  });

  // Atualiza prospect: vincula oportunidade e muda status
  await prisma.prospect.update({
    where: { id },
    data: {
      status: "OPORTUNIDADE_CRIADA",
      oportunidadeId: oportunidade.id,
      updatedAt: new Date(),
    },
  });

  // Registra interação de qualificação manual
  await prisma.prospectInteracao.create({
    data: {
      prospectId: id,
      tipo: "QUALIFICADO_MANUAL",
      canal: "WHATSAPP",
      conteudo: `Qualificado manualmente por ${user.nome ?? user.email}. Oportunidade criada: ${oportunidade.id}`,
      criadoPorIA: false,
    },
  });

  return NextResponse.json({ oportunidade, prospectId: id });
}
