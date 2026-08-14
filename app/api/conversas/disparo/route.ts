// ARQUIVO: app/api/conversas/disparo/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Disparo em massa: busca todos os leads de um tipo (aguardando-resposta ou
// conversas-ativas) e envia a mesma mensagem a cada um via Maria (maria-villa).
// Retorna { enviados, erros } com detalhe por lead.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { type StatusOportunidade } from "@/app/generated/prisma/client";

const INSTANCE_NAME = "maria-villa";

function normalizarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

async function enviarMensagem(
  telefone: string,
  mensagem: string,
  apiUrl: string,
  apiKey: string
): Promise<string | null> {
  try {
    const resp = await fetch(`${apiUrl}/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: telefone, text: mensagem }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return (data?.key?.id as string) ?? "ok";
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { tipo, mensagem } = body as { tipo?: string; mensagem?: string };

  if (!mensagem?.trim()) {
    return NextResponse.json({ error: "mensagem é obrigatória." }, { status: 400 });
  }

  const baseWhere = {
    status: { in: ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO"] as StatusOportunidade[] },
  };

  // Busca leads conforme o tipo
  const leads = await prisma.oportunidade.findMany({
    where: baseWhere,
    select: {
      id: true,
      pessoaId: true,
      pessoa: { select: { nome: true, whatsapp: true, telefone: true } },
      empresa: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
    },
    orderBy: { createdAt: "desc" },
    // Sem filtro adicional de tipo — busca todos os ativos (ambas as seções)
    // Filtro por tipo passado pelo frontend:
    ...((tipo === "aguardando-resposta" || tipo === "conversas-ativas" || !tipo) ? {} : {}),
  });

  // Pega canal Maria
  const canal = await prisma.canalWhatsapp.findUnique({
    where: { instanceName: INSTANCE_NAME },
    select: { id: true },
  });

  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "") ?? "";
  const apiKey = process.env.EVOLUTION_API_KEY ?? "";

  const enviados: { nome: string; telefone: string }[] = [];
  const erros: { nome: string; telefone: string; motivo: string }[] = [];
  const semTelefone: { nome: string }[] = [];

  for (const lead of leads) {
    const telRaw = lead.pessoa?.whatsapp ?? lead.pessoa?.telefone;
    if (!telRaw) {
      semTelefone.push({ nome: lead.pessoa?.nome ?? "—" });
      continue;
    }
    const telFull = normalizarTelefone(telRaw);
    const telSem55 = telFull.slice(2);

    // Busca ou cria conversa
    let conversa = await prisma.conversa.findFirst({
      where: {
        instanceName: INSTANCE_NAME,
        status: { not: "SPAM" },
        OR: [
          { telefone: { contains: telSem55 } },
          { telefone: { contains: telFull } },
        ],
      },
      orderBy: { ultimaMensagemEm: "desc" },
      select: { id: true },
    });

    if (!conversa) {
      conversa = await prisma.conversa.create({
        data: {
          instanceName: INSTANCE_NAME,
          telefone: telFull,
          nomeContato: lead.pessoa?.nome ?? null,
          canalWhatsappId: canal?.id ?? null,
          oportunidadeId: lead.id,
          pessoaId: lead.pessoaId ?? null,
          atendidoPorId: user.id,
          ultimaMensagemEm: new Date(),
        },
        select: { id: true },
      });
    }

    const waId = await enviarMensagem(telFull, mensagem, apiUrl, apiKey);

    await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        conteudo: mensagem,
        direcao: "SAIDA",
        autor: "HUMANO",
        autorUsuarioId: user.id,
        waMessageId: waId ?? undefined,
        status: waId ? "ENVIADA" : "ERRO",
        canalWhatsappId: canal?.id ?? null,
      },
    });

    await prisma.conversa.update({
      where: { id: conversa.id },
      data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
    });

    if (waId) {
      enviados.push({ nome: lead.pessoa?.nome ?? "—", telefone: telFull });
    } else {
      erros.push({ nome: lead.pessoa?.nome ?? "—", telefone: telFull, motivo: "Evolution API não confirmou envio" });
    }

    // Pequeno delay entre envios para não travar o WhatsApp
    await new Promise((r) => setTimeout(r, 800));
  }

  return NextResponse.json({ enviados, erros, semTelefone, total: leads.length });
}
