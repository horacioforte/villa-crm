-- Migration: add_fila_mensagem
-- Criado manualmente em: 15/11/2026 (banco não acessível no sandbox)
-- Revisar com: npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma
-- Executar com: npx prisma migrate deploy (APENAS em produção, com autorização de Horácio)

-- CreateEnum
CREATE TYPE "StatusFilaMensagem" AS ENUM ('AGUARDANDO', 'PROCESSANDO', 'CONCLUIDA', 'FALHOU');

-- CreateTable
CREATE TABLE "FilaMensagem" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nomeContato" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "messageId" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "status" "StatusFilaMensagem" NOT NULL DEFAULT 'AGUARDANDO',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "processandoAte" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "erroMsg" TEXT,
    "rawPayload" JSONB,
    "referral" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilaMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FilaMensagem_messageId_key" ON "FilaMensagem"("messageId");

-- CreateIndex
CREATE INDEX "FilaMensagem_telefone_status_criadoEm_idx" ON "FilaMensagem"("telefone", "status", "criadoEm");

-- CreateIndex
CREATE INDEX "FilaMensagem_status_processandoAte_idx" ON "FilaMensagem"("status", "processandoAte");
