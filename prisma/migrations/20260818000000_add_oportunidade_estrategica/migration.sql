-- BI Executivo (18/08/2026): campo de marcação manual de oportunidade estratégica.
-- Aplicado diretamente via ALTER TABLE (ADD COLUMN IF NOT EXISTS) em vez de
-- `prisma migrate dev`, porque o ambiente reportou drift de migração não
-- relacionado a esta mudança e pediu reset completo do schema público — reset
-- NUNCA foi executado. Este arquivo documenta a alteração já aplicada; a
-- reconciliação da tabela _prisma_migrations fica pendente para quem administra
-- as migrations, para não arriscar dado de produção.
ALTER TABLE "Oportunidade" ADD COLUMN IF NOT EXISTS "estrategica" BOOLEAN NOT NULL DEFAULT false;
