-- Base Nacional de Concreteiras — Fase 1 (fundação da arquitetura híbrida). 02/10/2026.
--
-- 100% ADITIVA. Este arquivo apenas:
--   * cria 7 tipos ENUM novos;
--   * cria 12 tabelas novas;
--   * cria índices e chaves estrangeiras SOMENTE nas tabelas novas;
--   * adiciona CHECKs de integridade SOMENTE nas tabelas novas.
-- Não contém DROP, DELETE, UPDATE, TRUNCATE nem RENAME. Não altera nenhuma tabela,
-- coluna, valor ou registro existente (Empresa, Usuario, DossieComercial etc.).
-- As relações com Empresa/Usuario são chaves estrangeiras declaradas nas tabelas NOVAS.
--
-- Gerado com `prisma migrate diff` (schema anterior → schema novo, sem conectar a banco)
-- e complementado à mão com os CHECKs ao final. REGRA: nunca remover.

◇ injected env (28) from .env.local // tip: ⌘ override existing { override: true }
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
-- CreateEnum
CREATE TYPE "StatusValidacaoConcreteira" AS ENUM ('PENDENTE', 'EM_VERIFICACAO', 'CONFIRMADA', 'PROVAVEL', 'NAO_E_CONCRETEIRA', 'INATIVA', 'NAO_LOCALIZADA');

-- CreateEnum
CREATE TYPE "TipoAtividadeConcreteira" AS ENUM ('CONCRETO_USINADO', 'ARGAMASSA', 'PRE_MOLDADO', 'BOMBEAMENTO', 'OUTRA_ATIVIDADE', 'DUVIDOSO');

-- CreateEnum
CREATE TYPE "ConfiancaInformacao" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "TipoUnidadeConcreteira" AS ENUM ('CENTRAL_CONCRETO', 'ESCRITORIO', 'FABRICA', 'DEPOSITO', 'DESCONHECIDA');

-- CreateEnum
CREATE TYPE "StatusCompetenciaReceita" AS ENUM ('REGISTRADA', 'BAIXANDO', 'PROCESSANDO', 'CONCLUIDA', 'FALHOU');

-- CreateEnum
CREATE TYPE "TipoMudancaReceita" AS ENUM ('NOVO_ESTABELECIMENTO', 'SAIU_DO_FILTRO', 'SITUACAO_ALTERADA', 'ENDERECO_ALTERADO', 'CNAE_ALTERADO', 'NOME_ALTERADO', 'CONTATO_ALTERADO', 'PORTE_ALTERADO', 'CAPITAL_ALTERADO', 'OUTRA');

-- CreateEnum
CREATE TYPE "TipoFonteEvidencia" AS ENUM ('RECEITA_FEDERAL', 'SITE_EMPRESA', 'GOOGLE_MAPS', 'REDE_SOCIAL', 'LINKEDIN', 'NOTICIA', 'VAGA_EMPREGO', 'LICENCA_AMBIENTAL', 'DIARIO_OFICIAL', 'ASSOCIACAO_SETORIAL', 'CONTATO_DIRETO', 'OUTRA');

-- CreateTable
CREATE TABLE "SegmentoEmpresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SegmentoEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaSegmento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "segmentoId" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "origem" TEXT,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpresaSegmento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceitaCompetencia" (
    "id" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "fonteUrl" TEXT,
    "coletadoEm" TIMESTAMP(3),
    "status" "StatusCompetenciaReceita" NOT NULL DEFAULT 'REGISTRADA',
    "cnaesFiltro" TEXT[],
    "ufsFiltro" TEXT[],
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "hashArquivos" JSONB,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceitaCompetencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceitaEstabelecimento" (
    "id" TEXT NOT NULL,
    "competenciaId" TEXT NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "cnpjBasico" CHAR(8) NOT NULL,
    "cnpjOrdem" CHAR(4) NOT NULL,
    "cnpjDv" CHAR(2) NOT NULL,
    "isMatriz" BOOLEAN NOT NULL,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "situacaoCadastral" TEXT NOT NULL,
    "dataSituacaoCadastral" DATE,
    "motivoSituacao" TEXT,
    "dataInicioAtividade" DATE,
    "cnaePrincipal" TEXT NOT NULL,
    "cnaesSecundarios" TEXT[],
    "cnaeAlvoComoPrincipal" BOOLEAN NOT NULL,
    "naturezaJuridica" TEXT,
    "porte" TEXT,
    "capitalSocial" DECIMAL(18,2),
    "opcaoSimples" BOOLEAN,
    "opcaoMei" BOOLEAN,
    "tipoLogradouro" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" VARCHAR(8),
    "municipioCodigoReceita" TEXT,
    "municipioCodigoIbge" VARCHAR(7),
    "municipioNome" TEXT,
    "uf" CHAR(2),
    "ddd1" TEXT,
    "telefone1" TEXT,
    "ddd2" TEXT,
    "telefone2" TEXT,
    "email" TEXT,
    "hashRegistro" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceitaEstabelecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceitaMudanca" (
    "id" TEXT NOT NULL,
    "competenciaId" TEXT NOT NULL,
    "competenciaAnteriorId" TEXT,
    "cnpj" CHAR(14) NOT NULL,
    "cnpjBasico" CHAR(8) NOT NULL,
    "tipo" "TipoMudancaReceita" NOT NULL,
    "campo" TEXT,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceitaMudanca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcreteiraCandidata" (
    "id" TEXT NOT NULL,
    "cnpjBasico" CHAR(8) NOT NULL,
    "cnpjMatriz" CHAR(14),
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "naturezaJuridica" TEXT,
    "porte" TEXT,
    "capitalSocial" DECIMAL(18,2),
    "ufMatriz" CHAR(2),
    "municipioMatriz" TEXT,
    "totalUnidades" INTEGER NOT NULL DEFAULT 0,
    "totalUnidadesAtivas" INTEGER NOT NULL DEFAULT 0,
    "statusValidacao" "StatusValidacaoConcreteira" NOT NULL DEFAULT 'PENDENTE',
    "tipoAtividade" "TipoAtividadeConcreteira",
    "confianca" "ConfiancaInformacao",
    "justificativa" TEXT,
    "empresaId" TEXT,
    "vinculadoEm" TIMESTAMP(3),
    "vinculadoPorId" TEXT,
    "empresaSugeridaId" TEXT,
    "criterioSugestao" TEXT,
    "primeiraVerificacaoEm" TIMESTAMP(3),
    "ultimaVerificacaoEm" TIMESTAMP(3),
    "validadoPorId" TEXT,
    "validadoEm" TIMESTAMP(3),
    "primeiraCompetencia" TEXT,
    "ultimaCompetencia" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcreteiraCandidata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcreteiraCandidataUnidade" (
    "id" TEXT NOT NULL,
    "candidataId" TEXT NOT NULL,
    "cnpj" CHAR(14) NOT NULL,
    "isMatriz" BOOLEAN NOT NULL,
    "nomeFantasia" TEXT,
    "tipoUnidade" "TipoUnidadeConcreteira" NOT NULL DEFAULT 'DESCONHECIDA',
    "situacaoCadastral" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL,
    "dataInicioAtividade" DATE,
    "cnaePrincipal" TEXT NOT NULL,
    "cnaesSecundarios" TEXT[],
    "cnaeAlvoComoPrincipal" BOOLEAN NOT NULL,
    "tipoLogradouro" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" VARCHAR(8),
    "municipioCodigoIbge" VARCHAR(7),
    "municipioNome" TEXT,
    "uf" CHAR(2),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "telefone" TEXT,
    "email" TEXT,
    "primeiraCompetencia" TEXT,
    "ultimaCompetencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcreteiraCandidataUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaUnidade" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "cnpj" CHAR(14),
    "isMatriz" BOOLEAN NOT NULL DEFAULT false,
    "nome" TEXT,
    "tipoUnidade" "TipoUnidadeConcreteira" NOT NULL DEFAULT 'DESCONHECIDA',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" VARCHAR(8),
    "municipioCodigoIbge" VARCHAR(7),
    "municipioNome" TEXT,
    "uf" CHAR(2),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "telefone" TEXT,
    "email" TEXT,
    "candidataUnidadeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaValidacaoConcreteira" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "status" "StatusValidacaoConcreteira" NOT NULL,
    "tipoAtividade" "TipoAtividadeConcreteira",
    "confianca" "ConfiancaInformacao",
    "justificativa" TEXT,
    "possuiBombaPropria" BOOLEAN,
    "quantidadeCentraisEstimada" INTEGER,
    "frotaEstimada" INTEGER,
    "primeiraVerificacaoEm" TIMESTAMP(3),
    "ultimaVerificacaoEm" TIMESTAMP(3),
    "validadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaValidacaoConcreteira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcreteiraEvidencia" (
    "id" TEXT NOT NULL,
    "candidataId" TEXT,
    "empresaId" TEXT,
    "tipoFonte" "TipoFonteEvidencia" NOT NULL,
    "titulo" TEXT,
    "url" TEXT,
    "trecho" TEXT,
    "coletadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confianca" "ConfiancaInformacao",
    "registradoPorId" TEXT,
    "agente" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcreteiraEvidencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConcreteiraValidacaoHistorico" (
    "id" TEXT NOT NULL,
    "candidataId" TEXT,
    "empresaId" TEXT,
    "statusAnterior" "StatusValidacaoConcreteira",
    "statusNovo" "StatusValidacaoConcreteira" NOT NULL,
    "tipoAnterior" "TipoAtividadeConcreteira",
    "tipoNovo" "TipoAtividadeConcreteira",
    "confiancaAnterior" "ConfiancaInformacao",
    "confiancaNova" "ConfiancaInformacao",
    "motivo" TEXT,
    "usuarioId" TEXT,
    "agente" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConcreteiraValidacaoHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioConcreteirasGerado" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "filtros" JSONB NOT NULL,
    "totalRegistros" INTEGER NOT NULL,
    "geradoPorId" TEXT,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioConcreteirasGerado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SegmentoEmpresa_nome_key" ON "SegmentoEmpresa"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentoEmpresa_slug_key" ON "SegmentoEmpresa"("slug");

-- CreateIndex
CREATE INDEX "SegmentoEmpresa_ativo_idx" ON "SegmentoEmpresa"("ativo");

-- CreateIndex
CREATE INDEX "EmpresaSegmento_segmentoId_idx" ON "EmpresaSegmento"("segmentoId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaSegmento_empresaId_segmentoId_key" ON "EmpresaSegmento"("empresaId", "segmentoId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceitaCompetencia_competencia_key" ON "ReceitaCompetencia"("competencia");

-- CreateIndex
CREATE INDEX "ReceitaEstabelecimento_cnpj_idx" ON "ReceitaEstabelecimento"("cnpj");

-- CreateIndex
CREATE INDEX "ReceitaEstabelecimento_cnpjBasico_idx" ON "ReceitaEstabelecimento"("cnpjBasico");

-- CreateIndex
CREATE INDEX "ReceitaEstabelecimento_competenciaId_uf_idx" ON "ReceitaEstabelecimento"("competenciaId", "uf");

-- CreateIndex
CREATE INDEX "ReceitaEstabelecimento_competenciaId_municipioCodigoIbge_idx" ON "ReceitaEstabelecimento"("competenciaId", "municipioCodigoIbge");

-- CreateIndex
CREATE INDEX "ReceitaEstabelecimento_competenciaId_situacaoCadastral_idx" ON "ReceitaEstabelecimento"("competenciaId", "situacaoCadastral");

-- CreateIndex
CREATE UNIQUE INDEX "ReceitaEstabelecimento_competenciaId_cnpj_key" ON "ReceitaEstabelecimento"("competenciaId", "cnpj");

-- CreateIndex
CREATE INDEX "ReceitaMudanca_competenciaId_tipo_idx" ON "ReceitaMudanca"("competenciaId", "tipo");

-- CreateIndex
CREATE INDEX "ReceitaMudanca_cnpj_idx" ON "ReceitaMudanca"("cnpj");

-- CreateIndex
CREATE INDEX "ReceitaMudanca_cnpjBasico_idx" ON "ReceitaMudanca"("cnpjBasico");

-- CreateIndex
CREATE UNIQUE INDEX "ConcreteiraCandidata_cnpjBasico_key" ON "ConcreteiraCandidata"("cnpjBasico");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidata_statusValidacao_idx" ON "ConcreteiraCandidata"("statusValidacao");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidata_tipoAtividade_idx" ON "ConcreteiraCandidata"("tipoAtividade");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidata_ufMatriz_idx" ON "ConcreteiraCandidata"("ufMatriz");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidata_empresaId_idx" ON "ConcreteiraCandidata"("empresaId");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidata_empresaSugeridaId_idx" ON "ConcreteiraCandidata"("empresaSugeridaId");

-- CreateIndex
CREATE UNIQUE INDEX "ConcreteiraCandidataUnidade_cnpj_key" ON "ConcreteiraCandidataUnidade"("cnpj");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidataUnidade_candidataId_idx" ON "ConcreteiraCandidataUnidade"("candidataId");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidataUnidade_uf_idx" ON "ConcreteiraCandidataUnidade"("uf");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidataUnidade_uf_municipioCodigoIbge_idx" ON "ConcreteiraCandidataUnidade"("uf", "municipioCodigoIbge");

-- CreateIndex
CREATE INDEX "ConcreteiraCandidataUnidade_ativa_idx" ON "ConcreteiraCandidataUnidade"("ativa");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaUnidade_cnpj_key" ON "EmpresaUnidade"("cnpj");

-- CreateIndex
CREATE INDEX "EmpresaUnidade_empresaId_idx" ON "EmpresaUnidade"("empresaId");

-- CreateIndex
CREATE INDEX "EmpresaUnidade_uf_municipioCodigoIbge_idx" ON "EmpresaUnidade"("uf", "municipioCodigoIbge");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaValidacaoConcreteira_empresaId_key" ON "EmpresaValidacaoConcreteira"("empresaId");

-- CreateIndex
CREATE INDEX "EmpresaValidacaoConcreteira_status_idx" ON "EmpresaValidacaoConcreteira"("status");

-- CreateIndex
CREATE INDEX "EmpresaValidacaoConcreteira_tipoAtividade_idx" ON "EmpresaValidacaoConcreteira"("tipoAtividade");

-- CreateIndex
CREATE INDEX "ConcreteiraEvidencia_candidataId_idx" ON "ConcreteiraEvidencia"("candidataId");

-- CreateIndex
CREATE INDEX "ConcreteiraEvidencia_empresaId_idx" ON "ConcreteiraEvidencia"("empresaId");

-- CreateIndex
CREATE INDEX "ConcreteiraEvidencia_tipoFonte_idx" ON "ConcreteiraEvidencia"("tipoFonte");

-- CreateIndex
CREATE INDEX "ConcreteiraValidacaoHistorico_candidataId_createdAt_idx" ON "ConcreteiraValidacaoHistorico"("candidataId", "createdAt");

-- CreateIndex
CREATE INDEX "ConcreteiraValidacaoHistorico_empresaId_createdAt_idx" ON "ConcreteiraValidacaoHistorico"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "RelatorioConcreteirasGerado_geradoEm_idx" ON "RelatorioConcreteirasGerado"("geradoEm");

-- AddForeignKey
ALTER TABLE "EmpresaSegmento" ADD CONSTRAINT "EmpresaSegmento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaSegmento" ADD CONSTRAINT "EmpresaSegmento_segmentoId_fkey" FOREIGN KEY ("segmentoId") REFERENCES "SegmentoEmpresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaSegmento" ADD CONSTRAINT "EmpresaSegmento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceitaEstabelecimento" ADD CONSTRAINT "ReceitaEstabelecimento_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "ReceitaCompetencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceitaMudanca" ADD CONSTRAINT "ReceitaMudanca_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "ReceitaCompetencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceitaMudanca" ADD CONSTRAINT "ReceitaMudanca_competenciaAnteriorId_fkey" FOREIGN KEY ("competenciaAnteriorId") REFERENCES "ReceitaCompetencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_vinculadoPorId_fkey" FOREIGN KEY ("vinculadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_empresaSugeridaId_fkey" FOREIGN KEY ("empresaSugeridaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraCandidataUnidade" ADD CONSTRAINT "ConcreteiraCandidataUnidade_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaUnidade" ADD CONSTRAINT "EmpresaUnidade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaUnidade" ADD CONSTRAINT "EmpresaUnidade_candidataUnidadeId_fkey" FOREIGN KEY ("candidataUnidadeId") REFERENCES "ConcreteiraCandidataUnidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaValidacaoConcreteira" ADD CONSTRAINT "EmpresaValidacaoConcreteira_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpresaValidacaoConcreteira" ADD CONSTRAINT "EmpresaValidacaoConcreteira_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraEvidencia" ADD CONSTRAINT "ConcreteiraEvidencia_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraEvidencia" ADD CONSTRAINT "ConcreteiraEvidencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraEvidencia" ADD CONSTRAINT "ConcreteiraEvidencia_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD CONSTRAINT "ConcreteiraValidacaoHistorico_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD CONSTRAINT "ConcreteiraValidacaoHistorico_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD CONSTRAINT "ConcreteiraValidacaoHistorico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioConcreteirasGerado" ADD CONSTRAINT "RelatorioConcreteirasGerado_geradoPorId_fkey" FOREIGN KEY ("geradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── CHECKs de integridade (somente tabelas novas) ────────────────────────────

ALTER TABLE "ReceitaCompetencia" ADD CONSTRAINT "ReceitaCompetencia_competencia_formato_chk" CHECK ("competencia" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "ReceitaEstabelecimento" ADD CONSTRAINT "ReceitaEstabelecimento_cnpj_digitos_chk" CHECK ("cnpj" ~ '^[0-9]{14}$' AND "cnpjBasico" = substr("cnpj", 1, 8) AND "cnpjOrdem" = substr("cnpj", 9, 4) AND "cnpjDv" = substr("cnpj", 13, 2));

ALTER TABLE "ReceitaMudanca" ADD CONSTRAINT "ReceitaMudanca_cnpj_digitos_chk" CHECK ("cnpj" ~ '^[0-9]{14}$' AND "cnpjBasico" = substr("cnpj", 1, 8));

ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_cnpj_digitos_chk" CHECK ("cnpjBasico" ~ '^[0-9]{8}$' AND ("cnpjMatriz" IS NULL OR ("cnpjMatriz" ~ '^[0-9]{14}$' AND substr("cnpjMatriz", 1, 8) = "cnpjBasico")));

ALTER TABLE "ConcreteiraCandidataUnidade" ADD CONSTRAINT "ConcreteiraCandidataUnidade_cnpj_digitos_chk" CHECK ("cnpj" ~ '^[0-9]{14}$');

ALTER TABLE "EmpresaUnidade" ADD CONSTRAINT "EmpresaUnidade_cnpj_digitos_chk" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9]{14}$');

ALTER TABLE "ConcreteiraEvidencia" ADD CONSTRAINT "ConcreteiraEvidencia_alvo_chk" CHECK ("candidataId" IS NOT NULL OR "empresaId" IS NOT NULL);

ALTER TABLE "ConcreteiraValidacaoHistorico" ADD CONSTRAINT "ConcreteiraValidacaoHistorico_alvo_chk" CHECK ("candidataId" IS NOT NULL OR "empresaId" IS NOT NULL);
