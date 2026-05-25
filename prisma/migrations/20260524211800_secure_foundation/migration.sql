-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Empresa"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Pessoa"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Obra"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Oportunidade"
ADD COLUMN "ativa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "HistoricoContato"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Equipamento"
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Empresa_createdById_idx" ON "Empresa"("createdById");
CREATE INDEX "Empresa_updatedById_idx" ON "Empresa"("updatedById");
CREATE INDEX "Pessoa_createdById_idx" ON "Pessoa"("createdById");
CREATE INDEX "Pessoa_updatedById_idx" ON "Pessoa"("updatedById");
CREATE INDEX "Obra_createdById_idx" ON "Obra"("createdById");
CREATE INDEX "Obra_updatedById_idx" ON "Obra"("updatedById");
CREATE INDEX "Oportunidade_createdById_idx" ON "Oportunidade"("createdById");
CREATE INDEX "Oportunidade_updatedById_idx" ON "Oportunidade"("updatedById");
CREATE INDEX "Oportunidade_ativa_idx" ON "Oportunidade"("ativa");
CREATE INDEX "HistoricoContato_createdById_idx" ON "HistoricoContato"("createdById");
CREATE INDEX "HistoricoContato_updatedById_idx" ON "HistoricoContato"("updatedById");
CREATE INDEX "Equipamento_createdById_idx" ON "Equipamento"("createdById");
CREATE INDEX "Equipamento_updatedById_idx" ON "Equipamento"("updatedById");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HistoricoContato" ADD CONSTRAINT "HistoricoContato_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HistoricoContato" ADD CONSTRAINT "HistoricoContato_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
