import { z } from "zod";

export const tipoFeedbackValues = ["BUG", "SUGESTAO"] as const;

export const statusFeedbackValues = [
  "RECEBIDO",
  "EM_ANALISE",
  "IMPLEMENTADO",
  "DESCARTADO",
] as const;

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  });

export const feedbackCreateSchema = z.object({
  tipo: z.enum(tipoFeedbackValues),
  titulo: z.string().trim().min(3, "Informe um titulo para o feedback."),
  descricao: z.string().trim().min(10, "Descreva o feedback com mais detalhes."),
  area: optionalText,
});

export const feedbackPatchSchema = z.object({
  status: z.enum(statusFeedbackValues).optional(),
  respostaAdmin: optionalText,
});

export type FeedbackCreateInput = z.input<typeof feedbackCreateSchema>;
export type FeedbackPatchInput = z.input<typeof feedbackPatchSchema>;
