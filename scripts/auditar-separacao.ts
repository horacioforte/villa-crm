// ARQUIVO: scripts/auditar-separacao.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Auditoria READ ONLY — separação Radar João vs Carteiras Estratégicas.
// Não altera nenhum dado — apenas lê e exibe relatório.
//
// Uso:
//   npx tsx scripts/auditar-separacao.ts

import "./env";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(`\n${"═".repeat(70)}`);
  console.log("AUDITORIA SEPARAÇÃO: RADAR JOÃO × CARTEIRAS ESTRATÉGICAS");
  console.log(`${"═".repeat(70)}\n`);

  // ── 1. Totais gerais ─────────────────────────────────────────────────────────

  const { rows: [totais] } = await client.query<{
    total: number;
    so_radar: number;
    so_carteira: number;
    ambos: number;
    sem_carteira_sem_joao_radar: number;
    com_carteira: number;
    sem_carteira: number;
  }>(`
    SELECT
      COUNT(*)::int                                              AS total,
      COUNT(*) FILTER (
        WHERE origem = 'JOAO_RADAR'
          AND NOT EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
      )::int                                                     AS so_radar,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
          AND origem != 'JOAO_RADAR'
      )::int                                                     AS so_carteira,
      COUNT(*) FILTER (
        WHERE origem = 'JOAO_RADAR'
          AND EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
      )::int                                                     AS ambos,
      COUNT(*) FILTER (
        WHERE origem != 'JOAO_RADAR'
          AND NOT EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
      )::int                                                     AS sem_carteira_sem_joao_radar,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
      )::int                                                     AS com_carteira,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
      )::int                                                     AS sem_carteira
    FROM "DossieComercial" d
  `);

  console.log("── TOTAIS GLOBAIS ────────────────────────────────────────────────────");
  console.log(`  Total DossieComercial no banco         : ${totais.total}`);
  console.log(`  Com DossieCarteira (Carteiras)         : ${totais.com_carteira}`);
  console.log(`  Sem DossieCarteira                     : ${totais.sem_carteira}`);
  console.log();
  console.log("── CATEGORIAS ────────────────────────────────────────────────────────");
  console.log(`  Só Radar (JOAO_RADAR + sem carteira)   : ${totais.so_radar}`);
  console.log(`  Só Carteira (com carteira + não JOAO)  : ${totais.so_carteira}`);
  console.log(`  AMBOS (JOAO_RADAR + com carteira)      : ${totais.ambos}  ← SOBREPOSIÇÃO`);
  console.log(`  Indeterminado (não JOAO + sem carteira): ${totais.sem_carteira_sem_joao_radar}`);

  // ── 2. Por origem ────────────────────────────────────────────────────────────

  const { rows: origemDist } = await client.query<{ origem: string; qtd: number }>(`
    SELECT origem, COUNT(*)::int AS qtd
    FROM "DossieComercial"
    GROUP BY origem ORDER BY qtd DESC
  `);

  console.log("\n── DISTRIBUIÇÃO POR ORIGEM ───────────────────────────────────────────");
  for (const r of origemDist)
    console.log(`  ${r.origem.padEnd(20)}: ${r.qtd}`);

  // ── 3. Dossiês com DossieCarteira — distribuição por carteira ────────────────

  const { rows: carteiraDist } = await client.query<{ carteira: string; qtd: number }>(`
    SELECT carteira, COUNT(*)::int AS qtd
    FROM "DossieCarteira"
    GROUP BY carteira ORDER BY qtd DESC
  `);

  console.log("\n── DISTRIBUIÇÃO POR CARTEIRA (DossieCarteira) ────────────────────────");
  for (const r of carteiraDist)
    console.log(`  ${r.carteira.padEnd(25)}: ${r.qtd}`);

  // ── 4. Dossiês em múltiplas carteiras ────────────────────────────────────────

  const { rows: multiCarteira } = await client.query<{ qtd_carteiras: number; qtd_dossies: number }>(`
    SELECT qtd_carteiras, COUNT(*)::int AS qtd_dossies
    FROM (
      SELECT "dossieId", COUNT(*)::int AS qtd_carteiras
      FROM "DossieCarteira"
      GROUP BY "dossieId"
    ) t
    GROUP BY qtd_carteiras ORDER BY qtd_carteiras
  `);

  console.log("\n── DOSSIÊS EM MÚLTIPLAS CARTEIRAS ────────────────────────────────────");
  for (const r of multiCarteira)
    console.log(`  ${r.qtd_carteiras} carteira(s): ${r.qtd_dossies} dossiê(s)`);

  // ── 5. Origem dos dossiês COM DossieCarteira ─────────────────────────────────

  const { rows: origemCarteira } = await client.query<{ origem: string; qtd: number }>(`
    SELECT d.origem, COUNT(*)::int AS qtd
    FROM "DossieComercial" d
    WHERE EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
    GROUP BY d.origem ORDER BY qtd DESC
  `);

  console.log("\n── ORIGEM DOS DOSSIÊS QUE TÊM DossieCarteira ────────────────────────");
  for (const r of origemCarteira)
    console.log(`  ${r.origem.padEnd(20)}: ${r.qtd}  ← todos os seeds usam JOAO_RADAR`);

  // ── 6. criadoPorAgente dos dossiês SEM DossieCarteira ────────────────────────

  const { rows: agenteRadar } = await client.query<{ agente: string; qtd: number }>(`
    SELECT COALESCE("criadoPorAgente", '(null)') AS agente, COUNT(*)::int AS qtd
    FROM "DossieComercial" d
    WHERE NOT EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
    GROUP BY agente ORDER BY qtd DESC
  `);

  console.log("\n── criadoPorAgente DOS DOSSIÊS SEM DossieCarteira ────────────────────");
  for (const r of agenteRadar)
    console.log(`  ${r.agente.padEnd(25)}: ${r.qtd}`);

  // ── 7. criadoPorAgente dos dossiês COM DossieCarteira ────────────────────────

  const { rows: agenteCarteira } = await client.query<{ agente: string; qtd: number }>(`
    SELECT COALESCE("criadoPorAgente", '(null)') AS agente, COUNT(*)::int AS qtd
    FROM "DossieComercial" d
    WHERE EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
    GROUP BY agente ORDER BY qtd DESC
  `);

  console.log("\n── criadoPorAgente DOS DOSSIÊS COM DossieCarteira ────────────────────");
  for (const r of agenteCarteira)
    console.log(`  ${r.agente.padEnd(25)}: ${r.qtd}`);

  // ── 8. Cockpit hoje: o que aparece sem filtro ─────────────────────────────────

  const { rows: [cockpit] } = await client.query<{
    sem_filtro: number;
    so_radar: number;
    so_carteira_ou_ambos: number;
  }>(`
    SELECT
      COUNT(*)::int AS sem_filtro,
      COUNT(*) FILTER (
        WHERE NOT EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
      )::int AS so_radar,
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
      )::int AS so_carteira_ou_ambos
    FROM "DossieComercial" d
    WHERE d.status NOT IN ('ARQUIVADO')
  `);

  console.log("\n── SIMULAÇÃO DO COCKPIT ATUAL (status != ARQUIVADO) ─────────────────");
  console.log(`  Total retornado (sem filtro adicional) : ${cockpit.sem_filtro}`);
  console.log(`  Destes: só Radar (sem DossieCarteira)  : ${cockpit.so_radar}`);
  console.log(`  Destes: com DossieCarteira (indevidos) : ${cockpit.so_carteira_ou_ambos}`);

  // ── 9. 10 exemplos de dossiês SEM DossieCarteira (Radar puro) ────────────────

  const { rows: exemploRadar } = await client.query<{
    id: string; titulo: string; origem: string; criadoPorAgente: string | null;
    status: string; tipo: string;
  }>(`
    SELECT d.id, d.titulo, d.origem::text, d."criadoPorAgente", d.status::text, d.tipo::text
    FROM "DossieComercial" d
    WHERE NOT EXISTS (SELECT 1 FROM "DossieCarteira" dc WHERE dc."dossieId" = d.id)
    ORDER BY d."createdAt" DESC
    LIMIT 10
  `);

  console.log("\n── 10 EXEMPLOS — RADAR PURO (sem DossieCarteira) ────────────────────");
  for (const r of exemploRadar)
    console.log(`  [${r.status}] ${r.titulo.slice(0, 55)} | origem=${r.origem} | agente=${r.criadoPorAgente ?? "null"}`);

  // ── 10. 10 exemplos de dossiês COM DossieCarteira ────────────────────────────

  const { rows: exemploCarteira } = await client.query<{
    id: string; titulo: string; origem: string; criadoPorAgente: string | null;
    status: string; tipo: string; carteiras: string;
  }>(`
    SELECT d.id, d.titulo, d.origem::text, d."criadoPorAgente", d.status::text, d.tipo::text,
           STRING_AGG(dc.carteira::text, ', ') AS carteiras
    FROM "DossieComercial" d
    JOIN "DossieCarteira" dc ON dc."dossieId" = d.id
    GROUP BY d.id, d.titulo, d.origem, d."criadoPorAgente", d.status, d.tipo
    ORDER BY d."createdAt" DESC
    LIMIT 10
  `);

  console.log("\n── 10 EXEMPLOS — COM DossieCarteira (Carteiras) ─────────────────────");
  for (const r of exemploCarteira)
    console.log(`  [${r.status}] ${r.titulo.slice(0, 45)} | origem=${r.origem} | carteiras=${r.carteiras}`);

  // ── 11. 5 exemplos de SOBREPOSIÇÃO (JOAO_RADAR + DossieCarteira) ─────────────

  const { rows: exemploSobreposicao } = await client.query<{
    titulo: string; origem: string; carteiras: string; criadoPorAgente: string | null;
  }>(`
    SELECT d.titulo, d.origem::text, d."criadoPorAgente",
           STRING_AGG(dc.carteira::text, ', ') AS carteiras
    FROM "DossieComercial" d
    JOIN "DossieCarteira" dc ON dc."dossieId" = d.id
    WHERE d.origem = 'JOAO_RADAR'
    GROUP BY d.id, d.titulo, d.origem, d."criadoPorAgente"
    LIMIT 5
  `);

  if (exemploSobreposicao.length > 0) {
    console.log("\n── EXEMPLOS DE SOBREPOSIÇÃO (JOAO_RADAR + com carteira) ─────────────");
    for (const r of exemploSobreposicao)
      console.log(`  ${r.titulo.slice(0, 50)} | carteiras=${r.carteiras}`);
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log("READ ONLY — nenhum dado alterado.");
  console.log(`${"═".repeat(70)}\n`);

  await client.end();
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
