// ARQUIVO: scripts/base-nacional/piloto-gravar-validacao.ts
// REGRA: nunca remover. Apenas acrescentar.
// Grava no branch isolado o resultado de um PILOTO de validação por pesquisa pública (autorizado por
// Horácio em 08/10/2026 para Pernambuco). Lê um JSON (fora do repositório) com, por empresa:
// classificação, justificativa, confiança, evidências com URL, contatos, pessoas e potencial.
//
// Regras:
// - Só o branch "base-nacional-concreteiras" (endpoint ep-gentle-king-ajo60u4q). Nunca produção.
// - Só tabelas da Base Nacional. Não cria Empresa, Pessoa, Dossiê, Carteira, Oportunidade ou Tarefa.
// - Nunca sobrescreve validação humana: só altera candidatas ainda "PENDENTE".
// - Idempotente: ids determinísticos + ON CONFLICT DO NOTHING.
// - Histórico com telefone/e-mail MASCARADOS. Autoria marcada como "piloto-pesquisa-publica".
// - Nenhum contato é feito com as empresas: os dados vêm de páginas públicas, com o link.
//
// Uso: npx tsx scripts/base-nacional/piloto-gravar-validacao.ts --arquivo=<json> [--commit]

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { normalizarContato, validarContato, valorParaHistorico } from "../../lib/base-nacional/contatos";
import type { TipoContato } from "../../lib/base-nacional/rotulos";

export const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";
const AGENTE = "piloto-pesquisa-publica";
const PREFIXO = "[Piloto PE — pesquisa pública automatizada, 08/10/2026] ";

const STATUS: Record<string, string> = {
  CONFIRMADA: "CONFIRMADA", PROVAVEL: "PROVAVEL", EM_VERIFICACAO: "EM_VERIFICACAO",
  NAO_E_CONCRETEIRA: "NAO_E_CONCRETEIRA", SEM_EVIDENCIA: "NAO_LOCALIZADA",
};
const FONTES = new Set(["RECEITA_FEDERAL", "SITE_EMPRESA", "GOOGLE_MAPS", "REDE_SOCIAL", "LINKEDIN", "NOTICIA", "VAGA_EMPREGO", "LICENCA_AMBIENTAL", "DIARIO_OFICIAL", "ASSOCIACAO_SETORIAL", "CONTATO_DIRETO", "OUTRA"]);
const TIPOS_ATIV = new Set(["CONCRETO_USINADO", "ARGAMASSA", "PRE_MOLDADO", "BOMBEAMENTO", "OUTRA_ATIVIDADE", "DUVIDOSO"]);
const TIPOS_CONTATO = new Set(["TELEFONE", "WHATSAPP", "EMAIL", "SITE", "LINKEDIN", "INSTAGRAM", "FACEBOOK", "OUTRO"]);
const PAPEIS = new Set(["PROPRIETARIO_SOCIO", "ADMINISTRADOR", "COMPRADOR", "RESPONSAVEL_FROTA", "RESPONSAVEL_MANUTENCAO", "RESPONSAVEL_EQUIPAMENTOS", "OUTRO"]);
const EQUIP = new Set(["BOMBA_LANCA", "BOMBA_ESTACIONARIA", "CAMINHAO_BETONEIRA", "CENTRAL_CONCRETO", "TELEBELT", "PECAS_ACESSORIOS", "OUTRO"]);
const NIVEL = new Set(["ALTO", "MEDIO", "BAIXO", "NENHUM", "DESCONHECIDO"]);

type Resultado = {
  id: string; classificacao: string; tipo_atividade: string | null; confianca: string; justificativa: string;
  evidencias: Array<{ tipo_fonte: string; titulo: string; url: string; trecho?: string; data_publicacao?: string | null }>;
  unidades_confirmadas?: Array<{ cidade: string; uf: string; descricao?: string; url?: string }>;
  contatos?: Array<{ tipo: string; valor: string; descricao?: string; fonte_url: string }>;
  pessoas?: Array<{ nome: string; funcao?: string; papeis?: string[]; fonte_url: string }>;
  potencial?: Array<{ equipamento: string; venda: string; motivo?: string }>;
  sinais?: string[]; observacao?: string;
};

export function fontePorUrl(url: string | null | undefined): string {
  const u = (url ?? "").toLowerCase();
  if (/instagram\.com|facebook\.com|fb\.com|tiktok\.com|youtube\.com/.test(u)) return "REDE_SOCIAL";
  if (/linkedin\.com/.test(u)) return "LINKEDIN";
  if (/google\.[a-z.]+\/maps|maps\.app\.goo/.test(u)) return "GOOGLE_MAPS";
  return "OUTRA";
}

/** Converte "@perfil" em URL e descarta contatos que não passam na validação da tela. */
export function prepararContato(tipo: string, valor: string): { tipo: TipoContato; valor: string } | null {
  if (!TIPOS_CONTATO.has(tipo)) return null;
  let v = (valor ?? "").trim();
  if (tipo === "INSTAGRAM" && v.startsWith("@")) v = `https://www.instagram.com/${v.slice(1)}/`;
  if ((tipo === "FACEBOOK" || tipo === "INSTAGRAM" || tipo === "LINKEDIN") && !/^https?:\/\//i.test(v)) v = `https://${v}`;
  return validarContato(tipo as TipoContato, v) ? null : { tipo: tipo as TipoContato, valor: v };
}

async function main() {
  const arquivo = process.argv.find(a => a.startsWith("--arquivo="))?.slice(10);
  const commit = process.argv.includes("--commit");
  if (!arquivo) throw new Error("informe --arquivo=<json>");
  const dados = JSON.parse(readFileSync(arquivo, "utf8")) as Resultado[];
  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) throw new Error(`BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado.`);
  console.log(`[piloto] branch autorizado (${amb.endpointMascarado}) · ${dados.length} empresas · modo ${commit ? "COMMIT" : "simulação (ROLLBACK)"}`);

  const c = new Client({ connectionString: amb.url });
  await c.connect();
  const cont = { atualizadas: 0, puladasJaValidadas: 0, inexistentes: 0, evidencias: 0, contatos: 0, contatosDescartados: 0, pessoas: 0, potenciais: 0 };
  try {
    await c.query("BEGIN");
    // Responsável institucional pela validação do piloto (só referência; Usuario não é alterado).
    const validador = (await c.query(`SELECT id FROM "Usuario" WHERE papel = 'ADMIN' AND ativo = true ORDER BY nome, id LIMIT 1`)).rows[0]?.id as string;
    if (!validador) throw new Error("nenhum ADMIN ativo para referenciar.");
    for (const r of dados) {
      const cand = (await c.query(`SELECT id, "statusValidacao" FROM "ConcreteiraCandidata" WHERE id = $1`, [r.id])).rows[0];
      if (!cand) { cont.inexistentes++; continue; }
      if (cand.statusValidacao !== "PENDENTE") { cont.puladasJaValidadas++; continue; }
      const status = STATUS[r.classificacao];
      if (!status) throw new Error(`classificação inválida em ${r.id}`);
      const conf = ["ALTA", "MEDIA", "BAIXA"].includes(r.confianca) ? r.confianca : "BAIXA";
      const tipo = r.tipo_atividade && TIPOS_ATIV.has(r.tipo_atividade) ? r.tipo_atividade : null;
      const just = (PREFIXO + (r.justificativa ?? "").trim()).slice(0, 4000);
      const unidadesTxt = (r.unidades_confirmadas ?? []).map(u => `${u.cidade}/${u.uf}${u.descricao ? ` (${u.descricao})` : ""}`).join("; ");
      const obsCom = [r.sinais?.length ? `Sinais: ${r.sinais.join(", ")}` : "", unidadesTxt ? `Unidades confirmadas em fonte pública: ${unidadesTxt}` : "", r.observacao ?? ""].filter(Boolean).join(" · ");
      await c.query(
        `UPDATE "ConcreteiraCandidata" SET "statusValidacao"=$2::"StatusValidacaoConcreteira", confianca=$3::"ConfiancaInformacao", "tipoAtividade"=$4::"TipoAtividadeConcreteira", justificativa=$5,
           "primeiraVerificacaoEm"=coalesce("primeiraVerificacaoEm", now()), "ultimaVerificacaoEm"=now(),
           "validadoPorId"=CASE WHEN $2::text='CONFIRMADA' THEN $6 ELSE "validadoPorId" END,
           "validadoEm"=CASE WHEN $2::text='CONFIRMADA' THEN now() ELSE "validadoEm" END,
           "observacaoComercial"=coalesce("observacaoComercial", nullif($7,'')), "updatedAt"=now()
         WHERE id=$1 AND "statusValidacao"='PENDENTE'`,
        [r.id, status, conf, tipo, just, validador, obsCom.slice(0, 4000)]);
      await c.query(
        `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","statusAnterior","statusNovo","confiancaNova","tipoNovo",motivo,agente,"tipoEvento",origem)
         VALUES ($1,$2,'PENDENTE',$3,$4,$5,$6,$7,'VALIDACAO','NAO_INFORMADA') ON CONFLICT (id) DO NOTHING`,
        [`piloto-pe-hist-${r.id}`, r.id, status, conf, tipo, just, AGENTE]);
      cont.atualizadas++;

      for (const [i, e] of (r.evidencias ?? []).entries()) {
        if (!/^https?:\/\//i.test(e.url ?? "")) continue;
        await c.query(
          `INSERT INTO "ConcreteiraEvidencia"(id,"candidataId","tipoFonte",titulo,url,trecho,"coletadoEm",confianca,agente,observacao)
           VALUES ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
          [`piloto-pe-ev-${r.id}-${i}`, r.id, FONTES.has(e.tipo_fonte) ? e.tipo_fonte : "OUTRA", (e.titulo ?? "").slice(0, 300) || "(sem título)", e.url,
            (e.trecho ?? "").slice(0, 1000) || null, conf, AGENTE, e.data_publicacao ? `Data da publicação: ${e.data_publicacao}` : "Pesquisa em 08/10/2026"]);
        cont.evidencias++;
      }
      const vistos = new Set<string>();
      for (const k of r.contatos ?? []) {
        const p = prepararContato(k.tipo, k.valor);
        if (!p || !/^https?:\/\//i.test(k.fonte_url ?? "")) { cont.contatosDescartados++; continue; }
        const norm = normalizarContato(p.tipo, p.valor);
        if (vistos.has(`${p.tipo}:${norm}`)) continue;
        vistos.add(`${p.tipo}:${norm}`);
        const idc = `piloto-pe-ct-${r.id}-${p.tipo}-${norm}`.slice(0, 190);
        const ins = await c.query(
          `INSERT INTO "ConcreteiraCandidataContato"(id,"candidataId",tipo,valor,"valorNormalizado",descricao,situacao,fonte,"fonteUrl","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,'NAO_VERIFICADO',$7,$8,now()) ON CONFLICT DO NOTHING RETURNING id`,
          [idc, r.id, p.tipo, p.valor, norm, `${(k.descricao ?? "").slice(0, 150)} (encontrado em fonte pública — piloto)`.trim(), fontePorUrl(k.fonte_url), k.fonte_url]);
        if (ins.rowCount) {
          cont.contatos++;
          await c.query(
            `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","statusAnterior","statusNovo",motivo,agente,"tipoEvento",origem,campo,"valorNovo","entidadeId")
             VALUES ($1,$2,$3,$3,'Contato encontrado em fonte pública (piloto)',$4,'CONTATO','NAO_INFORMADA',$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
            [`piloto-pe-hct-${idc}`.slice(0, 200), r.id, status, AGENTE, `contato:${p.tipo}`, valorParaHistorico(p.tipo, p.valor), idc]);
        }
      }
      for (const [i, ps] of (r.pessoas ?? []).entries()) {
        if (!ps.nome?.trim() || !/^https?:\/\//i.test(ps.fonte_url ?? "")) continue;
        const papeis = (ps.papeis ?? []).filter(x => PAPEIS.has(x));
        const ins = await c.query(
          `INSERT INTO "ConcreteiraCandidataPessoa"(id,"candidataId",nome,funcao,papeis,fonte,"fonteUrl",situacao,observacao,"updatedAt")
           VALUES ($1,$2,$3,$4,$5::"PapelPessoaCandidata"[],$6,$7,'NAO_VERIFICADO','Encontrado em fonte pública (piloto 08/10/2026)',now()) ON CONFLICT DO NOTHING RETURNING id`,
          [`piloto-pe-ps-${r.id}-${i}`, r.id, ps.nome.trim().slice(0, 200), ps.funcao?.slice(0, 200) ?? null, papeis.length ? papeis : ["OUTRO"], fontePorUrl(ps.fonte_url), ps.fonte_url]);
        if (ins.rowCount) {
          cont.pessoas++;
          await c.query(
            `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","statusAnterior","statusNovo",motivo,agente,"tipoEvento",origem,campo,"valorNovo","entidadeId")
             VALUES ($1,$2,$3,$3,'Pessoa encontrada em fonte pública (piloto)',$4,'PESSOA','NAO_INFORMADA','pessoa',$5,$6) ON CONFLICT (id) DO NOTHING`,
            [`piloto-pe-hps-${r.id}-${i}`, r.id, status, AGENTE, `${ps.nome.trim()} — ${ps.funcao ?? ""}`.slice(0, 300), `piloto-pe-ps-${r.id}-${i}`]);
        }
      }
      if (status === "CONFIRMADA" || status === "PROVAVEL") {
        for (const pt of r.potencial ?? []) {
          if (!EQUIP.has(pt.equipamento) || !NIVEL.has(pt.venda) || pt.equipamento === "OUTRO") continue;
          const ins = await c.query(
            `INSERT INTO "ConcreteiraPotencialEquipamento"(id,"candidataId",equipamento,"potencialVenda","interesseLocacao",observacao,"avaliadoEm","updatedAt")
             VALUES ($1,$2,$3,$4,'DESCONHECIDO',$5,now(),now()) ON CONFLICT DO NOTHING RETURNING id`,
            [`piloto-pe-pot-${r.id}-${pt.equipamento}`, r.id, pt.equipamento, pt.venda, `Piloto (pesquisa pública): ${(pt.motivo ?? "").slice(0, 900)}`]);
          if (ins.rowCount) cont.potenciais++;
        }
      }
    }
    await c.query(commit ? "COMMIT" : "ROLLBACK");
    console.log(`[piloto] ${commit ? "GRAVADO" : "simulado e desfeito"}:`, JSON.stringify(cont));
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e instanceof Error ? e.message : "erro"); process.exit(1); });
}
