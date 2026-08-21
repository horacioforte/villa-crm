import { z } from "zod";

export const tipoContratoValues = [
  "CAMINHAO_BETONEIRA",
  "AUTO_BOMBA",
  "USINA_CONCRETO",
  "GERAL_OUTRO",
] as const;

export const TIPO_CONTRATO_LABELS: Record<(typeof tipoContratoValues)[number], string> = {
  CAMINHAO_BETONEIRA: "Caminhão Betoneira",
  AUTO_BOMBA: "Auto Bomba",
  USINA_CONCRETO: "Usina de Concreto",
  GERAL_OUTRO: "Geral / Outro",
};

export const nivelRiscoValues = ["BAIXO", "MEDIO", "ALTO"] as const;

export const NIVEL_RISCO_LABELS: Record<(typeof nivelRiscoValues)[number], string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
};

const optionalRelationId = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (!value || value === "__none__" ? null : value));

const optionalNonEmptyText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  });

export const analisarContratoSchema = z
  .object({
    tipoContrato: z.enum(tipoContratoValues),
    nomeArquivo: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((value) => (value && value.trim() ? value.trim() : null)),
    texto: optionalNonEmptyText,
    pdfBase64: optionalNonEmptyText,
    empresaId: optionalRelationId,
    oportunidadeId: optionalRelationId,
  })
  .refine((data) => Boolean(data.texto) || Boolean(data.pdfBase64), {
    message: "Envie o texto do contrato ou um arquivo PDF.",
    path: ["texto"],
  });

export type AnalisarContratoInput = z.input<typeof analisarContratoSchema>;
