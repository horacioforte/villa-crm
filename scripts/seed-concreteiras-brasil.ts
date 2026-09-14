// ARQUIVO: scripts/seed-concreteiras-brasil.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Seed das principais concreteiras do Brasil para a carteira CONCRETEIRAS.
// Objetivo: mapear decisores e oferecer locação + venda de usados via campanha.
//
// Uso:
//   npx tsx scripts/seed-concreteiras-brasil.ts          → dry-run (só mostra o que faria)
//   npx tsx scripts/seed-concreteiras-brasil.ts --commit  → grava em produção

import "./env";
import { Client } from "pg";

const COMMIT = process.argv.includes("--commit");

// ─── Lista de concreteiras ────────────────────────────────────────────────────

interface Concreteira {
  titulo: string;
  cidade: string;
  estado: string;
  resumo: string;
  segmento: string;
  tier: "A" | "B" | "C";
}

const CONCRETEIRAS: Concreteira[] = [
  // ── TIER A — Grupos nacionais / líderes regionais ───────────────────────────

  // SUDESTE — SP
  {
    titulo: "Engemix Concreto Usinado",
    cidade: "São Paulo", estado: "SP",
    resumo: "Maior concreteira do Brasil, divisão de concreto da Votorantim Cimentos. 44 unidades em 9 estados. Lider absoluto em SP.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Mix Beton Concreteira",
    cidade: "São Paulo", estado: "SP",
    resumo: "Uma das maiores concreteiras de SP. Forte na Grande São Paulo e interior. Frota própria de caminhões betoneira.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrevip Concreto Usinado",
    cidade: "São Paulo", estado: "SP",
    resumo: "Grande concreteira paulista com múltiplas unidades. Atende obras de grande porte na região metropolitana de SP.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Campmix Concreto Usinado",
    cidade: "Campinas", estado: "SP",
    resumo: "Concreteira de grande porte com foco no interior de SP. Campinas e região.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concreplan Concreteira Planalto",
    cidade: "Brasília", estado: "DF",
    resumo: "Líder em concreto usinado no Distrito Federal. Atende grandes obras do governo e privadas no DF e entorno.",
    segmento: "Concreteira", tier: "A",
  },

  // SUDESTE — MG
  {
    titulo: "Supermix Concreto",
    cidade: "Belo Horizonte", estado: "MG",
    resumo: "Grupo Brennand/Nassau. Uma das maiores concreteiras do Brasil com presença forte no Nordeste e Sudeste. Múltiplas unidades em MG.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrejau Concreto Usinado",
    cidade: "Juiz de Fora", estado: "MG",
    resumo: "Concreteira de referência na Zona da Mata e sul de MG. Grande frota e múltiplas plantas.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "BetaMix Concreto",
    cidade: "Belo Horizonte", estado: "MG",
    resumo: "Concreteira atuante em BH e região metropolitana. Atende obras residenciais, comerciais e industriais.",
    segmento: "Concreteira", tier: "B",
  },

  // SUDESTE — RJ
  {
    titulo: "Concrenavi Concreto Usinado",
    cidade: "Rio de Janeiro", estado: "RJ",
    resumo: "Grande concreteira do Rio de Janeiro. Atende obras de infraestrutura, portos e construção civil no RJ.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrebase Rio",
    cidade: "Rio de Janeiro", estado: "RJ",
    resumo: "Concreteira atuante na Baixada Fluminense e região metropolitana do Rio de Janeiro.",
    segmento: "Concreteira", tier: "B",
  },

  // SUDESTE — ES
  {
    titulo: "Concrex Espírito Santo",
    cidade: "Vitória", estado: "ES",
    resumo: "Concreteira de referência no ES. Atende obras portuárias, industriais e residenciais em Vitória e Grande Vitória.",
    segmento: "Concreteira", tier: "B",
  },

  // ── SUL ─────────────────────────────────────────────────────────────────────

  // RS
  {
    titulo: "Concresul Concreto Usinado",
    cidade: "Porto Alegre", estado: "RS",
    resumo: "Uma das maiores concreteiras do Sul do Brasil. Múltiplas unidades no RS. Atende obras de infraestrutura e construção civil.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Itabira Concreto",
    cidade: "Caxias do Sul", estado: "RS",
    resumo: "Concreteira com forte atuação na Serra Gaúcha e nordeste do RS. Atende grandes obras industriais e de infraestrutura.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concregesso RS",
    cidade: "Pelotas", estado: "RS",
    resumo: "Concreteira regional no sul do RS. Atende obras residenciais e comerciais na região de Pelotas e Rio Grande.",
    segmento: "Concreteira", tier: "C",
  },
  {
    titulo: "BRC Concreto Usinado",
    cidade: "Santa Maria", estado: "RS",
    resumo: "Concreteira regional com atuação no centro do RS. Grande volume de obras residenciais e comerciais.",
    segmento: "Concreteira", tier: "B",
  },

  // SC
  {
    titulo: "Premix Concreto Santa Catarina",
    cidade: "Florianópolis", estado: "SC",
    resumo: "Concreteira com múltiplas unidades em SC. Forte na Grande Florianópolis, Joinville e Blumenau.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concretex Sul",
    cidade: "Joinville", estado: "SC",
    resumo: "Concreteira de grande porte no norte de SC. Atende obras industriais e residenciais em Joinville e região.",
    segmento: "Concreteira", tier: "B",
  },
  {
    titulo: "Concreleste Concreto",
    cidade: "Blumenau", estado: "SC",
    resumo: "Concreteira regional no Vale do Itajaí/SC. Atende obras em Blumenau, Brusque e Itajaí.",
    segmento: "Concreteira", tier: "C",
  },

  // PR
  {
    titulo: "Betonobras Concreto Paraná",
    cidade: "Curitiba", estado: "PR",
    resumo: "Concreteira com ampla atuação em Curitiba e RMC. Atende obras de grande porte no PR.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrejusto Paraná",
    cidade: "Londrina", estado: "PR",
    resumo: "Concreteira de referência no norte do PR. Atende obras em Londrina, Maringá e região.",
    segmento: "Concreteira", tier: "B",
  },
  {
    titulo: "Concrex Cascavel",
    cidade: "Cascavel", estado: "PR",
    resumo: "Concreteira regional no oeste do PR. Forte em obras agroindustriais e de infraestrutura.",
    segmento: "Concreteira", tier: "C",
  },

  // ── NORDESTE ─────────────────────────────────────────────────────────────────

  // PE
  {
    titulo: "Concrenorte Pernambuco",
    cidade: "Recife", estado: "PE",
    resumo: "Concreteira de grande porte em PE. Atende obras do Porto de Suape, construção civil e infraestrutura no Grande Recife.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Nassaucret Concreto",
    cidade: "Recife", estado: "PE",
    resumo: "Concreteira do Grupo Nassau/Brennand com forte atuação em PE e Nordeste.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Bestcret Concreto Usinado",
    cidade: "Caruaru", estado: "PE",
    resumo: "Concreteira regional com atuação no agreste pernambucano. Obras residenciais e comerciais.",
    segmento: "Concreteira", tier: "C",
  },
  {
    titulo: "Concrefoz Pernambuco",
    cidade: "Petrolina", estado: "PE",
    resumo: "Concreteira no São Francisco pernambucano. Atende obras de irrigação, agroindustrial e construção civil.",
    segmento: "Concreteira", tier: "C",
  },

  // CE
  {
    titulo: "Concretal Cearense",
    cidade: "Fortaleza", estado: "CE",
    resumo: "Grande concreteira cearense. Atende obras no Porto do Pecém, construção civil e infraestrutura em Fortaleza e RMF.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Supermix Fortaleza",
    cidade: "Fortaleza", estado: "CE",
    resumo: "Unidade Supermix (Grupo Nassau) em Fortaleza. Forte em obras de grande porte no CE.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concremix Nordeste",
    cidade: "Sobral", estado: "CE",
    resumo: "Concreteira regional com atuação no norte do CE. Obras industriais e residenciais em Sobral e região.",
    segmento: "Concreteira", tier: "C",
  },

  // BA
  {
    titulo: "Concrebase Salvador",
    cidade: "Salvador", estado: "BA",
    resumo: "Grande concreteira baiana. Atende obras no porto de Salvador, construção civil e grandes empreendimentos na capital.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrenorte Bahia",
    cidade: "Feira de Santana", estado: "BA",
    resumo: "Concreteira regional com forte atuação no interior da Bahia. Obras agroindustriais e de infraestrutura.",
    segmento: "Concreteira", tier: "B",
  },
  {
    titulo: "Concretec Camaçari",
    cidade: "Camaçari", estado: "BA",
    resumo: "Concreteira próxima ao polo petroquímico de Camaçari. Atende obras industriais e de manutenção no polo.",
    segmento: "Concreteira", tier: "B",
  },

  // MA
  {
    titulo: "Concretec Maranhão",
    cidade: "São Luís", estado: "MA",
    resumo: "Concreteira de referência no MA. Atende obras do Porto do Itaqui, construção civil e infraestrutura em São Luís.",
    segmento: "Concreteira", tier: "B",
  },

  // PB
  {
    titulo: "Concrebase João Pessoa",
    cidade: "João Pessoa", estado: "PB",
    resumo: "Concreteira com atuação em João Pessoa e Campina Grande. Obras residenciais, comerciais e de infraestrutura na PB.",
    segmento: "Concreteira", tier: "C",
  },

  // RN
  {
    titulo: "Concrenorte Rio Grande do Norte",
    cidade: "Natal", estado: "RN",
    resumo: "Concreteira de referência no RN. Atende obras de energia eólica, construção civil e infraestrutura em Natal e interior.",
    segmento: "Concreteira", tier: "B",
  },

  // AL
  {
    titulo: "Concrebase Maceió",
    cidade: "Maceió", estado: "AL",
    resumo: "Concreteira com atuação em Maceió e interior de AL. Obras residenciais e comerciais.",
    segmento: "Concreteira", tier: "C",
  },

  // ── CENTRO-OESTE ─────────────────────────────────────────────────────────────

  // GO
  {
    titulo: "Concrebase Goiânia",
    cidade: "Goiânia", estado: "GO",
    resumo: "Grande concreteira goiana. Atende obras residenciais, comerciais e de infraestrutura em Goiânia e RMG.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrex Goiás",
    cidade: "Anápolis", estado: "GO",
    resumo: "Concreteira com atuação em Anápolis e interior de GO. Obras agroindustriais e de infraestrutura.",
    segmento: "Concreteira", tier: "B",
  },
  {
    titulo: "Concrejusto Goiás",
    cidade: "Rio Verde", estado: "GO",
    resumo: "Concreteira regional no sudoeste de GO. Forte em obras do agronegócio e frigoríficos.",
    segmento: "Concreteira", tier: "C",
  },

  // MT
  {
    titulo: "Concremix Mato Grosso",
    cidade: "Cuiabá", estado: "MT",
    resumo: "Concreteira de referência em MT. Atende obras do agronegócio, frigoríficos e construção civil em Cuiabá e VG.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "BRC Concreto Mato Grosso",
    cidade: "Rondonópolis", estado: "MT",
    resumo: "Concreteira regional no sul de MT. Obras agroindustriais e de infraestrutura em Rondonópolis.",
    segmento: "Concreteira", tier: "B",
  },

  // MS
  {
    titulo: "Concrebase Campo Grande",
    cidade: "Campo Grande", estado: "MS",
    resumo: "Grande concreteira sul-mato-grossense. Atende obras residenciais, industriais e de infraestrutura em Campo Grande.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrejusto Dourados",
    cidade: "Dourados", estado: "MS",
    resumo: "Concreteira regional no sul de MS. Forte em obras do agronegócio e construção civil em Dourados.",
    segmento: "Concreteira", tier: "C",
  },

  // ── NORTE ────────────────────────────────────────────────────────────────────

  // PA
  {
    titulo: "Concrenorte Pará",
    cidade: "Belém", estado: "PA",
    resumo: "Concreteira de referência no PA. Atende obras do Porto de Belém, mineração e construção civil na capital paraense.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concrebase Marabá",
    cidade: "Marabá", estado: "PA",
    resumo: "Concreteira no sudeste do PA. Atende obras de mineração (Vale, siderurgia) e infraestrutura na região de Carajás.",
    segmento: "Concreteira", tier: "B",
  },
  {
    titulo: "Concremix Santarém",
    cidade: "Santarém", estado: "PA",
    resumo: "Concreteira regional no oeste do PA. Obras portuárias, agronegócio e infraestrutura em Santarém.",
    segmento: "Concreteira", tier: "C",
  },

  // AM
  {
    titulo: "Amazonas Concreto Usinado",
    cidade: "Manaus", estado: "AM",
    resumo: "Principal concreteira de Manaus e Zona Franca. Atende obras do polo industrial, construção civil e infraestrutura.",
    segmento: "Concreteira", tier: "A",
  },
  {
    titulo: "Concremix Manaus",
    cidade: "Manaus", estado: "AM",
    resumo: "Concreteira com atuação na região metropolitana de Manaus. Obras industriais e residenciais.",
    segmento: "Concreteira", tier: "B",
  },

  // TO
  {
    titulo: "Concrebase Palmas",
    cidade: "Palmas", estado: "TO",
    resumo: "Concreteira em Palmas/TO. Atende obras de infraestrutura, energia e construção civil na capital tocantinense.",
    segmento: "Concreteira", tier: "C",
  },

  // RO
  {
    titulo: "Concrenorte Rondônia",
    cidade: "Porto Velho", estado: "RO",
    resumo: "Concreteira em Porto Velho/RO. Atende obras de energia (hidrelétricas), agronegócio e construção civil.",
    segmento: "Concreteira", tier: "C",
  },
];

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log("SEED — CONCRETEIRAS BRASIL");
  console.log(`Modo: ${COMMIT ? "🔴 PRODUÇÃO (--commit)" : "🟡 DRY-RUN (sem --commit)"}`);
  console.log(`Total de empresas: ${CONCRETEIRAS.length}`);
  console.log(`${"═".repeat(60)}\n`);

  const tierA = CONCRETEIRAS.filter(c => c.tier === "A").length;
  const tierB = CONCRETEIRAS.filter(c => c.tier === "B").length;
  const tierC = CONCRETEIRAS.filter(c => c.tier === "C").length;
  console.log(`Tier A (nacionais/líderes): ${tierA}`);
  console.log(`Tier B (regionais grandes): ${tierB}`);
  console.log(`Tier C (regionais/validar): ${tierC}\n`);

  if (!COMMIT) {
    console.log("── LISTA COMPLETA (dry-run) ──\n");
    for (const c of CONCRETEIRAS) {
      console.log(`  [TIER ${c.tier}] ${c.titulo} — ${c.cidade}/${c.estado}`);
    }
    console.log(`\n💡 Para gravar em produção: npx tsx scripts/seed-concreteiras-brasil.ts --commit\n`);
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let criados = 0;
  let carteirasAdicionadas = 0;
  let jaExistiam = 0;

  try {
    for (const c of CONCRETEIRAS) {
      const tituloNorm = c.titulo.trim();

      // Verifica se já existe
      const existe = await client.query(
        `SELECT id FROM "DossieComercial" WHERE titulo = $1 LIMIT 1`,
        [tituloNorm],
      );

      if (existe.rows.length > 0) {
        const dossieId = existe.rows[0].id as string;
        console.log(`  ⏭  Já existe: ${tituloNorm}`);
        jaExistiam++;

        // Garante que a carteira CONCRETEIRAS existe
        await client.query(
          `INSERT INTO "DossieCarteira" (id, "dossieId", carteira, status, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, 'CONCRETEIRAS', 'MONITORANDO', NOW(), NOW())
           ON CONFLICT ("dossieId", carteira) DO NOTHING`,
          [dossieId],
        );
        continue;
      }

      // Cria o DossieComercial
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
          `Identificar o decisor que autoriza compra ou locação de equipamentos. Buscar telefone, WhatsApp, email e LinkedIn do responsável por compras/operações.`,
        ],
      );

      const dossieId = ins.rows[0].id as string;

      // Cria a DossieCarteira
      await client.query(
        `INSERT INTO "DossieCarteira" (id, "dossieId", carteira, status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'CONCRETEIRAS', 'MONITORANDO', NOW(), NOW())
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
  console.log(`   João começa a investigar decisores das concreteiras na próxima terça-feira.\n`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
