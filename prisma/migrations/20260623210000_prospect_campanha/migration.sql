-- Migration: 20260623210000_prospect_campanha
-- Prospecção ativa do João: Campanha, Prospect, ProspectInteracao
-- REGRA: nunca remover. Apenas acrescentar.

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "StatusProspect" AS ENUM (
  'PROSPECTADO',
  'ABORDADO',
  'RESPONDEU',
  'INTERESSADO',
  'QUALIFICADO',
  'OPORTUNIDADE_CRIADA',
  'DESCARTADO'
);

CREATE TYPE "TipoInteracaoProspect" AS ENUM (
  'WHATSAPP_ENVIADO',
  'WHATSAPP_ENTREGUE',
  'WHATSAPP_LIDO',
  'WHATSAPP_RESPONDIDO',
  'EMAIL_ENVIADO',
  'EMAIL_ENTREGUE',
  'EMAIL_ABERTO',
  'EMAIL_CLICADO',
  'EMAIL_RESPONDIDO',
  'LIGACAO_REALIZADA',
  'INTERESSE_REGISTRADO',
  'QUALIFICADO_MANUAL',
  'DESCARTADO'
);

-- ─── Campanha ─────────────────────────────────────────────────────────────────

CREATE TABLE "Campanha" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "nome"        TEXT NOT NULL,
  "descricao"   TEXT,
  "agente"      TEXT NOT NULL DEFAULT 'joao-villa',
  "tipo"        TEXT NOT NULL DEFAULT 'WHATSAPP',
  "status"      TEXT NOT NULL DEFAULT 'ATIVA',
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Campanha_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Campanha_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Campanha_agente_idx"      ON "Campanha"("agente");
CREATE INDEX "Campanha_status_idx"      ON "Campanha"("status");
CREATE INDEX "Campanha_createdById_idx" ON "Campanha"("createdById");

-- ─── Prospect ─────────────────────────────────────────────────────────────────

CREATE TABLE "Prospect" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "status"         "StatusProspect" NOT NULL DEFAULT 'PROSPECTADO',
  "agente"         TEXT NOT NULL DEFAULT 'joao-villa',
  "origem"         TEXT,
  "origemDetalhe"  TEXT,
  "nomeContato"    TEXT,
  "telefone"       TEXT,
  "email"          TEXT,
  "empresaId"      TEXT,
  "pessoaId"       TEXT,
  "campanhaId"     TEXT,
  "oportunidadeId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Prospect_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Prospect_pessoaId_fkey"
    FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Prospect_campanhaId_fkey"
    FOREIGN KEY ("campanhaId") REFERENCES "Campanha"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Prospect_oportunidadeId_fkey"
    FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Prospect_status_idx"        ON "Prospect"("status");
CREATE INDEX "Prospect_agente_idx"        ON "Prospect"("agente");
CREATE INDEX "Prospect_empresaId_idx"     ON "Prospect"("empresaId");
CREATE INDEX "Prospect_pessoaId_idx"      ON "Prospect"("pessoaId");
CREATE INDEX "Prospect_campanhaId_idx"    ON "Prospect"("campanhaId");
CREATE INDEX "Prospect_telefone_idx"      ON "Prospect"("telefone");

-- ─── ProspectInteracao ────────────────────────────────────────────────────────

CREATE TABLE "ProspectInteracao" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "tipo"        "TipoInteracaoProspect" NOT NULL,
  "canal"       TEXT NOT NULL,
  "conteudo"    TEXT,
  "instancia"   TEXT,
  "waMessageId" TEXT,
  "criadoPorIA" BOOLEAN NOT NULL DEFAULT TRUE,
  "observacao"  TEXT,
  "prospectId"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProspectInteracao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProspectInteracao_prospectId_fkey"
    FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProspectInteracao_prospectId_idx" ON "ProspectInteracao"("prospectId");
CREATE INDEX "ProspectInteracao_tipo_idx"       ON "ProspectInteracao"("tipo");
CREATE INDEX "ProspectInteracao_createdAt_idx"  ON "ProspectInteracao"("createdAt");
