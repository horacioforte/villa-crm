// ARQUIVO: scripts/base-nacional/importar-externas-cnae-vizinho.ts
// REGRA: nunca remover. Apenas acrescentar.
// Inclui na Base Nacional, como CANDIDATAS, empresas encontradas fora da base por "CNAE vizinho"
// (sem o CNAE 2330-3/05), autorizadas por Horácio em 09/10/2026 (somente as 18 "possíveis concreteiras" de PE).
// - Origem registrada em observacoes ("Origem: CNAE vizinho — sem 2330-3/05") e no histórico (agente cnae-vizinho).
// - Entram como EM VERIFICAÇÃO; a pesquisa pública pode registrar Provável/Confirmada com evidência e link.
// - Dados cadastrais da Receita (arquivos abertos, competência 2026-09). Telefone e e-mail NÃO são gravados.
// - Idempotente (ids determinísticos + ON CONFLICT DO NOTHING); nunca altera candidata existente.
// - Só branch isolado autorizado. Não cria Empresa, Pessoa, Dossiê, Carteira, Oportunidade ou Tarefa.
// Uso: npx tsx scripts/base-nacional/importar-externas-cnae-vizinho.ts --arquivo=<json> [--commit]

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { ehInterior } from "../../lib/base-nacional/triagem";

const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";
const AGENTE = "cnae-vizinho";
const COMPETENCIA = "2026-09";
const ORIGEM_TXT_PE = "Origem: CNAE vizinho — empresa sem o CNAE 2330-3/05, encontrada pela busca gratuita nos dados abertos da Receita (competência 2026-09). Incluída como candidata em 09/10/2026 por autorização de Horácio.";

type Unidade = {
  cnpj: string; matriz: boolean; fantasia: string | null; situacao: string; inicio: string | null; cnaePrincipal: string; sec: string[];
  tipoLogradouro: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cep: string | null;
  municipioNome: string | null; uf: string | null;
};
type Evid = { tipoFonte: string; titulo: string; url: string | null; trecho: string | null; confianca?: string | null };
type Externa = {
  raiz: string; razao: string; natureza: string | null; porte: string | null; capital: number | null; unidades: Unidade[];
  fila?: { uf: string; municipio: string | null };
  resultado: { status: "EM_VERIFICACAO" | "PROVAVEL" | "CONFIRMADA" | "NAO_E_CONCRETEIRA"; confianca: "ALTA" | "MEDIA" | "BAIXA" | null; tipoAtividade: string | null; justificativa: string; evidencias: Evid[]; filaMotivo?: string | null };
};
// 12/10/2026 (Brasil autorizado por Horácio): --lote=BR usa o texto nacional e a UF/município da própria empresa na fila.
const LOTE_BR = process.argv.includes("--lote=BR");
const ORIGEM_TXT = LOTE_BR
  ? "Origem: CNAE vizinho — empresa sem o CNAE 2330-3/05, encontrada pela busca gratuita nos dados abertos da Receita (competência 2026-09). Incluída como candidata em 12/10/2026 (Base Nacional, todos os estados) por autorização de Horácio; nome indica concreto usinado/usina/central de concreto."
  : ORIGEM_TXT_PE;
const ordenar = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

async function main() {
  const arq = process.argv.find(a => a.startsWith("--arquivo="))?.slice(10);
  const commit = process.argv.includes("--commit");
  // --completar-unidades: só acrescenta unidades que faltaram numa carga anterior (candidata já criada por esta origem).
  const completar = process.argv.includes("--completar-unidades");
  if (!arq) throw new Error("informe --arquivo=<json>");
  const dados = JSON.parse(readFileSync(arq, "utf8")) as Externa[];
  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) throw new Error(`BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado.`);
  console.log(`[externas] branch autorizado (${amb.endpointMascarado}) · ${dados.length} empresas · ${commit ? "COMMIT" : "simulação (ROLLBACK)"}`);
  const c = new Client({ connectionString: amb.url });
  await c.connect();
  const cont = { novas: 0, jaExistiam: 0, unidades: 0, evidencias: 0, fila: 0 };
  try {
    await c.query("BEGIN");
    const validador = (await c.query(`SELECT id FROM "Usuario" WHERE papel = 'ADMIN' AND ativo = true ORDER BY nome, id LIMIT 1`)).rows[0]?.id as string;
    const agora = new Date();
    for (const e of dados) {
      if (!/^\d{8}$/.test(e.raiz) || e.unidades.some(u => u.sec.includes("2330305") || u.cnaePrincipal === "2330305")) throw new Error(`Dados inválidos para ${e.raiz}`);
      const id = `rfb-cand-${e.raiz}`;
      const r = e.resultado;
      const ativas = e.unidades.filter(u => u.situacao === "02");
      const matriz = e.unidades.find(u => u.matriz) ?? e.unidades[0];
      const ins = await c.query(
        `INSERT INTO "ConcreteiraCandidata"(id,"cnpjBasico","cnpjMatriz","razaoSocial","nomeFantasia","naturezaJuridica",porte,"capitalSocial","ufMatriz","municipioMatriz",
           "totalUnidades","totalUnidadesAtivas","statusValidacao","tipoAtividade",confianca,justificativa,"primeiraVerificacaoEm","ultimaVerificacaoEm","validadoPorId","validadoEm",
           "primeiraCompetencia","ultimaCompetencia",observacoes,"nomeOrdenacao","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::"StatusValidacaoConcreteira",$14::"TipoAtividadeConcreteira",$15::"ConfiancaInformacao",$16,$17,$17,$18,$19,$20,$20,$21,$22,$17,$17)
         ON CONFLICT DO NOTHING`,
        [id, e.raiz, matriz.matriz ? matriz.cnpj : null, e.razao, matriz.fantasia, e.natureza, e.porte, e.capital, matriz.uf, matriz.municipioNome,
          e.unidades.length, ativas.length, r.status, r.tipoAtividade, r.confianca, r.justificativa, agora,
          r.status === "CONFIRMADA" ? validador : null, r.status === "CONFIRMADA" ? agora : null, COMPETENCIA, ORIGEM_TXT, ordenar(e.razao)]);
      if (ins.rowCount === 0) {
        cont.jaExistiam++;
        if (!completar) continue;
        const origem = (await c.query(`SELECT 1 FROM "ConcreteiraCandidata" WHERE id = $1 AND observacoes LIKE 'Origem: CNAE vizinho%'`, [id])).rowCount;
        if (!origem) continue; // nunca mexe em candidata de outra origem
        for (const u of e.unidades) {
          const r2 = await c.query(
            `INSERT INTO "ConcreteiraCandidataUnidade"(id,"candidataId",cnpj,"isMatriz","nomeFantasia","situacaoCadastral",ativa,"dataInicioAtividade","cnaePrincipal","cnaesSecundarios",
               "cnaeAlvoComoPrincipal","tipoLogradouro",logradouro,numero,complemento,bairro,cep,"municipioNome",uf,"primeiraCompetencia","ultimaCompetencia","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20,$20) ON CONFLICT DO NOTHING`,
            [`rfb-uni-${u.cnpj}`, id, u.cnpj, u.matriz, u.fantasia, u.situacao, u.situacao === "02", u.inicio, u.cnaePrincipal, u.sec,
              u.tipoLogradouro, u.logradouro, u.numero, u.complemento, u.bairro, u.cep, u.municipioNome, u.uf, COMPETENCIA, agora]);
          cont.unidades += r2.rowCount ?? 0;
        }
        await c.query(`UPDATE "ConcreteiraCandidata" SET "totalUnidades" = (SELECT count(*) FROM "ConcreteiraCandidataUnidade" WHERE "candidataId" = $1),
          "totalUnidadesAtivas" = (SELECT count(*) FROM "ConcreteiraCandidataUnidade" WHERE "candidataId" = $1 AND ativa), "updatedAt" = now() WHERE id = $1`, [id]);
        const pe = (await c.query(`SELECT uf, "municipioNome" FROM "ConcreteiraCandidataUnidade" WHERE "candidataId" = $1 AND ativa AND uf = 'PE' ORDER BY "isMatriz" DESC, cnpj LIMIT 1`, [id])).rows[0];
        if (pe) await c.query(`UPDATE "ConcreteiraTriagem" SET uf = 'PE', municipio = $2, "updatedAt" = now() WHERE "candidataId" = $1 AND uf <> 'PE'`, [id, pe.municipioNome]);
        continue;
      }
      cont.novas++;
      for (const u of e.unidades) {
        await c.query(
          `INSERT INTO "ConcreteiraCandidataUnidade"(id,"candidataId",cnpj,"isMatriz","nomeFantasia","situacaoCadastral",ativa,"dataInicioAtividade","cnaePrincipal","cnaesSecundarios",
             "cnaeAlvoComoPrincipal","tipoLogradouro",logradouro,numero,complemento,bairro,cep,"municipioNome",uf,"primeiraCompetencia","ultimaCompetencia","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19,$20,$20) ON CONFLICT DO NOTHING`,
          [`rfb-uni-${u.cnpj}`, id, u.cnpj, u.matriz, u.fantasia, u.situacao, u.situacao === "02", u.inicio, u.cnaePrincipal, u.sec,
            u.tipoLogradouro, u.logradouro, u.numero, u.complemento, u.bairro, u.cep, u.municipioNome, u.uf, COMPETENCIA, agora]);
        cont.unidades++;
      }
      // Histórico: entrada como candidata (Em verificação) e, se for o caso, resultado da pesquisa.
      await c.query(
        `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","tipoEvento",origem,agente,"statusAnterior","statusNovo",motivo,"createdAt")
         VALUES ($1,$2,'VALIDACAO','IMPORTACAO_RECEITA',$3,'PENDENTE','EM_VERIFICACAO',$4,$5) ON CONFLICT DO NOTHING`,
        [`cnaeviz-hist-entrada-${id}`, id, AGENTE, ORIGEM_TXT, agora]);
      if (r.status !== "EM_VERIFICACAO") {
        await c.query(
          `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","tipoEvento",origem,agente,"statusAnterior","statusNovo","confiancaNova","tipoNovo",motivo,"usuarioId","createdAt")
           VALUES ($1,$2,'VALIDACAO','NAO_INFORMADA','piloto-pesquisa-publica','EM_VERIFICACAO',$3::"StatusValidacaoConcreteira",$4::"ConfiancaInformacao",$5::"TipoAtividadeConcreteira",$6,$7,$8) ON CONFLICT DO NOTHING`,
          [`cnaeviz-hist-pesquisa-${id}`, id, r.status, r.confianca, r.tipoAtividade, r.justificativa, r.status === "CONFIRMADA" ? validador : null, new Date(agora.getTime() + 1000)]);
      }
      for (const [i, ev] of [{ tipoFonte: "RECEITA_FEDERAL", titulo: "Cadastro Receita: sem o CNAE 2330-3/05 (origem CNAE vizinho)", url: null,
          trecho: `CNAE principal ${matriz.cnaePrincipal}; secundários: ${[...new Set(e.unidades.flatMap(u => u.sec))].join(", ") || "—"}. Nenhuma unidade com 2330-3/05.`, confianca: "ALTA" }, ...r.evidencias].entries()) {
        await c.query(
          `INSERT INTO "ConcreteiraEvidencia"(id,"candidataId","tipoFonte",titulo,url,trecho,"coletadoEm",confianca,agente,observacao)
           VALUES ($1,$2,$3::"TipoFonteEvidencia",$4,$5,$6,$7,$8::"ConfiancaInformacao",$9,$10) ON CONFLICT DO NOTHING`,
          [`cnaeviz-ev-${e.raiz}-${i}`, id, ev.tipoFonte, ev.titulo, ev.url, ev.trecho, agora, ev.confianca ?? r.confianca ?? "BAIXA", i === 0 ? AGENTE : "piloto-pesquisa-publica",
            i === 0 ? "Dado aberto da Receita Federal." : "Pesquisa pública gratuita (09/10/2026)."]);
        cont.evidencias++;
      }
      // Fila: Em verificação e Provável entram para verificação humana (Confirmada e Não é ficam fora).
      if (r.status === "EM_VERIFICACAO" || r.status === "PROVAVEL") {
        const doUf = e.fila ? { uf: e.fila.uf, municipioNome: e.fila.municipio } : (ativas.find(u => u.uf === "PE") ?? matriz);
        await c.query(
          `INSERT INTO "ConcreteiraTriagem"("candidataId","versaoRegra",classificacao,sinais,pontuacao,uf,municipio,interior,"prioridadeReceita","situacaoFila","motivoFila","createdAt","updatedAt")
           VALUES ($1,'${LOTE_BR ? "cnae-vizinho-2026-10-12" : "cnae-vizinho-2026-10-09"}','POSSIVEL_CONCRETEIRA',$2,$3,$4,$5,$6,'B','AGUARDANDO',$7,$8,$8) ON CONFLICT DO NOTHING`,
          [id, ["origem: CNAE vizinho (sem 2330-3/05)", "nome indica concreto"], 30, doUf.uf, doUf.municipioNome,
            e.fila ? ehInterior(doUf.municipioNome, doUf.uf) : !["RECIFE", "JABOATAO DOS GUARARAPES", "OLINDA", "PAULISTA", "CABO DE SANTO AGOSTINHO", "CAMARAGIBE", "SAO LOURENCO DA MATA", "IGARASSU", "ABREU E LIMA", "IPOJUCA", "MORENO", "ITAPISSUMA", "ILHA DE ITAMARACA", "ARACOIABA"].includes((doUf.municipioNome ?? "").toUpperCase()),
            r.filaMotivo ?? "CNAE vizinho: confirmar se produz/fornece concreto usinado.", agora]);
        cont.fila++;
      }
    }
    await c.query(commit ? "COMMIT" : "ROLLBACK");
    console.log(`[externas] ${commit ? "GRAVADO" : "simulado e desfeito"}: ${JSON.stringify(cont)}`);
  } catch (err) { await c.query("ROLLBACK"); throw err; } finally { await c.end(); }
}
main().catch(e => { console.error("[externas] ERRO", e instanceof Error ? e.message : e); process.exit(1); });
