-- MIGRATION — Empresa.duplicadaDeId (deduplicação de Empresa).
-- NÃO APLICAR EM PRODUÇÃO sem autorização de Horácio. Rodar manualmente no terminal
-- com `npx prisma migrate dev` / `migrate deploy` quando decidido.
-- Estritamente ADITIVA: coluna opcional + FK opcional (SET NULL). Não altera nem
-- remove nenhum dado existente. Nenhuma Empresa é apagada ou renomeada por esta
-- migration — ela só cria onde guardar, no futuro, qual é a empresa "principal"
-- de um grupo de duplicatas (ver scripts/empresas/relatorio-duplicadas.ts, que é
-- só leitura e não grava nada aqui).

ALTER TABLE "Empresa"
    ADD COLUMN IF NOT EXISTS "duplicadaDeId" TEXT;

DO $$ BEGIN
    ALTER TABLE "Empresa"
        ADD CONSTRAINT "Empresa_duplicadaDeId_fkey"
        FOREIGN KEY ("duplicadaDeId") REFERENCES "Empresa"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Empresa_duplicadaDeId_idx" ON "Empresa"("duplicadaDeId");
