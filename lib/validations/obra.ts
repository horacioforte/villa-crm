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

type ObraDateValue = string | Date | null | undefined;

function parseDateParts(value: string) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  if (brMatch) {
    return {
      year: Number(brMatch[3]),
      month: Number(brMatch[2]),
      day: Number(brMatch[1]),
    };
  }

  return null;
}

export function normalizeObraDateInput(value: ObraDateValue) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString().slice(0, 10);
  }

  const parts = parseDateParts(value);

  if (!parts) {
    return null;
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (
    date.getUTCFullYear() !== parts.year ||
    date.getUTCMonth() !== parts.month - 1 ||
    date.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(
    2,
    "0",
  )}-${String(parts.day).padStart(2, "0")}`;
}

const optionalDate = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    const normalized = normalizeObraDateInput(value);

    if (normalized === "") {
      return null;
    }

    if (normalized === null) {
      ctx.addIssue({
        code: "custom",
        message: "Informe uma data valida.",
      });
      return z.NEVER;
    }

    return new Date(`${normalized}T00:00:00.000Z`);
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
  endereco: optionalText.optional(),
  cidade: optionalText.optional(),
  estado: optionalUf.optional(),
  volumeEstimado: numericText.optional(),
  dataInicio: optionalDate.optional(),
  dataTermino: optionalDate.optional(),
  status: z.enum(statusObraValues),
});

export const obraPatchSchema = obraSchema.partial();

export type ObraInput = z.input<typeof obraSchema>;
