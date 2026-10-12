-- MIGRATION v6 — Base Nacional de Concreteiras: preparação técnica do João (enriquecimento de decisores).
-- Autorizada por Horácio em 12/10/2026 SOMENTE para o branch Neon "base-nacional-concreteiras"
-- (endpoint ep-gentle-king-ajo60u4q). Produção: proibido.
--
-- Estritamente ADITIVA: acrescenta colunas opcionais às tabelas de pessoas/contatos da própria Base Nacional,
-- cria a fila do João, o cache de pesquisa e o controle de consumo. Não altera, renomeia nem remove coluna,
-- tabela, tipo ou dado existente. Não toca Empresa, Pessoa, DossieComercial, DossieCarteira, Oportunidade,
-- Tarefa nem tabelas anteriores à v3. Nenhum campo de preço. REGRA: nunca remover. Apenas acrescentar.
-- Nada aqui envia mensagem ou contata alguém: é só registro de pesquisa.

-- 1. Valores novos em enums da Base Nacional
ALTER TYPE "OrigemAcaoBaseNacional" ADD VALUE IF NOT EXISTS 'JOAO_ENRIQUECIMENTO';
ALTER TYPE "TipoEventoBaseNacional" ADD VALUE IF NOT EXISTS 'ENRIQUECIMENTO';

-- 2. Tipos novos
CREATE TYPE "SituacaoEnriquecimento" AS ENUM ('AGUARDANDO', 'EM_ANDAMENTO', 'CONCLUIDO', 'NAO_LOCALIZADO', 'ERRO');

-- 3. Colunas opcionais (pesquisa do João) em pessoas e contatos da candidata
ALTER TABLE "ConcreteiraCandidataPessoa"
    ADD COLUMN IF NOT EXISTS "confianca"        "ConfiancaInformacao",
    ADD COLUMN IF NOT EXISTS "pesquisadoEm"     TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "unidadeId"        TEXT,
    ADD COLUMN IF NOT EXISTS "agente"           TEXT,
    ADD COLUMN IF NOT EXISTS "grupoChave"       TEXT,
    ADD COLUMN IF NOT EXISTS "nomeNormalizado"  TEXT;
ALTER TABLE "ConcreteiraCandidataContato"
    ADD COLUMN IF NOT EXISTS "confianca"        "ConfiancaInformacao",
    ADD COLUMN IF NOT EXISTS "pesquisadoEm"     TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "agente"           TEXT,
    ADD COLUMN IF NOT EXISTS "grupoChave"       TEXT,
    ADD COLUMN IF NOT EXISTS "pessoaId"         TEXT,
    ADD COLUMN IF NOT EXISTS "observacao"       TEXT;
CREATE INDEX IF NOT EXISTS "ConcreteiraCandidataPessoa_grupoChave_idx" ON "ConcreteiraCandidataPessoa"("grupoChave");
CREATE INDEX IF NOT EXISTS "ConcreteiraCandidataPessoa_nomeNormalizado_idx" ON "ConcreteiraCandidataPessoa"("nomeNormalizado");
CREATE INDEX IF NOT EXISTS "ConcreteiraCandidataContato_grupoChave_idx" ON "ConcreteiraCandidataContato"("grupoChave");

-- 4. Fila do João: 1 linha por grupo (matriz + filiais + grupo econômico), pesquisado uma única vez
CREATE TABLE "JoaoEnriquecimentoGrupo" (
    "chave"                 TEXT NOT NULL,
    "nome"                  TEXT NOT NULL,
    "candidataPrincipalId"  TEXT NOT NULL,
    "candidataIds"          TEXT[] DEFAULT ARRAY[]::TEXT[],
    "raizes"                TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dominios"              TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publico"               TEXT NOT NULL,
    "ordem"                 INTEGER NOT NULL DEFAULT 0,
    "situacao"              "SituacaoEnriquecimento" NOT NULL DEFAULT 'AGUARDANDO',
    "etapas"                JSONB NOT NULL DEFAULT '{}',
    "decisoresEncontrados"  INTEGER NOT NULL DEFAULT 0,
    "contatosEncontrados"   INTEGER NOT NULL DEFAULT 0,
    "resultado"             TEXT,
    "tentativas"            INTEGER NOT NULL DEFAULT 0,
    "erro"                  TEXT,
    "iniciadoEm"            TIMESTAMP(3),
    "concluidoEm"           TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JoaoEnriquecimentoGrupo_pkey" PRIMARY KEY ("chave")
);
CREATE INDEX "JoaoEnriquecimentoGrupo_publico_situacao_ordem_idx" ON "JoaoEnriquecimentoGrupo"("publico", "situacao", "ordem");

-- 5. Cache de pesquisa (empresa, domínio, página, pessoa, contato, busca) — nada é pesquisado duas vezes no prazo
CREATE TABLE "JoaoEnriquecimentoCache" (
    "chave"      TEXT NOT NULL,
    "tipo"       TEXT NOT NULL,
    "dados"      JSONB,
    "fonteUrl"   TEXT,
    "erro"       TEXT,
    "buscadoEm"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JoaoEnriquecimentoCache_pkey" PRIMARY KEY ("chave")
);
CREATE INDEX "JoaoEnriquecimentoCache_tipo_idx" ON "JoaoEnriquecimentoCache"("tipo");

-- 6. Controle de consumo (tokens/chamadas/custo) por grupo e etapa, para limite de gasto
CREATE TABLE "JoaoEnriquecimentoConsumo" (
    "id"               TEXT NOT NULL,
    "grupoChave"       TEXT,
    "etapa"            TEXT NOT NULL,
    "ferramenta"       TEXT NOT NULL,
    "chamadas"         INTEGER NOT NULL DEFAULT 0,
    "tokensEstimados"  INTEGER NOT NULL DEFAULT 0,
    "custoUsd"         DECIMAL(10,4) NOT NULL DEFAULT 0,
    "pago"             BOOLEAN NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JoaoEnriquecimentoConsumo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JoaoEnriquecimentoConsumo_grupoChave_idx" ON "JoaoEnriquecimentoConsumo"("grupoChave");
