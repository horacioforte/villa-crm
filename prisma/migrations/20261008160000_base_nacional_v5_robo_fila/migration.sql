-- MIGRATION v5 — Base Nacional de Concreteiras: robô gratuito + fila de verificação humana.
-- Autorizada por Horácio em 08/10/2026 SOMENTE para o branch Neon "base-nacional-concreteiras"
-- (endpoint ep-gentle-king-ajo60u4q), aplicada via prisma.config.base-nacional.ts. Produção: proibido.
--
-- Estritamente ADITIVA: só cria tabelas/tipos novos e acrescenta valores a enums da própria Base Nacional.
-- Não altera, renomeia nem remove coluna, tabela, tipo ou dado existente. Não toca Empresa, Pessoa,
-- DossieComercial, DossieCarteira, Oportunidade, Tarefa nem tabelas anteriores à v3.
-- Únicas referências a tabelas antigas: chaves para "Usuario" (ON DELETE SET NULL).
-- Nenhum campo de preço. REGRA: nunca remover. Apenas acrescentar.

-- 1. Valores novos em enums da Base Nacional (v4)
ALTER TYPE "OrigemAcaoBaseNacional" ADD VALUE IF NOT EXISTS 'ROBO_GRATUITO';
ALTER TYPE "OrigemAcaoBaseNacional" ADD VALUE IF NOT EXISTS 'FILA_VERIFICACAO';
ALTER TYPE "TipoEventoBaseNacional" ADD VALUE IF NOT EXISTS 'TRIAGEM';
ALTER TYPE "TipoEventoBaseNacional" ADD VALUE IF NOT EXISTS 'FILA_VERIFICACAO';

-- 2. Tipos novos
CREATE TYPE "SituacaoFilaVerificacao" AS ENUM ('AGUARDANDO', 'CONCLUIDA', 'DISPENSADA_TRIAGEM');
CREATE TYPE "TipoVinculoCandidata" AS ENUM ('TELEFONE', 'EMAIL', 'DOMINIO', 'ENDERECO', 'RAIZ_CNPJ');

-- 3. Triagem e fila (1 linha por candidata)
CREATE TABLE "ConcreteiraTriagem" (
    "candidataId"       TEXT NOT NULL,
    "versaoRegra"       TEXT NOT NULL,
    "classificacao"     TEXT NOT NULL,
    "sinais"            TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pontuacao"         INTEGER NOT NULL DEFAULT 0,
    "uf"                CHAR(2),
    "municipio"         TEXT,
    "interior"          BOOLEAN NOT NULL DEFAULT false,
    "prioridadeReceita" CHAR(1),
    "situacaoFila"      "SituacaoFilaVerificacao" NOT NULL DEFAULT 'AGUARDANDO',
    "motivoFila"        TEXT,
    "sugestaoRobo"      TEXT,
    "potencialCompra"   "NivelPotencial" NOT NULL DEFAULT 'DESCONHECIDO',
    "emRevisaoPorId"    TEXT,
    "emRevisaoDesde"    TIMESTAMP(3),
    "concluidaPorId"    TEXT,
    "concluidaEm"       TIMESTAMP(3),
    "roboExecutadoEm"   TIMESTAMP(3),
    "roboResumo"        JSONB,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConcreteiraTriagem_pkey" PRIMARY KEY ("candidataId"),
    CONSTRAINT "ConcreteiraTriagem_concluida_exige_responsavel_chk"
      CHECK ("situacaoFila" <> 'CONCLUIDA' OR ("concluidaPorId" IS NOT NULL AND "concluidaEm" IS NOT NULL)),
    CONSTRAINT "ConcreteiraTriagem_reserva_completa_chk"
      CHECK (("emRevisaoPorId" IS NULL) = ("emRevisaoDesde" IS NULL))
);
ALTER TABLE "ConcreteiraTriagem" ADD CONSTRAINT "ConcreteiraTriagem_candidataId_fkey"
  FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraTriagem" ADD CONSTRAINT "ConcreteiraTriagem_emRevisaoPorId_fkey"
  FOREIGN KEY ("emRevisaoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraTriagem" ADD CONSTRAINT "ConcreteiraTriagem_concluidaPorId_fkey"
  FOREIGN KEY ("concluidaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ConcreteiraTriagem_uf_situacaoFila_idx" ON "ConcreteiraTriagem"("uf", "situacaoFila");
CREATE INDEX "ConcreteiraTriagem_situacaoFila_pontuacao_idx" ON "ConcreteiraTriagem"("situacaoFila", "pontuacao");

-- 4. Vínculos entre candidatas encontrados pelo robô (telefone, e-mail, domínio, endereço, raiz)
CREATE TABLE "ConcreteiraVinculo" (
    "id"                     TEXT NOT NULL,
    "candidataId"            TEXT NOT NULL,
    "candidataRelacionadaId" TEXT NOT NULL,
    "tipo"                   "TipoVinculoCandidata" NOT NULL,
    "chaveMascarada"         TEXT NOT NULL,
    "forca"                  TEXT NOT NULL DEFAULT 'MEDIA',
    "agente"                 TEXT NOT NULL DEFAULT 'robo-gratuito',
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConcreteiraVinculo_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConcreteiraVinculo_distintas_chk" CHECK ("candidataId" <> "candidataRelacionadaId")
);
ALTER TABLE "ConcreteiraVinculo" ADD CONSTRAINT "ConcreteiraVinculo_candidataId_fkey"
  FOREIGN KEY ("candidataId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConcreteiraVinculo" ADD CONSTRAINT "ConcreteiraVinculo_candidataRelacionadaId_fkey"
  FOREIGN KEY ("candidataRelacionadaId") REFERENCES "ConcreteiraCandidata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ConcreteiraVinculo_par_tipo_key" ON "ConcreteiraVinculo"("candidataId", "candidataRelacionadaId", "tipo");
CREATE INDEX "ConcreteiraVinculo_candidataId_idx" ON "ConcreteiraVinculo"("candidataId");

-- 5. Cache das páginas públicas visitadas pelo robô (nunca visita a mesma URL duas vezes no prazo)
CREATE TABLE "ConcreteiraRoboCache" (
    "url"              TEXT NOT NULL,
    "dominio"          TEXT NOT NULL,
    "permitidoRobots"  BOOLEAN NOT NULL,
    "statusHttp"       INTEGER,
    "erro"             TEXT,
    "termosConcreto"   TEXT[] DEFAULT ARRAY[]::TEXT[],
    "termosOutros"     TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cnpjsEncontrados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trechos"          JSONB,
    "titulo"           TEXT,
    "buscadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConcreteiraRoboCache_pkey" PRIMARY KEY ("url")
);
CREATE INDEX "ConcreteiraRoboCache_dominio_idx" ON "ConcreteiraRoboCache"("dominio");
