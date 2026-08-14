-- Corrigir criadoPorAgente e fonteInformacao dos 8 dossiês
-- Obras 1-4: Morgana
UPDATE "DossieComercial"
SET "criadoPorAgente" = 'Morgana',
    "fonteInformacao" = 'Solicitado por Morgana'
WHERE origem = 'MANUAL'
  AND (
    titulo ILIKE '%UTE Jandaia%'
    OR titulo ILIKE '%BR-104%'
    OR titulo ILIKE '%Nove de Julho%'
    OR titulo ILIKE '%Transnordestina%'
  );

-- Obras 5-8: Horácio
UPDATE "DossieComercial"
SET "criadoPorAgente" = 'Horácio',
    "fonteInformacao" = 'Solicitado por Horácio'
WHERE origem = 'MANUAL'
  AND (
    titulo ILIKE '%Odata%'
    OR titulo ILIKE '%One Data Center%'
    OR titulo ILIKE '%datacenter ceara%'
    OR titulo ILIKE '%GWM%'
  );
