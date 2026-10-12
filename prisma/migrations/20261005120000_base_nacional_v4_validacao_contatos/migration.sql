-- MIGRATION v4 (revisada) — Base Nacional de Concreteiras: validação manual, contatos, pessoas,
-- qualificação comercial por equipamento e histórico detalhado.
-- Autorizada por Horácio em 05/10/2026 SOMENTE para o branch Neon "base-nacional-concreteiras"
-- (endpoint ep-gentle-king-ajo60u4q), aplicada via prisma.config.base-nacional.ts. Produção: proibido.
--
-- Decisões aprovadas refletidas aqui:
--   1. Uma Empresa do CRM pode estar ligada a várias candidatas (SEM índice único de vínculo).
--   2. Confirmada exige responsável, data, confiança e justificativa (CHECK no banco).
--   3. Contatos e pessoas têm inativação com motivo, data e responsável (sem exclusão física pela tela).
--   4. Telefone/e-mail completos não vão para o histórico (garantido pela aplicação: valores mascarados).
--   5. Potencial de equipamento pode ser geral (sem unidade) ou de uma unidade/central específica.
--
-- Pré-condição: os dados fictícios "demo-bn-*" são removidos ANTES (script de demonstração --remover)
-- e recriados DEPOIS já completos; por isso os CHECKs são criados válidos para todas as linhas.
-- Se existir qualquer linha que viole uma regra, a migration inteira falha e nada é gravado.
--
-- Estritamente ADITIVA: não altera, renomeia nem remove coluna, tabela, tipo ou dado existente.
-- Não toca Empresa, Pessoa, DossieComercial, DossieCarteira, Oportunidade, Tarefa nem tabelas
-- anteriores à v3. Únicas referências a tabelas antigas: chaves para "Usuario" (ON DELETE SET NULL).
-- Nenhum campo de preço. REGRA: nunca remover. Apenas acrescentar.

-- ============================================================================
-- 1. TIPOS ENUM
-- ============================================================================
CREATE TYPE "TipoEventoBaseNacional" AS ENUM ('VALIDACAO', 'TIPO_UNIDADE', 'VINCULO_EMPRESA', 'EVIDENCIA', 'CONTATO', 'PESSOA', 'POTENCIAL_EQUIPAMENTO', 'QUALIFICACAO', 'OUTRO');
CREATE TYPE "OrigemAcaoBaseNacional" AS ENUM ('TELA_BASE_NACIONAL', 'IMPORTACAO_RECEITA', 'SCRIPT_DEMONSTRACAO', 'NAO_INFORMADA');
CREATE TYPE "TipoContatoCandidata" AS ENUM ('TELEFONE', 'WHATSAPP', 'EMAIL', 'SITE', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'OUTRO');
CREATE TYPE "SituacaoVerificacaoContato" AS ENUM ('VERIFICADO', 'NAO_VERIFICADO', 'INVALIDO');
CREATE TYPE "PapelPessoaCandidata" AS ENUM ('PROPRIETARIO_SOCIO', 'ADMINISTRADOR', 'COMPRADOR', 'RESPONSAVEL_FROTA', 'RESPONSAVEL_MANUTENCAO', 'RESPONSAVEL_EQUIPAMENTOS', 'OUTRO');
CREATE TYPE "TipoEquipamentoInteresse" AS ENUM ('BOMBA_LANCA', 'BOMBA_ESTACIONARIA', 'CAMINHAO_BETONEIRA', 'CENTRAL_CONCRETO', 'TELEBELT', 'PECAS_ACESSORIOS', 'OUTRO');
CREATE TYPE "NivelPotencial" AS ENUM ('ALTO', 'MEDIO', 'BAIXO', 'NENHUM', 'DESCONHECIDO');
CREATE TYPE "PrioridadeComercial" AS ENUM ('ALTA', 'MEDIA', 'BAIXA', 'NAO_PRIORITARIA');

-- ============================================================================
-- 2. NOVAS COLUNAS EM TABELAS DA v3 (opcionais ou com DEFAULT)
-- ============================================================================
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "prioridadeComercial" "PrioridadeComercial";
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "observacaoComercial" TEXT;
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "qualificadoEm" TIMESTAMP(3);
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "qualificadoPorId" TEXT;
ALTER TABLE "ConcreteiraCandidata" ADD COLUMN "nomeOrdenacao" TEXT;

ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "tipoEvento" "TipoEventoBaseNacional" NOT NULL DEFAULT 'VALIDACAO';
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "origem" "OrigemAcaoBaseNacional" NOT NULL DEFAULT 'NAO_INFORMADA';
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "campo" TEXT;
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "valorAnterior" TEXT;
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "valorNovo" TEXT;
ALTER TABLE "ConcreteiraValidacaoHistorico" ADD COLUMN "entidadeId" TEXT;

ALTER TABLE "ConcreteiraEvidencia" ADD COLUMN "observacao" TEXT;

-- ============================================================================
-- 3. NOVAS TABELAS
-- ============================================================================
-- Contatos institucionais da candidata. NÃO cria Pessoa nem Decisor no CRM.
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
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "inativadoEm" TIMESTAMP(3),
    "inativadoPorId" TEXT,
    "motivoInativacao" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcreteiraCandidataContato_pkey" PRIMARY KEY ("id")
);

-- Pessoas ligadas à candidata. Ficam SOMENTE aqui: não criam Pessoa, Decisor, Empresa nem Oportunidade.
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
    "inativadoEm" TIMESTAMP(3),
    "inativadoPorId" TEXT,
    "motivoInativacao" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConcreteiraCandidataPessoa_pkey" PRIMARY KEY ("id")
);

-- Potencial por equipamento: geral (unidadeId nulo) ou de uma unidade/central. Sem preços.
-- Foco comercial: venda de usados (potencialVenda); locação é secundária (interesseLocacao).
CREATE TABLE "ConcreteiraPotencialEquipamento" (
    "id" TEXT NOT NULL,
    "candidataId" TEXT NOT NULL,
    "unidadeId" TEXT,
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
-- 4. PREENCHIMENTO DA CHAVE DE ORDENAÇÃO (só a coluna nova; antes dos CHECKs)
-- ============================================================================
UPDATE "ConcreteiraCandidata"
SET "nomeOrdenacao" = lower(translate(coalesce("razaoSocial", ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'))
WHERE "nomeOrdenacao" IS NULL;

-- ============================================================================
-- 5. ÍNDICES
-- ============================================================================
CREATE INDEX "ConcreteiraCandidata_nomeOrdenacao_id_idx" ON "ConcreteiraCandidata"("nomeOrdenacao", "id");
CREATE INDEX "ConcreteiraCandidata_prioridadeComercial_idx" ON "ConcreteiraCandidata"("prioridadeComercial");
-- (Sem índice único em empresaId: decisão 1. O índice simples da v3 continua.)

CREATE INDEX "ConcreteiraValidacaoHistorico_tipoEvento_idx" ON "ConcreteiraValidacaoHistorico"("tipoEvento");

CREATE INDEX "ConcreteiraCandidataContato_candidataId_idx" ON "ConcreteiraCandidataContato"("candidataId");
CREATE INDEX "ConcreteiraCandidataContato_unidadeId_idx" ON "ConcreteiraCandidataContato"("unidadeId");
CREATE INDEX "ConcreteiraCandidataContato_valorNormalizado_idx" ON "ConcreteiraCandidataContato"("valorNormalizado");
-- Um mesmo contato ATIVO não se repete na candidata; inativos não bloqueiam recadastro.
CREATE UNIQUE INDEX "ConcreteiraCandidataContato_ativo_unico" ON "ConcreteiraCandidataContato"("candidataId", "tipo", "valorNormalizado") WHERE "ativo" = true;

CREATE INDEX "ConcreteiraCandidataPessoa_candidataId_idx" ON "ConcreteiraCandidataPessoa"("candidataId");
CREATE INDEX "ConcreteiraCandidataPessoa_papeis_idx" ON "ConcreteiraCandidataPessoa" USING GIN ("papeis");
CREATE UNIQUE INDEX "ConcreteiraCandidataPessoa_email_ativo_unico" ON "ConcreteiraCandidataPessoa"("candidataId", "emailNormalizado") WHERE "emailNormalizado" IS NOT NULL AND "ativo" = true;
CREATE UNIQUE INDEX "ConcreteiraCandidataPessoa_whatsapp_ativo_unico" ON "ConcreteiraCandidataPessoa"("candidataId", "whatsappNormalizado") WHERE "whatsappNormalizado" IS NOT NULL AND "ativo" = true;

CREATE INDEX "ConcreteiraPotencialEquipamento_candidataId_idx" ON "ConcreteiraPotencialEquipamento"("candidataId");
CREATE INDEX "ConcreteiraPotencialEquipamento_unidadeId_idx" ON "ConcreteiraPotencialEquipamento"("unidadeId");
CREATE INDEX "ConcreteiraPotencialEquipamento_equipamento_potencialVenda_idx" ON "ConcreteiraPotencialEquipamento"("equipamento", "potencialVenda");
CREATE INDEX "ConcreteiraPotencialEquipamento_evidenciaId_idx" ON "ConcreteiraPotencialEquipamento"("evidenciaId");
-- Um registro por equipamento no nível geral e um por equipamento em cada unidade.
CREATE UNIQUE INDEX "ConcreteiraPotencialEquipamento_geral_unico" ON "ConcreteiraPotencialEquipamento"("candidataId", "equipamento") WHERE "unidadeId" IS NULL;
CREATE UNIQUE INDEX "ConcreteiraPotencialEquipamento_unidade_unico" ON "ConcreteiraPotencialEquipamento"("unidadeId", "equipamento") WHERE "unidadeId" IS NOT NULL;

-- ============================================================================
-- 6. CHAVES ESTRANGEIRAS (sem CASCADE de exclusão)
-- ============================================================================
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_qualificadoPorId_fkey" FOREIGN KEY ("qualificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "ConcreteiraCandidataUnidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_verificadoPorId_fkey" FOREIGN KEY ("verificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_inativadoPorId_fkey" FOREIGN KEY ("inativadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_verificadoPorId_fkey" FOREIGN KEY ("verificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_inativadoPorId_fkey" FOREIGN KEY ("inativadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_candidataId_fkey" FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "ConcreteiraCandidataUnidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_evidenciaId_fkey" FOREIGN KEY ("evidenciaId") REFERENCES "ConcreteiraEvidencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_avaliadoPorId_fkey" FOREIGN KEY ("avaliadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 7. CHECKs (válidos para todas as linhas)
-- ============================================================================
-- Decisão 2. Observação: como validadoPorId é obrigatório numa Confirmada, um Usuario que tenha
-- confirmado candidatas não pode ser excluído fisicamente (o SET NULL violaria a regra). No CRM
-- usuários são desativados, não excluídos, então isso funciona como proteção do histórico.
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_confirmada_exige_validacao_chk" CHECK ("statusValidacao" <> 'CONFIRMADA' OR ("validadoEm" IS NOT NULL AND "validadoPorId" IS NOT NULL AND "confianca" IS NOT NULL AND length(btrim(coalesce("justificativa", ''))) > 0));
ALTER TABLE "ConcreteiraCandidata" ADD CONSTRAINT "ConcreteiraCandidata_descarte_exige_justificativa_chk" CHECK ("statusValidacao" NOT IN ('NAO_E_CONCRETEIRA', 'INATIVA', 'NAO_LOCALIZADA') OR length(btrim(coalesce("justificativa", ''))) > 0);

ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_valor_preenchido_chk" CHECK (length(btrim("valor")) > 0 AND length(btrim("valorNormalizado")) > 0);
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_verificado_exige_data_chk" CHECK ("situacao" <> 'VERIFICADO' OR "verificadoEm" IS NOT NULL);
-- Decisão 3: inativação exige data, responsável e motivo.
ALTER TABLE "ConcreteiraCandidataContato" ADD CONSTRAINT "ConcreteiraCandidataContato_inativacao_completa_chk" CHECK ("ativo" OR ("inativadoEm" IS NOT NULL AND "inativadoPorId" IS NOT NULL AND length(btrim(coalesce("motivoInativacao", ''))) > 0));

ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_nome_preenchido_chk" CHECK (length(btrim("nome")) > 0);
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_verificado_exige_data_chk" CHECK ("situacao" <> 'VERIFICADO' OR "verificadoEm" IS NOT NULL);
ALTER TABLE "ConcreteiraCandidataPessoa" ADD CONSTRAINT "ConcreteiraCandidataPessoa_inativacao_completa_chk" CHECK ("ativo" OR ("inativadoEm" IS NOT NULL AND "inativadoPorId" IS NOT NULL AND length(btrim(coalesce("motivoInativacao", ''))) > 0));

ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_quantidade_nao_negativa_chk" CHECK ("quantidadeEstimada" IS NULL OR "quantidadeEstimada" >= 0);
ALTER TABLE "ConcreteiraPotencialEquipamento" ADD CONSTRAINT "ConcreteiraPotencialEquipamento_outro_exige_descricao_chk" CHECK ("equipamento" <> 'OUTRO' OR length(btrim(coalesce("descricaoOutro", ''))) > 0);
