-- Migration específica para suportar as Carteiras Estratégicas.
-- Cria somente os tipos e tabela necessários para a modelagem atual do schema.
-- Não altera modelos ou tabelas preexistentes de outras features.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CarteiraEstrategica') THEN
    CREATE TYPE "CarteiraEstrategica" AS ENUM (
      'MCMV',
      'CONSTRUTORA_BRASIL',
      'CONCRETEIRAS',
      'PRE_MOLDADOS',
      'REVENDAS_CAMINHOES'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EtapaCarteira') THEN
    CREATE TYPE "EtapaCarteira" AS ENUM (
      'MONITORANDO',
      'SINAL_DETECTADO',
      'EM_INVESTIGACAO',
      'DECISOR_ENCONTRADO',
      'PRONTO_PARA_ABORDAR',
      'EM_CAMPANHA',
      'RESPONDEU',
      'INTERESSADO'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DossieCarteira" (
  "id" TEXT NOT NULL,
  "carteira" "CarteiraEstrategica" NOT NULL,
  "status" "EtapaCarteira" NOT NULL DEFAULT 'MONITORANDO',
  "principalSinal" TEXT,
  "proximaAcao" TEXT,
  "observacoes" TEXT,
  "ultimaInvestigacao" TIMESTAMP(3),
  "ultimaAtualizacao" TIMESTAMP(3),
  "score" INTEGER NOT NULL DEFAULT 0,
  "decisores" INTEGER NOT NULL DEFAULT 0,
  "emCampanha" BOOLEAN NOT NULL DEFAULT false,
  "interessado" BOOLEAN NOT NULL DEFAULT false,
  "dossieId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DossieCarteira_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DossieCarteira_dossieId_fkey"
    FOREIGN KEY ("dossieId") REFERENCES "DossieComercial"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DossieCarteira_dossieId_carteira_key"
  ON "DossieCarteira" ("dossieId", "carteira");

CREATE INDEX IF NOT EXISTS "DossieCarteira_carteira_idx"
  ON "DossieCarteira" ("carteira");

CREATE INDEX IF NOT EXISTS "DossieCarteira_status_idx"
  ON "DossieCarteira" ("status");

CREATE INDEX IF NOT EXISTS "DossieCarteira_dossieId_idx"
  ON "DossieCarteira" ("dossieId");
