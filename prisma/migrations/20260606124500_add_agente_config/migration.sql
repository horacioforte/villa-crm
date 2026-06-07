-- CreateTable
CREATE TABLE "AgenteConfig" (
    "id" TEXT NOT NULL,
    "agente" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "personalidade" TEXT NOT NULL,
    "regrasQuente" TEXT NOT NULL,
    "regrasMedia" TEXT NOT NULL,
    "regrasFria" TEXT NOT NULL,
    "ignorar" TEXT NOT NULL,
    "exemplosLead" TEXT NOT NULL,
    "exemplosNaoLead" TEXT NOT NULL,
    "historicoErros" TEXT NOT NULL,
    "promptCompleto" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoPor" TEXT,

    CONSTRAINT "AgenteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgenteConfig_agente_key" ON "AgenteConfig"("agente");
