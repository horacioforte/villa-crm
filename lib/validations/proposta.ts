import { z } from "zod";

import { PROPOSTA_TEMPLATES } from "@/lib/propostas/templates";

export const statusPropostaComercialValues = [
  "RASCUNHO",
  "ENVIADA",
  "APROVADA",
  "REJEITADA",
  "VENCIDA",
] as const;

export const propostaTemplateValues = PROPOSTA_TEMPLATES.map(
  (template) => template.id,
) as [string, ...string[]];

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  });

const requiredText = (message: string) =>
  z.string().trim().min(1, message);

const requiredDecimal = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed =
      typeof value === "number" ? value : Number(value.replace(",", "."));

    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um valor valido.",
      });
      return z.NEVER;
    }

    return parsed;
  });

const requiredDate = z
  .union([z.string(), z.date()])
  .transform((value, ctx) => {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma data valida.",
      });
      return z.NEVER;
    }

    return date;
  });

export const propostaCreateSchema = z.object({
  templateUtilizado: z.enum(propostaTemplateValues),
  valorTotal: requiredDecimal,
  validadeProposta: requiredDate,
  prazoExecucao: requiredText("Informe o prazo de execucao."),
  observacoesComerciais: optionalText,
  observacoesTecnicas: optionalText,
  condicoesPagamento: optionalText,
});

export const propostaPatchSchema = propostaCreateSchema.partial();

export type PropostaCreateInput = z.input<typeof propostaCreateSchema>;
export type PropostaPatchInput = z.input<typeof propostaPatchSchema>;
