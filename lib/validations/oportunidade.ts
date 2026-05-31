import { z } from "zod";

const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  });

const requiredRelationId = (message: string) =>
  z.union([z.string(), z.null()]).transform((value, ctx) => {
    const trimmed = value?.trim();

    if (!trimmed || trimmed === "__none__") {
      ctx.addIssue({
        code: "custom",
        message,
      });
      return z.NEVER;
    }

    return trimmed;
  });

const optionalRelationId = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();

    return trimmed && trimmed !== "__none__" ? trimmed : null;
  });

const optionalNumber = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "") {
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

export const tipoOperacaoValues = ["LOCACAO", "EQUIPAMENTO_USADO"] as const;

export const tipoServicoValues = [
  "BOMBA_LANCA",
  "BOMBA_ESTACIONARIA",
  "TELEBELT",
  "BETONEIRA",
  "CENTRAL_IN_LOCO",
  "CONCRETO",
  "SERVICO_ESPECIAL",
] as const;

export const faixaPotencialValues = [
  "ATE_100_MIL",
  "DE_100_A_500_MIL",
  "DE_500_MIL_A_2_MILHOES",
  "ACIMA_DE_2_MILHOES",
] as const;

export const canalOrigemValues = [
  "INDICACAO",
  "CLIENTE_ATUAL",
  "GOOGLE",
  "LINKEDIN",
  "SITE",
  "VISITA_COMERCIAL",
  "OBRA_MAPEADA",
  "MARKETPLACE",
  "OLX",
  "EVENTO",
  "OUTROS",
] as const;

export const temperaturaOportunidadeValues = ["FRIA", "MEDIA", "QUENTE"] as const;

export const statusOportunidadeValues = [
  "NOVA",
  "EM_ATENDIMENTO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "GANHA",
  "PERDIDA",
] as const;

const oportunidadeBaseSchema = z.object({
  titulo: z.string().trim().min(2, "Informe o titulo da oportunidade."),
  descricao: optionalText,
  tipo: z.enum(tipoOperacaoValues),
  tipoServico: z.enum(tipoServicoValues).optional().nullable(),
  status: z.enum(statusOportunidadeValues).default("NOVA"),
  potencialOportunidade: optionalNumber,
  faixaPotencial: z.enum(faixaPotencialValues).optional().nullable(),
  valorContrato: optionalNumber,
  motivoPerda: optionalText,
  temperatura: z.enum(temperaturaOportunidadeValues).optional().nullable(),
  canalOrigem: z.enum(canalOrigemValues).optional().nullable(),
  empresaId: requiredRelationId("Selecione a empresa."),
  pessoaId: optionalRelationId,
  obraId: requiredRelationId("Selecione a obra."),
  responsavelId: optionalRelationId,
  equipamentoId: optionalRelationId,
});

function validateMotivoPerda(
  data: Partial<z.output<typeof oportunidadeBaseSchema>>,
  ctx: z.RefinementCtx,
) {
  if (data.status === "PERDIDA" && !data.motivoPerda) {
    ctx.addIssue({
      code: "custom",
      path: ["motivoPerda"],
      message: "Informe o motivo da perda.",
    });
  }
}

export const oportunidadeSchema =
  oportunidadeBaseSchema.superRefine(validateMotivoPerda);

export const oportunidadePatchSchema = oportunidadeBaseSchema
  .partial()
  .superRefine(validateMotivoPerda);

export const oportunidadeStatusSchema = z.object({
  status: z.enum(statusOportunidadeValues),
});

export type OportunidadeInput = z.input<typeof oportunidadeSchema>;
