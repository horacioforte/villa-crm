import { z } from "zod";

export const papelUsuarioValues = [
  "ADMIN",
  "GERENTE",
  "COMERCIAL",
  "OPERACIONAL",
] as const;

const optionalRelationId = z
  .string()
  .trim()
  .optional()
  .transform((value) => (!value || value === "__none__" ? null : value));

const senhaSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.");

export const usuarioCreateSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail valido.").toLowerCase(),
  senha: senhaSchema,
  papel: z.enum(papelUsuarioValues),
  filialId: optionalRelationId,
});

export const usuarioPatchSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").optional(),
  papel: z.enum(papelUsuarioValues).optional(),
  filialId: optionalRelationId,
});

export const resetSenhaSchema = z.object({
  senha: senhaSchema,
});

export type UsuarioCreateInput = z.input<typeof usuarioCreateSchema>;
export type UsuarioPatchInput = z.input<typeof usuarioPatchSchema>;
export type ResetSenhaInput = z.input<typeof resetSenhaSchema>;
