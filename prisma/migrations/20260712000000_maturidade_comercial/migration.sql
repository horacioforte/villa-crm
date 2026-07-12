-- AlterTable: adiciona maturidadeComercial a DossieComercial
-- 0–100: o quanto faz sentido a Villa agir comercialmente sobre este dossiê
ALTER TABLE "DossieComercial" ADD COLUMN "maturidadeComercial" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "DossieComercial_maturidadeComercial_idx" ON "DossieComercial"("maturidadeComercial");
