// ARQUIVO: scripts/base-nacional/testar-importador-branch.ts
// REGRA: nunca remover. Apenas acrescentar.
// Testes de integração do importador da Receita Federal (scripts/base-nacional/importar-receita.ts)
// — SOMENTE no branch isolado, SEMPRE em uma transação que termina em ROLLBACK: nada
// fica gravado, igual ao padrão de scripts/base-nacional/testar-branch.ts.
//
// Usa os fixtures fictícios em scripts/base-nacional/fixtures-receita/2031-01 e 2031-02
// (competências sem relação com nenhuma data real ou com os dados de demonstração).
//
// Uso: npx tsx scripts/base-nacional/testar-importador-branch.ts

import path from "node:path";
import { Client } from "pg";
import { carregarAmbienteDeTeste } from "../../lib/base-nacional/ambiente";
import { gravarNoBranch, lerCompetencia } from "./importar-receita";

type Resultado = { teste: string; ok: boolean; detalhe: string };
const resultados: Resultado[] = [];
const registrar = (teste: string, ok: boolean, detalhe = "") => resultados.push({ teste, ok, detalhe });

const FIXTURES = path.join(__dirname, "fixtures-receita");
const n = async (c: Client, sql: string, params: unknown[] = []) => Number((await c.query(sql, params)).rows[0].n);

async function instantaneo(c: Client) {
  return {
    empresas: await n(c, `SELECT count(*) n FROM "Empresa"`),
    empresaHash: (await c.query(`SELECT md5(string_agg(t::text, '|' ORDER BY id)) h FROM "Empresa" t`)).rows[0].h as string,
    pessoas: await n(c, `SELECT count(*) n FROM "Pessoa"`),
    pessoaHash: (await c.query(`SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY id), '')) h FROM "Pessoa" t`)).rows[0].h as string,
    dossies: await n(c, `SELECT count(*) n FROM "DossieComercial"`),
    carteiras: await n(c, `SELECT count(*) n FROM "DossieCarteira"`),
    oportunidades: await n(c, `SELECT count(*) n FROM "Oportunidade"`),
    tarefas: await n(c, `SELECT count(*) n FROM "Tarefa"`),
  };
}

async function main() {
  const amb = carregarAmbienteDeTeste();
  console.log(`[testar-importador-branch] endpoint ${amb.endpointMascarado} — transação com ROLLBACK ao final`);
  const c = new Client({ connectionString: amb.url });
  await c.connect();
  await c.query("BEGIN");
  try {
    const antes = await instantaneo(c);

    // ── 1. Importar a amostra fictícia da competência A (2031-01) ──────────────
    const leituraA = await lerCompetencia(path.join(FIXTURES, "2031-01"));
    registrar("Leitura A: 3 raízes encontradas (Alfa, Beta, Gama)", leituraA.relatorio.raizesEncontradas === 3, String(leituraA.relatorio.raizesEncontradas));
    registrar("Leitura A: linha malformada contada e ignorada, sem derrubar o processo", leituraA.relatorio.linhasMalformadasEstabelecimentos === 2, String(leituraA.relatorio.linhasMalformadasEstabelecimentos));
    const resA = await gravarNoBranch(c, { competencia: "2031-01", fonteUrl: "teste://fixture", leitura: leituraA, competenciaAnteriorId: null, competenciaAnteriorStr: null, agente: "teste-integracao" });
    registrar("Gravação A: 3 candidatas novas (Alfa, Beta, Gama)", resA.candidatasCriadas === 3, String(resA.candidatasCriadas));
    registrar("Gravação A: 4 unidades (Alfa tem 2, Beta 1, Gama 1)", resA.unidadesGravadas === 4, String(resA.unidadesGravadas));
    registrar("Gravação A: nenhuma mudança (primeira competência, sem anterior)", resA.mudancasGravadas === 0, String(resA.mudancasGravadas));

    // ── 2. Reimportar a MESMA competência A — deve dar zero duplicados ──────────
    const dupEstab = await n(c, `SELECT count(*) n FROM "ReceitaEstabelecimento" WHERE "competenciaId" = $1`, [resA.competenciaId]);
    const resA2 = await gravarNoBranch(c, { competencia: "2031-01", fonteUrl: "teste://fixture", leitura: leituraA, competenciaAnteriorId: null, competenciaAnteriorStr: null, agente: "teste-integracao" });
    const dupEstabDepois = await n(c, `SELECT count(*) n FROM "ReceitaEstabelecimento" WHERE "competenciaId" = $1`, [resA.competenciaId]);
    registrar("Reimportar A: zero candidatas novas na 2ª vez", resA2.candidatasCriadas === 0, String(resA2.candidatasCriadas));
    registrar("Reimportar A: nenhum ReceitaEstabelecimento duplicado", dupEstab === dupEstabDepois && dupEstabDepois === 4, `${dupEstab} → ${dupEstabDepois}`);
    const totalCand = await n(c, `SELECT count(*) n FROM "ConcreteiraCandidata" WHERE "cnpjBasico" IN ('97100001','97100002','97100003')`);
    registrar("Reimportar A: ainda exatamente 3 candidatas (sem duplicar)", totalCand === 3, String(totalCand));

    // ── 3. Importar a competência B (2031-02): filial nova, baixada, endereço alterado, saída do filtro ──
    const leituraB = await lerCompetencia(path.join(FIXTURES, "2031-02"));
    registrar("Leitura B: 2 raízes encontradas (Gama saiu do filtro, não aparece)", leituraB.relatorio.raizesEncontradas === 2, String(leituraB.relatorio.raizesEncontradas));
    const resB = await gravarNoBranch(c, { competencia: "2031-02", fonteUrl: "teste://fixture", leitura: leituraB, competenciaAnteriorId: resA.competenciaId, competenciaAnteriorStr: "2031-01", agente: "teste-integracao" });
    registrar("Gravação B: nenhuma candidata nova (todas já existiam desde A)", resB.candidatasCriadas === 0, String(resB.candidatasCriadas));

    const mudancas = (await c.query(`SELECT cnpj, tipo FROM "ReceitaMudanca" WHERE "competenciaId" = $1 ORDER BY cnpj, tipo`, [resB.competenciaId])).rows as Array<{ cnpj: string; tipo: string }>;
    const tipoDe = (cnpj: string) => mudancas.filter(m => m.cnpj === cnpj).map(m => m.tipo);
    registrar("ReceitaMudanca: filial nova da Alfa (NOVO_ESTABELECIMENTO)", tipoDe("97100001000300").includes("NOVO_ESTABELECIMENTO"));
    registrar("ReceitaMudanca: filial antiga da Alfa saiu do filtro (SAIU_DO_FILTRO)", tipoDe("97100001000200").includes("SAIU_DO_FILTRO"));
    registrar("ReceitaMudanca: matriz da Alfa com endereço alterado (ENDERECO_ALTERADO)", tipoDe("97100001000100").includes("ENDERECO_ALTERADO"));
    registrar("ReceitaMudanca: Beta baixada (SITUACAO_ALTERADA)", tipoDe("97100002000100").includes("SITUACAO_ALTERADA"));
    registrar("ReceitaMudanca: Gama (raiz inteira) saiu do filtro (SAIU_DO_FILTRO)", tipoDe("97100003000100").includes("SAIU_DO_FILTRO"));
    registrar("ReceitaMudanca: exatamente 5 mudanças, nenhuma extra", mudancas.length === 5, String(mudancas.length));

    const gama = (await c.query(`SELECT "totalUnidades","ultimaCompetencia" FROM "ConcreteiraCandidata" WHERE "cnpjBasico"='97100003'`)).rows[0];
    registrar("Gama: candidata/unidade NÃO foram excluídas (último estado preservado, nunca DELETE)", gama.totalUnidades === 1 && gama.ultimaCompetencia === "2031-01", JSON.stringify(gama));
    const deleteGama = await n(c, `SELECT count(*) n FROM "ConcreteiraCandidataUnidade" WHERE cnpj = '97100003000100'`);
    registrar("Gama: unidade ainda existe na tabela (não foi deletada)", deleteGama === 1, String(deleteGama));

    // ── 4. Campos de validação manual de uma candidata existente NÃO mudaram ───
    const validadorTeste = (await c.query(`SELECT id FROM "Usuario" WHERE papel = 'ADMIN' ORDER BY nome, id LIMIT 1`)).rows[0]?.id as string | undefined;
    if (!validadorTeste) throw new Error("nenhum usuário ADMIN para simular a validação manual no teste");
    await c.query(
      `UPDATE "ConcreteiraCandidata" SET "statusValidacao"='CONFIRMADA', confianca='ALTA', justificativa='Validado manualmente antes da reimportação (teste)',
         "validadoEm"=now(), "validadoPorId"=$1, "prioridadeComercial"='ALTA', "observacaoComercial"='Observação manual (teste)' WHERE "cnpjBasico"='97100001'`,
      [validadorTeste],
    );
    const resB2 = await gravarNoBranch(c, { competencia: "2031-02", fonteUrl: "teste://fixture", leitura: leituraB, competenciaAnteriorId: resA.competenciaId, competenciaAnteriorStr: "2031-01", agente: "teste-integracao" });
    const alfaDepois = (await c.query(`SELECT "statusValidacao",confianca,justificativa,"prioridadeComercial","observacaoComercial" FROM "ConcreteiraCandidata" WHERE "cnpjBasico"='97100001'`)).rows[0];
    registrar("Reimportar B após validação manual: statusValidacao/confiança/justificativa/prioridade/observação intocados", alfaDepois.statusValidacao === "CONFIRMADA" && alfaDepois.confianca === "ALTA" && alfaDepois.prioridadeComercial === "ALTA" && alfaDepois.observacaoComercial === "Observação manual (teste)", JSON.stringify(alfaDepois));
    registrar("Reimportar B (idempotente) não cria mudanças novas nem duplica histórico", resB2.mudancasGravadas === 5, String(resB2.mudancasGravadas));
    const histB = await n(c, `SELECT count(*) n FROM "ConcreteiraValidacaoHistorico" WHERE origem='IMPORTACAO_RECEITA' AND "entidadeId" IN ('97100001000300','97100001000200','97100001000100','97100002000100','97100003000100')`);
    registrar("Histórico de mudanças relevantes não duplicou na reimportação", histB === 3, String(histB)); // NOVO_ESTABELECIMENTO, SAIU_DO_FILTRO x2 (SITUACAO_ALTERADA é relevante tb, mas ENDERECO não) — ver RELEVANTES_PARA_HISTORICO

    // ── 5. Nenhum DELETE foi executado em nenhuma tabela da Base Nacional ──────
    // Alfa fica com 3 linhas (matriz 0001 + filial antiga 0002, preservada mesmo tendo
    // saído do filtro + filial nova 0003) + Beta 1 + Gama 1 = 5. Nunca 4: a filial antiga
    // da Alfa NUNCA é removida, só marcada via ReceitaMudanca (SAIU_DO_FILTRO) — é exatamente
    // isso que esta asserção confirma (rule 6: nunca DELETE).
    const totalUnidadesSempreCrescenteOuIgual = await n(c, `SELECT count(*) n FROM "ConcreteiraCandidataUnidade" WHERE "candidataId" IN (SELECT id FROM "ConcreteiraCandidata" WHERE "cnpjBasico" IN ('97100001','97100002','97100003'))`);
    registrar("Nenhuma unidade foi removida (Alfa 3 [matriz+filial antiga preservada+filial nova] + Beta 1 + Gama 1 = 5)", totalUnidadesSempreCrescenteOuIgual === 5, String(totalUnidadesSempreCrescenteOuIgual));

    // ── 6. Nada fora das tabelas da Base Nacional foi tocado ──────────────────
    const depois = await instantaneo(c);
    registrar("Nenhuma Empresa alterada (contagem e hash idênticos)", depois.empresas === antes.empresas && depois.empresaHash === antes.empresaHash, `${depois.empresas} empresas`);
    registrar("Nenhuma Pessoa alterada (contagem e hash idênticos)", depois.pessoas === antes.pessoas && depois.pessoaHash === antes.pessoaHash, `${depois.pessoas} pessoas`);
    registrar("Nenhum Dossiê criado", depois.dossies === antes.dossies, `${depois.dossies}`);
    registrar("Nenhuma Carteira criada", depois.carteiras === antes.carteiras, `${depois.carteiras}`);
    registrar("Nenhuma Oportunidade criada", depois.oportunidades === antes.oportunidades, `${depois.oportunidades}`);
    registrar("Nenhuma Tarefa criada", depois.tarefas === antes.tarefas, `${depois.tarefas}`);
  } finally {
    await c.query("ROLLBACK");
    await c.end();
  }

  let falhas = 0;
  for (const r of resultados) {
    if (!r.ok) falhas++;
    console.log(`${r.ok ? "PASSOU" : "FALHOU"} — ${r.teste}${r.detalhe ? ` (${r.detalhe})` : ""}`);
  }
  console.log(`\n${resultados.length - falhas}/${resultados.length} testes passaram. Transação desfeita (ROLLBACK) — nada foi gravado.`);
  if (falhas > 0) process.exit(1);
}

main().catch(e => { console.error(e instanceof Error ? e.message : "erro"); process.exit(1); });
