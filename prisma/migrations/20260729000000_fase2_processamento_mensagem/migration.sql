-- MIGRAÇÃO — Fase 2 Central de Atendimento WhatsApp (Etapa 3) — estado persistente de
-- processamento de Mensagem.
-- REGRA: nunca remover. Apenas acrescentar.
--
-- Exclusivamente aditiva: nenhuma coluna, tabela, constraint ou valor de enum existente
-- é removido, renomeado ou alterado.
--
-- Fecha o risco identificado na homologação controlada: se o processamento síncrono do
-- webhook V2 for interrompido entre receber a mensagem e concluir IA+envio+CRM, a
-- mensagem antes ficava indistinguível de "ainda não processada". Com este estado,
-- fica visivelmente presa em PROCESSANDO (ou PENDENTE, se a interrupção for ainda mais
-- cedo) e elegível para reprocessamento controlado — ver
-- lib/whatsapp/processamento-mensagem.ts, scripts/diagnostico-mensagens-travadas.ts e
-- scripts/reprocessar-mensagem.ts.
--
-- Gerada via `prisma migrate diff --from-migrations prisma/migrations --to-schema
-- prisma/schema.prisma --script` (shadow database descartável, já removida) e revisada
-- manualmente linha a linha.
--
-- EXCLUÍDO DELIBERADAMENTE do SQL bruto gerado pelo Prisma (mesmo ruído de gerador já
-- documentado nas duas migrations anteriores desta Fase 2 — não relacionado a esta
-- mudança, inofensivo de deixar como está): `ALTER COLUMN ... DROP DEFAULT` em
-- id/updatedAt de Campanha, DecisorDossie, DossieComercial, EmpresaDossie, Prospect,
-- ProspectInteracao, TemplateResposta, Conversa.updatedAt; e
-- `ALTER TABLE "Oportunidade" ALTER COLUMN "tipo" SET DEFAULT 'LOCACAO'`.

-- CreateEnum
CREATE TYPE "ProcessamentoMensagemStatus" AS ENUM ('NAO_APLICAVEL', 'PENDENTE', 'PROCESSANDO', 'PROCESSADA', 'ERRO_PROCESSAMENTO');

-- AlterTable
ALTER TABLE "Mensagem"
    ADD COLUMN "processamentoStatus" "ProcessamentoMensagemStatus" NOT NULL DEFAULT 'NAO_APLICAVEL',
    ADD COLUMN "processamentoErroCodigo" TEXT,
    ADD COLUMN "processamentoErro" TEXT,
    ADD COLUMN "processamentoTentativas" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "processamentoAtualizadoEm" TIMESTAMP(3),
    ADD COLUMN "processadaEm" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Mensagem_processamentoStatus_processamentoAtualizadoEm_idx"
    ON "Mensagem"("processamentoStatus", "processamentoAtualizadoEm");
