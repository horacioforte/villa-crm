// ARQUIVO: scripts/base-nacional/testar-branch.ts
// REGRA: nunca remover. Apenas acrescentar.
// Testes de integração da Base Nacional de Concreteiras — SOMENTE no branch isolado.
// Tudo roda dentro de UMA transação que termina em ROLLBACK: nada fica gravado.
//
// Uso: npx tsx scripts/base-nacional/testar-branch.ts

import { Client } from "pg";
import { carregarAmbienteDeTeste } from "../../lib/base-nacional/ambiente";

type Resultado = { teste: string; ok: boolean; detalhe: string };
const resultados: Resultado[] = [];
const registrar = (teste: string, ok: boolean, detalhe = "") => resultados.push({ teste, ok, detalhe });

async function falhaEsperada(c: Client, sql: string, params: unknown[] = []): Promise<string | null> {
  await c.query("SAVEPOINT sp");
  try {
    await c.query(sql, params);
    await c.query("RELEASE SAVEPOINT sp");
    return null;
  } catch (e) {
    await c.query("ROLLBACK TO SAVEPOINT sp");
    return e instanceof Error ? e.message.split("\n")[0] : "erro";
  }
}

const n = async (c: Client, sql: string, params: unknown[] = []) => Number((await c.query(sql, params)).rows[0].n);

async function main() {
  const amb = carregarAmbienteDeTeste();
  console.log(`[testar-branch] endpoint ${amb.endpointMascarado} — transação com ROLLBACK ao final`);
  const c = new Client({ connectionString: amb.url });
  await c.connect();
  await c.query("BEGIN");
  try {
    const antes = {
      empresas: await n(c, `SELECT count(*) n FROM "Empresa"`),
      empresasAtivas: await n(c, `SELECT count(*) n FROM "Empresa" WHERE ativa = true`),
      dossies: await n(c, `SELECT count(*) n FROM "DossieComercial"`),
      dossiesInvestigando: await n(c, `SELECT count(*) n FROM "DossieComercial" WHERE status IN ('INVESTIGANDO','PEDIR_MAIS_PESQUISA')`),
      carteiras: await n(c, `SELECT count(*) n FROM "DossieCarteira"`),
      prospects: await n(c, `SELECT count(*) n FROM "Prospect"`),
      oportunidades: await n(c, `SELECT count(*) n FROM "Oportunidade"`),
      empresaHash: (await c.query(`SELECT md5(string_agg(t::text, '|' ORDER BY id)) h FROM "Empresa" t`)).rows[0].h as string,
    };

    // Segmentos de teste (dentro da transação)
    await c.query(`INSERT INTO "SegmentoEmpresa"(id,nome,slug,"updatedAt") VALUES ('t-seg-1','T Concreteira','t-concreteira',now()),('t-seg-2','T Pre-Moldado','t-pre-moldado',now())`);
    const empresaId = (await c.query(`SELECT id FROM "Empresa" ORDER BY "criadoEm" LIMIT 1`)).rows[0].id as string;

    // 1. Múltiplos segmentos por Empresa
    await c.query(`INSERT INTO "EmpresaSegmento"(id,"empresaId","segmentoId") VALUES ('t-es-1',$1,'t-seg-1'),('t-es-2',$1,'t-seg-2')`, [empresaId]);
    registrar("Empresa com vários segmentos", (await n(c, `SELECT count(*) n FROM "EmpresaSegmento" WHERE "empresaId"=$1`, [empresaId])) === 2);

    // 2. Segmento duplicado bloqueado
    const dup = await falhaEsperada(c, `INSERT INTO "EmpresaSegmento"(id,"empresaId","segmentoId") VALUES ('t-es-3',$1,'t-seg-1')`, [empresaId]);
    registrar("Segmento duplicado na mesma Empresa é bloqueado", dup !== null, dup ?? "inseriu (falha)");

    // 3. Desativar segmento não apaga vínculos
    await c.query(`UPDATE "SegmentoEmpresa" SET ativo=false WHERE id='t-seg-2'`);
    registrar("Segmento desativado mantém vínculos", (await n(c, `SELECT count(*) n FROM "EmpresaSegmento" WHERE "segmentoId"='t-seg-2'`)) === 1);

    // 4. Competências e snapshots
    await c.query(`INSERT INTO "ReceitaCompetencia"(id,competencia,"cnaesFiltro","ufsFiltro","updatedAt") VALUES ('t-c-08','2026-08','{2330305}','{}',now()),('t-c-09','2026-09','{2330305}','{}',now())`);
    const ins = `INSERT INTO "ReceitaEstabelecimento"(id,"competenciaId",cnpj,"cnpjBasico","cnpjOrdem","cnpjDv","isMatriz","razaoSocial","situacaoCadastral","cnaePrincipal","cnaesSecundarios","cnaeAlvoComoPrincipal",uf,"hashRegistro")
                 VALUES ($1,$2,'12345678000195','12345678','0001','95',true,$3,'02','2330305','{}',true,'PE',$4)`;
    await c.query(ins, ["t-e-1", "t-c-08", "CONCRETO TESTE AGO", "h1"]);
    await c.query(ins, ["t-e-2", "t-c-09", "CONCRETO TESTE SET", "h2"]);
    registrar("Mesmo CNPJ em competências diferentes é permitido", true);
    const dupComp = await falhaEsperada(c, ins, ["t-e-3", "t-c-09", "DUPLICADO", "h3"]);
    registrar("CNPJ único dentro da mesma competência", dupComp !== null, dupComp ?? "inseriu (falha)");
    const snaps = (await c.query(`SELECT "razaoSocial" r FROM "ReceitaEstabelecimento" WHERE cnpj='12345678000195' ORDER BY "competenciaId"`)).rows.map(r => r.r);
    registrar("Snapshots mensais preservados lado a lado", snaps.join("|") === "CONCRETO TESTE AGO|CONCRETO TESTE SET", snaps.join(" | "));

    // 5. CHECKs
    const cnpjRuim = await falhaEsperada(c, ins.replace("'12345678000195'", "'12.345.678/0001-95'"), ["t-e-4", "t-c-08", "X", "h"]);
    registrar("CNPJ fora do padrão de 14 dígitos é recusado", cnpjRuim !== null, cnpjRuim ?? "");
    const compRuim = await falhaEsperada(c, `INSERT INTO "ReceitaCompetencia"(id,competencia,"updatedAt") VALUES ('t-c-x','2026-13',now())`);
    registrar("Competência fora de AAAA-MM é recusada", compRuim !== null, compRuim ?? "");
    const evSemAlvo = await falhaEsperada(c, `INSERT INTO "ConcreteiraEvidencia"(id,"tipoFonte") VALUES ('t-ev-x','OUTRA')`);
    registrar("Evidência sem candidata/empresa é recusada", evSemAlvo !== null, evSemAlvo ?? "");

    // 6. Candidata com vínculo opcional
    await c.query(`INSERT INTO "ConcreteiraCandidata"(id,"cnpjBasico","cnpjMatriz","updatedAt") VALUES ('t-cand-1','12345678','12345678000195',now()),('t-cand-2','87654321',NULL,now())`);
    await c.query(`UPDATE "ConcreteiraCandidata" SET "empresaId"=$1 WHERE id='t-cand-1'`, [empresaId]);
    registrar("Candidata pode ficar sem Empresa", (await n(c, `SELECT count(*) n FROM "ConcreteiraCandidata" WHERE id='t-cand-2' AND "empresaId" IS NULL`)) === 1);
    registrar("Candidata pode ser vinculada a Empresa existente", (await n(c, `SELECT count(*) n FROM "ConcreteiraCandidata" WHERE id='t-cand-1' AND "empresaId"=$1`, [empresaId])) === 1);
    const raizDup = await falhaEsperada(c, `INSERT INTO "ConcreteiraCandidata"(id,"cnpjBasico","updatedAt") VALUES ('t-cand-3','12345678',now())`);
    registrar("Uma candidata por raiz de CNPJ (matriz+filiais juntas)", raizDup !== null, raizDup ?? "");

    // 6b. Proteção contra exclusão física (RESTRICT) — tentativas desfeitas por SAVEPOINT
    const fks = (await c.query(`SELECT conname, confdeltype FROM pg_constraint
        WHERE contype='f' AND conrelid::regclass::text IN ('"EmpresaSegmento"','"ConcreteiraCandidata"','"ConcreteiraCandidataUnidade"','"EmpresaUnidade"','"EmpresaValidacaoConcreteira"','"ConcreteiraEvidencia"','"ConcreteiraValidacaoHistorico"')
          AND confrelid::regclass::text IN ('"Empresa"','"ConcreteiraCandidata"','"ConcreteiraCandidataUnidade"')`)).rows as Array<{ conname: string; confdeltype: string }>;
    const naoRestrict = fks.filter(f => f.confdeltype !== "r" && f.conname !== "ConcreteiraCandidata_empresaSugeridaId_fkey");
    const sugestao = fks.find(f => f.conname === "ConcreteiraCandidata_empresaSugeridaId_fkey");
    registrar("FKs para Empresa e candidatas são RESTRICT (exceto sugestão = SET NULL)", fks.length === 11 && naoRestrict.length === 0 && sugestao?.confdeltype === "n",
      `${fks.length} FKs verificadas; fora do padrão: ${naoRestrict.map(f => f.conname).join(", ") || "nenhuma"}`);
    // Empresa temporária só para este teste — desfeita pelo ROLLBACK TO SAVEPOINT logo abaixo
    await c.query("SAVEPOINT sp_emp");
    await c.query(`INSERT INTO "Empresa"(id,"razaoSocial","atualizadoEm") VALUES ('t-emp-del','EMPRESA TEMPORARIA DE TESTE',now())`);
    await c.query(`INSERT INTO "EmpresaUnidade"(id,"empresaId","updatedAt") VALUES ('t-eu-1','t-emp-del',now())`);
    const delEmpresa = await falhaEsperada(c, `DELETE FROM "Empresa" WHERE id='t-emp-del'`);
    await c.query("ROLLBACK TO SAVEPOINT sp_emp");
    registrar("Exclusão física de Empresa com unidade da Base Nacional é bloqueada", (delEmpresa ?? "").includes("EmpresaUnidade_empresaId_fkey"), delEmpresa ?? "excluiu (falha)");
    await c.query(`INSERT INTO "ConcreteiraCandidataUnidade"(id,"candidataId",cnpj,"isMatriz","situacaoCadastral",ativa,"cnaePrincipal","cnaesSecundarios","cnaeAlvoComoPrincipal","updatedAt") VALUES ('t-cu-1','t-cand-2','87654321000100',true,'02',true,'2330305','{}',true,now())`);
    const delCand = await falhaEsperada(c, `DELETE FROM "ConcreteiraCandidata" WHERE id='t-cand-2'`);
    registrar("Exclusão física de candidata com unidades é bloqueada", delCand !== null, delCand ?? "excluiu (falha)");
    const delSeg = await falhaEsperada(c, `DELETE FROM "SegmentoEmpresa" WHERE id='t-seg-1'`);
    registrar("Exclusão de segmento em uso é bloqueada", delSeg !== null, delSeg ?? "excluiu (falha)");

    // 7. Volume: milhares de registros simulados
    const t0 = Date.now();
    await c.query(`INSERT INTO "ConcreteiraCandidata"(id,"cnpjBasico","razaoSocial","ufMatriz","statusValidacao","updatedAt")
      SELECT 'v-c-'||g, lpad((50000000+g)::text,8,'0'), 'CONCRETEIRA SIMULADA '||g,
             (ARRAY['PE','BA','SP','MG','PR','RS','GO','CE'])[1+(g%8)],
             (ARRAY['PENDENTE','EM_VERIFICACAO','CONFIRMADA','PROVAVEL','NAO_E_CONCRETEIRA','INATIVA','NAO_LOCALIZADA'])[1+(g%7)]::"StatusValidacaoConcreteira", now()
      FROM generate_series(1,5000) g`);
    await c.query(`INSERT INTO "ConcreteiraCandidataUnidade"(id,"candidataId",cnpj,"isMatriz","situacaoCadastral",ativa,"cnaePrincipal","cnaesSecundarios","cnaeAlvoComoPrincipal",uf,"municipioCodigoIbge","updatedAt")
      SELECT 'v-u-'||g||'-'||k, 'v-c-'||g, lpad((50000000+g)::text,8,'0')||lpad(k::text,4,'0')||'00', k=1, '02', true, '2330305','{}', true,
             (ARRAY['PE','BA','SP','MG','PR','RS','GO','CE'])[1+(g%8)], lpad((2600000+(g%180))::text,7,'0'), now()
      FROM generate_series(1,5000) g, generate_series(1,3) k`);
    await c.query(`INSERT INTO "ReceitaEstabelecimento"(id,"competenciaId",cnpj,"cnpjBasico","cnpjOrdem","cnpjDv","isMatriz","situacaoCadastral","cnaePrincipal","cnaesSecundarios","cnaeAlvoComoPrincipal",uf,"hashRegistro")
      SELECT 'v-e-'||m||'-'||g, m, lpad((50000000+g)::text,8,'0')||'000100', lpad((50000000+g)::text,8,'0'),'0001','00', true, '02','2330305','{}',true,
             (ARRAY['PE','BA','SP','MG','PR','RS','GO','CE'])[1+(g%8)], md5(g::text)
      FROM generate_series(1,20000) g, unnest(ARRAY['t-c-08','t-c-09']) m`);
    const tCarga = Date.now() - t0;
    const t1 = Date.now();
    const porUf = (await c.query(`SELECT "ufMatriz", "statusValidacao", count(*) FROM "ConcreteiraCandidata" GROUP BY 1,2`)).rowCount;
    const ficha = (await c.query(`SELECT cand.*, (SELECT json_agg(u) FROM "ConcreteiraCandidataUnidade" u WHERE u."candidataId"=cand.id) unidades FROM "ConcreteiraCandidata" cand WHERE "cnpjBasico"='50002500'`)).rowCount;
    const porCidade = (await c.query(`SELECT uf, "municipioCodigoIbge", count(DISTINCT "candidataId") FROM "ConcreteiraCandidataUnidade" GROUP BY 1,2`)).rowCount;
    const diff = await n(c, `SELECT count(*) n FROM "ReceitaEstabelecimento" a JOIN "ReceitaEstabelecimento" b ON a.cnpj=b.cnpj AND a."competenciaId"='t-c-09' AND b."competenciaId"='t-c-08' WHERE a."hashRegistro"<>b."hashRegistro"`);
    const tConsultas = Date.now() - t1;
    registrar("Volume simulado: 5.000 candidatas, 15.000 unidades, 40.000 registros da Receita", porUf! > 0 && ficha === 1 && porCidade! > 0,
      `carga ${tCarga} ms; relatórios por UF/status, cidade, ficha e comparação entre competências em ${tConsultas} ms (diferenças: ${diff})`);

    // 8. Isolamento e ausência de efeitos colaterais
    const depois = {
      empresas: await n(c, `SELECT count(*) n FROM "Empresa"`),
      empresasAtivas: await n(c, `SELECT count(*) n FROM "Empresa" WHERE ativa = true`),
      dossies: await n(c, `SELECT count(*) n FROM "DossieComercial"`),
      dossiesInvestigando: await n(c, `SELECT count(*) n FROM "DossieComercial" WHERE status IN ('INVESTIGANDO','PEDIR_MAIS_PESQUISA')`),
      carteiras: await n(c, `SELECT count(*) n FROM "DossieCarteira"`),
      prospects: await n(c, `SELECT count(*) n FROM "Prospect"`),
      oportunidades: await n(c, `SELECT count(*) n FROM "Oportunidade"`),
      empresaHash: (await c.query(`SELECT md5(string_agg(t::text, '|' ORDER BY id)) h FROM "Empresa" t`)).rows[0].h as string,
    };
    registrar("Lista normal de Empresas inalterada (mesma consulta de GET /api/empresas)", depois.empresasAtivas === antes.empresasAtivas && depois.empresas === antes.empresas, `${depois.empresasAtivas} ativas`);
    registrar("Nenhum cadastro de Empresa modificado (hash da tabela)", depois.empresaHash === antes.empresaHash);
    registrar("Nenhum Dossiê criado", depois.dossies === antes.dossies && depois.carteiras === antes.carteiras, `${depois.dossies} dossiês / ${depois.carteiras} carteiras`);
    registrar("Fila do João inalterada (dossiês em Investigando)", depois.dossiesInvestigando === antes.dossiesInvestigando, `${depois.dossiesInvestigando}`);
    registrar("Nenhum Prospect ou Oportunidade criado", depois.prospects === antes.prospects && depois.oportunidades === antes.oportunidades);
    const gatilhos = await n(c, `SELECT count(*) n FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal AND r.relname IN ('SegmentoEmpresa','EmpresaSegmento','ReceitaCompetencia','ReceitaEstabelecimento','ReceitaMudanca','ConcreteiraCandidata','ConcreteiraCandidataUnidade','EmpresaUnidade','EmpresaValidacaoConcreteira','ConcreteiraEvidencia','ConcreteiraValidacaoHistorico','RelatorioConcreteirasGerado')`);
    registrar("Nenhum gatilho (trigger) nas tabelas novas", gatilhos === 0);
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }

  let falhas = 0;
  for (const r of resultados) {
    if (!r.ok) falhas++;
    console.log(`${r.ok ? "PASSOU" : "FALHOU"} — ${r.teste}${r.detalhe ? ` (${r.detalhe})` : ""}`);
  }
  console.log(`\n${resultados.length - falhas}/${resultados.length} testes passaram. Transação desfeita (ROLLBACK).`);
  if (falhas > 0) process.exit(1);
}

main().catch(e => { console.error(e instanceof Error ? e.message : "erro"); process.exit(1); });
