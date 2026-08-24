-- Fase 1A — João: infraestrutura estrutural de Evidências, Movimentações e Scores.
-- Este arquivo é aditivo e não destrói tabelas ou colunas existentes.
-- Ele preserva as Carteiras Estratégicas já existentes em DossieCarteira.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FaseObra') THEN
    CREATE TYPE "FaseObra" AS ENUM (
      'TERRENO',
      'PROJETO',
      'LICENCIAMENTO',
      'LANCAMENTO',
      'MOBILIZACAO',
      'TERRAPLENAGEM',
      'FUNDACAO',
      'CONCRETAGEM',
      'ESTRUTURA',
      'ACABAMENTO',
      'CONCLUIDA'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEvidencia') THEN
    CREATE TYPE "TipoEvidencia" AS ENUM (
      'NOVA_OBRA',
      'NOVO_EMPREENDIMENTO',
      'LICENCIAMENTO',
      'ALVARA',
      'CONTRATO_PUBLICO',
      'MOBILIZACAO',
      'TERRAPLENAGEM',
      'FUNDACAO',
      'CONCRETAGEM',
      'ESTRUTURA',
      'EXPANSAO',
      'NOVA_UNIDADE',
      'CONTRATACAO',
      'MUDANCA_EXECUTIVO',
      'COMPRA_EQUIPAMENTO',
      'VENDA_EQUIPAMENTO',
      'NOTICIA',
      'POST_LINKEDIN',
      'POST_INSTAGRAM',
      'OUTRO'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusEvidencia') THEN
    CREATE TYPE "StatusEvidencia" AS ENUM (
      'CONFIRMADA',
      'FORTE',
      'PROVAVEL',
      'SINAL'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoEvidencia') THEN
    CREATE TYPE "EstadoEvidencia" AS ENUM (
      'ATIVA',
      'PENDENTE_VALIDACAO',
      'DESCARTADA',
      'SUPERADA'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FonteEvidencia') THEN
    CREATE TYPE "FonteEvidencia" AS ENUM (
      'OFICIAL',
      'EMPRESA',
      'ASSOCIACAO',
      'MIDIA',
      'REDE_SOCIAL',
      'BASE_EMPRESARIAL',
      'RANKING',
      'IMPORTACAO_MANUAL',
      'OUTRA'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoMovimentacao') THEN
    CREATE TYPE "TipoMovimentacao" AS ENUM (
      'OBRA_DETECTADA',
      'NOVA_OBRA',
      'NOVO_EMPREENDIMENTO',
      'LICENCIAMENTO_EM_ANDAMENTO',
      'ALVARA_EMITIDO',
      'MOBILIZACAO_INICIADA',
      'TERRAPLENAGEM',
      'FUNDACAO_INICIADA',
      'CONCRETAGEM',
      'ESTRUTURA_EM_ANDAMENTO',
      'EXPANSAO',
      'NOVA_UNIDADE',
      'CONTRATACAO_EM_ANDAMENTO',
      'MUDANCA_EXECUTIVO',
      'COMPRA_EQUIPAMENTO',
      'VENDA_EQUIPAMENTO',
      'SINAL_DE_MERCADO',
      'OUTRA'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusMovimentacao') THEN
    CREATE TYPE "StatusMovimentacao" AS ENUM (
      'ATIVA',
      'RESOLVIDA',
      'DESCARTADA',
      'SUPERADA'
    );
  END IF;
END $$;

ALTER TABLE "Obra"
  ADD COLUMN IF NOT EXISTS "faseAtual" "FaseObra",
  ADD COLUMN IF NOT EXISTS "ultimaMovimentacao" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "origemObra" TEXT;

ALTER TABLE "DossieComercial"
  ADD COLUMN IF NOT EXISTS "potencialVilla" INTEGER,
  ADD COLUMN IF NOT EXISTS "momentoVilla" INTEGER,
  ADD COLUMN IF NOT EXISTS "prontidao" INTEGER,
  ADD COLUMN IF NOT EXISTS "prioridadeJoao" INTEGER,
  ADD COLUMN IF NOT EXISTS "potencialMcmv" INTEGER,
  ADD COLUMN IF NOT EXISTS "momentoMcmv" INTEGER,
  ADD COLUMN IF NOT EXISTS "prioridadeMcmv" INTEGER,
  ADD COLUMN IF NOT EXISTS "motivoPrioridade" TEXT;

CREATE TABLE IF NOT EXISTS "DossieEvidencia" (
  "id" TEXT NOT NULL,
  "dossieId" TEXT NOT NULL,
  "obraId" TEXT,
  "tipo" "TipoEvidencia" NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "fonteTipo" "FonteEvidencia" NOT NULL DEFAULT 'OUTRA',
  "fonteNome" TEXT,
  "url" TEXT,
  "dataInformacao" TIMESTAMP(3),
  "dataColeta" TIMESTAMP(3),
  "confianca" "StatusEvidencia" NOT NULL DEFAULT 'SINAL',
  "estado" "EstadoEvidencia" NOT NULL DEFAULT 'ATIVA',
  "hashConteudo" TEXT,
  "hashUrl" TEXT,
  "conteudoBruto" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DossieEvidencia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DossieEvidencia_dossieId_fkey"
    FOREIGN KEY ("dossieId") REFERENCES "DossieComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DossieEvidencia_obraId_fkey"
    FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DossieEvidencia_dossieId_idx"
  ON "DossieEvidencia" ("dossieId");

CREATE INDEX IF NOT EXISTS "DossieEvidencia_obraId_idx"
  ON "DossieEvidencia" ("obraId");

CREATE INDEX IF NOT EXISTS "DossieEvidencia_tipo_idx"
  ON "DossieEvidencia" ("tipo");

CREATE INDEX IF NOT EXISTS "DossieEvidencia_hashConteudo_idx"
  ON "DossieEvidencia" ("hashConteudo");

CREATE INDEX IF NOT EXISTS "DossieEvidencia_hashUrl_idx"
  ON "DossieEvidencia" ("hashUrl");

CREATE INDEX IF NOT EXISTS "DossieEvidencia_dataInformacao_idx"
  ON "DossieEvidencia" ("dataInformacao");

CREATE TABLE IF NOT EXISTS "DossieMovimentacao" (
  "id" TEXT NOT NULL,
  "dossieId" TEXT NOT NULL,
  "obraId" TEXT,
  "tipo" "TipoMovimentacao" NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "momento" TIMESTAMP(3),
  "relevancia" INTEGER NOT NULL DEFAULT 0,
  "status" "StatusMovimentacao" NOT NULL DEFAULT 'ATIVA',
  "hashUnico" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DossieMovimentacao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DossieMovimentacao_dossieId_fkey"
    FOREIGN KEY ("dossieId") REFERENCES "DossieComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DossieMovimentacao_obraId_fkey"
    FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DossieMovimentacao_hashUnico_key" UNIQUE ("hashUnico")
);

CREATE INDEX IF NOT EXISTS "DossieMovimentacao_dossieId_idx"
  ON "DossieMovimentacao" ("dossieId");

CREATE INDEX IF NOT EXISTS "DossieMovimentacao_obraId_idx"
  ON "DossieMovimentacao" ("obraId");

CREATE INDEX IF NOT EXISTS "DossieMovimentacao_tipo_idx"
  ON "DossieMovimentacao" ("tipo");

CREATE INDEX IF NOT EXISTS "DossieMovimentacao_status_idx"
  ON "DossieMovimentacao" ("status");

CREATE TABLE IF NOT EXISTS "DossieMovimentacaoEvidencia" (
  "id" TEXT NOT NULL,
  "movimentacaoId" TEXT NOT NULL,
  "evidenciaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DossieMovimentacaoEvidencia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DossieMovimentacaoEvidencia_movimentacaoId_fkey"
    FOREIGN KEY ("movimentacaoId") REFERENCES "DossieMovimentacao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DossieMovimentacaoEvidencia_evidenciaId_fkey"
    FOREIGN KEY ("evidenciaId") REFERENCES "DossieEvidencia"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DossieMovimentacaoEvidencia_movimentacaoId_evidenciaId_key" UNIQUE ("movimentacaoId", "evidenciaId")
);

CREATE INDEX IF NOT EXISTS "DossieMovimentacaoEvidencia_evidenciaId_idx"
  ON "DossieMovimentacaoEvidencia" ("evidenciaId");
