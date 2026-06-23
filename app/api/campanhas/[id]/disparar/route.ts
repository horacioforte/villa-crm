// ARQUIVO: app/api/campanhas/[id]/disparar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Disparo ativo do João: envia mensagemInicial para todos os prospects
// com status PROSPECTADO da campanha. Rate limit de 2s entre envios.
// REGRA: este endpoint NUNCA cria oportunidade — apenas registra WHATSAPP_ENVIADO.
// Oportunidade só nasce via POST /api/prospects/[id]/qualificar (ação manual).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { enviarWhatsappJoao } from "@/lib/agentes/joao/crm";

// Vercel: aumenta o timeout para 5 min (plano Pro) para disparos grandes
export const maxDuration = 300;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;

  // Carrega campanha com mensagemInicial
  const campanha = await prisma.campanha.findUnique({
    where: { id },
    select: { id: true, nome: true, status: true, mensagemInicial: true, agente: true },
  });

  if (!campanha) {
    return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  }

  if (!campanha.mensagemInicial?.trim()) {
    return NextResponse.json(
      { error: "A campanha não tem mensagemInicial definida. Configure antes de disparar." },
      { status: 400 }
    );
  }

  // Só prospects PROSPECTADO (nunca reenviar para quem já foi abordado)
  const prospects = await prisma.prospect.findMany({
    where: { campanhaId: id, status: "PROSPECTADO" },
    select: { id: true, telefone: true, nomeContato: true },
    orderBy: { createdAt: "asc" },
  });

  if (prospects.length === 0) {
    return NextResponse.json({
      ok: true,
      mensagem: "Nenhum prospect com status PROSPECTADO nesta campanha.",
      enviados: 0,
      erros: 0,
      total: 0,
    });
  }

  const resultados: { prospectId: string; telefone: string; ok: boolean; erro?: string }[] = [];

  for (const prospect of prospects) {
    if (!prospect.telefone) {
      resultados.push({ prospectId: prospect.id, telefone: "—", ok: false, erro: "Sem telefone" });
      continue;
    }

    try {
      // Substitui {nome} pelo primeiro nome do contato (se disponível)
      const primeiroNome = prospect.nomeContato?.split(" ")[0] ?? "";
      const textoPersonalizado = campanha.mensagemInicial!.replace(/\{nome\}/gi, primeiroNome).trim();

      // Envia a mensagem inicial
      await enviarWhatsappJoao({ telefone: prospect.telefone, texto: textoPersonalizado });

      // Registra interação WHATSAPP_ENVIADO
      await prisma.prospectInteracao.create({
        data: {
          prospectId: prospect.id,
          tipo: "WHATSAPP_ENVIADO",
          canal: "WHATSAPP",
          conteudo: `[Disparo campanha "${campanha.nome}"] ${textoPersonalizado}`,
          instancia: campanha.agente ?? "joao-villa",
          criadoPorIA: false, // disparado manualmente pelo comercial
        },
      });

      // Atualiza status para ABORDADO
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { status: "ABORDADO", updatedAt: new Date() },
      });

      resultados.push({ prospectId: prospect.id, telefone: prospect.telefone, ok: true });
    } catch (err) {
      console.error(`[disparar] Erro ao enviar para ${prospect.telefone}:`, err);
      resultados.push({
        prospectId: prospect.id,
        telefone: prospect.telefone,
        ok: false,
        erro: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }

    // Rate limit: 2s entre envios para não levar ban no WhatsApp
    if (prospects.indexOf(prospect) < prospects.length - 1) {
      await delay(2000);
    }
  }

  const enviados = resultados.filter((r) => r.ok).length;
  const erros = resultados.filter((r) => !r.ok).length;

  return NextResponse.json({
    ok: true,
    campanha: campanha.nome,
    total: prospects.length,
    enviados,
    erros,
    resultados,
  });
}
