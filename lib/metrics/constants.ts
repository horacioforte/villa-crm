// ARQUIVO: lib/metrics/constants.ts
// Definições puras (sem Prisma) da governança de indicadores comerciais — Fase 0.
// Importável tanto no servidor quanto em componentes client, sem puxar o runtime do Prisma.
//
// Fonte única de verdade para "o que é pipeline aberto". Nenhuma tela deve manter
// sua própria lista de status — todas importam daqui.

import type { statusOportunidadeValues } from "@/lib/validations/oportunidade";

export type StatusOportunidade = (typeof statusOportunidadeValues)[number];

/**
 * Estágios que representam pipeline comercial efetivamente aberto.
 *
 * PRE_QUALIFICADA fica de fora: é criada automaticamente pelo João e ainda não
 * passou por revisão comercial — só entra no Pipeline Potencial oficial depois
 * de validada por um comercial (decisão confirmada em 17/08/2026).
 */
export const PIPELINE_ABERTO_STATUSES: readonly StatusOportunidade[] = [
  "NOVA",
  "EM_ATENDIMENTO",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
] as const;

/** Estágios finais — nunca entram no Pipeline Potencial/Proposto aberto. */
export const PIPELINE_FECHADO_STATUSES: readonly StatusOportunidade[] = [
  "GANHA",
  "PERDIDA",
] as const;

/** Status ainda não classificados como aberto nem fechado (aguardando revisão comercial). */
export const PIPELINE_AGUARDANDO_REVISAO_STATUSES: readonly StatusOportunidade[] = [
  "PRE_QUALIFICADA",
] as const;

/**
 * Acima deste valor, o potencial da oportunidade é considerado excepcional e exige
 * confirmação explícita do usuário (não é um teto/bloqueio — a oportunidade pode ser
 * salva com qualquer valor, desde que confirmado). Ver lib/validations/oportunidade.ts.
 *
 * Referência: o maior negócio real do pipeline auditado em 17/08/2026 foi de ~R$ 6 mi;
 * R$ 20 mi dá margem confortável sem deixar passar despercebido um valor de
 * investimento de projeto (megaobras costumam vir na casa das centenas de milhões).
 */
export const POTENCIAL_ALERTA_EXCEPCIONAL = 20_000_000;

/** Status de proposta que nunca contam para "Pipeline Proposto" (descartadas). */
export const PROPOSTA_STATUS_EXCLUIDOS = ["CANCELADA", "REJEITADA"] as const;

/**
 * Piso de sanidade financeira: qualquer valor abaixo disso (potencialOportunidade
 * ou valorTotal de proposta) é tratado como placeholder técnico — nunca como
 * valor financeiro de fato. Nunca soma em nenhum indicador em R$.
 *
 * CONFIRMADO EM PRODUÇÃO (18/08/2026): não é hipotético. Três oportunidades do
 * Radar João foram encontradas com potencialOportunidade = "1" e "2000" — valores
 * de teste/placeholder digitados diretamente no campo, não potencial real de
 * faturamento. Nenhuma PropostaComercial com valorTotal simbólico foi encontrada
 * (menor valor real de proposta: R$ 55), mas o piso protege os dois campos.
 */
export const VALOR_FINANCEIRO_MINIMO_REAL = 100;
