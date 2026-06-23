-- Central de Atendimento — nunca remover, só acrescentar

-- CreateEnum
CREATE TYPE "CanalAtendimento" AS ENUM ('WHATSAPP', 'EMAIL', 'TELEFONE', 'CHAT');

-- CreateEnum
CREATE TYPE "StatusConversa" AS ENUM ('ABERTA', 'PENDENTE', 'CONCLUIDA', 'SPAM');

-- CreateEnum
CREATE TYPE "DirecaoMensagem" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "AutorMensagem" AS ENUM ('IA', 'HUMANO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('ENVIADA', 'ENTREGUE', 'LIDA', 'ERRO');

-- CreateTable: Conversa
CREATE TABLE "Conversa" (
    "id"               TEXT NOT NULL,
    "canal"            "CanalAtendimento" NOT NULL DEFAULT 'WHATSAPP',
    "status"           "StatusConversa" NOT NULL DEFAULT 'ABERTA',
    "instanceName"     TEXT NOT NULL,
    "chatwootId"       INTEGER,
    "telefone"         TEXT,
    "nomeContato"      TEXT,
    "empresaId"        TEXT,
    "pessoaId"         TEXT,
    "oportunidadeId"   TEXT,
    "atendidoPorId"    TEXT,
    "ultimaMensagemEm" TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Mensagem
CREATE TABLE "Mensagem" (
    "id"             TEXT NOT NULL,
    "conteudo"       TEXT NOT NULL,
    "direcao"        "DirecaoMensagem" NOT NULL,
    "autor"          "AutorMensagem" NOT NULL DEFAULT 'IA',
    "status"         "StatusMensagem" NOT NULL DEFAULT 'ENVIADA',
    "waMessageId"    TEXT,
    "mimeType"       TEXT,
    "mediaUrl"       TEXT,
    "conversaId"     TEXT NOT NULL,
    "autorUsuarioId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TemplateResposta
CREATE TABLE "TemplateResposta" (
    "id"          TEXT NOT NULL,
    "nome"        TEXT NOT NULL,
    "conteudo"    TEXT NOT NULL,
    "categoria"   TEXT,
    "ativo"       BOOLEAN NOT NULL DEFAULT true,
    "criadoPorId" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateResposta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversa_status_idx" ON "Conversa"("status");
CREATE INDEX "Conversa_instanceName_idx" ON "Conversa"("instanceName");
CREATE INDEX "Conversa_empresaId_idx" ON "Conversa"("empresaId");
CREATE INDEX "Conversa_pessoaId_idx" ON "Conversa"("pessoaId");
CREATE INDEX "Conversa_oportunidadeId_idx" ON "Conversa"("oportunidadeId");
CREATE INDEX "Conversa_atendidoPorId_idx" ON "Conversa"("atendidoPorId");
CREATE INDEX "Conversa_ultimaMensagemEm_idx" ON "Conversa"("ultimaMensagemEm");
CREATE INDEX "Mensagem_conversaId_idx" ON "Mensagem"("conversaId");
CREATE INDEX "Mensagem_conversaId_createdAt_idx" ON "Mensagem"("conversaId", "createdAt");
CREATE INDEX "Mensagem_autorUsuarioId_idx" ON "Mensagem"("autorUsuarioId");
CREATE INDEX "Mensagem_waMessageId_idx" ON "Mensagem"("waMessageId");
CREATE INDEX "TemplateResposta_criadoPorId_idx" ON "TemplateResposta"("criadoPorId");
CREATE INDEX "TemplateResposta_ativo_idx" ON "TemplateResposta"("ativo");

-- AddForeignKey
ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_pessoaId_fkey"
    FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_oportunidadeId_fkey"
    FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversa" ADD CONSTRAINT "Conversa_atendidoPorId_fkey"
    FOREIGN KEY ("atendidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey"
    FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_autorUsuarioId_fkey"
    FOREIGN KEY ("autorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TemplateResposta" ADD CONSTRAINT "TemplateResposta_criadoPorId_fkey"
    FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
