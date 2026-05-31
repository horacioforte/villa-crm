import { addBusinessDays, addDays } from "date-fns";

import type {
  PrioridadeTarefa,
  TipoAtividade,
} from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export type GatilhoTarefaAutomatica =
  | "PROPOSTA_ENVIADA"
  | "PROPOSTA_APROVADA"
  | "PROPOSTA_ACEITA"
  | "CONTRATO_ASSINADO"
  | "OPORTUNIDADE_GANHA";

const gatilhos: Record<
  GatilhoTarefaAutomatica,
  {
    titulo: string;
    tipo: TipoAtividade;
    prioridade: PrioridadeTarefa;
    prazo: (date: Date) => Date;
  }
> = {
  PROPOSTA_ENVIADA: {
    titulo: "Ligar para cliente - acompanhar proposta",
    tipo: "LIGACAO",
    prioridade: "ALTA",
    prazo: (date) => addBusinessDays(date, 2),
  },
  PROPOSTA_APROVADA: {
    titulo: "Iniciar elaboracao de contrato",
    tipo: "CONTRATO",
    prioridade: "ALTA",
    prazo: (date) => addDays(date, 1),
  },
  PROPOSTA_ACEITA: {
    titulo: "Agendar mobilizacao do equipamento",
    tipo: "LOGISTICA",
    prioridade: "URGENTE",
    prazo: (date) => addDays(date, 1),
  },
  CONTRATO_ASSINADO: {
    titulo: "Agendar mobilizacao do equipamento",
    tipo: "LOGISTICA",
    prioridade: "URGENTE",
    prazo: (date) => addDays(date, 1),
  },
  OPORTUNIDADE_GANHA: {
    titulo: "Visita pos-venda - confirmar entrega",
    tipo: "POS_VENDA",
    prioridade: "MEDIA",
    prazo: (date) => addDays(date, 7),
  },
};

export async function criarTarefaAutomatica(
  gatilho: GatilhoTarefaAutomatica,
  oportunidadeId: string,
  responsavelId: string | null,
  userId: string,
) {
  const config = gatilhos[gatilho];
  const oportunidade = await prisma.oportunidade.findUnique({
    where: {
      id: oportunidadeId,
    },
    select: {
      id: true,
      empresaId: true,
      pessoaId: true,
      obraId: true,
      responsavelId: true,
    },
  });

  if (!oportunidade) {
    return null;
  }

  const tarefaExistente = await prisma.tarefa.findFirst({
    where: {
      oportunidadeId,
      titulo: config.titulo,
      status: {
        in: ["PENDENTE", "EM_ANDAMENTO"],
      },
    },
  });

  if (tarefaExistente) {
    return tarefaExistente;
  }

  const tarefa = await prisma.tarefa.create({
    data: {
      titulo: config.titulo,
      tipo: config.tipo,
      prioridade: config.prioridade,
      dataVencimento: config.prazo(new Date()),
      oportunidadeId,
      empresaId: oportunidade.empresaId,
      pessoaId: oportunidade.pessoaId,
      obraId: oportunidade.obraId,
      responsavelId: responsavelId ?? oportunidade.responsavelId ?? userId,
      createdById: userId,
      updatedById: userId,
    },
    include: {
      oportunidade: true,
      empresa: true,
      pessoa: true,
      obra: true,
      proposta: true,
      responsavel: true,
      createdBy: true,
      updatedBy: true,
    },
  });

  await auditLog({
    action: "TAREFA_AUTOMATICA_CREATED",
    entity: "Tarefa",
    entityId: tarefa.id,
    after: tarefa,
    metadata: {
      gatilho,
      oportunidadeId,
    },
    userId,
  });

  return tarefa;
}
