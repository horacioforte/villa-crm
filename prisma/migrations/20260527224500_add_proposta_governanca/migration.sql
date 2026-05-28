-- AlterEnum
ALTER TYPE "StatusPropostaComercial" ADD VALUE IF NOT EXISTS 'AGUARDANDO_APROVACAO';
ALTER TYPE "StatusPropostaComercial" ADD VALUE IF NOT EXISTS 'ACEITA';
ALTER TYPE "StatusPropostaComercial" ADD VALUE IF NOT EXISTS 'CANCELADA';

-- CreateEnum
CREATE TYPE "TipoBlocoProposta" AS ENUM ('BLOQUEADO', 'EDITAVEL', 'EDITAVEL_COM_APROVACAO');

-- CreateEnum
CREATE TYPE "StatusExcecaoProposta" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- AlterTable
ALTER TABLE "PropostaComercial" ADD COLUMN "templateMasterId" TEXT;

-- CreateTable
CREATE TABLE "PropostaTemplateMaster" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoServico" TEXT NOT NULL,
    "descricao" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaTemplateMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaTemplateBloco" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoBlocoProposta" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "conteudo" TEXT NOT NULL,
    "templateMasterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaTemplateBloco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaBloco" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoBlocoProposta" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "conteudoOriginal" TEXT NOT NULL,
    "conteudoAtual" TEXT NOT NULL,
    "editado" BOOLEAN NOT NULL DEFAULT false,
    "propostaId" TEXT NOT NULL,
    "templateBlocoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaBloco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaExcecaoAprovacao" (
    "id" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorProposto" JSONB,
    "justificativa" TEXT NOT NULL,
    "status" "StatusExcecaoProposta" NOT NULL DEFAULT 'PENDENTE',
    "decisaoMotivo" TEXT,
    "decididoEm" TIMESTAMP(3),
    "propostaId" TEXT NOT NULL,
    "blocoId" TEXT,
    "solicitanteId" TEXT,
    "aprovadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaExcecaoAprovacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaAuditoriaCampo" (
    "id" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAnterior" JSONB,
    "valorNovo" JSONB,
    "justificativa" TEXT,
    "statusAnterior" "StatusPropostaComercial",
    "statusNovo" "StatusPropostaComercial",
    "versao" INTEGER NOT NULL,
    "propostaId" TEXT NOT NULL,
    "blocoId" TEXT,
    "excecaoId" TEXT,
    "usuarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaAuditoriaCampo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropostaTemplateMaster_codigo_key" ON "PropostaTemplateMaster"("codigo");
CREATE INDEX "PropostaTemplateMaster_codigo_idx" ON "PropostaTemplateMaster"("codigo");
CREATE INDEX "PropostaTemplateMaster_ativo_idx" ON "PropostaTemplateMaster"("ativo");
CREATE INDEX "PropostaTemplateMaster_createdById_idx" ON "PropostaTemplateMaster"("createdById");
CREATE INDEX "PropostaTemplateMaster_updatedById_idx" ON "PropostaTemplateMaster"("updatedById");
CREATE UNIQUE INDEX "PropostaTemplateBloco_templateMasterId_chave_key" ON "PropostaTemplateBloco"("templateMasterId", "chave");
CREATE INDEX "PropostaTemplateBloco_templateMasterId_ordem_idx" ON "PropostaTemplateBloco"("templateMasterId", "ordem");
CREATE INDEX "PropostaTemplateBloco_tipo_idx" ON "PropostaTemplateBloco"("tipo");
CREATE UNIQUE INDEX "PropostaBloco_propostaId_chave_key" ON "PropostaBloco"("propostaId", "chave");
CREATE INDEX "PropostaBloco_propostaId_ordem_idx" ON "PropostaBloco"("propostaId", "ordem");
CREATE INDEX "PropostaBloco_templateBlocoId_idx" ON "PropostaBloco"("templateBlocoId");
CREATE INDEX "PropostaBloco_tipo_idx" ON "PropostaBloco"("tipo");
CREATE INDEX "PropostaExcecaoAprovacao_propostaId_status_idx" ON "PropostaExcecaoAprovacao"("propostaId", "status");
CREATE INDEX "PropostaExcecaoAprovacao_blocoId_idx" ON "PropostaExcecaoAprovacao"("blocoId");
CREATE INDEX "PropostaExcecaoAprovacao_solicitanteId_idx" ON "PropostaExcecaoAprovacao"("solicitanteId");
CREATE INDEX "PropostaExcecaoAprovacao_aprovadorId_idx" ON "PropostaExcecaoAprovacao"("aprovadorId");
CREATE INDEX "PropostaExcecaoAprovacao_createdAt_idx" ON "PropostaExcecaoAprovacao"("createdAt");
CREATE INDEX "PropostaAuditoriaCampo_propostaId_createdAt_idx" ON "PropostaAuditoriaCampo"("propostaId", "createdAt");
CREATE INDEX "PropostaAuditoriaCampo_blocoId_idx" ON "PropostaAuditoriaCampo"("blocoId");
CREATE INDEX "PropostaAuditoriaCampo_excecaoId_idx" ON "PropostaAuditoriaCampo"("excecaoId");
CREATE INDEX "PropostaAuditoriaCampo_usuarioId_idx" ON "PropostaAuditoriaCampo"("usuarioId");
CREATE INDEX "PropostaAuditoriaCampo_campo_idx" ON "PropostaAuditoriaCampo"("campo");
CREATE INDEX "PropostaComercial_templateMasterId_idx" ON "PropostaComercial"("templateMasterId");

-- AddForeignKey
ALTER TABLE "PropostaComercial" ADD CONSTRAINT "PropostaComercial_templateMasterId_fkey" FOREIGN KEY ("templateMasterId") REFERENCES "PropostaTemplateMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaTemplateMaster" ADD CONSTRAINT "PropostaTemplateMaster_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaTemplateMaster" ADD CONSTRAINT "PropostaTemplateMaster_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaTemplateBloco" ADD CONSTRAINT "PropostaTemplateBloco_templateMasterId_fkey" FOREIGN KEY ("templateMasterId") REFERENCES "PropostaTemplateMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropostaBloco" ADD CONSTRAINT "PropostaBloco_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropostaBloco" ADD CONSTRAINT "PropostaBloco_templateBlocoId_fkey" FOREIGN KEY ("templateBlocoId") REFERENCES "PropostaTemplateBloco"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaExcecaoAprovacao" ADD CONSTRAINT "PropostaExcecaoAprovacao_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropostaExcecaoAprovacao" ADD CONSTRAINT "PropostaExcecaoAprovacao_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "PropostaBloco"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaExcecaoAprovacao" ADD CONSTRAINT "PropostaExcecaoAprovacao_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaExcecaoAprovacao" ADD CONSTRAINT "PropostaExcecaoAprovacao_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaAuditoriaCampo" ADD CONSTRAINT "PropostaAuditoriaCampo_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropostaAuditoriaCampo" ADD CONSTRAINT "PropostaAuditoriaCampo_blocoId_fkey" FOREIGN KEY ("blocoId") REFERENCES "PropostaBloco"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaAuditoriaCampo" ADD CONSTRAINT "PropostaAuditoriaCampo_excecaoId_fkey" FOREIGN KEY ("excecaoId") REFERENCES "PropostaExcecaoAprovacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropostaAuditoriaCampo" ADD CONSTRAINT "PropostaAuditoriaCampo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
