-- ROLLBACK da migration v4 revisada (20261005120000_base_nacional_v4_validacao_contatos).
-- NÃO EXECUTAR sem autorização expressa do Horácio. ⚠ APAGA DEFINITIVAMENTE todos os contatos,
-- pessoas e potenciais cadastrados, a qualificação comercial das candidatas, a observação das
-- evidências e o detalhe (tipo/origem/campo/valores) do histórico. Exportar antes.
-- Preferível no Neon: restaurar o branch para um ponto anterior (também perde o que veio depois).
BEGIN;
DROP TABLE IF EXISTS "ConcreteiraPotencialEquipamento";
DROP TABLE IF EXISTS "ConcreteiraCandidataPessoa";
DROP TABLE IF EXISTS "ConcreteiraCandidataContato";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP CONSTRAINT IF EXISTS "ConcreteiraCandidata_descarte_exige_justificativa_chk";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP CONSTRAINT IF EXISTS "ConcreteiraCandidata_confirmada_exige_validacao_chk";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP CONSTRAINT IF EXISTS "ConcreteiraCandidata_qualificadoPorId_fkey";
DROP INDEX IF EXISTS "ConcreteiraCandidata_prioridadeComercial_idx";
DROP INDEX IF EXISTS "ConcreteiraCandidata_nomeOrdenacao_id_idx";
DROP INDEX IF EXISTS "ConcreteiraValidacaoHistorico_tipoEvento_idx";
ALTER TABLE IF EXISTS "ConcreteiraEvidencia" DROP COLUMN IF EXISTS "observacao";
ALTER TABLE IF EXISTS "ConcreteiraValidacaoHistorico" DROP COLUMN IF EXISTS "entidadeId", DROP COLUMN IF EXISTS "valorNovo", DROP COLUMN IF EXISTS "valorAnterior", DROP COLUMN IF EXISTS "campo", DROP COLUMN IF EXISTS "origem", DROP COLUMN IF EXISTS "tipoEvento";
ALTER TABLE IF EXISTS "ConcreteiraCandidata" DROP COLUMN IF EXISTS "nomeOrdenacao", DROP COLUMN IF EXISTS "qualificadoPorId", DROP COLUMN IF EXISTS "qualificadoEm", DROP COLUMN IF EXISTS "observacaoComercial", DROP COLUMN IF EXISTS "prioridadeComercial";
DROP TYPE IF EXISTS "PrioridadeComercial";
DROP TYPE IF EXISTS "NivelPotencial";
DROP TYPE IF EXISTS "TipoEquipamentoInteresse";
DROP TYPE IF EXISTS "PapelPessoaCandidata";
DROP TYPE IF EXISTS "SituacaoVerificacaoContato";
DROP TYPE IF EXISTS "TipoContatoCandidata";
DROP TYPE IF EXISTS "OrigemAcaoBaseNacional";
DROP TYPE IF EXISTS "TipoEventoBaseNacional";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261005120000_base_nacional_v4_validacao_contatos';
COMMIT;
