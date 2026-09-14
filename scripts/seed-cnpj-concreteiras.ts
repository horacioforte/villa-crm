// ARQUIVO: scripts/seed-cnpj-concreteiras.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Lê o CSV gerado por fetch-cnpj-concreteiras.py e popula a carteira CONCRETEIRAS.
//
// Uso:
//   npx tsx scripts/seed-cnpj-concreteiras.ts          → dry-run (mostra amostra)
//   npx tsx scripts/seed-cnpj-concreteiras.ts --commit  → grava em produção

import "./env";
import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const COMMIT = process.argv.includes("--commit");
const CSV_PATH = path.join(__dirname, "cnpj-concreteiras.csv");

interface Concreteira {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  uf: string;
  cidade: string;
  telefone: string;
  criterio_identificacao?: string;
  confianca?: string;
}

// Parser CSV simples (sem dependência externa)
function parseCsv(content: string): Concreteira[] {
  const lines = content.split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  // Remove aspas de um campo
  const unquote = (s: string) => s.replace(/^"|"$/g, "").replace(/""/g, '"').trim();

  // Divide linha CSV respeitando aspas
  const splitLine = (line: string): string[] => {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        fields.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields.map(unquote);
  };

  const header = splitLine(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  const iCnpj = idx("cnpj");
  const iRazao = idx("razao_social");
  const iFantasia = idx("nome_fantasia");
  const iUf = idx("uf");
  const iCidade = idx("cidade");
  const iTel = idx("telefone");
  const iCriterio = idx("criterio_identificacao");
  const iConfianca = idx("confianca");

  return lines.slice(1).map((line) => {
    const f = splitLine(line);
    return {
      cnpj: f[iCnpj] ?? "",
      razao_social: f[iRazao] ?? "",
      nome_fantasia: f[iFantasia] ?? "",
      uf: f[iUf] ?? "",
      cidade: f[iCidade] ?? "",
      telefone: f[iTel] ?? "",
      criterio_identificacao: iCriterio >= 0 ? (f[iCriterio] ?? "") : "",
      confianca: iConfianca >= 0 ? (f[iConfianca] ?? "") : "",
    };
  }).filter(r => r.cnpj || r.razao_social);
}

async function main() {
  // Verifica se o CSV existe
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n❌ CSV não encontrado: ${CSV_PATH}`);
    console.error("Execute primeiro:");
    console.error("  pip install requests --break-system-packages");
    console.error("  python scripts/fetch-cnpj-concreteiras.py\n");
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(content);

  const porEstado: Record<string, number> = {};
  for (const r of rows) porEstado[r.uf || "??"] = (porEstado[r.uf || "??"] || 0) + 1;

  console.log(`\n${"═".repeat(60)}`);
  console.log("SEED — CONCRETEIRAS BRASIL (CNPJ Receita Federal)");
  console.log(`Modo   : ${COMMIT ? "🔴 PRODUÇÃO (--commit)" : "🟡 DRY-RUN (sem --commit)"}`);
  console.log(`Total  : ${rows.length} concreteiras no CSV`);
  console.log(`${"═".repeat(60)}`);
  for (const [uf, qtd] of Object.entries(porEstado).sort((a, b) => b[1] - a[1]))
    console.log(`  ${uf}: ${qtd}`);
  console.log("");

  if (!COMMIT) {
    console.log("── AMOSTRA (primeiros 30) ──");
    for (const r of rows.slice(0, 30)) {
      const nome = r.nome_fantasia || r.razao_social;
      console.log(`  ${r.uf} | ${r.cidade || "—"} | ${nome}`);
    }
    console.log(`\n💡 Para gravar: npx tsx scripts/seed-cnpj-concreteiras.ts --commit\n`);
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let criados = 0, jaExistiam = 0, erros = 0;

  try {
    for (const r of rows) {
      const titulo = (r.nome_fantasia || r.razao_social).trim();
      if (!titulo) { erros++; continue; }

      // Verifica duplicata por título exato
      const existe = await client.query(
        `SELECT id FROM "DossieComercial" WHERE titulo=$1 LIMIT 1`,
        [titulo],
      );

      if (existe.rows.length > 0) {
        jaExistiam++;
        await client.query(
          `INSERT INTO "DossieCarteira" (id,"dossieId",carteira,status,"createdAt","updatedAt")
           VALUES (gen_random_uuid(),$1,'CONCRETEIRAS','MONITORANDO',NOW(),NOW())
           ON CONFLICT ("dossieId",carteira) DO NOTHING`,
          [existe.rows[0].id],
        );
        continue;
      }

      const criterioLabel = r.criterio_identificacao === "CNAE_DIRETO"
        ? "CNAE 2330305 (direto)"
        : r.criterio_identificacao === "CNAE_GENERICO_NOME"
        ? "CNAE construção + nome (genérico)"
        : "";

      const resumo = [
        `Concreteira${r.cidade ? ` em ${r.cidade}` : ""}/${r.uf}.`,
        r.cnpj ? `CNPJ: ${r.cnpj}.` : "",
        r.telefone ? `Tel: ${r.telefone}.` : "",
        criterioLabel ? `Identificada por: ${criterioLabel}.` : "",
        r.confianca ? `Confiança: ${r.confianca}.` : "",
        `Central dosadora de concreto usinado. Potencial cliente para locação de bomba lança, bomba estacionária e betoneiras da Villa Empreendimentos.`,
      ].filter(Boolean).join(" ");

      const ins = await client.query(
        `INSERT INTO "DossieComercial" (
           id, titulo, resumo, status, origem, tipo, segmento,
           cidade, estado, completude, score,
           "missaoAtual", "ultimaAtividade", "createdAt", "updatedAt"
         ) VALUES (
           gen_random_uuid(), $1, $2, 'INVESTIGANDO', 'JOAO_RADAR', 'EMPRESA', 'Concreteira',
           $3, $4, 0, 0, $5,
           NOW() - INTERVAL '30 days', NOW(), NOW()
         ) RETURNING id`,
        [
          titulo,
          resumo,
          r.cidade || "",
          r.uf,
          `Identificar decisor que contrata locação de bomba lança, bomba estacionária ou betoneira (proprietário, gerente de operações ou comprador). Buscar LinkedIn, telefone e WhatsApp.`,
        ],
      );

      await client.query(
        `INSERT INTO "DossieCarteira" (id,"dossieId",carteira,status,"createdAt","updatedAt")
         VALUES (gen_random_uuid(),$1,'CONCRETEIRAS','MONITORANDO',NOW(),NOW())
         ON CONFLICT ("dossieId",carteira) DO NOTHING`,
        [ins.rows[0].id],
      );

      criados++;
      if (criados % 200 === 0)
        console.log(`  ... ${criados} criados (${((criados / rows.length) * 100).toFixed(1)}%)`);
    }
  } finally {
    await client.end();
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Criados        : ${criados}`);
  console.log(`  Já existiam    : ${jaExistiam}`);
  console.log(`  Sem nome (skip): ${erros}`);
  console.log(`\n✅ Base de concreteiras populada via Receita Federal.`);
  console.log(`   João investiga decisores na próxima terça e quinta.\n`);
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
