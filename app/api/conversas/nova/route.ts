// ARQUIVO: app/api/conversas/nova/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Inicia uma conversa nova via CRM, sem precisar que o cliente tenha mandado
// mensagem antes. Usa sempre a instância maria-villa pelo Evolution API.
// Cria a Conversa + a Mensagem no banco e devolve { conversaId }.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

const INSTANCE_NAME = "maria-villa";

function normalizarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  // Garante que tenha DDI 55 para envio via WhatsApp
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { telefone, mensagem, nomeContato, oportunidadeId, pessoaId } = body as {
    telefone?: string;
    mensagem?: string;
    nomeContato?: string;
    oportunidadeId?: string;
    pessoaId?: string;
  };

  if (!telefone || !mensagem) {
    return NextResponse.json({ error: "telefone e mensagem são obrigatórios." }, { status: 400 });
  }

  const telFull = normalizarTelefone(telefone); // ex: "5585991984127"
  const telSem55 = telFull.slice(2);             // ex: "85991984127"

  // Busca canal WhatsApp da Maria
  const canal = await prisma.canalWhatsapp.findUnique({
    where: { instanceName: INSTANCE_NAME },
    select: { id: true },
  });

  // Reutiliza conversa existente (qualquer status exceto SPAM) para não criar duplicata
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
    select: { id: true, telefone: true },
  });

  if (!conversa) {
    conversa = await prisma.conversa.create({
      data: {
        instanceName: INSTANCE_NAME,
        telefone: telFull,
        nomeContato: nomeContato ?? null,
        canalWhatsappId: canal?.id ?? null,
        oportunidadeId: oportunidadeId ?? null,
        pessoaId: pessoaId ?? null,
        atendidoPorId: user.id,
        ultimaMensagemEm: new Date(),
      },
      select: { id: true, telefone: true },
    });
  }

  // Envia pelo Evolution API
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY ?? "";
  let waMessageId: string | undefined;

  try {
    const resp = await fetch(`${apiUrl}/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: telFull, text: mensagem }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      waMessageId = data?.key?.id as string | undefined;
    } else {
      const errText = await resp.text().catch(() => "");
      console.error("[api/conversas/nova] Evolution API error", resp.status, errText);
    }
  } catch (err) {
    console.error("[api/conversas/nova] Erro ao chamar Evolution API", err);
  }

  // Salva mensagem no banco
  await prisma.mensagem.create({
    data: {
      conversaId: conversa.id,
      conteudo: mensagem,
      direcao: "SAIDA",
      autor: "HUMANO",
      autorUsuarioId: user.id,
      waMessageId,
      status: waMessageId ? "ENVIADA" : "ERRO",
      canalWhatsappId: canal?.id ?? null,
    },
  });

  // Atualiza última mensagem + atendente
  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
  });

  return NextResponse.json({ conversaId: conversa.id });
}
