import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

export const empresaSchema = z.object({
  nomeFantasia: z.string().trim().min(2, "Informe o nome fantasia."),
  razaoSocial: z.string().trim().min(2, "Informe a razao social."),
  cnpj: optionalText,
  segmento: z.string().trim().min(2, "Informe o segmento."),
  cidade: z.string().trim().min(2, "Informe a cidade."),
  estado: z
    .string()
    .trim()
    .length(2, "Informe a UF com 2 letras.")
    .transform((value) => value.toUpperCase()),
  responsavel: z.string().trim().min(2, "Informe o responsavel."),
});

export const empresaPatchSchema = empresaSchema.partial();

export type EmpresaInput = z.input<typeof empresaSchema>;
