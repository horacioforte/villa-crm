import { z } from "zod";

export const tipoAtividadeValues = [
  "LIGACAO",
  "WHATSAPP",
  "EMAIL",
  "VISITA",
  "REUNIAO",
  "REUNIAO_ONLINE",
  "PROPOSTA",
  "CONTRATO",
  "COBRANCA",
  "RETORNO_CLIENTE",
  "POS_VENDA",
  "LOGISTICA",
  "MANUTENCAO",
  "VISTORIA",
  "APRESENTACAO_COMERCIAL",
  "TAREFA_INTERNA",
  "OUTRO",
] as const;

export const prioridadeTarefaValues = [
  "BAIXA",
  "MEDIA",
  "ALTA",
  "URGENTE",
] as const;

export const statusTarefaValues = [
  "PENDENTE",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
  "ATRASADA",
] as const;

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  });

const optionalRelationId = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();

    return trimmed && trimmed !== "__none__" ? trimmed : null;
  });

const requiredDate = z.string().min(1, "Informe a data de vencimento.").transform(
  (value, ctx) => {
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma data valida.",
      });
      return z.NEVER;
    }

    return date;
  },
);

const optionalTime = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    const trimmed = value?.trim();

    if (!trimmed) {
      return null;
    }

    if (!/^\d{2}:\d{2}$/.test(trimmed)) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma hora valida.",
      });
      return z.NEVER;
    }

    return trimmed;
  });

export const tarefaCreateSchema = z.object({
  titulo: z.string().trim().min(2, "Informe o titulo da tarefa."),
  descricao: optionalText,
  tipo: z.enum(tipoAtividadeValues).default("LIGACAO"),
  prioridade: z.enum(prioridadeTarefaValues).default("MEDIA"),
  dataVencimento: requiredDate,
  horaVencimento: optionalTime,
  observacoes: optionalText,
  resultado: optionalText,
  resultadoCodigo: optionalText,
  oportunidadeId: optionalRelationId,
  empresaId: optionalRelationId,
  pessoaId: optionalRelationId,
  obraId: optionalRelationId,
  propostaId: optionalRelationId,
  responsavelId: optionalRelationId,
});

export const tarefaPatchSchema = tarefaCreateSchema.partial().extend({
  status: z.enum(statusTarefaValues).optional(),
});

export type TarefaCreateInput = z.input<typeof tarefaCreateSchema>;
export type TarefaPatchInput = z.input<typeof tarefaPatchSchema>;
