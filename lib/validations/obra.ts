import { z } from "zod";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(`${value}T00:00:00`) : null));

const numericText = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) {
      return null;
    }

    const parsed = Number(value.replace(",", "."));

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
  cidade: z.string().trim().min(2, "Informe a cidade."),
  estado: z
    .string()
    .trim()
    .length(2, "Informe a UF com 2 letras.")
    .transform((value) => value.toUpperCase()),
  volumeEstimado: numericText,
  dataInicio: optionalDate,
  dataTermino: optionalDate,
  status: z.enum(statusObraValues),
});

export const obraPatchSchema = obraSchema.partial();

export type ObraInput = z.input<typeof obraSchema>;
