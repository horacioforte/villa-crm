// ARQUIVO: scripts/seed-mcmv-brasil.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Seed das principais construtoras do programa Minha Casa Minha Vida do Brasil.
// Carteira: MCMV
// Objetivo: mapear decisor e oferecer locação de central de concreto, betoneira e
//           bomba de concreto, além de venda de equipamentos usados.
//
// Uso:
//   npx tsx scripts/seed-mcmv-brasil.ts          → dry-run
//   npx tsx scripts/seed-mcmv-brasil.ts --commit  → grava em produção

import "./env";
import { Client } from "pg";

const COMMIT = process.argv.includes("--commit");

interface ConstrutoraMCMV {
  titulo: string;
  cidade: string;
  estado: string;
  resumo: string;
  segmento: string;
  tier: "A" | "B" | "C";
}

const MCMV: ConstrutoraMCMV[] = [

  // ── TIER A — Grandes nacionais MCMV ─────────────────────────────────────────

  {
    titulo: "MRV Engenharia",
    cidade: "Belo Horizonte", estado: "MG",
    resumo: "Maior construtora e incorporadora do programa MCMV no Brasil. Opera em mais de 160 cidades em todos os estados. Produz dezenas de condomínios simultâneos. Consome massivamente bomba, betoneira e central de concreto.",
    segmento: "Construtora MCMV", tier: "A",
  },
  {
    titulo: "Tenda Construtora",
    cidade: "São Paulo", estado: "SP",
    resumo: "Segunda maior construtora MCMV do Brasil. Foco em habitação popular faixas 1 e 2. Presente em SP, RJ, MG, CE, PE, BA, GO, PR, RS e SC. Grandes canteiros com alto consumo de concreto.",
    segmento: "Construtora MCMV", tier: "A",
  },
  {
    titulo: "Direcional Engenharia",
    cidade: "Belo Horizonte", estado: "MG",
    resumo: "Grande construtora MCMV com forte atuação no Norte e Nordeste além do Sudeste. Condomínios de alto volume com demanda constante de concretagem e bombeamento.",
    segmento: "Construtora MCMV", tier: "A",
  },
  {
    titulo: "Cury Construtora",
    cidade: "São Paulo", estado: "SP",
    resumo: "Construtora focada em habitação popular no eixo SP–RJ. Opera centenas de unidades simultâneas no programa MCMV. Forte consumidora de centrais de concreto e bombas.",
    segmento: "Construtora MCMV", tier: "A",
  },
  {
    titulo: "Plano&Plano Construtora",
    cidade: "São Paulo", estado: "SP",
    resumo: "Incorporadora MCMV com foco em SP Capital e Grande SP. Condomínios de médio porte com ciclos de concretagem frequentes. Potencial cliente para locação de bomba e central.",
    segmento: "Construtora MCMV", tier: "A",
  },
  {
    titulo: "Riva Incorporadora",
    cidade: "São Paulo", estado: "SP",
    resumo: "Incorporadora MCMV do grupo Odebrecht (marca Riva). Atua em diversas cidades do Brasil em faixas 2 e 3 do MCMV. Alta demanda de concreto bombeado.",
    segmento: "Construtora MCMV", tier: "A",
  },
  {
    titulo: "Even Construtora",
    cidade: "São Paulo", estado: "SP",
    resumo: "Construtora e incorporadora com projetos MCMV faixas 2 e 3 em SP e RS. Canteiros simultâneos com demanda de bomba de concreto e betoneira.",
    segmento: "Construtora MCMV", tier: "A",
  },

  // ── TIER B — Regionais fortes MCMV ──────────────────────────────────────────

  {
    titulo: "OLM Construtora",
    cidade: "Salvador", estado: "BA",
    resumo: "Uma das maiores construtoras MCMV do Nordeste. Forte atuação na BA, SE e AL. Grandes empreendimentos com múltiplos blocos e alta demanda de concretagem.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "GEF Engenharia",
    cidade: "Fortaleza", estado: "CE",
    resumo: "Construtora MCMV cearense com empreendimentos em CE, RN, PB e PI. Condomínios de múltiplos blocos com uso intensivo de concreto e bomba lança.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Engemix Nordeste Construtora",
    cidade: "Recife", estado: "PE",
    resumo: "Construtora MCMV com foco no Nordeste (PE, AL, PB, RN). Opera condomínios de 200 a 500 unidades com concretagem frequente de fundações e lajes.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Nortenge Engenharia",
    cidade: "Belém", estado: "PA",
    resumo: "Construtora MCMV no Norte do Brasil. Atua em PA, AM e TO. Projetos de habitação popular com uso de bomba estacionária e betoneira nos canteiros.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Construtora São José MCMV",
    cidade: "Goiânia", estado: "GO",
    resumo: "Construtora goiana especializada em MCMV faixas 1 e 2. Empreendimentos em GO, DF e MT com alto volume de concreto bombeado.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Delta Construtora MCMV",
    cidade: "Curitiba", estado: "PR",
    resumo: "Construtora paranaense com carteira expressiva de obras MCMV no Sul. Condomínios em Curitiba, Londrina, Maringá e Cascavel com demanda constante de concretagem.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Ecovix Construções",
    cidade: "Porto Alegre", estado: "RS",
    resumo: "Construtora gaúcha com projetos MCMV em Porto Alegre e interior do RS. Ciclos intensivos de lajes e fundações com uso de bomba e betoneira.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Engesol Construtora",
    cidade: "Florianópolis", estado: "SC",
    resumo: "Construtora catarinense MCMV com empreendimentos em Florianópolis, Joinville e Blumenau. Demanda regular de concreto bombeado e locação de central.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Rodobens Negócios Imobiliários",
    cidade: "São José do Rio Preto", estado: "SP",
    resumo: "Construtora do interior paulista especializada em MCMV faixa 2 e 3. Atuação em cidades do interior de SP com condomínios de 100 a 300 unidades.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Helbor Empreendimentos",
    cidade: "Mogi das Cruzes", estado: "SP",
    resumo: "Incorporadora paulista com linha MCMV faixa 3. Projetos na Grande SP e interior com uso de concreto bombeado e central de concreto in loco.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Viver Incorporadora",
    cidade: "São Paulo", estado: "SP",
    resumo: "Incorporadora com projetos MCMV faixas 2 e 3 no estado de SP. Canteiros de médio porte com uso regular de bomba lança e betoneira.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Construtora Trisul",
    cidade: "São Paulo", estado: "SP",
    resumo: "Construtora SP com projetos residenciais incluindo MCMV faixa 3. Obra intensiva em laje com uso de bomba lança e concreto usinado.",
    segmento: "Construtora MCMV", tier: "B",
  },
  {
    titulo: "Tecnisa",
    cidade: "São Paulo", estado: "SP",
    resumo: "Incorporadora com linha habitacional incluindo MCMV faixa 3. Grandes condomínios verticais com alta demanda de concreto bombeado.",
    segmento: "Construtora MCMV", tier: "B",
  },

  // ── TIER C — Regionais menores / nichos MCMV ────────────────────────────────

  {
    titulo: "Construtora Iplan",
    cidade: "Manaus", estado: "AM",
    resumo: "Construtora MCMV no Amazonas. Empreendimentos em Manaus e municípios vizinhos com uso de concreto bombeado em fundações e lajes.",
    segmento: "Construtora MCMV", tier: "C",
  },
  {
    titulo: "Construtora Pilar",
    cidade: "Maceió", estado: "AL",
    resumo: "Construtora MCMV alagoana. Empreendimentos em Maceió e interior de AL. Demanda de bomba e betoneira em obras de pequeno e médio porte.",
    segmento: "Construtora MCMV", tier: "C",
  },
  {
    titulo: "Construtora Alencar MCMV",
    cidade: "Teresina", estado: "PI",
    resumo: "Construtora MCMV piauiense. Projetos habitacionais em Teresina e municípios com uso de concreto e bombeamento.",
    segmento: "Construtora MCMV", tier: "C",
  },
  {
    titulo: "Construtora Maranhense MCMV",
    cidade: "São Luís", estado: "MA",
    resumo: "Construtora MCMV no Maranhão. Empreendimentos em São Luís e interior do MA. Potencial para locação de central de concreto in loco.",
    segmento: "Construtora MCMV", tier: "C",
  },
  {
    titulo: "Construtora Palmas MCMV",
    cidade: "Palmas", estado: "TO",
    resumo: "Construtora MCMV no Tocantins. Projetos residenciais em Palmas e Araguaína. Uso de betoneira e bomba em fundações.",
    segmento: "Construtora MCMV", tier: "C",
  },
  {
    titulo: "Construtora Sergipe Habitar",
    cidade: "Aracaju", estado: "SE",
    resumo: "Construtora MCMV sergipana. Empreendimentos em Aracaju e entorno. Uso de concretagem com bomba estacionária.",
    segmento: "Construtora MCMV", tier: "C",
  },
  {
    titulo: "Construtora Acre Habitação",
    cidade: "Rio Branco", estado: "AC",
    resumo: "Construtora MCMV no Acre. Projetos habitacionais em Rio Branco. Potencial para locação de betoneira e bomba.",
    segmento: "Construtora MCMV", tier: "C",
  },
  {
    titulo: "Norte Construtora RR",
    cidade: "Boa Vista", estado: "RR",
    resumo: "Construtora MCMV em Roraima. Empreendimentos habitacionais em Boa Vista com uso de concreto e betoneiras.",
    segmento: "Construtora MCMV", tier: "C",
  },
];

// ─── Script principal ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log("SEED — MCMV BRASIL");
  console.log(`Modo: ${COMMIT ? "🔴 PRODUÇÃO (--commit)" : "🟡 DRY-RUN (sem --commit)"}`);
  console.log(`Total de empresas: ${MCMV.length}`);
  console.log(`${"═".repeat(60)}\n`);

  const tierA = MCMV.filter(c => c.tier === "A").length;
  const tierB = MCMV.filter(c => c.tier === "B").length;
  const tierC = MCMV.filter(c => c.tier === "C").length;
  console.log(`Tier A (nacionais MCMV):    ${tierA}`);
  console.log(`Tier B (regionais grandes): ${tierB}`);
  console.log(`Tier C (regionais menores): ${tierC}\n`);

  if (!COMMIT) {
    console.log("── LISTA COMPLETA (dry-run) ──\n");
    for (const c of MCMV) {
      console.log(`  [TIER ${c.tier}] ${c.titulo} — ${c.cidade}/${c.estado}`);
    }
    console.log(`\n💡 Para gravar: npx tsx scripts/seed-mcmv-brasil.ts --commit\n`);
    return;
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  let criados = 0;
  let carteirasAdicionadas = 0;
  let jaExistiam = 0;

  try {
    for (const c of MCMV) {
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
           VALUES (gen_random_uuid(), $1, 'MCMV', 'MONITORANDO', NOW(), NOW())
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
          `Identificar o decisor que contrata locação de equipamentos de concreto (central, bomba, betoneira) para as obras MCMV. Buscar Diretor de Obras, Gerente de Obras ou Comprador. LinkedIn + telefone + WhatsApp.`,
        ],
      );

      const dossieId = ins.rows[0].id as string;

      await client.query(
        `INSERT INTO "DossieCarteira" (id, "dossieId", carteira, status, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, 'MCMV', 'MONITORANDO', NOW(), NOW())
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
  console.log(`   João começa a investigar decisores das construtoras MCMV na próxima terça.\n`);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
