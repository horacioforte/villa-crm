// ARQUIVO: scripts/base-nacional/seed-segmentos-branch.ts
// REGRA: nunca remover. Apenas acrescentar.
// Cadastra os segmentos iniciais em SegmentoEmpresa — SOMENTE no branch isolado.
// Não associa nenhuma Empresa. Idempotente (ON CONFLICT DO NOTHING).
//
// Uso: npx tsx scripts/base-nacional/seed-segmentos-branch.ts            → dry-run
//      npx tsx scripts/base-nacional/seed-segmentos-branch.ts --commit   → grava no branch

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";

const SEGMENTOS: Array<{ nome: string; slug: string; ordem: number }> = [
  { nome: "Concreteira", slug: "concreteira", ordem: 10 },
  { nome: "Pré-Moldado", slug: "pre-moldado", ordem: 20 },
  { nome: "Bombeamento de Concreto", slug: "bombeamento-de-concreto", ordem: 30 },
  { nome: "Construtora", slug: "construtora", ordem: 40 },
  { nome: "Incorporadora", slug: "incorporadora", ordem: 50 },
  { nome: "Locadora", slug: "locadora", ordem: 60 },
  { nome: "Indústria", slug: "industria", ordem: 70 },
  { nome: "Revenda", slug: "revenda", ordem: 80 },
  { nome: "Outro", slug: "outro", ordem: 90 },
];

async function main() {
  const commit = process.argv.includes("--commit");
  const amb = carregarAmbienteIsolado();
  console.log(`[seed-segmentos] branch isolado — endpoint ${amb.endpointMascarado} — modo ${commit ? "COMMIT" : "dry-run"}`);
  const c = new Client({ connectionString: amb.url });
  await c.connect();
  try {
    if (!commit) {
      SEGMENTOS.forEach(s => console.log(`  (dry-run) ${s.nome}`));
      return;
    }
    let criados = 0;
    for (const s of SEGMENTOS) {
      const r = await c.query(
        `INSERT INTO "SegmentoEmpresa" (id, nome, slug, ativo, ordem, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, now(), now()) ON CONFLICT DO NOTHING`,
        [randomUUID(), s.nome, s.slug, s.ordem],
      );
      criados += r.rowCount ?? 0;
    }
    const total = await c.query(`SELECT count(*)::int AS n FROM "SegmentoEmpresa"`);
    console.log(`[seed-segmentos] criados agora: ${criados} — total na tabela: ${total.rows[0].n}`);
  } finally {
    await c.end();
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : "erro"); process.exit(1); });
