-- CreateEnum
CREATE TYPE "TipoProposta" AS ENUM ('BETONEIRA', 'BOMBA', 'CENTRAL', 'TELEBELT', 'OUTRO');

-- CreateTable
CREATE TABLE "Proposta" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipoProposta" "TipoProposta" NOT NULL,
    "descricao" TEXT,
    "oportunidadeId" TEXT NOT NULL,
    "createdById" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposta_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PropostaComercial"
ADD COLUMN "ativa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "propostaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Proposta_numero_key" ON "Proposta"("numero");

-- CreateIndex
CREATE INDEX "Proposta_oportunidadeId_idx" ON "Proposta"("oportunidadeId");

-- CreateIndex
CREATE INDEX "Proposta_createdById_idx" ON "Proposta"("createdById");

-- CreateIndex
CREATE INDEX "PropostaComercial_propostaId_idx" ON "PropostaComercial"("propostaId");

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaComercial" ADD CONSTRAINT "PropostaComercial_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
