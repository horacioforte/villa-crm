-- MIGRATION v4 — Base Nacional de Concreteiras: validação manual, contatos e qualificação comercial
-- PROPOSTA. NÃO APLICAR sem autorização expressa do Horácio.
-- Destino autorizado (após aprovação): SOMENTE o branch Neon "base-nacional-concreteiras"
-- (endpoint ep-gentle-king-ajo60u4q), via prisma.config.base-nacional.ts.
--
-- Escopo, estritamente ADITIVO:
--   * cria 8 tipos enum novos;
--   * cria 3 tabelas novas (contatos, pessoas e potencial por equipamento da candidata);
--   * preenche a nova coluna "nomeOrdenacao" ANTES de criar os CHECKs;
--   * acrescenta colunas OPCIONAIS ou com DEFAULT às tabelas novas da v3
--     (ConcreteiraCandidata, ConcreteiraValidacaoHistorico, ConcreteiraEvidencia);
--   * acrescenta índices e CHECKs somente nessas tabelas;
-- NÃO altera, renomeia nem remove nenhuma coluna, tabela, tipo ou dado existente.
-- NÃO toca Empresa, Pessoa, DossieComercial, DossieCarteira, Oportunidade, Tarefa nem qualquer
-- tabela anterior à v3 (as únicas referências a tabelas antigas são chaves estrangeiras
-- para "Usuario", com ON DELETE SET NULL, iguais às da v3).
-- Nenhum campo de preço ou valor monetário é criado.
-- REGRA: nunca remover. Apenas acrescentar.

-- ============================================================================
-- 1. TIPOS ENUM
-- ============================================================================

-- Tipo do evento registrado no histórico de validação.
CREATE TYPE "TipoEventoBaseNacional" AS ENUM ('VALIDACAO', 'TIPO_UNIDADE', 'VINCULO_EMPRESA', 'EVIDENCIA', 'CONTATO', 'PESSOA', 'POTENCIAL_EQUIPAMENTO', 'QUALIFICACAO', 'OUTRO');

-- De onde partiu a ação registrada no histórico.
CREATE TYPE "OrigemAcaoBaseNacional" AS ENUM ('TELA_BASE_NACIONAL', 'IMPORTACAO_RECEITA', 'SCRIPT_DEMONSTRACAO', 'NAO_INFORMADA');

-- Tipo do contato institucional da candidata.
CREATE TYPE "TipoContatoCandidata" AS ENUM ('TELEFONE', 'WHATSAPP', 'EMAIL', 'SITE', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'OUTRO');

-- Situação de verificação de contatos e pessoas.
CREATE TYPE "SituacaoVerificacaoContato" AS ENUM ('VERIFICADO', 'NAO_VERIFICADO', 'INVALIDO');

-- Papel da pessoa na candidata (uma pessoa pode ter vários papéis).
CREATE TYPE "PapelPessoaCandidata" AS ENUM ('PROPRIETARIO_SOCIO', 'ADMINISTRADOR', 'COMPRADOR', 'RESPONSAVEL_FROTA', 'RESPONSAVEL_MANUTENCAO', 'RESPONSAVEL_EQUIPAMENTOS', 'OUTRO');

-- Equipamento de interesse da Villa (venda de usados e, em segundo plano, locação).
CREATE TYPE "TipoEquipamentoInteresse" AS ENUM ('BOMBA_LANCA', 'BOMBA_ESTACIONARIA', 'CAMINHAO_BETONEIRA', 'CENTRAL_CONCRETO', 'TELEBELT', 'PECAS_ACESSORIOS', 'OUTRO');

-- Nível de potencial (venda) ou de interesse (locação).
CREATE TYPE "NivelPotencial" AS ENUM ('ALTO', 'MEDIO', 'BAIXO', 'NENHUM', 'DESCONHECIDO');

-- Prioridade comercial atribuída manualmente à candidata.
CREATE TYPE "PrioridadeComercial" AS ENUM ('ALTA', 'MEDIA', 'BAIXA', 'NAO_PRIORITARIA');

-- ============================================================================
-- 2. NOVAS COLUNAS EM TABELAS DA v3 (todas opcionais ou com DEFAULT)
-- ============================================================================

-- ConcreteiraCandidata: qualificação comercial manual + chave de ordenação sem acentos.
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "prioridadeComercial" "PrioridadeComercial";
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "observacaoComercial" TEXT;
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "qualificadoEm" TIMESTAMP(3);
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "qualificadoPorId" TEXT;
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "nomeOrdenacao" TEXT;

-- ConcreteiraValidacaoHistorico: tipo do evento, origem e detalhe campo a campo.
-- Linhas já existentes recebem tipoEvento = 'VALIDACAO' e origem = 'NAO_INFORMADA'.
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "tipoEvento" "TipoEventoBaseNacional" NOT NULL DEFAULT 'VALIDACAO';
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "origem" "OrigemAcaoBaseNacional" NOT NULL DEFAULT 'NAO_INFORMADA';
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "campo" TEXT;
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "valorAnterior" TEXT;
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "valorNovo" TEXT;
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "entidadeId" TEXT;

-- ConcreteiraEvidencia: observação livre de quem registrou.
ALTER TABLE "ConcreteiraEvidencia" ADD COLUMN "observacao" TEXT;

-- ============================================================================
-- 3. NOVAS TABELAS
-- ============================================================================

-- Contatos institucionais da candidata (telefone, e-mail, site...). NÃO cria Pessoa nem Decisor.
CREATE TABLE "ConcreteiraCandidataContato" (
    "id" TEXT NOT NULL,
    "candidataId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "tipo" "TipoContatoCandidata" NOT NULL,
    "valor" TEXT NOT NULL,
    "valorNormalizado" TEXT NOT NULL,
    "descricao" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "situacao" "SituacaoVerificacaoContato" NOT NULL DEFAULT 'NAO_VERIFICADO',
    "fonte" "TipoFonteEvidencia",
    "fonteUrl" TEXT,
    "verificadoEm" TIMESTAMP(3),
    "verificadoPorId" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcreteiraCandidataContato_pkey" PRIMARY KEY ("id")
);

-- Pessoas ligadas à candidata (sócio, comprador, responsável por frota...).
-- Ficam SOMENTE aqui: NÃO criam Pessoa, Decisor, Empresa nem Oportunidade no CRM.
CREATE TABLE "ConcreteiraCandidataPessoa" (
    "id" TEXT NOT NULL,
    "candidataId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT,
    "papeis" "PapelPessoaCandidata"[] NOT NULL DEFAULT ARRAY[]::"PapelPessoaCandidata"[],
    "telefone" TEXT,
    "telefoneNormalizado" TEXT,
    "whatsapp" TEXT,
    "whatsappNormalizado" TEXT,
    "email" TEXT,
    "emailNormalizado" TEXT,
    "linkedinUrl" TEXT,
    "fonte" "TipoFonteEvidencia",
    "fonteUrl" TEXT,
    "situacao" "SituacaoVerificacaoContato" NOT NULL DEFAULT 'NAO_VERIFICADO',
    "verificadoEm" TIMESTAMP(3),
    "verificadoPorId" TEXT,
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcreteiraCandidataPessoa_pkey" PRIMARY KEY ("id")
);

-- Potencial da candidata por equipamento (sem preços).
CREATE TABLE "ConcreteiraPotencialEquipamento" (
    "id" TEXT NOT NULL,
    "candidataId" TEXT NOT NULL,
    "equipamento" "TipoEquipamentoInteresse" NOT NULL,
    "descricaoOutro" TEXT,
    "potencialVenda" "NivelPotencial" NOT NULL DEFAULT 'DESCONHECIDO',
    "interesseLocacao" "NivelPotencial" NOT NULL DEFAULT 'DESCONHECIDO',
    "quantidadeEstimada" INTEGER,
    "evidenciaId" TEXT,
    "observacao" TEXT,
    "avaliadoPorId" TEXT,
    "avaliadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcreteiraPotencialEquipamento_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- 4. PREENCHIMENTO DA CHAVE DE ORDENAÇÃO (somente ConcreteiraCandidata, tabela nova da v3)
-- ============================================================================
-- Minúsculas e sem acentos. Afeta apenas a coluna criada acima; nenhuma outra coluna muda.
UPDATE "ConcreteiraCandidata"
SET "nomeOrdenacao" = lower(translate(coalesce("razaoSocial", ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))
WHERE "nomeOrdenacao" IS NULL;
-- Feito ANTES dos CHECKs da seção 7: um CHECK NOT VALID também vale para linhas atualizadas,
-- e as candidatas de demonstração "Confirmada" não têm validadoEm.

-- ============================================================================
-- 5. ÍNDICES
-- ============================================================================

-- Candidata: ordenação alfabética sem acentos feita pelo banco (substitui o limite de 20.000 em JS).
CREATE INDEX "ConcreteiraCandidata_nomeOrdenacao_id_idx" ON "ConcreteiraCandidata"("nomeOrdenacao", "id");
CREATE INDEX "ConcreteiraCandidata_prioridadeComercial_idx" ON "ConcreteiraCandidata"("prioridadeComercial");
-- Candidata: uma Empresa do CRM só pode estar vinculada a UMA candidata.
CREATE UNIQUE INDEX "ConcreteiraCandidata_empresaId_vinculo_unico" ON "ConcreteiraCandidata"("empresaId") WHERE "empresaId" IS NOT NULL;

-- Histórico: filtrar por tipo de evento.
CREATE INDEX "ConcreteiraValidacaoHistorico_tipoEvento_idx" ON "ConcreteiraValidacaoHistorico"("tipoEvento");

-- Contatos.
CREATE UNIQUE INDEX "ConcreteiraCandidataContato_candidata_tipo_valor_key" ON "ConcreteiraCandidataContato"("candidataId", "tipo", "valorNormalizado");
CREATE INDEX "ConcreteiraCandidataContato_unidadeId_idx" ON "ConcreteiraCandidataContato"("unidadeId");
CREATE INDEX "ConcreteiraCandidataContato_valorNormalizado_idx" ON "ConcreteiraCandidataContato"("valorNormalizado");

-- Pessoas.
CREATE INDEX "ConcreteiraCandidataPessoa_candidataId_idx" ON "ConcreteiraCandidataPessoa"("candidataId");
CREATE INDEX "ConcreteiraCandidataPessoa_papeis_idx" ON "ConcreteiraCandidataPessoa" USING GIN ("papeis");
CREATE UNIQUE INDEX "ConcreteiraCandidataPessoa_candidataId_email_unico" ON "ConcreteiraCandidataPessoa"("candidataId", "emailNormalizado") WHERE "emailNormalizado" IS NOT NULL;
CREATE UNIQUE INDEX "ConcreteiraCandidataPessoa_candidataId_whatsapp_unico" ON "ConcreteiraCandidataPessoa"("candidataId", "whatsappNormalizado") WHERE "whatsappNormalizado" IS NOT NULL;

-- Potencial por equipamento.
CREATE UNIQUE INDEX "ConcreteiraPotencialEquipamento_candidataId_equipamento_key" ON "ConcreteiraPotencialEquipamento"("candidataId", "equipamento");
CREATE INDEX "ConcreteiraPotencialEquipamento_equipamento_potencialVenda_idx" ON "ConcreteiraPotencialEquipamento"("equipamento", "potencialVenda");
CREATE INDEX "ConcreteiraPotencialEquipamento_evidenciaId_idx" ON "ConcreteiraPotencialEquipamento"("evidenciaId");

-- ============================================================================
-- 6. CHAVES ESTRANGEIRAS (sem CASCADE de exclusão; mesmas regras da v3)
-- ============================================================================

ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_qualificadoPorId_fkey" FOREIGN KEY ("qualificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "ConcreteiraCandidataUnidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_verificadoPorId_fkey" FOREIGN KEY ("verificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_verificadoPorId_fkey" FOREIGN KEY ("verificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_evidenciaId_fkey" FOREIGN KEY ("evidenciaId") REFERENCES "ConcreteiraEvidencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_avaliadoPorId_fkey" FOREIGN KEY ("avaliadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 7. CHECKs
-- ============================================================================

-- Regras de validação manual. NOT VALID: valem para toda gravação nova ou alterada,
-- sem reprovar as linhas de demonstração já existentes (criadas antes da regra).
-- Quem validou (validadoPorId) é exigido pela aplicação, não pelo banco, para não
-- conflitar com o ON DELETE SET NULL da chave para Usuario.
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_confirmada_exige_validacao_chk" CHECK ("statusValidacao" <> 'CONFIRMADA' OR ("validadoEm" IS NOT NULL AND length(btrim(coalesce("justificativa", ''))) > 0)) NOT VALID;
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_descarte_exige_justificativa_chk" CHECK ("statusValidacao" NOT IN ('NAO_E_CONCRETEIRA', 'INATIVA', 'NAO_LOCALIZADA') OR length(btrim(coalesce("justificativa", ''))) > 0) NOT VALID;

ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_valor_preenchido_chk" CHECK (length(btrim("valor")) > 0 AND length(btrim("valorNormalizado")) > 0);
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_verificado_exige_data_chk" CHECK ("situacao" <> 'VERIFICADO' OR "verificadoEm" IS NOT NULL);

ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_nome_preenchido_chk" CHECK (length(btrim("nome")) > 0);
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_verificado_exige_data_chk" CHECK ("situacao" <> 'VERIFICADO' OR "verificadoEm" IS NOT NULL);

ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_quantidade_nao_negativa_chk" CHECK ("quantidadeEstimada" IS NULL OR "quantidadeEstimada" >= 0);
ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_outro_exige_descricao_chk" CHECK ("equipamento" <> 'OUTRO' OR length(btrim(coalesce("descricaoOutro", ''))) > 0);
