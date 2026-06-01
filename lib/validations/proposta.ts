import { z } from "zod";

import { PROPOSTA_TEMPLATES } from "@/lib/propostas/templates";

export const statusPropostaComercialValues = [
  "RASCUNHO",
  "AGUARDANDO_APROVACAO",
  "APROVADA",
  "ENVIADA",
  "ACEITA",
  "REJEITADA",
  "VENCIDA",
  "CANCELADA",
] as const;

export const tipoBlocoPropostaValues = [
  "BLOQUEADO",
  "EDITAVEL",
  "EDITAVEL_COM_APROVACAO",
] as const;

export const statusExcecaoPropostaValues = [
  "PENDENTE",
  "APROVADA",
  "REJEITADA",
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

function parseDecimalInput(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  const sanitized = value.trim().replace(/[^\d,.-]/g, "");
  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(
      sanitized
        .replaceAll(thousandsSeparator, "")
        .replace(decimalSeparator, "."),
    );
  }

  return Number(sanitized.replace(",", "."));
}

const requiredDecimal = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed = parseDecimalInput(value);

    if (Number.isNaN(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um valor positivo.",
      });
      return z.NEVER;
    }

    return parsed;
  });

const optionalDecimal = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) {
      return null;
    }

    const parsed = parseDecimalInput(value);

    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um valor valido.",
      });
      return z.NEVER;
    }

    return parsed;
  });

const requiredPositiveInteger = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed =
      typeof value === "number" ? value : Number(value.trim().replace(",", "."));

    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma quantidade inteira positiva.",
      });
      return z.NEVER;
    }

    return String(parsed);
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
  quantidade: requiredPositiveInteger,
  descricaoComercial: optionalText,
  horasGarantidas: optionalText,
  precoUnitario: requiredDecimal,
  horaExtra: optionalDecimal,
  precoM3: optionalDecimal,
  volumeMinimoM3: optionalDecimal,
  telefone: optionalText,
  email: optionalText,
  observacoesComerciais: optionalText,
  observacoesTecnicas: optionalText,
  condicoesPagamento: optionalText,
});

export const propostaBlocoPatchSchema = z.object({
  id: z.string().min(1, "Informe o bloco."),
  conteudoAtual: requiredText("Informe o conteudo do bloco."),
  justificativa: optionalText,
});

export const propostaPatchSchema = propostaCreateSchema.partial().extend({
  blocos: z.array(propostaBlocoPatchSchema).optional(),
  justificativa: optionalText,
});

export const propostaExcecaoCreateSchema = z.object({
  blocoId: z.string().min(1, "Informe o bloco."),
  conteudoProposto: requiredText("Informe o conteudo proposto."),
  justificativa: requiredText("Informe a justificativa da excecao."),
});

export const propostaExcecaoDecisaoSchema = z.object({
  decisao: z.enum(["APROVAR", "REJEITAR"]),
  motivo: optionalText,
});

export type PropostaCreateInput = z.input<typeof propostaCreateSchema>;
export type PropostaPatchInput = z.input<typeof propostaPatchSchema>;
export type PropostaExcecaoCreateInput = z.input<
  typeof propostaExcecaoCreateSchema
>;
