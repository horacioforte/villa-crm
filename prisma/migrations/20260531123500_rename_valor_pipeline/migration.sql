-- Preserve existing opportunity values as the initial potential pipeline.
ALTER TABLE "Oportunidade" RENAME COLUMN "valor" TO "potencialOportunidade";

ALTER TABLE "Oportunidade" ADD COLUMN "valorContrato" DECIMAL(12,2);
