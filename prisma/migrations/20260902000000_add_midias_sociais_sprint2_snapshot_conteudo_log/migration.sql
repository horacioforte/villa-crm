-- Módulo Central de Mídias Sociais — Sprint 2 (Instagram Analytics Real), C1.
-- Ver Proposta_Tecnica_Sprint2_Instagram_Analytics.docx para o desenho completo.
--
-- Escrita à mão (em vez de gerada por `prisma migrate dev`) pelo mesmo motivo
-- documentado em 20260821010000_add_rede_social_conta/migration.sql: o
-- ambiente reporta o mesmo drift pré-existente, não relacionado a este
-- módulo, em tabelas de outras frentes (Campanha, ProspectInteracao,
-- RadarPendingOportunidade, TemplateResposta). A única saída oferecida pelo
-- `migrate dev` era `prisma migrate reset`, que apagaria todo o banco
-- compartilhado — não aceito. Este arquivo é 100% aditivo (5 novos ENUMs,
-- 3 novas tabelas, 1 nova coluna opcional em RedeSocialConta) e não altera
-- nenhuma tabela existente além de adicionar essa coluna, então pode ser
-- aplicado com `prisma migrate deploy` sem tocar no drift pré-existente.

-- CreateEnum
CREATE TYPE "OrigemMetricaSocial" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "StatusQualidadeMetricaSocial" AS ENUM ('COMPLETO', 'PARCIAL');

-- CreateEnum
CREATE TYPE "TipoSnapshotSocial" AS ENUM ('CONTA', 'MEDIA');

-- CreateEnum
CREATE TYPE "TipoConteudoSocial" AS ENUM ('POST', 'REEL', 'CARROSSEL', 'STORY');

-- CreateEnum
CREATE TYPE "SincronizacaoSocialStatus" AS ENUM ('SUCESSO', 'PARCIAL', 'ERRO');

-- AlterTable
ALTER TABLE "RedeSocialConta" ADD COLUMN "instagramBusinessAccountId" TEXT;

-- CreateTable
CREATE TABLE "MetricaSocialSnapshot" (
    "id" TEXT NOT NULL,
    "redeSocialContaId" TEXT NOT NULL,
    "tipo" "TipoSnapshotSocial" NOT NULL,
    "origem" "OrigemMetricaSocial" NOT NULL,
    "capturadoEm" TIMESTAMP(3) NOT NULL,
    "periodoInicio" TIMESTAMP(3),
    "periodoFim" TIMESTAMP(3),
    "seguidores" INTEGER,
    "alcance" INTEGER,
    "visualizacoes" INTEGER,
    "interacoes" INTEGER,
    "visitasPerfil" INTEGER,
    "cliquesBio" INTEGER,
    "quantidadePosts" INTEGER,
    "metricasExtra" JSONB,
    "status" "StatusQualidadeMetricaSocial" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricaSocialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricaSocialSnapshot_redeSocialContaId_idx" ON "MetricaSocialSnapshot"("redeSocialContaId");

-- CreateIndex
CREATE INDEX "MetricaSocialSnapshot_tipo_idx" ON "MetricaSocialSnapshot"("tipo");

-- CreateIndex
CREATE INDEX "MetricaSocialSnapshot_capturadoEm_idx" ON "MetricaSocialSnapshot"("capturadoEm");

-- CreateTable
CREATE TABLE "ConteudoSocial" (
    "id" TEXT NOT NULL,
    "redeSocialContaId" TEXT NOT NULL,
    "rede" "RedeSocialTipo" NOT NULL,
    "externalMediaId" TEXT NOT NULL,
    "tipo" "TipoConteudoSocial" NOT NULL,
    "publicadoEm" TIMESTAMP(3) NOT NULL,
    "legenda" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "alcance" INTEGER,
    "interacoes" INTEGER,
    "curtidas" INTEGER,
    "comentarios" INTEGER,
    "salvamentos" INTEGER,
    "compartilhamentos" INTEGER,
    "ultimaSincronizacaoEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConteudoSocial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConteudoSocial_rede_externalMediaId_key" ON "ConteudoSocial"("rede", "externalMediaId");

-- CreateIndex
CREATE INDEX "ConteudoSocial_redeSocialContaId_idx" ON "ConteudoSocial"("redeSocialContaId");

-- CreateIndex
CREATE INDEX "ConteudoSocial_publicadoEm_idx" ON "ConteudoSocial"("publicadoEm");

-- CreateTable
CREATE TABLE "SincronizacaoSocialLog" (
    "id" TEXT NOT NULL,
    "redeSocialContaId" TEXT NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL,
    "finalizadoEm" TIMESTAMP(3),
    "status" "SincronizacaoSocialStatus" NOT NULL,
    "contagemMetricas" INTEGER,
    "contagemConteudos" INTEGER,
    "duracaoMs" INTEGER,
    "erro" TEXT,
    "tentativa" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SincronizacaoSocialLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SincronizacaoSocialLog_redeSocialContaId_idx" ON "SincronizacaoSocialLog"("redeSocialContaId");

-- CreateIndex
CREATE INDEX "SincronizacaoSocialLog_status_idx" ON "SincronizacaoSocialLog"("status");

-- CreateIndex
CREATE INDEX "SincronizacaoSocialLog_iniciadoEm_idx" ON "SincronizacaoSocialLog"("iniciadoEm");

-- AddForeignKey
ALTER TABLE "MetricaSocialSnapshot" ADD CONSTRAINT "MetricaSocialSnapshot_redeSocialContaId_fkey" FOREIGN KEY ("redeSocialContaId") REFERENCES "RedeSocialConta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteudoSocial" ADD CONSTRAINT "ConteudoSocial_redeSocialContaId_fkey" FOREIGN KEY ("redeSocialContaId") REFERENCES "RedeSocialConta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SincronizacaoSocialLog" ADD CONSTRAINT "SincronizacaoSocialLog_redeSocialContaId_fkey" FOREIGN KEY ("redeSocialContaId") REFERENCES "RedeSocialConta"("id") ON DELETE CASCADE ON UPDATE CASCADE;
