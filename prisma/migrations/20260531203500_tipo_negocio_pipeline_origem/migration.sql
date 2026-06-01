CREATE TYPE "TipoServico" AS ENUM (
  'BOMBA_LANCA',
  'BOMBA_ESTACIONARIA',
  'TELEBELT',
  'BETONEIRA',
  'CENTRAL_IN_LOCO',
  'CONCRETO',
  'SERVICO_ESPECIAL'
);

CREATE TYPE "FaixaPotencial" AS ENUM (
  'ATE_100_MIL',
  'DE_100_A_500_MIL',
  'DE_500_MIL_A_2_MILHOES',
  'ACIMA_DE_2_MILHOES'
);

CREATE TYPE "CanalOrigem" AS ENUM (
  'INDICACAO',
  'CLIENTE_ATUAL',
  'GOOGLE',
  'LINKEDIN',
  'SITE',
  'VISITA_COMERCIAL',
  'OBRA_MAPEADA',
  'MARKETPLACE',
  'OLX',
  'EVENTO',
  'OUTROS'
);

ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'EQUIPAMENTO_USADO';

ALTER TABLE "Oportunidade"
  ADD COLUMN "tipoServico" "TipoServico",
  ADD COLUMN "faixaPotencial" "FaixaPotencial",
  ADD COLUMN "canalOrigem" "CanalOrigem";

UPDATE "Oportunidade"
SET "tipo" = 'EQUIPAMENTO_USADO'
WHERE "tipo" = 'VENDA';

UPDATE "Oportunidade"
SET "canalOrigem" = 'CLIENTE_ATUAL'
WHERE "origem" = 'CLIENTE_RECORRENTE';

UPDATE "Oportunidade"
SET "canalOrigem" = 'OUTROS'
WHERE "origem" = 'CLIENTE_NOVO';

ALTER TABLE "Oportunidade" DROP COLUMN "origem";
