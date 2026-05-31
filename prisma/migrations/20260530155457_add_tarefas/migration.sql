-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('LIGACAO', 'WHATSAPP', 'VISITA', 'REUNIAO', 'REUNIAO_ONLINE', 'PROPOSTA', 'CONTRATO', 'COBRANCA', 'RETORNO_CLIENTE', 'POS_VENDA', 'LOGISTICA', 'MANUTENCAO', 'VISTORIA', 'APRESENTACAO_COMERCIAL', 'TAREFA_INTERNA', 'OUTRO');

-- CreateEnum
CREATE TYPE "PrioridadeTarefa" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA', 'ATRASADA');

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoAtividade" NOT NULL DEFAULT 'LIGACAO',
    "prioridade" "PrioridadeTarefa" NOT NULL DEFAULT 'MEDIA',
    "status" "StatusTarefa" NOT NULL DEFAULT 'PENDENTE',
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "horaVencimento" TEXT,
    "observacoes" TEXT,
    "concluidaEm" TIMESTAMP(3),
    "oportunidadeId" TEXT,
    "empresaId" TEXT,
    "pessoaId" TEXT,
    "obraId" TEXT,
    "propostaId" TEXT,
    "responsavelId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "whatsappMessageId" TEXT,
    "googleCalendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarefa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tarefa_oportunidadeId_idx" ON "Tarefa"("oportunidadeId");

-- CreateIndex
CREATE INDEX "Tarefa_empresaId_idx" ON "Tarefa"("empresaId");

-- CreateIndex
CREATE INDEX "Tarefa_pessoaId_idx" ON "Tarefa"("pessoaId");

-- CreateIndex
CREATE INDEX "Tarefa_obraId_idx" ON "Tarefa"("obraId");

-- CreateIndex
CREATE INDEX "Tarefa_propostaId_idx" ON "Tarefa"("propostaId");

-- CreateIndex
CREATE INDEX "Tarefa_responsavelId_idx" ON "Tarefa"("responsavelId");

-- CreateIndex
CREATE INDEX "Tarefa_status_idx" ON "Tarefa"("status");

-- CreateIndex
CREATE INDEX "Tarefa_dataVencimento_idx" ON "Tarefa"("dataVencimento");

-- CreateIndex
CREATE INDEX "Tarefa_prioridade_idx" ON "Tarefa"("prioridade");

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaComercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarefa" ADD CONSTRAINT "Tarefa_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
