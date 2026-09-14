// ARQUIVO: app/api/conversas/[id]/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Retorna uma conversa com todas as mensagens para exibição no CRM.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { calcularAguardandoRespostaDesdeMensagens } from "@/lib/conversas/aguardando-resposta";

export async function GET(
  _req: NextRequest,
  context: any
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;

  const conversa = await prisma.conversa.findUnique({
    where: { id },
    include: {
      mensagens: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          conteudo: true,
          direcao: true,
          autor: true,
          createdAt: true,
          // ACRESCENTADO — necessário para o Workspace exibir mídia recebida/enviada
          // e sinalizar mensagens que falharam no envio (ver diagnóstico de status ERRO).
          status: true,
          mediaUrl: true,
          mimeType: true,
          messageType: true,
          errorMessage: true,
        },
      },
      atendidoPor: { select: { nome: true } },
      // ACRESCENTADO — tarefa "atual" vinculada a esta conversa (ver botao "Abrir no
      // WhatsApp" das tarefas). So exibida/usada pelo Workspace para oferecer o atalho
      // de concluir a tarefa sem sair da Central de Atendimento.
      tarefaAtual: {
        select: {
          id: true,
          titulo: true,
          tipo: true,
          status: true,
          oportunidadeId: true,
          empresaId: true,
          pessoaId: true,
          obraId: true,
          responsavelId: true,
        },
      },
      pessoa: { select: { id: true, nome: true, telefone: true, cargo: true } },
      empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      oportunidade: {
        select: {
          id: true,
          titulo: true,
          status: true,
          potencialOportunidade: true,
          valorContrato: true,
          probabilidade: true,
          tarefas: {
            orderBy: { dataVencimento: "asc" },
            take: 5,
            select: {
              id: true,
              titulo: true,
              status: true,
              prioridade: true,
              dataVencimento: true,
            },
          },
          propostas: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              numeroProposta: true,
              status: true,
            },
          },
          historicos: {
            orderBy: { dataContato: "desc" },
            take: 5,
            select: {
              id: true,
              resumo: true,
              tipo: true,
              dataContato: true,
            },
          },
        },
      },
    },
  });

  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });

  // Ciclo de Atendimento — calculado a partir das mensagens já carregadas acima
  // (não persistido, ver lib/conversas/aguardando-resposta.ts).
  const aguardandoRespostaDesde = calcularAguardandoRespostaDesdeMensagens(conversa.mensagens);

  return NextResponse.json({ ...conversa, aguardandoRespostaDesde });
}


// ACRESCENTADO — usado pelo botao "Abrir no WhatsApp" das tarefas para vincular a
// conversa (existente) a tarefa de origem, sem alterar nada mais na conversa. Quando a
// conversa e nova, esse vinculo ja e feito na criacao (ver /api/conversas/nova).
export async function PATCH(req: NextRequest, context: any) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const { tarefaAtualId } = body as { tarefaAtualId?: string };

  if (!tarefaAtualId) {
    return NextResponse.json({ error: "tarefaAtualId é obrigatório." }, { status: 400 });
  }

  const conversa = await prisma.conversa.update({
    where: { id },
    data: { tarefaAtualId },
    select: { id: true, tarefaAtualId: true },
  });

  return NextResponse.json(conversa);
}
