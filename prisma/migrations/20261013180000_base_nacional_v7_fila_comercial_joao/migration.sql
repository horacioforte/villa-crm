-- MIGRATION v7 — Base Nacional: fila comercial do João (categorias A/B/C e decisão humana).
-- Autorizada por Horácio em 13/10/2026 SOMENTE para o branch Neon "base-nacional-concreteiras"
-- (endpoint ep-gentle-king-ajo60u4q). Produção: proibido.
-- Estritamente ADITIVA: acrescenta tipos e colunas opcionais em "JoaoEnriquecimentoGrupo" e um valor no enum de
-- eventos da Base Nacional. Não altera nem remove nada existente. Nenhum campo de preço.
-- A decisão "aprovado para abordagem" é só um registro: nada aqui envia mensagem ou inicia contato.

ALTER TYPE "TipoEventoBaseNacional" ADD VALUE IF NOT EXISTS 'DECISAO_COMERCIAL';

CREATE TYPE "CategoriaComercialJoao" AS ENUM ('A', 'B', 'C');
CREATE TYPE "DecisaoComercialJoao" AS ENUM ('APROVADO_ABORDAGEM', 'PESQUISAR_MELHOR', 'CONTATO_INVALIDO', 'NAO_PRIORITARIA', 'ADIAR');

ALTER TABLE "JoaoEnriquecimentoGrupo"
    ADD COLUMN IF NOT EXISTS "categoriaComercial" "CategoriaComercialJoao",
    ADD COLUMN IF NOT EXISTS "categoriaMotivo"    TEXT,
    ADD COLUMN IF NOT EXISTS "categorizadoEm"     TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "indicadores"        JSONB,
    ADD COLUMN IF NOT EXISTS "decisaoComercial"   "DecisaoComercialJoao",
    ADD COLUMN IF NOT EXISTS "decisaoObservacao"  TEXT,
    ADD COLUMN IF NOT EXISTS "decisaoPorId"       TEXT,
    ADD COLUMN IF NOT EXISTS "decisaoEm"          TIMESTAMP(3);
ALTER TABLE "JoaoEnriquecimentoGrupo" ADD CONSTRAINT "JoaoEnriquecimentoGrupo_decisaoPorId_fkey"
    FOREIGN KEY ("decisaoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "JoaoEnriquecimentoGrupo_categoriaComercial_idx" ON "JoaoEnriquecimentoGrupo"("categoriaComercial");
