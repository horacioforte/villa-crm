ALTER TYPE "TipoAtividade" ADD VALUE IF NOT EXISTS 'EMAIL';

ALTER TABLE "Tarefa"
  ADD COLUMN "resultado" TEXT,
  ADD COLUMN "resultadoCodigo" TEXT;
