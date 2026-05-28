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

const optionalEmail = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value.trim() === "") {
      return null;
    }

    const trimmed = value.trim().toLowerCase();
    const parsed = z
      .string()
      .email("Informe um e-mail valido.")
      .safeParse(trimmed);

    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um e-mail valido.",
      });
      return z.NEVER;
    }

    return trimmed;
  });

const optionalBirthday = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const date =
      value instanceof Date ? value : new Date(`${value.trim()}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma data valida.",
      });
      return z.NEVER;
    }

    return date;
  });

export const influenciaValues = [
  "DECISOR",
  "INFLUENCIADOR",
  "TECNICO",
  "OPERACIONAL",
  "BLOQUEADOR",
] as const;

export const relacionamentoValues = [
  "FRIO",
  "NEUTRO",
  "BOM",
  "EXCELENTE",
] as const;

export const contatoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do contato."),
  empresaId: z.string().trim().min(1, "Selecione a empresa vinculada."),
  cargo: optionalText,
  tipoCargo: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  influenciaDecisao: z.enum(influenciaValues).default("INFLUENCIADOR"),
  nivelRelacionamento: z.enum(relacionamentoValues).default("NEUTRO"),
  aniversario: optionalBirthday,
});

export const contatoPatchSchema = contatoSchema.partial();

export type ContatoInput = z.input<typeof contatoSchema>;
