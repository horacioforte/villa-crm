// ARQUIVO: app/api/mensagens/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Envia mensagem via Evolution API e salva no banco.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

function getEvolutionToken(instanceName: string): string {
  if (instanceName.startsWith("joao")) {
    return process.env.JOAO_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  }
  if (instanceName.startsWith("morgana")) {
    return process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  }
  if (instanceName.startsWith("taciane")) {
    return process.env.TACIANE_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  }
  return process.env.EVOLUTION_API_KEY ?? "";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { conversaId, conteudo } = await req.json().catch(() => ({}));
  if (!conversaId || !conteudo) {
    return NextResponse.json({ error: "conversaId e conteudo são obrigatórios." }, { status: 400 });
  }

  const conversa = await prisma.conversa.findUnique({ where: { id: conversaId } });
  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const telefone = conversa.telefone;
  if (!telefone) {
    return NextResponse.json({ error: "Conversa sem telefone de destino." }, { status: 400 });
  }

  // Envia via Evolution API
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const token = getEvolutionToken(conversa.instanceName);

  let waMessageId: string | undefined;

  try {
    const resp = await fetch(
      `${apiUrl}/message/sendText/${conversa.instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
        body: JSON.stringify({
          number: telefone,
          text: conteudo,
        }),
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      waMessageId = data?.key?.id;
    }
  } catch (err) {
    console.error("[api/mensagens] Erro ao enviar via Evolution API:", err);
    // Continua para salvar no banco mesmo se a API falhar
  }

  // Salva no banco
  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId,
      conteudo,
      direcao: "SAIDA",
      autor: "HUMANO",
      autorUsuarioId: user.id,
      waMessageId,
      status: waMessageId ? "ENVIADA" : "ERRO",
    },
  });

  // Atualiza conversa
  await prisma.conversa.update({
    where: { id: conversaId },
    data: {
      ultimaMensagemEm: new Date(),
      atendidoPorId: user.id,
    },
  });

  return NextResponse.json(mensagem);
}
