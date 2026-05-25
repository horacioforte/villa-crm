-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMIN', 'GERENTE', 'COMERCIAL', 'OPERACIONAL');

-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('CONTATO', 'DECISOR', 'RESPONSAVEL_OBRA', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "InfluenciaDecisao" AS ENUM ('DECISOR', 'INFLUENCIADOR', 'TECNICO', 'OPERACIONAL', 'BLOQUEADOR');

-- CreateEnum
CREATE TYPE "NivelRelacionamento" AS ENUM ('FRIO', 'NEUTRO', 'BOM', 'EXCELENTE');

-- CreateEnum
CREATE TYPE "StatusObra" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoOperacao" AS ENUM ('LOCACAO', 'VENDA');

-- CreateEnum
CREATE TYPE "StatusOportunidade" AS ENUM ('NOVA', 'EM_ATENDIMENTO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'GANHA', 'PERDIDA');

-- CreateEnum
CREATE TYPE "TipoContato" AS ENUM ('TELEFONE', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'VISITA', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoEquipamento" AS ENUM ('BOMBA_CONCRETO', 'BETONEIRA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusEquipamento" AS ENUM ('DISPONIVEL', 'LOCADO', 'MANUTENCAO', 'VENDIDO', 'INATIVO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT,
    "telefone" TEXT,
    "cargo" TEXT,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'COMERCIAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "filialId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filial" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cep" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT,
    "segmento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "site" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "responsavel" TEXT,
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "filialId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pessoa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "cargo" TEXT,
    "tipoCargo" TEXT,
    "tipo" "TipoPessoa" NOT NULL DEFAULT 'CONTATO',
    "influenciaDecisao" "InfluenciaDecisao" NOT NULL DEFAULT 'INFLUENCIADOR',
    "nivelRelacionamento" "NivelRelacionamento" NOT NULL DEFAULT 'NEUTRO',
    "aniversario" TIMESTAMP(3),
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "volumeEstimado" DECIMAL(12,2),
    "status" "StatusObra" NOT NULL DEFAULT 'PLANEJADA',
    "dataInicio" TIMESTAMP(3),
    "dataTermino" TIMESTAMP(3),
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT NOT NULL,
    "filialId" TEXT,
    "responsavelId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oportunidade" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoOperacao" NOT NULL,
    "status" "StatusOportunidade" NOT NULL DEFAULT 'NOVA',
    "valor" DECIMAL(12,2),
    "probabilidade" INTEGER,
    "origem" TEXT,
    "motivoPerda" TEXT,
    "previsaoFechamento" TIMESTAMP(3),
    "fechadaEm" TIMESTAMP(3),
    "empresaId" TEXT NOT NULL,
    "pessoaId" TEXT,
    "obraId" TEXT,
    "responsavelId" TEXT,
    "equipamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Oportunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoContato" (
    "id" TEXT NOT NULL,
    "tipo" "TipoContato" NOT NULL,
    "resumo" TEXT NOT NULL,
    "detalhes" TEXT,
    "dataContato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proximoContato" TIMESTAMP(3),
    "oportunidadeId" TEXT,
    "empresaId" TEXT,
    "pessoaId" TEXT,
    "usuarioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricoContato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoEquipamento" NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "ano" INTEGER,
    "numeroSerie" TEXT,
    "status" "StatusEquipamento" NOT NULL DEFAULT 'DISPONIVEL',
    "valorLocacao" DECIMAL(12,2),
    "valorVenda" DECIMAL(12,2),
    "observacoes" TEXT,
    "filialId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_filialId_idx" ON "Usuario"("filialId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- CreateIndex
CREATE INDEX "Empresa_filialId_idx" ON "Empresa"("filialId");

-- CreateIndex
CREATE INDEX "Empresa_razaoSocial_idx" ON "Empresa"("razaoSocial");

-- CreateIndex
CREATE INDEX "Pessoa_empresaId_idx" ON "Pessoa"("empresaId");

-- CreateIndex
CREATE INDEX "Pessoa_nome_idx" ON "Pessoa"("nome");

-- CreateIndex
CREATE INDEX "Obra_empresaId_idx" ON "Obra"("empresaId");

-- CreateIndex
CREATE INDEX "Obra_filialId_idx" ON "Obra"("filialId");

-- CreateIndex
CREATE INDEX "Obra_responsavelId_idx" ON "Obra"("responsavelId");

-- CreateIndex
CREATE INDEX "Oportunidade_empresaId_idx" ON "Oportunidade"("empresaId");

-- CreateIndex
CREATE INDEX "Oportunidade_pessoaId_idx" ON "Oportunidade"("pessoaId");

-- CreateIndex
CREATE INDEX "Oportunidade_obraId_idx" ON "Oportunidade"("obraId");

-- CreateIndex
CREATE INDEX "Oportunidade_responsavelId_idx" ON "Oportunidade"("responsavelId");

-- CreateIndex
CREATE INDEX "Oportunidade_equipamentoId_idx" ON "Oportunidade"("equipamentoId");

-- CreateIndex
CREATE INDEX "Oportunidade_status_idx" ON "Oportunidade"("status");

-- CreateIndex
CREATE INDEX "HistoricoContato_oportunidadeId_idx" ON "HistoricoContato"("oportunidadeId");

-- CreateIndex
CREATE INDEX "HistoricoContato_empresaId_idx" ON "HistoricoContato"("empresaId");

-- CreateIndex
CREATE INDEX "HistoricoContato_pessoaId_idx" ON "HistoricoContato"("pessoaId");

-- CreateIndex
CREATE INDEX "HistoricoContato_usuarioId_idx" ON "HistoricoContato"("usuarioId");

-- CreateIndex
CREATE INDEX "HistoricoContato_dataContato_idx" ON "HistoricoContato"("dataContato");

-- CreateIndex
CREATE UNIQUE INDEX "Equipamento_codigo_key" ON "Equipamento"("codigo");

-- CreateIndex
CREATE INDEX "Equipamento_filialId_idx" ON "Equipamento"("filialId");

-- CreateIndex
CREATE INDEX "Equipamento_status_idx" ON "Equipamento"("status");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empresa" ADD CONSTRAINT "Empresa_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pessoa" ADD CONSTRAINT "Pessoa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oportunidade" ADD CONSTRAINT "Oportunidade_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoContato" ADD CONSTRAINT "HistoricoContato_oportunidadeId_fkey" FOREIGN KEY ("oportunidadeId") REFERENCES "Oportunidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoContato" ADD CONSTRAINT "HistoricoContato_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoContato" ADD CONSTRAINT "HistoricoContato_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "Pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoContato" ADD CONSTRAINT "HistoricoContato_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE SET NULL ON UPDATE CASCADE;
