// ARQUIVO: scripts/auditar-legado.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Auditoria READ ONLY dos dossiês legados com completude zerada.
// Não altera nenhum dado — apenas lê e exibe relatório.
//
// Uso:
//   npx tsx scripts/auditar-legado.ts

import "./env";
import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(`\n${"═".repeat(65)}`);
  console.log("AUDITORIA LEGADO — READ ONLY");
  console.log(`${"═".repeat(65)}\n`);

  // ── 1. Totais gerais ────────────────────────────────────────────────────────

  const { rows: [totais] } = await client.query<{
    total: number; assumido: number; arquivado: number; ativos: number;
    zero_completude: number; com_completude: number;
  }>(`
    SELECT
      COUNT(*)::int                                        AS total,
      COUNT(*) FILTER (WHERE status = 'ASSUMIDO')::int    AS assumido,
      COUNT(*) FILTER (WHERE status = 'ARQUIVADO')::int   AS arquivado,
      COUNT(*) FILTER (WHERE status NOT IN ('ASSUMIDO','ARQUIVADO'))::int AS ativos,
      COUNT(*) FILTER (WHERE completude = 0 AND status NOT IN ('ASSUMIDO','ARQUIVADO'))::int AS zero_completude,
      COUNT(*) FILTER (WHERE completude > 0 AND status NOT IN ('ASSUMIDO','ARQUIVADO'))::int AS com_completude
    FROM "DossieComercial"
  `);

  console.log("── TOTAIS GERAIS ────────────────────────────────────────────────");
  console.log(`  Total no banco        : ${totais.total}`);
  console.log(`  Ativos (no funil)     : ${totais.ativos}`);
  console.log(`  Oportunidade (ASSUMIDO): ${totais.assumido}`);
  console.log(`  Arquivados            : ${totais.arquivado}`);
  console.log(`  Completude = 0        : ${totais.zero_completude}  ← legados`);
  console.log(`  Completude > 0        : ${totais.com_completude}`);

  // ── 2. Score dos legados (completude = 0) ───────────────────────────────────

  const { rows: scoreDist } = await client.query<{ faixa: string; qtd: number }>(`
    SELECT
      CASE
        WHEN score BETWEEN 0  AND 24  THEN '0–24'
        WHEN score BETWEEN 25 AND 49  THEN '25–49'
        WHEN score BETWEEN 50 AND 69  THEN '50–69'
        WHEN score BETWEEN 70 AND 84  THEN '70–84'
        WHEN score BETWEEN 85 AND 100 THEN '85–100'
      END AS faixa,
      COUNT(*)::int AS qtd
    FROM "DossieComercial"
    WHERE completude = 0 AND status NOT IN ('ASSUMIDO','ARQUIVADO')
    GROUP BY 1
    ORDER BY MIN(score)
  `);

  console.log("\n── SCORE (legados completude=0) ─────────────────────────────────");
  for (const r of scoreDist)
    console.log(`  ${String(r.faixa).padEnd(8)}: ${r.qtd}`);

  // ── 3. Por status antigo (legados) ──────────────────────────────────────────

  const { rows: statusDist } = await client.query<{ status: string; qtd: number }>(`
    SELECT status, COUNT(*)::int AS qtd
    FROM "DossieComercial"
    WHERE completude = 0 AND status NOT IN ('ASSUMIDO','ARQUIVADO')
    GROUP BY status ORDER BY qtd DESC
  `);

  console.log("\n── STATUS ANTIGO (legados completude=0) ─────────────────────────");
  for (const r of statusDist)
    console.log(`  ${r.status.padEnd(26)}: ${r.qtd}`);

  // ── 4. Por tipo/carteira (legados) ──────────────────────────────────────────

  const { rows: tipoDist } = await client.query<{ tipo: string; qtd: number }>(`
    SELECT tipo, COUNT(*)::int AS qtd
    FROM "DossieComercial"
    WHERE completude = 0 AND status NOT IN ('ASSUMIDO','ARQUIVADO')
    GROUP BY tipo ORDER BY qtd DESC LIMIT 15
  `);

  console.log("\n── POR CARTEIRA/TIPO (legados completude=0) ─────────────────────");
  for (const r of tipoDist)
    console.log(`  ${r.tipo.padEnd(30)}: ${r.qtd}`);

  // ── 5. Dias desde última atividade (legados) ────────────────────────────────

  const { rows: diasDist } = await client.query<{ faixa: string; qtd: number }>(`
    SELECT
      CASE
        WHEN EXTRACT(DAY FROM NOW() - COALESCE("ultimaAtividade","updatedAt")) <= 7   THEN '0–7 dias'
        WHEN EXTRACT(DAY FROM NOW() - COALESCE("ultimaAtividade","updatedAt")) <= 30  THEN '8–30 dias'
        WHEN EXTRACT(DAY FROM NOW() - COALESCE("ultimaAtividade","updatedAt")) <= 90  THEN '31–90 dias'
        WHEN EXTRACT(DAY FROM NOW() - COALESCE("ultimaAtividade","updatedAt")) <= 180 THEN '91–180 dias'
        ELSE '+180 dias'
      END AS faixa,
      COUNT(*)::int AS qtd
    FROM "DossieComercial"
    WHERE completude = 0 AND status NOT IN ('ASSUMIDO','ARQUIVADO')
    GROUP BY 1
    ORDER BY MIN(EXTRACT(DAY FROM NOW() - COALESCE("ultimaAtividade","updatedAt")))
  `);

  console.log("\n── DIAS DESDE ÚLTIMA ATIVIDADE (legados completude=0) ──────────");
  for (const r of diasDist)
    console.log(`  ${r.faixa.padEnd(14)}: ${r.qtd}`);

  // ── 6. Top 30 candidatos para piloto (completude=0, não Construtoras) ───────
  // Excluímos tipo = 'Construtora' por proteção READ ONLY.
  // Ordenação: score desc, status mais avançado desc, atualização mais recente desc.

  const { rows: candidatos } = await client.query<{
    id: string; titulo: string; tipo: string; status: string;
    score: number; completude: number;
    potencial_villa: number | null; momento_villa: number | null;
    prontidao: number | null; prioridade_joao: number | null;
    missao_atual: string | null;
    ultima_atividade: string | null;
    cidade: string | null; estado: string | null;
    cliente_final: string | null; construtora: string | null;
    epc: string | null; total_decisores: number;
  }>(`
    SELECT
      id, titulo, tipo, status, score, completude,
      "potencialVilla"   AS potencial_villa,
      "momentoVilla"     AS momento_villa,
      prontidao,
      "prioridadeJoao"   AS prioridade_joao,
      "missaoAtual"      AS missao_atual,
      COALESCE("ultimaAtividade","updatedAt")::text AS ultima_atividade,
      cidade, estado,
      "clienteFinal"     AS cliente_final,
      construtora,
      epc,
      "totalDecisores"   AS total_decisores
    FROM "DossieComercial"
    WHERE
      completude = 0
      AND status NOT IN ('ASSUMIDO','ARQUIVADO')
      AND tipo::text NOT ILIKE '%construtora%'
    ORDER BY
      score DESC,
      CASE status
        WHEN 'PRONTO_PARA_ASSUMIR'  THEN 0
        WHEN 'EM_ANALISE'           THEN 1
        WHEN 'AGUARDANDO_VALIDACAO' THEN 2
        WHEN 'PEDIR_MAIS_PESQUISA'  THEN 3
        ELSE 4
      END ASC,
      COALESCE("ultimaAtividade","updatedAt") DESC
    LIMIT 30
  `);

  console.log(`\n── TOP 30 CANDIDATOS (excluindo Construtoras) ───────────────────`);
  console.log(`   #  Score  Status                    Tipo                     Título`);
  console.log(`  ${"─".repeat(90)}`);
  for (let i = 0; i < candidatos.length; i++) {
    const c = candidatos[i];
    const n  = String(i + 1).padStart(3);
    const sc = String(c.score).padStart(5);
    const st = c.status.padEnd(25);
    const tp = (c.tipo ?? "—").slice(0, 22).padEnd(22);
    const tl = c.titulo.slice(0, 50);
    console.log(`  ${n}  ${sc}  ${st} ${tp}  ${tl}`);
  }

  // ── 7. Detalhe dos 20 primeiros (ANTES do piloto) ───────────────────────────

  console.log(`\n${"═".repeat(65)}`);
  console.log("DETALHE — 20 SELECIONADOS PARA PILOTO (estado ANTES)");
  console.log(`${"═".repeat(65)}`);

  for (let i = 0; i < Math.min(20, candidatos.length); i++) {
    const c = candidatos[i];
    console.log(`\n[${i + 1}] ${c.titulo}`);
    console.log(`    ID          : ${c.id}`);
    console.log(`    Tipo        : ${c.tipo}`);
    console.log(`    Status      : ${c.status}`);
    console.log(`    Score       : ${c.score}`);
    console.log(`    Completude  : ${c.completude}%`);
    console.log(`    Potencial   : ${c.potencial_villa ?? "—"}`);
    console.log(`    Momento     : ${c.momento_villa ?? "—"}`);
    console.log(`    Prontidão   : ${c.prontidao ?? "—"}`);
    console.log(`    Prioridade  : ${c.prioridade_joao ?? "—"}`);
    console.log(`    Local       : ${c.cidade ?? "—"}/${c.estado ?? "—"}`);
    console.log(`    Decisores   : ${c.total_decisores}`);
    console.log(`    Missão      : ${c.missao_atual?.slice(0, 100) ?? "—"}`);
    console.log(`    Última ativ.: ${c.ultima_atividade?.slice(0, 19) ?? "—"}`);
  }

  console.log(`\n${"═".repeat(65)}`);
  console.log("READ ONLY — nenhum dado alterado.");
  console.log(`${"═".repeat(65)}\n`);

  await client.end();
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
