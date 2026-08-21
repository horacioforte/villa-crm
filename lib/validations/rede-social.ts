import { z } from "zod";

export const redeSocialTipoValues = ["INSTAGRAM", "FACEBOOK", "YOUTUBE"] as const;

export const REDE_SOCIAL_LABELS: Record<(typeof redeSocialTipoValues)[number], string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
};

export const redeSocialStatusConexaoValues = [
  "NAO_CONECTADO",
  "CONECTADO",
  "ERRO",
  "TOKEN_EXPIRADO",
] as const;

export const STATUS_CONEXAO_LABELS: Record<
  (typeof redeSocialStatusConexaoValues)[number],
  string
> = {
  NAO_CONECTADO: "Não conectado",
  CONECTADO: "Conectado",
  ERRO: "Erro",
  TOKEN_EXPIRADO: "Token expirado",
};

// Nota: usamos .nullable().optional() explícito (em vez de
// z.union([z.string(), z.null(), z.undefined()]), como em lib/validations/contrato.ts)
// porque no Zod 4 instalado (^4.4.3) a forma via union NÃO marca a chave como
// opcional no objeto — uma chave ausente no JSON (ex.: campo nunca enviado
// pelo formulário) falha com "expected nonoptional, received undefined"
// mesmo a união aceitando undefined. Verificado em testes desta Sprint.
const optionalNonEmptyText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  });

export const criarRedeSocialContaSchema = z.object({
  rede: z.enum(redeSocialTipoValues),
  nome: z
    .string()
    .trim()
    .min(1, "Informe um nome para identificar a conta."),
  businessId: optionalNonEmptyText,
  pageId: optionalNonEmptyText,
  contaAnunciosId: optionalNonEmptyText,
  accessTokenEnvVar: optionalNonEmptyText,
});

export type CriarRedeSocialContaInput = z.input<typeof criarRedeSocialContaSchema>;
