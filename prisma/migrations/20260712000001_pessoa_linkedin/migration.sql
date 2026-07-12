-- AlterTable: adiciona campo linkedin à Pessoa
-- Necessário para assumir/route.ts criar Pessoa com linkedin do DecisorDossie
ALTER TABLE "Pessoa" ADD COLUMN "linkedin" TEXT;
