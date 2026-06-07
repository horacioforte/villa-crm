import { z } from "zod";

const textField = z.string().trim();

export const agenteUpdateSchema = z.object({
  descricao: textField,
  personalidade: textField,
  regrasQuente: textField,
  regrasMedia: textField,
  regrasFria: textField,
  ignorar: textField,
  exemplosLead: textField,
  exemplosNaoLead: textField,
  historicoErros: textField,
  ativo: z.boolean(),
});
