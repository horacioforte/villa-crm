-- MIGRAÇÃO: ConversaTransferencia
-- Histórico de transferências de conversa entre atendentes
-- REGRA: nunca remover. Apenas acrescentar.

CREATE TABLE "ConversaTransferencia" (
    "id"            TEXT NOT NULL,
    "conversaId"    TEXT NOT NULL,
    "deUsuarioId"   TEXT,
    "paraUsuarioId" TEXT,
    "feitoPorId"    TEXT,
    "motivo"        TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversaTransferencia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversaTransferencia_conversaId_idx"    ON "ConversaTransferencia"("conversaId");
CREATE INDEX "ConversaTransferencia_deUsuarioId_idx"   ON "ConversaTransferencia"("deUsuarioId");
CREATE INDEX "ConversaTransferencia_paraUsuarioId_idx" ON "ConversaTransferencia"("paraUsuarioId");
CREATE INDEX "ConversaTransferencia_feitoPorId_idx"    ON "ConversaTransferencia"("feitoPorId");

ALTER TABLE "ConversaTransferencia"
    ADD CONSTRAINT "ConversaTransferencia_conversaId_fkey"
    FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversaTransferencia"
    ADD CONSTRAINT "ConversaTransferencia_deUsuarioId_fkey"
    FOREIGN KEY ("deUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversaTransferencia"
    ADD CONSTRAINT "ConversaTransferencia_paraUsuarioId_fkey"
    FOREIGN KEY ("paraUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversaTransferencia"
    ADD CONSTRAINT "ConversaTransferencia_feitoPorId_fkey"
    FOREIGN KEY ("feitoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
