// ARQUIVO: app/api/conversas/alertas/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Task #11 — fila unificada de alertas do Ciclo de Atendimento. Camada de composição
// para alimentar futuramente Supervisão, Saúde Comercial, notificações e o CRM IA — esta
// sprint entrega o endpoint e a primeira evolução visual da Supervisão (coluna "Precisa
// de ação" em SupervisaoBoard.tsx).
//
// Não define nenhuma regra de SLA nova — reaproveita obrigatoriamente:
//   - calcularAguardandoRespostaDesde() (@/lib/conversas/aguardando-resposta) — mesmo
//     cálculo (2 groupBy) já usado em GET /api/conversas;
//   - getPrioridadeAguardando() (@/lib/conversas/prioridade), via classificarConversa —
//     Atenção (30min-4h) e Urgente (>4h);
//   - getVirtualStatus() (@/lib/tarefas/service) — tarefa WHATSAPP vencida (status ativo +
//     dataVencimento antes de hoje).
//
// Escopo: TODOS os canais. CanalWhatsapp.agenteIA distingue canal de IA (Maria, João —
// agenteIA != null) de canal humano (Taciane, Morgana e futuros — agenteIA == null); não
// há lista fixa de nomes de agente neste arquivo.
//
// Universo de conversas: ABERTA e PENDENTE (mesmo escopo já usado hoje pela Supervisão em
// components/conversas/SupervisaoBoard.tsx) — filtrado ANTES dos groupBy de Mensagem, para
// não varrer o histórico inteiro. Tarefas: pré-filtradas no banco pelos mesmos valores de
// status ativos + dataVencimento < hoje, e revalidadas com getVirtualStatus().
//
// Dados de contexto do card (empresa, oportunidade/valor, responsável, última mensagem):
// vêm de relações que o Prisma já resolve na mesma consulta de Conversa (nenhuma query
// extra por conversa, nenhuma API nova) — só ficam disponíveis quando a conversa já tem
// esse vínculo; caso contrário chegam como null e o frontend simplesmente omite o campo.
//
// Auth: mesmo padrão de todo /api/conversas/* hoje — getCurrentUser (autenticado, sem
// RBAC por papel). Nenhuma política nova de permissão introduzida aqui.
//
// Fora de escopo nesta sprint (ver auditoria da Task #11): "pediu_humano" e "ia_pausada"
// não são calculados — Conversa.iaPausada / atendimentoHumanoAtivo não têm hoje fluxo de
// escrita real em nenhuma rota, webhook ou automação. Pendência para sprint futura.

import { NextResponse } from "next/server";
import { startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { calcularAguardandoRespostaDesde } from "@/lib/conversas/aguardando-resposta";
import { getVirtualStatus } from "@/lib/tarefas/service";
import {
  montarFilaDeAlertas,
  type ConversaParaAlerta,
  type TarefaVencidaParaAlerta,
} from "@/lib/conversas/alertas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const conversas = await prisma.conversa.findMany({
    where: { status: { in: ["ABERTA", "PENDENTE"] } },
    select: {
      id: true,
      nomeContato: true,
      telefone: true,
      instanceName: true,
      atendidoPorId: true,
      tarefaAtualId: true,
      ultimaMensagemEm: true,
      canalWhatsapp: { select: { agenteIA: true } },
      atendidoPor: { select: { nome: true } },
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      oportunidade: { select: { id: true, titulo: true, valorContrato: true } },
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { conteudo: true, direcao: true, createdAt: true },
      },
    },
  });

  const conversaIds = conversas.map((c) => c.id);

  const [ultimasDoCliente, ultimasRespostasHumanas, candidatasVencidas] = await Promise.all([
    conversaIds.length
      ? prisma.mensagem.groupBy({
          by: ["conversaId"],
          where: { conversaId: { in: conversaIds }, direcao: "ENTRADA" },
          _max: { createdAt: true },
        })
      : Promise.resolve([]),
    conversaIds.length
      ? prisma.mensagem.groupBy({
          by: ["conversaId"],
          where: { conversaId: { in: conversaIds }, direcao: "SAIDA", autor: "HUMANO" },
          _max: { createdAt: true },
        })
      : Promise.resolve([]),
    // Pré-filtro no banco com os mesmos valores usados por getVirtualStatus/statusAtivos
    // (lib/tarefas/service.ts) — evita trazer tarefas que não têm chance de estar vencidas.
    prisma.tarefa.findMany({
      where: {
        tipo: "WHATSAPP",
        status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
        dataVencimento: { lt: startOfDay(new Date()) },
      },
      select: { id: true, titulo: true, dataVencimento: true, status: true, responsavelId: true },
    }),
  ]);

  // Revalida com a função canônica em vez de confiar só no filtro acima — reaplica a
  // mesma regra de "vencida" já usada no resto do CRM, nunca reimplementa.
  const tarefasVencidas: TarefaVencidaParaAlerta[] = candidatasVencidas
    .filter((t) => getVirtualStatus(t) === "ATRASADA")
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      dataVencimento: t.dataVencimento.toISOString(),
      responsavelId: t.responsavelId,
    }));

  const mapaUltimaCliente = new Map(ultimasDoCliente.map((r) => [r.conversaId, r._max.createdAt]));
  const mapaUltimaHumana = new Map(ultimasRespostasHumanas.map((r) => [r.conversaId, r._max.createdAt]));

  const conversasParaAlerta: ConversaParaAlerta[] = conversas.map((c) => ({
    id: c.id,
    nomeContato: c.nomeContato,
    telefone: c.telefone,
    instanceName: c.instanceName,
    // agenteIA != null -> canal de IA (Maria, João, ...); agenteIA == null -> canal
    // humano (Taciane, Morgana, ...); sem CanalWhatsapp vinculado -> DESCONHECIDO
    // (conversas legadas). Nunca hardcoded por nome de agente.
    canalTipo: c.canalWhatsapp ? (c.canalWhatsapp.agenteIA ? "IA" : "HUMANO") : "DESCONHECIDO",
    atendidoPorId: c.atendidoPorId,
    atendidoPorNome: c.atendidoPor?.nome ?? null,
    tarefaAtualId: c.tarefaAtualId,
    ultimaMensagemEm: c.ultimaMensagemEm ? c.ultimaMensagemEm.toISOString() : null,
    aguardandoRespostaDesde: calcularAguardandoRespostaDesde(
      mapaUltimaCliente.get(c.id) ?? null,
      mapaUltimaHumana.get(c.id) ?? null,
    ),
    empresaNome: c.empresa?.razaoSocial ?? c.empresa?.nomeFantasia ?? null,
    oportunidade: c.oportunidade
      ? {
          id: c.oportunidade.id,
          titulo: c.oportunidade.titulo,
          valor: c.oportunidade.valorContrato ? Number(c.oportunidade.valorContrato) : null,
        }
      : null,
    ultimaMensagem: c.mensagens[0]
      ? {
          conteudo: c.mensagens[0].conteudo,
          direcao: c.mensagens[0].direcao,
          createdAt: c.mensagens[0].createdAt.toISOString(),
        }
      : null,
  }));

  const fila = montarFilaDeAlertas({ conversas: conversasParaAlerta, tarefasVencidas });

  return NextResponse.json(fila);
}
