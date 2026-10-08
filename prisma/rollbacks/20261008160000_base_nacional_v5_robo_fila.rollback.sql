-- ROLLBACK da migration v5 (20261008160000_base_nacional_v5_robo_fila).
-- NÃO EXECUTAR sem autorização expressa do Horácio. ⚠ APAGA a triagem, a fila de verificação,
-- os vínculos encontrados pelo robô e o cache de páginas. Exportar antes.
-- Os valores acrescentados aos enums (ROBO_GRATUITO, FILA_VERIFICACAO, TRIAGEM) não podem ser
-- removidos pelo Postgres sem recriar o tipo; ficam inertes (nenhum dado antigo depende deles).
BEGIN;
DROP TABLE IF EXISTS "ConcreteiraRoboCache";
DROP TABLE IF EXISTS "ConcreteiraVinculo";
DROP TABLE IF EXISTS "ConcreteiraTriagem";
DROP TYPE IF EXISTS "TipoVinculoCandidata";
DROP TYPE IF EXISTS "SituacaoFilaVerificacao";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261008160000_base_nacional_v5_robo_fila';
COMMIT;
