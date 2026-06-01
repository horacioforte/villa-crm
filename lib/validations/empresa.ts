import { z } from "zod";

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  });

const optionalUf = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value.trim() === "") {
      return null;
    }

    const trimmed = value.trim().toUpperCase();

    if (trimmed.length !== 2) {
      ctx.addIssue({
        code: "custom",
        message: "Informe a UF com 2 letras.",
      });
      return z.NEVER;
    }

    return trimmed;
  });

export const empresaSchema = z.object({
  nomeFantasia: optionalText.optional(),
  razaoSocial: z.string().trim().min(2, "Informe a razao social."),
  cnpj: optionalText.optional(),
  telefone: optionalText.optional(),
  segmento: optionalText.optional(),
  cidade: optionalText.optional(),
  estado: optionalUf.optional(),
  responsavel: optionalText.optional(),
});

export const empresaPatchSchema = empresaSchema.partial();

export type EmpresaInput = z.input<typeof empresaSchema>;
