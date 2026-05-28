-- CreateEnum
CREATE TYPE "StatusPropostaComercial" AS ENUM ('RASCUNHO', 'ENVIADA', 'APROVADA', 'REJEITADA', 'VENCIDA');

-- CreateTable
CREATE TABLE "PropostaComercial" (
    "id" TEXT NOT NULL,
    "numeroProposta" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "status" "StatusPropostaComercial" NOT NULL DEFAULT 'RASCUNHO',
    "templateUtilizado" TEXT NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "validadeProposta" TIMESTAMP(3) NOT NULL,
    "prazoExecucao" TEXT,
    "observacoesComerciais" TEXT,
    "observacoesTecnicas" TEXT,
    "condicoesPagamento" TEXT,
    "pdfUrl" TEXT,
    "wordUrl" TEXT,
    "htmlSnapshot" TEXT NOT NULL,
    "oportunidadeId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaComercial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaComercial_numeroProposta_versao_key" ON "PropostaComercial"("numeroProposta", "versao");
CREATE INDEX "PropostaComercial_oportunidadeId_idx" ON "PropostaComercial"("oportunidadeId");
CREATE INDEX "PropostaComercial_createdById_idx" ON "PropostaComercial"("createdById");
CREATE INDEX "PropostaComercial_updatedById_idx" ON "PropostaComercial"("updatedById");
CREATE INDEX "PropostaComercial_status_idx" ON "PropostaComercial"("status");
CREATE INDEX "PropostaComercial_validadeProposta_idx" ON "PropostaComercial"("validadeProposta");

-- AddForeignKey
ALTER TABLE "PropostaComercial" ADD CONSTRAINT "PropostaComercial_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropostaComercial" ADD CONSTRAINT "PropostaComercial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaComercial" ADD CONSTRAINT "PropostaComercial_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
