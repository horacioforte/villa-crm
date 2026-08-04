-- MIGRAÇÃO — Fase 2 Central de Atendimento WhatsApp (piloto João)
-- REGRA: nunca remover. Apenas acrescentar.
--
-- Exclusivamente aditiva: nenhuma coluna, tabela, constraint ou valor de enum existente
-- é removido, renomeado ou alterado. Nenhuma tabela usada pela aplicação perde dado.
--
-- Gerada via `prisma migrate diff --from-migrations prisma/migrations --to-schema
-- prisma/schema.prisma --script` (shadow database descartável, já removida) e revisada
-- manualmente linha a linha antes de virar este arquivo.
--
-- EXCLUÍDO DELIBERADAMENTE do SQL bruto gerado pelo Prisma (não faz parte desta migration):
--   - Recriação do enum "TipoOperacao" removendo o valor 'VENDA'. Esse enum já está
--     desatualizado no schema.prisma (falta 'VENDA', que existe de fato no banco e é
--     usado no domínio do negócio) ANTES desta sessão — confirmado via `git diff`, não
--     foi introduzido pela Fase 2. É um problema pré-existente e separado, fora de escopo
--     aqui. Não incluir essa alteração evita risco de perda de dado numa migration que
--     deveria ser só aditiva.
--   - `ALTER COLUMN ... DROP DEFAULT` em id/updatedAt de Campanha, DecisorDossie,
--     DossieComercial, EmpresaDossie, Prospect, ProspectInteracao, TemplateResposta,
--     e em Conversa.updatedAt/Oportunidade.tipo — ruído de diferença de geração de SQL
--     entre versões do gerador Prisma, não relacionado à Fase 2 e inofensivo de deixar
--     como está (Prisma Client sempre define esses valores explicitamente).

-- ─── Enums ──────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "CanalWhatsappTipo" AS ENUM ('META_CLOUD_API', 'EVOLUTION', 'CHATWOOT_MIRROR');

-- AlterEnum
ALTER TYPE "AutorMensagem" ADD VALUE 'CLIENTE';

-- AlterEnum
ALTER TYPE "StatusMensagem" ADD VALUE 'PENDENTE';
ALTER TYPE "StatusMensagem" ADD VALUE 'RECEBIDA';

-- ─── Nova tabela: CanalWhatsapp ─────────────────────────────────────────────

-- CreateTable
CREATE TABLE "CanalWhatsapp" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "CanalWhatsappTipo" NOT NULL,
    "instanceName" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    "displayPhoneNumber" TEXT,
    "accessTokenEnvVar" TEXT,
    "verifyTokenEnvVar" TEXT,
    "appSecretEnvVar" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "responsavelPadraoId" TEXT,
    "agenteIA" TEXT,
    "ultimoWebhookEm" TIMESTAMP(3),
    "ultimoErro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanalWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanalWhatsapp_instanceName_key" ON "CanalWhatsapp"("instanceName");

-- CreateIndex
CREATE UNIQUE INDEX "CanalWhatsapp_phoneNumberId_key" ON "CanalWhatsapp"("phoneNumberId");

-- CreateIndex
CREATE INDEX "CanalWhatsapp_ativo_idx" ON "CanalWhatsapp"("ativo");

-- AddForeignKey
ALTER TABLE "CanalWhatsapp" ADD CONSTRAINT "CanalWhatsapp_responsavelPadraoId_fkey"
    FOREIGN KEY ("responsavelPadraoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Conversa: novos campos (todos opcionais/com default, nenhum existente alterado) ──

-- AlterTable
ALTER TABLE "Conversa"
    ADD COLUMN "canalWhatsappId" TEXT,
    ADD COLUMN "tarefaAtualId" TEXT,
    ADD COLUMN "iaPausada" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "atendimentoHumanoAtivo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Conversa_canalWhatsappId_idx" ON "Conversa"("canalWhatsappId");

-- CreateIndex
CREATE INDEX "Conversa_tarefaAtualId_idx" ON "Conversa"("tarefaAtualId");

-- AddForeignKey
-- Restrict: canal usado nunca pode ser apagado, só desativado (ativo=false)
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_canalWhatsappId_fkey"
    FOREIGN KEY ("canalWhatsappId") REFERENCES "CanalWhatsapp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_tarefaAtualId_fkey"
    FOREIGN KEY ("tarefaAtualId") REFERENCES "Tarefa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Mensagem: novos campos (todos opcionais, nenhum existente alterado) ───────

-- AlterTable
ALTER TABLE "Mensagem"
    ADD COLUMN "canalWhatsappId" TEXT,
    ADD COLUMN "externalMessageId" TEXT,
    ADD COLUMN "messageType" TEXT,
    ADD COLUMN "replyToMensagemId" TEXT,
    ADD COLUMN "errorCode" TEXT,
    ADD COLUMN "errorMessage" TEXT,
    ADD COLUMN "rawPayload" JSONB,
    ADD COLUMN "deliveredAt" TIMESTAMP(3),
    ADD COLUMN "readAt" TIMESTAMP(3),
    ADD COLUMN "receivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Mensagem_canalWhatsappId_idx" ON "Mensagem"("canalWhatsappId");

-- CreateIndex
CREATE INDEX "Mensagem_externalMessageId_idx" ON "Mensagem"("externalMessageId");

-- CreateIndex
CREATE INDEX "Mensagem_replyToMensagemId_idx" ON "Mensagem"("replyToMensagemId");

-- CreateIndex — unicidade composta por canal/provedor (não global)
CREATE UNIQUE INDEX "Mensagem_canalWhatsappId_externalMessageId_key" ON "Mensagem"("canalWhatsappId", "externalMessageId");

-- AddForeignKey
-- Restrict: evita SetNull deixar externalMessageId orfao (conflitaria com o CHECK abaixo);
-- canal usado nunca e apagado, so desativado
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_canalWhatsappId_fkey"
    FOREIGN KEY ("canalWhatsappId") REFERENCES "CanalWhatsapp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — autorrelação de resposta a mensagem anterior
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_replyToMensagemId_fkey"
    FOREIGN KEY ("replyToMensagemId") REFERENCES "Mensagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reforço extra: nenhuma mensagem pode ter externalMessageId sem canalWhatsappId
-- (não gerado automaticamente pelo Prisma — adicionado manualmente)
ALTER TABLE "Mensagem" ADD CONSTRAINT "mensagem_external_id_requer_canal"
    CHECK ("externalMessageId" IS NULL OR "canalWhatsappId" IS NOT NULL);
