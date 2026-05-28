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

const optionalDate = z
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

const numericText = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed =
      typeof value === "number" ? value : Number(value.trim().replace(",", "."));

    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um volume valido.",
      });
      return z.NEVER;
    }

    return parsed;
  });

export const statusObraValues = [
  "PLANEJADA",
  "EM_ANDAMENTO",
  "CONCLUIDA",
  "CANCELADA",
] as const;

export const obraSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da obra."),
  empresaId: z.string().trim().min(1, "Selecione a empresa vinculada."),
  cidade: optionalText,
  estado: optionalUf,
  volumeEstimado: numericText,
  dataInicio: optionalDate,
  dataTermino: optionalDate,
  status: z.enum(statusObraValues),
});

export const obraPatchSchema = obraSchema.partial();

export type ObraInput = z.input<typeof obraSchema>;
