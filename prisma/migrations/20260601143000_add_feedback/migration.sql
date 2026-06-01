-- CreateEnum
CREATE TYPE "TipoFeedback" AS ENUM ('BUG', 'SUGESTAO');

-- CreateEnum
CREATE TYPE "StatusFeedback" AS ENUM ('RECEBIDO', 'EM_ANALISE', 'IMPLEMENTADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "tipo" "TipoFeedback" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "area" TEXT,
    "status" "StatusFeedback" NOT NULL DEFAULT 'RECEBIDO',
    "respostaAdmin" TEXT,
    "autorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_numero_key" ON "Feedback"("numero");

-- CreateIndex
CREATE INDEX "Feedback_autorId_idx" ON "Feedback"("autorId");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_tipo_idx" ON "Feedback"("tipo");

-- CreateIndex
CREATE INDEX "Feedback_numero_idx" ON "Feedback"("numero");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
