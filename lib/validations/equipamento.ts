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

const optionalNumber = (message: string) =>
  z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((value, ctx) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed =
      typeof value === "number" ? value : Number(value.trim().replace(",", "."));

    if (Number.isNaN(parsed) || parsed < 0) {
      ctx.addIssue({
        code: "custom",
        message,
      });
      return z.NEVER;
    }

    return parsed;
  });

const optionalYear = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed =
      typeof value === "number" ? value : Number.parseInt(value.trim(), 10);
    const currentYear = new Date().getFullYear() + 1;

    if (
      !Number.isInteger(parsed) ||
      parsed < 1900 ||
      parsed > currentYear
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Informe um ano valido.",
      });
      return z.NEVER;
    }

    return parsed;
  });

export const tipoEquipamentoValues = [
  "BOMBA_CONCRETO",
  "BETONEIRA",
  "OUTRO",
] as const;

export const statusEquipamentoValues = [
  "DISPONIVEL",
  "LOCADO",
  "MANUTENCAO",
  "VENDIDO",
  "INATIVO",
] as const;

export const equipamentoSchema = z.object({
  codigo: z.string().trim().min(1, "Informe o codigo do equipamento."),
  nome: z.string().trim().min(2, "Informe o nome do equipamento."),
  tipo: z.enum(tipoEquipamentoValues),
  status: z.enum(statusEquipamentoValues).default("DISPONIVEL"),
  marca: optionalText,
  modelo: optionalText,
  ano: optionalYear,
  numeroSerie: optionalText,
  valorLocacao: optionalNumber("Informe um valor de locacao valido."),
  valorM3: optionalNumber("Informe um valor por m3 valido."),
  volumeMinimoM3: optionalNumber("Informe um volume minimo valido."),
  valorVenda: optionalNumber("Informe um valor de venda valido."),
  observacoes: optionalText,
});

export const equipamentoPatchSchema = equipamentoSchema.partial();

export type EquipamentoInput = z.input<typeof equipamentoSchema>;
