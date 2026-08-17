-- Oportunidades criadas nos últimos 3 dias por qualquer origem automatizada
SELECT
  o.id,
  o.titulo,
  o."canalOrigem",
  o.status,
  o.temperatura,
  o."potencialOportunidade",
  e."razaoSocial"  AS empresa,
  o."criadoEm"
FROM "Oportunidade" o
LEFT JOIN "Empresa" e ON e.id = o."empresaId"
WHERE o."criadoEm" >= NOW() - INTERVAL '3 days'
ORDER BY o."criadoEm" DESC;
