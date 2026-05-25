import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value !== "__none__" ? value : null));

const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === "") {
      return null;
    }

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

export const tipoOperacaoValues = ["LOCACAO", "VENDA"] as const;

export const statusOportunidadeValues = [
  "NOVA",
  "EM_ATENDIMENTO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "GANHA",
  "PERDIDA",
] as const;

export const oportunidadeSchema = z.object({
  titulo: z.string().trim().min(2, "Informe o titulo da oportunidade."),
  descricao: optionalText,
  tipo: z.enum(tipoOperacaoValues),
  status: z.enum(statusOportunidadeValues).default("NOVA"),
  valor: optionalNumber,
  empresaId: z.string().trim().min(1, "Selecione a empresa."),
  pessoaId: optionalText,
  obraId: optionalText,
  responsavelId: optionalText,
  equipamentoId: optionalText,
});

export const oportunidadePatchSchema = oportunidadeSchema.partial();

export const oportunidadeStatusSchema = z.object({
  status: z.enum(statusOportunidadeValues),
});

export type OportunidadeInput = z.input<typeof oportunidadeSchema>;
