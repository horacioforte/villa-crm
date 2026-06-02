CREATE TABLE "PropostaItem" (
    "id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "precoM3" DOUBLE PRECISION,
    "volumeMinimoM3" DOUBLE PRECISION,
    "horasGarantidas" TEXT,
    "precoUnitario" DOUBLE PRECISION,
    "horaExtra" DOUBLE PRECISION,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "propostaId" TEXT NOT NULL,
    "equipamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropostaItem_propostaId_idx" ON "PropostaItem"("propostaId");
CREATE INDEX "PropostaItem_equipamentoId_idx" ON "PropostaItem"("equipamentoId");

ALTER TABLE "PropostaItem" ADD CONSTRAINT "PropostaItem_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaComercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropostaItem" ADD CONSTRAINT "PropostaItem_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
