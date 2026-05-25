import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

const optionalBirthday = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(`${value}T00:00:00`) : null));

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
  cargo: z.string().trim().min(2, "Informe o cargo."),
  tipoCargo: z.string().trim().min(2, "Informe o tipo de cargo."),
  whatsapp: z.string().trim().min(8, "Informe o WhatsApp."),
  email: optionalText,
  influenciaDecisao: z.enum(influenciaValues),
  nivelRelacionamento: z.enum(relacionamentoValues),
  aniversario: optionalBirthday,
});

export const contatoPatchSchema = contatoSchema.partial();

export type ContatoInput = z.input<typeof contatoSchema>;
