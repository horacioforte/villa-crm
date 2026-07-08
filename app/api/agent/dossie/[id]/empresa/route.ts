// ARQUIVO: app/api/agent/dossie/[id]/empresa/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// João adiciona empresa relacionada ao dossiê (construtora, EPC, fornecedor…).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    razaoSocial: string;
    papel: string; // CONSTRUTORA | EPC | EPCM | CONSORCIO | FORNECEDOR | CONCORRENTE | CONCRETEIRA | CLIENTE_FINAL
    cidade?: string;
    estado?: string;
    cnpj?: string;
    site?: string;
    fonte?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  if (!body.razaoSocial?.trim() || !body.papel?.trim()) {
    return NextResponse.json({ error: "razaoSocial e papel são obrigatórios." }, { status: 400 });
  }

  const papeis = ["CONSTRUTORA", "EPC", "EPCM", "CONSORCIO", "FORNECEDOR", "CONCORRENTE", "CONCRETEIRA", "CLIENTE_FINAL"];
  if (!papeis.includes(body.papel.toUpperCase())) {
    return NextResponse.json({ error: `papel inválido. Use: ${papeis.join(", ")}` }, { status: 400 });
  }

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!dossie) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });

  // Verifica duplicata
  const jaExiste = await prisma.empresaDossie.findFirst({
    where: {
      dossieId:    params.id,
      papel:       body.papel.toUpperCase(),
      razaoSocial: { equals: body.razaoSocial, mode: "insensitive" },
    },
  });
  if (jaExiste) {
    return NextResponse.json({ sucesso: false, mensagem: "Empresa com esse papel já registrada no dossiê." });
  }

  // Tenta encontrar empresa no CRM
  const empresaCRM = await prisma.empresa.findFirst({
    where: {
      OR: [
        { razaoSocial: { equals: body.razaoSocial, mode: "insensitive" } },
        body.cnpj ? { cnpj: body.cnpj } : {},
      ],
    },
    select: { id: true },
  });

  const empresaDossie = await prisma.empresaDossie.create({
    data: {
      dossieId:    params.id,
      razaoSocial: body.razaoSocial,
      papel:       body.papel.toUpperCase(),
      cidade:      body.cidade ?? null,
      estado:      body.estado ?? null,
      cnpj:        body.cnpj   ?? null,
      site:        body.site   ?? null,
      fonte:       body.fonte  ?? null,
      empresaId:   empresaCRM?.id ?? null,
    },
  });

  await prisma.$transaction([
    prisma.dossieComercial.update({
      where: { id: params.id },
      data: {
        totalEmpresas:  { increment: 1 },
        ultimaAtividade: new Date(),
      },
    }),
    prisma.atualizacaoDossie.create({
      data: {
        dossieId: params.id,
        tipo:     "EMPRESA_ENCONTRADA",
        titulo:   `${body.papel}: ${body.razaoSocial}`,
        conteudo: [
          `Razão Social: ${body.razaoSocial}`,
          `Papel: ${body.papel}`,
          body.cidade  ? `Cidade: ${body.cidade}/${body.estado}` : null,
          body.cnpj    ? `CNPJ: ${body.cnpj}`   : null,
          body.site    ? `Site: ${body.site}`    : null,
          body.fonte   ? `Fonte: ${body.fonte}`  : null,
          empresaCRM   ? `✅ Vinculada ao CRM (${empresaCRM.id})` : "⚠️ Não encontrada no CRM",
        ].filter(Boolean).join("\n"),
        agente: "joao-radar",
        fonte:  body.fonte ?? null,
      },
    }),
  ]);

  return NextResponse.json({
    sucesso:        true,
    empresaDossieId: empresaDossie.id,
    vinculadaCRM:   !!empresaCRM,
    empresaIdCRM:   empresaCRM?.id ?? null,
  }, { status: 201 });
}
