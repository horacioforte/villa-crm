-- ROLLBACK da migration v4 — NÃO EXECUTAR sem autorização expressa do Horácio.
-- Remove SOMENTE os objetos criados pela v4, na ordem inversa. Não toca nada da v3 nem anterior.
-- ATENÇÃO: apaga os contatos, pessoas e potenciais registrados após a v4 e as colunas novas.
-- Alternativa preferível no Neon: restaurar o branch "base-nacional-concreteiras" para um
-- ponto anterior à aplicação (Neon > Branches > Restore), sem executar este arquivo.
BEGIN;
DROP TABLE IF EXISTS "ConcreteiraPotencialEquipamento";
DROP TABLE IF EXISTS "ConcreteiraCandidataPessoa";
DROP TABLE IF EXISTS "ConcreteiraCandidataContato";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP CONSTRAINT IF EXISTS "ConcreteiraCandidata_descarte_exige_justificativa_chk";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP CONSTRAINT IF EXISTS "ConcreteiraCandidata_confirmada_exige_validacao_chk";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP CONSTRAINT IF EXISTS "ConcreteiraCandidata_qualificadoPorId_fkey";
DROP INDEX IF EXISTS "ConcreteiraCandidata_empresaId_vinculo_unico";
DROP INDEX IF EXISTS "ConcreteiraCandidata_prioridadeComercial_idx";
DROP INDEX IF EXISTS "ConcreteiraCandidata_nomeOrdenacao_id_idx";
DROP INDEX IF EXISTS "ConcreteiraValidacaoHistorico_tipoEvento_idx";
ALTER TABLE IF EXISTS "ConcreteiraEvidencia" DROP COLUMN IF EXISTS "observacao";
ALTER TABLE IF EXISTS "ConcreteiraValidacaoHistorico" DROP COLUMN IF EXISTS "entidadeId";
ALTER TABLE IF EXISTS "ConcreteiraValidacaoHistorico" DROP COLUMN IF EXISTS "valorNovo";
ALTER TABLE IF EXISTS "ConcreteiraValidacaoHistorico" DROP COLUMN IF EXISTS "valorAnterior";
ALTER TABLE IF EXISTS "ConcreteiraValidacaoHistorico" DROP COLUMN IF EXISTS "campo";
ALTER TABLE IF EXISTS "ConcreteiraValidacaoHistorico" DROP COLUMN IF EXISTS "origem";
ALTER TABLE IF EXISTS "ConcreteiraValidacaoHistorico" DROP COLUMN IF EXISTS "tipoEvento";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP COLUMN IF EXISTS "nomeOrdenacao";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP COLUMN IF EXISTS "qualificadoPorId";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP COLUMN IF EXISTS "qualificadoEm";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP COLUMN IF EXISTS "observacaoComercial";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP COLUMN IF EXISTS "prioridadeComercial";
DROP TYPE IF EXISTS "PrioridadeComercial";
DROP TYPE IF EXISTS "NivelPotencial";
DROP TYPE IF EXISTS "TipoEquipamentoInteresse";
DROP TYPE IF EXISTS "PapelPessoaCandidata";
DROP TYPE IF EXISTS "SituacaoVerificacaoContato";
DROP TYPE IF EXISTS "TipoContatoCandidata";
DROP TYPE IF EXISTS "OrigemAcaoBaseNacional";
DROP TYPE IF EXISTS "TipoEventoBaseNacional";
-- Depois de executar, remover a linha da v4 em "_prisma_migrations" (se ela tiver sido aplicada pelo Prisma).
COMMIT;
