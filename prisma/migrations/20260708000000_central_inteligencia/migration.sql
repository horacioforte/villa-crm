-- ARQUIVO: prisma/migrations/20260708000000_central_inteligencia/migration.sql
-- Central de Inteligência Comercial — João Hunter IA
-- REGRA: nunca remover. Apenas acrescentar.
-- Criado em: 08/07/2026

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "OrigemDossie" AS ENUM (
  'JOAO_RADAR',
  'JOAO_OUTBOUND',
  'MANUAL'
);

CREATE TYPE "TipoDossie" AS ENUM (
  'OBRA',
  'EMPRESA',
  'MOVIMENTO_ESTRATEGICO',
  'LICENCIAMENTO',
  'LEAD'
);

CREATE TYPE "StatusDossie" AS ENUM (
  'INVESTIGANDO',
  'AGUARDANDO_VALIDACAO',
  'EM_ANALISE',
  'PEDIR_MAIS_PESQUISA',
  'PRONTO_PARA_ASSUMIR',
  'ASSUMIDO',
  'ARQUIVADO'
);

CREATE TYPE "TipoAtualizacaoDossie" AS ENUM (
  'CRIACAO',
  'CAMPO_ATUALIZADO',
  'DECISOR_ENCONTRADO',
  'EMPRESA_ENCONTRADA',
  'NOTICIA_ENCONTRADA',
  'MISSAO_CONCLUIDA',
  'MISSAO_DEFINIDA',
  'SOLICITACAO_PESQUISA',
  'ANALISE_MORGANA',
  'ASSUMIDO_PELO_COMERCIAL',
  'MONITORAMENTO'
);

-- ── DossieComercial ───────────────────────────────────────────────────────────

CREATE TABLE "DossieComercial" (
  "id"                   TEXT NOT NULL,
  "titulo"               TEXT NOT NULL,
  "resumo"               TEXT,
  "origem"               "OrigemDossie" NOT NULL,
  "tipo"                 "TipoDossie" NOT NULL DEFAULT 'OBRA',
  "status"               "StatusDossie" NOT NULL DEFAULT 'INVESTIGANDO',
  "segmento"             TEXT,

  -- Localização
  "cidade"               TEXT,
  "estado"               TEXT,

  -- Obra / Projeto
  "clienteFinal"         TEXT,
  "construtora"          TEXT,
  "epc"                  TEXT,
  "epcm"                 TEXT,
  "consorcio"            TEXT,
  "faseObra"             TEXT,
  "cronograma"           TEXT,
  "licenciamento"        TEXT,
  "valorEstimado"        DECIMAL(15,2),
  "volumeConcreto"       DECIMAL(12,2),

  -- Inteligência Comercial
  "equipamentosSugeridos" TEXT,
  "campanhasSugerida"    TEXT,
  "proximaAcaoSugerida"  TEXT,
  "concorrentes"         TEXT,
  "fornecedores"         TEXT,
  "concreteiras"         TEXT,

  -- Fonte
  "fonteInformacao"      TEXT,
  "linkFonte"            TEXT,

  -- Score e Completude
  "score"                INTEGER NOT NULL DEFAULT 0,
  "completude"           INTEGER NOT NULL DEFAULT 0,
  "prioridade"           TEXT,

  -- Missão João
  "missaoAtual"          TEXT,

  -- Contadores cacheados
  "totalDecisores"       INTEGER NOT NULL DEFAULT 0,
  "totalEmpresas"        INTEGER NOT NULL DEFAULT 0,
  "totalNoticias"        INTEGER NOT NULL DEFAULT 0,
  "totalAtualizacoes"    INTEGER NOT NULL DEFAULT 0,

  -- Vínculos CRM
  "empresaId"            TEXT,
  "obraId"               TEXT,
  "oportunidadeId"       TEXT,

  -- Assunção
  "assumidoPorId"        TEXT,
  "assumidaEm"           TIMESTAMP(3),

  -- Descarte
  "motivoDescarte"       TEXT,

  -- Audit
  "criadoPorAgente"      TEXT NOT NULL DEFAULT 'joao-radar',
  "ultimaAtividade"      TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DossieComercial_pkey" PRIMARY KEY ("id")
);

-- ── DecisorDossie ─────────────────────────────────────────────────────────────

CREATE TABLE "DecisorDossie" (
  "id"        TEXT NOT NULL,
  "nome"      TEXT NOT NULL,
  "cargo"     TEXT,
  "empresa"   TEXT,
  "telefone"  TEXT,
  "email"     TEXT,
  "linkedin"  TEXT,
  "confianca" INTEGER NOT NULL DEFAULT 50,
  "fonte"     TEXT,
  "ativo"     BOOLEAN NOT NULL DEFAULT true,
  "dossieId"  TEXT NOT NULL,
  "pessoaId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DecisorDossie_pkey" PRIMARY KEY ("id")
);

-- ── EmpresaDossie ─────────────────────────────────────────────────────────────

CREATE TABLE "EmpresaDossie" (
  "id"          TEXT NOT NULL,
  "razaoSocial" TEXT NOT NULL,
  "papel"       TEXT NOT NULL,
  "cidade"      TEXT,
  "estado"      TEXT,
  "cnpj"        TEXT,
  "site"        TEXT,
  "fonte"       TEXT,
  "ativo"       BOOLEAN NOT NULL DEFAULT true,
  "dossieId"    TEXT NOT NULL,
  "empresaId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmpresaDossie_pkey" PRIMARY KEY ("id")
);

-- ── AtualizacaoDossie ─────────────────────────────────────────────────────────

CREATE TABLE "AtualizacaoDossie" (
  "id"             TEXT NOT NULL,
  "tipo"           "TipoAtualizacaoDossie" NOT NULL,
  "titulo"         TEXT NOT NULL,
  "conteudo"       TEXT NOT NULL,
  "fonte"          TEXT,
  "link"           TEXT,
  "agente"         TEXT,
  "dossieId"       TEXT NOT NULL,
  "oportunidadeId" TEXT,
  "usuarioId"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AtualizacaoDossie_pkey" PRIMARY KEY ("id")
);

-- ── Foreign Keys ──────────────────────────────────────────────────────────────

ALTER TABLE "DossieComercial"
  ADD CONSTRAINT "DossieComercial_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DossieComercial_obraId_fkey"
    FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DossieComercial_oportunidadeId_fkey"
    FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "DossieComercial_assumidoPorId_fkey"
    FOREIGN KEY ("assumidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DecisorDossie"
  ADD CONSTRAINT "DecisorDossie_dossieId_fkey"
    FOREIGN KEY ("dossieId") REFERENCES "DossieComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DecisorDossie_pessoaId_fkey"
    FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmpresaDossie"
  ADD CONSTRAINT "EmpresaDossie_dossieId_fkey"
    FOREIGN KEY ("dossieId") REFERENCES "DossieComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EmpresaDossie_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AtualizacaoDossie"
  ADD CONSTRAINT "AtualizacaoDossie_dossieId_fkey"
    FOREIGN KEY ("dossieId") REFERENCES "DossieComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Índices ───────────────────────────────────────────────────────────────────

CREATE INDEX "DossieComercial_status_idx" ON "DossieComercial"("status");
CREATE INDEX "DossieComercial_estado_idx" ON "DossieComercial"("estado");
CREATE INDEX "DossieComercial_segmento_idx" ON "DossieComercial"("segmento");
CREATE INDEX "DossieComercial_score_idx" ON "DossieComercial"("score");
CREATE INDEX "DossieComercial_completude_idx" ON "DossieComercial"("completude");
CREATE INDEX "DossieComercial_origem_idx" ON "DossieComercial"("origem");
CREATE INDEX "DossieComercial_empresaId_idx" ON "DossieComercial"("empresaId");
CREATE INDEX "DossieComercial_obraId_idx" ON "DossieComercial"("obraId");
CREATE INDEX "DossieComercial_oportunidadeId_idx" ON "DossieComercial"("oportunidadeId");
CREATE INDEX "DossieComercial_createdAt_idx" ON "DossieComercial"("createdAt");
CREATE INDEX "DossieComercial_ultimaAtividade_idx" ON "DossieComercial"("ultimaAtividade");

CREATE INDEX "DecisorDossie_dossieId_idx" ON "DecisorDossie"("dossieId");
CREATE INDEX "DecisorDossie_pessoaId_idx" ON "DecisorDossie"("pessoaId");
CREATE INDEX "DecisorDossie_nome_idx" ON "DecisorDossie"("nome");

CREATE INDEX "EmpresaDossie_dossieId_idx" ON "EmpresaDossie"("dossieId");
CREATE INDEX "EmpresaDossie_empresaId_idx" ON "EmpresaDossie"("empresaId");
CREATE INDEX "EmpresaDossie_papel_idx" ON "EmpresaDossie"("papel");

CREATE INDEX "AtualizacaoDossie_dossieId_idx" ON "AtualizacaoDossie"("dossieId");
CREATE INDEX "AtualizacaoDossie_tipo_idx" ON "AtualizacaoDossie"("tipo");
CREATE INDEX "AtualizacaoDossie_oportunidadeId_idx" ON "AtualizacaoDossie"("oportunidadeId");
CREATE INDEX "AtualizacaoDossie_createdAt_idx" ON "AtualizacaoDossie"("createdAt");
