// ARQUIVO: app/api/agent/dossie/[id]/decisor/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// João adiciona um decisor encontrado ao dossiê.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: {
    nome: string;
    cargo?: string;
    empresa?: string;
    telefone?: string;
    email?: string;
    linkedin?: string;
    confianca?: number;
    fonte?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "nome é obrigatório." }, { status: 400 });
  }

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: params.id },
    include: { decisores: { select: { nome: true, telefone: true, email: true, linkedin: true } } },
  });
  if (!dossie) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });

  // Evita duplicata pelo nome
  const jaExiste = dossie.decisores.find(
    d => d.nome?.toLowerCase() === body.nome.toLowerCase()
  );
  if (jaExiste) {
    return NextResponse.json({ sucesso: false, mensagem: "Decisor com esse nome já existe no dossiê." });
  }

  const decisor = await prisma.decisorDossie.create({
    data: {
      dossieId:  params.id,
      nome:      body.nome,
      cargo:     body.cargo     ?? null,
      empresa:   body.empresa   ?? null,
      telefone:  body.telefone  ?? null,
      email:     body.email     ?? null,
      linkedin:  body.linkedin  ?? null,
      confianca: body.confianca ?? 70,
      fonte:     body.fonte     ?? null,
    },
  });

  // Recalcula completude com o novo decisor
  const decisoresAtualizados = [
    ...dossie.decisores,
    { nome: decisor.nome, telefone: decisor.telefone, email: decisor.email, linkedin: decisor.linkedin },
  ];
  const { completude, missaoAtual } = recalcularDossie(dossie, decisoresAtualizados);

  await prisma.$transaction([
    prisma.dossieComercial.update({
      where: { id: params.id },
      data: {
        completude,
        missaoAtual,
        totalDecisores: { increment: 1 },
        ultimaAtividade: new Date(),
        ...(completude >= 80 && dossie.status === "INVESTIGANDO" ? { status: "AGUARDANDO_VALIDACAO" } : {}),
      },
    }),
    prisma.atualizacaoDossie.create({
      data: {
        dossieId: params.id,
        tipo:     "DECISOR_ENCONTRADO",
        titulo:   `Decisor encontrado: ${body.nome}`,
        conteudo: [
          `Nome: ${body.nome}`,
          body.cargo    ? `Cargo: ${body.cargo}`     : null,
          body.empresa  ? `Empresa: ${body.empresa}` : null,
          body.telefone ? `Tel: ${body.telefone}`    : null,
          body.email    ? `E-mail: ${body.email}`    : null,
          body.linkedin ? `LinkedIn: ${body.linkedin}` : null,
          body.fonte    ? `Fonte: ${body.fonte}`     : null,
        ].filter(Boolean).join("\n"),
        agente:   "joao-radar",
        fonte:    body.fonte ?? null,
      },
    }),
  ]);

  return NextResponse.json({
    sucesso:     true,
    decisorId:   decisor.id,
    completude,
    missaoAtual,
  }, { status: 201 });
}
