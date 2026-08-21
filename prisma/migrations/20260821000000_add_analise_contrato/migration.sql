-- Módulo Análise de Contratos.
-- Escrita à mão (em vez de gerada por `prisma migrate dev`) porque o ambiente
-- reportou drift de migração em tabelas não relacionadas (Prospect,
-- ProspectInteracao, RadarPendingOportunidade, TemplateResposta) e a única
-- saída oferecida pelo `migrate dev` era `prisma migrate reset` — que apagaria
-- todo o banco. Este arquivo é 100% aditivo (novos ENUMs + nova tabela) e não
-- altera nenhuma tabela existente, então pode ser aplicado com
-- `prisma migrate deploy` sem tocar no drift pré-existente.

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('CAMINHAO_BETONEIRA', 'AUTO_BOMBA', 'USINA_CONCRETO', 'GERAL_OUTRO');

-- CreateEnum
CREATE TYPE "NivelRisco" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

-- CreateTable
CREATE TABLE "AnaliseContrato" (
    "id" TEXT NOT NULL,
    "nomeArquivo" TEXT,
    "tipoContrato" "TipoContrato" NOT NULL,
    "tipoDetectado" TEXT,
    "partes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "prazo" TEXT,
    "valor" TEXT,
    "reajuste" TEXT,
    "riscoGeral" "NivelRisco",
    "resumo" TEXT,
    "resultado" JSONB NOT NULL,
    "textoAnalisado" TEXT,
    "empresaId" TEXT,
    "oportunidadeId" TEXT,
    "filialId" TEXT,
    "createdById" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnaliseContrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnaliseContrato_empresaId_idx" ON "AnaliseContrato"("empresaId");

-- CreateIndex
CREATE INDEX "AnaliseContrato_oportunidadeId_idx" ON "AnaliseContrato"("oportunidadeId");

-- CreateIndex
CREATE INDEX "AnaliseContrato_filialId_idx" ON "AnaliseContrato"("filialId");

-- CreateIndex
CREATE INDEX "AnaliseContrato_createdById_idx" ON "AnaliseContrato"("createdById");

-- CreateIndex
CREATE INDEX "AnaliseContrato_riscoGeral_idx" ON "AnaliseContrato"("riscoGeral");

-- CreateIndex
CREATE INDEX "AnaliseContrato_criadoEm_idx" ON "AnaliseContrato"("criadoEm");

-- AddForeignKey
ALTER TABLE "AnaliseContrato" ADD CONSTRAINT "AnaliseContrato_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseContrato" ADD CONSTRAINT "AnaliseContrato_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseContrato" ADD CONSTRAINT "AnaliseContrato_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseContrato" ADD CONSTRAINT "AnaliseContrato_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
