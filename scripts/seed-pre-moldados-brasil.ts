// ARQUIVO: scripts/seed-pre-moldados-brasil.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Seed dos principais fabricantes de pré-moldados de concreto do Brasil.
// Carteira: PRE_MOLDADOS
// Objetivo: mapear decisor e oferecer venda de equipamentos usados (bombas estacionárias,
//           betoneiras) via campanha direta.
//
// Uso:
//   npx tsx scripts/seed-pre-moldados-brasil.ts          → dry-run
//   npx tsx scripts/seed-pre-moldados-brasil.ts --commit  → grava em produção

import "./env";
import { Client } from "pg";

const COMMIT = process.argv.includes("--commit");

interface PreMoldado {
  titulo: string;
  cidade: string;
  estado: string;
  resumo: string;
  segmento: string;
  tier: "A" | "B" | "C";
}

const PRE_MOLDADOS: PreMoldado[] = [

  // ── TIER A — Grupos nacionais / maiores fabricantes ──────────────────────────

  {
    titulo: "Precon Engenharia",
    cidade: "Nova Lima", estado: "MG",
    resumo: "Um dos maiores fabricantes de pré-moldados do Brasil. Produz vigas, pilares, lajes alveolares e painéis para galpões, pontes, viadutos e edifícios. Presente em todo o território nacional.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Premo Pré-Fabricados",
    cidade: "Leme", estado: "SP",
    resumo: "Fabricante nacional de estruturas pré-moldadas de concreto. Especialidade em galpões industriais, pavilhões, pontes e passarelas. Atende projetos de logística, agronegócio e infraestrutura.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Delta Pré-Fabricados",
    cidade: "Caxias do Sul", estado: "RS",
    resumo: "Líder gaúcho em pré-fabricados de concreto. Produz vigas T, duplo T, lajes alveolares, painéis e pilares. Atende construtoras, indústrias e obras de infraestrutura no Sul do Brasil.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Piece Pré-Fabricados",
    cidade: "São Paulo", estado: "SP",
    resumo: "Fabricante paulistano de estruturas pré-moldadas para grandes projetos. Especialidade em centros logísticos, galpões de grande porte e estruturas industriais. Forte presença no interior de SP.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Baltar Pré-Fabricados",
    cidade: "Cabreúva", estado: "SP",
    resumo: "Fabricante de pré-moldados estruturais de concreto. Produz vigas, pilares, lajes e painéis para galpões, centros de distribuição e obras industriais em todo o Brasil.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Selt Engenharia",
    cidade: "Curitiba", estado: "PR",
    resumo: "Fabricante paranaense de estruturas pré-moldadas de concreto. Especialidade em galpões industriais, pontes e viadutos no Sul e Sudeste do Brasil.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Estrutural Pré-Moldados",
    cidade: "Maringá", estado: "PR",
    resumo: "Empresa do PR com foco em pré-moldados para o agronegócio e logística. Produz silos, galpões de armazenagem, pontes rurais e estruturas industriais.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Fuchs Construtora",
    cidade: "Blumenau", estado: "SC",
    resumo: "Fabricante catarinense de pré-moldados de concreto e estruturas metálicas. Atua em galpões industriais, centros de distribuição, frigoríficos e obras portuárias no Sul.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Sulpre Pré-Fabricados",
    cidade: "Passo Fundo", estado: "RS",
    resumo: "Fabricante gaúcho de lajes alveolares, vigas protendidas e painéis de concreto. Fornece para construtoras de todo o Sul do Brasil e projetos de infraestrutura.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },
  {
    titulo: "Concreframe",
    cidade: "Guarulhos", estado: "SP",
    resumo: "Fabricante de sistemas estruturais em pré-moldado de concreto para edifícios, galpões e infraestrutura urbana. Base no Grande ABC paulista com atuação nacional.",
    segmento: "Pré-Moldados de Concreto", tier: "A",
  },

  // ── TIER B — Regionais de médio porte ───────────────────────────────────────

  {
    titulo: "Sulmold Pré-Fabricados",
    cidade: "Joinville", estado: "SC",
    resumo: "Fabricante de pré-moldados de concreto no nordeste catarinense. Produz vigas, pilares e lajes para galpões industriais, portos e infraestrutura local.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Cassol Pré-Fabricados",
    cidade: "Caxias do Sul", estado: "RS",
    resumo: "Fabricante gaúcho de estruturas pré-moldadas de concreto para indústria e logística. Produz vigas, pilares e painéis com entrega em todo o Sul do Brasil.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Premold Estruturas",
    cidade: "Duque de Caxias", estado: "RJ",
    resumo: "Fabricante fluminense de pré-moldados de concreto para obras industriais, portuárias e de infraestrutura no Rio de Janeiro e Região Sudeste.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "RPC Pré-Fabricados",
    cidade: "Ribeirão Preto", estado: "SP",
    resumo: "Fabricante de pré-moldados de concreto no interior paulista. Especialidade em galpões para agronegócio, frigoríficos e usinas sucroenergéticas.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Pauluz Pré-Fabricados",
    cidade: "Lins", estado: "SP",
    resumo: "Fabricante de pré-moldados de concreto no interior de SP. Produz vigas, pilares, lajes alveolares e painéis para galpões e obras rurais.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Conpremold",
    cidade: "Campinas", estado: "SP",
    resumo: "Fabricante de estruturas pré-moldadas de concreto na Região Metropolitana de Campinas. Atende centros logísticos, indústrias e infraestrutura municipal.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Agile Pré-Moldados",
    cidade: "São José dos Campos", estado: "SP",
    resumo: "Fabricante no Vale do Paraíba paulista. Produz estruturas pré-moldadas para galpões industriais, hangares e data centers. Atende o corredor SP–RJ.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Francom Concreto",
    cidade: "Salvador", estado: "BA",
    resumo: "Fabricante baiano de pré-moldados de concreto. Fornece vigas, pilares e painéis para obras no Nordeste, incluindo portuárias, industriais e habitação.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Premix Nordeste",
    cidade: "Camaçari", estado: "BA",
    resumo: "Fabricante de pré-moldados e pré-moldados protendidos para o polo industrial de Camaçari e obras de grande porte no Nordeste.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Nordeste Pré-Fabricados",
    cidade: "Fortaleza", estado: "CE",
    resumo: "Fabricante cearense de pré-moldados de concreto. Produz estruturas para galpões, silos, usinas de energia renovável e obras de infraestrutura no CE, RN e PI.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Premold Pernambuco",
    cidade: "Recife", estado: "PE",
    resumo: "Fabricante de pré-moldados no Nordeste. Atende obras do Porto de Suape, pólos industriais, construtoras locais e obras públicas de infraestrutura em PE e AL.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Prefabrica Centro-Oeste",
    cidade: "Goiânia", estado: "GO",
    resumo: "Fabricante goiano de pré-moldados de concreto. Especialidade em silos, galpões para agronegócio, frigoríficos e centros de distribuição no Centro-Oeste.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Mato Grosso Pré-Fabricados",
    cidade: "Cuiabá", estado: "MT",
    resumo: "Fabricante de pré-moldados de concreto no MT. Atende obras do agronegócio (silos, armazéns, frigoríficos), indústrias e obras rodoviárias no estado.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Central Pré-Moldados Minas",
    cidade: "Betim", estado: "MG",
    resumo: "Fabricante mineiro de estruturas pré-moldadas de concreto. Produz vigas, pilares e painéis para galpões industriais, centros de distribuição e obras de mineração em MG.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Pré-Moldados Triângulo",
    cidade: "Uberlândia", estado: "MG",
    resumo: "Fabricante de pré-moldados no Triângulo Mineiro. Atende agroindústrias, frigoríficos, usinas de açúcar e etanol e obras de infraestrutura na região.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },
  {
    titulo: "Espírito Santo Pré-Fabricados",
    cidade: "Vitória", estado: "ES",
    resumo: "Fabricante capixaba de pré-moldados de concreto. Atende obras portuárias de Vitória, obras de mineração da Vale e galpões industriais no ES.",
    segmento: "Pré-Moldados de Concreto", tier: "B",
  },

  // ── TIER C — Regionais menores / validar ────────────────────────────────────

  {
    titulo: "Pré-Moldados Sudoeste",
    cidade: "Cascavel", estado: "PR",
    resumo: "Fabricante no sudoeste paranaense. Produz pré-moldados para silos de grãos, frigoríficos e galpões rurais no oeste do PR e leste do MS.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
  {
    titulo: "Amazônia Pré-Fabricados",
    cidade: "Manaus", estado: "AM",
    resumo: "Fabricante de pré-moldados na Zona Franca de Manaus. Atende obras industriais, galpões da ZFM e infraestrutura urbana no AM.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
  {
    titulo: "Pará Pré-Moldados",
    cidade: "Belém", estado: "PA",
    resumo: "Fabricante paraense de estruturas pré-moldadas de concreto. Atende obras de mineração, portuárias e de infraestrutura no PA e estados vizinhos.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
  {
    titulo: "Maranhão Pré-Fabricados",
    cidade: "São Luís", estado: "MA",
    resumo: "Fabricante de pré-moldados no MA. Atende obras portuárias do Itaqui, siderurgia, agroindústria e infraestrutura pública no estado.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
  {
    titulo: "Pré-Moldados Mato Grosso do Sul",
    cidade: "Campo Grande", estado: "MS",
    resumo: "Fabricante de pré-moldados de concreto no MS. Especialidade em silos, galpões do agronegócio e frigoríficos. Atende todo o Centro-Oeste.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
  {
    titulo: "Nordviga Pré-Fabricados",
    cidade: "Natal", estado: "RN",
    resumo: "Fabricante de vigas e pilares pré-moldados de concreto no RN. Atende obras de habitação, infraestrutura e energia eólica no Nordeste.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
  {
    titulo: "Tocantins Pré-Fabricados",
    cidade: "Palmas", estado: "TO",
    resumo: "Fabricante de pré-moldados em Palmas/TO. Atende obras de infraestrutura pública, galpões para agronegócio e construção civil na capital e interior do TO.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
  {
    titulo: "Pré-Moldados Rondônia",
    cidade: "Porto Velho", estado: "RO",
    resumo: "Fabricante de pré-moldados de concreto no RO. Atende obras de energia (hidrelétricas do rio Madeira), agronegócio e infraestrutura urbana.",
    segmento: "Pré-Moldados de Concreto", tier: "C",
  },
];

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log("SEED — PRÉ-MOLDADOS BRASIL");
  console.log(`Modo: ${COMMIT ? "🔴 PRODUÇÃO (--commit)" : "🟡 DRY-RUN (sem --commit)"}`);
  console.log(`Total de empresas: ${PRE_MOLDADOS.length}`);
  console.log(`${"═".repeat(60)}\n`);

  const tierA = PRE_MOLDADOS.filter(c => c.tier === "A").length;
  const tierB = PRE_MOLDADOS.filter(c => c.tier === "B").length;
  const tierC = PRE_MOLDADOS.filter(c => c.tier === "C").length;
  console.log(`Tier A (nacionais/líderes): ${tierA}`);
  console.log(`Tier B (regionais grandes): ${tierB}`);
  console.log(`Tier C (regionais/validar): ${tierC}\n`);

  if (!COMMIT) {
    console.log("── LISTA COMPLETA (dry-run) ──\n");
    for (const c of PRE_MOLDADOS) {
      console.log(`  [TIER ${c.tier}] ${c.titulo} — ${c.cidade}/${c.estado}`);
    }
    console.log(`\n💡 Para gravar: npx tsx scripts/seed-pre-moldados-brasil.ts --commit\n`);
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let criados = 0;
  let carteirasAdicionadas = 0;
  let jaExistiam = 0;

  try {
    for (const c of PRE_MOLDADOS) {
      const tituloNorm = c.titulo.trim();

      const existe = await client.query(
        `SELECT id FROM "DossieComercial" WHERE titulo = $1 LIMIT 1`,
        [tituloNorm],
      );

      if (existe.rows.length > 0) {
        const dossieId = existe.rows[0].id as string;
        console.log(`  ⏭  Já existe: ${tituloNorm}`);
        jaExistiam++;
        await client.query(
          `INSERT INTO "DossieCarteira" (id, "dossieId", carteira, status, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, 'PRE_MOLDADOS', 'MONITORANDO', NOW(), NOW())
           ON CONFLICT ("dossieId", carteira) DO NOTHING`,
          [dossieId],
        );
        continue;
      }

      const ins = await client.query(
        `INSERT INTO "DossieComercial" (
           id, titulo, resumo, status, origem, tipo, segmento,
           cidade, estado, completude, score,
           "missaoAtual", "ultimaAtividade", "createdAt", "updatedAt"
         )
         VALUES (
           gen_random_uuid(), $1, $2, 'INVESTIGANDO', 'JOAO_RADAR', 'EMPRESA', $3,
           $4, $5, 0, 0,
           $6,
           NOW() - INTERVAL '30 days',
           NOW(), NOW()
         )
         RETURNING id`,
        [
          tituloNorm,
          c.resumo,
          c.segmento,
          c.cidade,
          c.estado,
          `Identificar o decisor que autoriza compra de equipamentos de produção (bombas estacionárias, betoneiras). Buscar proprietário, diretor industrial ou gerente de produção via LinkedIn, telefone e WhatsApp.`,
        ],
      );

      const dossieId = ins.rows[0].id as string;

      await client.query(
        `INSERT INTO "DossieCarteira" (id, "dossieId", carteira, status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'PRE_MOLDADOS', 'MONITORANDO', NOW(), NOW())
         ON CONFLICT ("dossieId", carteira) DO NOTHING`,
        [dossieId],
      );

      console.log(`  + [TIER ${c.tier}] ${tituloNorm} — ${c.cidade}/${c.estado}`);
      criados++;
      carteirasAdicionadas++;
    }
  } finally {
    await client.end();
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log("RESUMO:");
  console.log(`  Dossiês criados          : ${criados}`);
  console.log(`  Carteiras adicionadas    : ${carteirasAdicionadas}`);
  console.log(`  Já existiam (sem mudança): ${jaExistiam}`);
  console.log(`\n✅ Gravado em produção.`);
  console.log(`   João começa a investigar decisores dos fabricantes de pré-moldados na próxima terça.\n`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
