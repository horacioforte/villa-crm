-- Módulo Central de Mídias Sociais — Sprint 1 (RedeSocialConta).
-- Escrita à mão (em vez de gerada por `prisma migrate dev`) porque o ambiente
-- reportou o mesmo drift pré-existente já visto na migration de Contratos
-- (20260821000000_add_analise_contrato) em tabelas não relacionadas (Prospect,
-- ProspectInteracao, RadarPendingOportunidade, TemplateResposta), e a única
-- saída oferecida pelo `migrate dev` era `prisma migrate reset` — que apagaria
-- todo o banco compartilhado. Este arquivo é 100% aditivo (2 novos ENUMs +
-- 1 nova tabela) e não altera nenhuma tabela existente, então pode ser
-- aplicado com `prisma migrate deploy` sem tocar no drift pré-existente.
--
-- Revisão 2 (aprovada): RedeSocialConta representa uma CONTA, não a rede em
-- si. @@unique([rede]) foi substituído por @@unique([rede, nome]) para
-- permitir múltiplas contas da mesma rede no futuro (ex.: mais de um
-- Instagram, mais de uma página Facebook, marcas/unidades diferentes).

-- CreateEnum
CREATE TYPE "RedeSocialTipo" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "RedeSocialStatusConexao" AS ENUM ('NAO_CONECTADO', 'CONECTADO', 'ERRO', 'TOKEN_EXPIRADO');

-- CreateTable
CREATE TABLE "RedeSocialConta" (
    "id" TEXT NOT NULL,
    "rede" "RedeSocialTipo" NOT NULL,
    "nome" TEXT NOT NULL,
    "businessId" TEXT,
    "pageId" TEXT,
    "contaAnunciosId" TEXT,
    "accessTokenEnvVar" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "statusConexao" "RedeSocialStatusConexao" NOT NULL DEFAULT 'NAO_CONECTADO',
    "ultimaSincronizacaoEm" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedeSocialConta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedeSocialConta_rede_nome_key" ON "RedeSocialConta"("rede", "nome");

-- CreateIndex
CREATE INDEX "RedeSocialConta_ativo_idx" ON "RedeSocialConta"("ativo");

-- AddForeignKey
ALTER TABLE "RedeSocialConta" ADD CONSTRAINT "RedeSocialConta_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
