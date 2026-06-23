-- ARQUIVO: prisma/migrations/20260623230000_joao_outbound_oportunidade/migration.sql
-- Adiciona valores aos enums para oportunidades outbound do João.
-- REGRA: nunca remover. Apenas acrescentar.

ALTER TYPE "CanalOrigem" ADD VALUE IF NOT EXISTS 'JOAO_OUTBOUND';
ALTER TYPE "StatusOportunidade" ADD VALUE IF NOT EXISTS 'PRE_QUALIFICADA';
