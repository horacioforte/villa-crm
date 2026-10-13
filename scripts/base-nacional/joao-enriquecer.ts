// ARQUIVO: scripts/base-nacional/joao-enriquecer.ts
// REGRA: nunca remover. Apenas acrescentar.
// João — preparação técnica do enriquecimento de decisores das concreteiras (autorizado por Horácio em 12/10/2026).
//
// Público: só CONFIRMADAS e PROVÁVEIS da Base Nacional. Piloto: 6 confirmadas + 14 prováveis com melhor evidência.
// O QUE FAZ (gratuito, sem API paga):
//   --preparar   monta a fila do João: agrupa matriz/filiais/grupo econômico e grava 1 linha por grupo.
//   --executar   para cada grupo (uma única vez, com checkpoint por etapa):
//                  qsa     → sócios/administradores do QSA da Receita (dados abertos);
//                  receita → telefone/e-mail do cadastro CNPJ (só se não for compartilhado por várias empresas);
//                  site    → páginas públicas de contato/equipe do site PRÓPRIO (robots.txt respeitado, cache).
//   --importar-web=<json>  grava achados da pesquisa pública feita fora do código (LinkedIn etc.), com as
//                  mesmas validações (homônimo, domínio, URL obrigatória). A IA só interpreta resultados.
//   --relatorio  números do público.
// NUNCA: envia mensagem, liga, aciona WhatsApp/e-mail, cria Empresa/Pessoa do CRM, Oportunidade, Tarefa ou Proposta.
// Não inventa dado: o que não foi achado fica "não localizado". Toda informação guarda a URL da fonte.
// Só roda no branch Neon autorizado.
//
// Uso: npx tsx scripts/base-nacional/joao-enriquecer.ts --preparar --socios=<socios.json>
//      npx tsx scripts/base-nacional/joao-enriquecer.ts --executar --publico=PILOTO_20 --socios=<socios.json> [--limite=N] [--prazo-ms=N] [--max-paginas=N]

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { dominioDeEmail, lerPagina } from "../../lib/base-nacional/robo/site";
import { agruparCandidatas, type Ligacao } from "../../lib/base-nacional/joao/agrupar";
import { extrairContatos, extrairLinkedinPessoas, extrairPessoasComCargo, linksDeContato } from "../../lib/base-nacional/joao/extrair";
import {
  QUALIFICACOES_DECISOR, classificarCargo, dominioRegistravel, nomeExibicao, nomePessoaPlausivel, normalizarLinkedinPessoa, normalizarNome,
  normalizarTelefoneBR, textoCitaEmpresa, tokensDistintivos, validarEmail,
} from "../../lib/base-nacional/joao/validar";

const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";
const AGENTE = "joao-enriquecimento";
const USER_AGENT_JOAO = "VillaCRM-Joao/1.0 (+leitura de contatos comerciais publicados no site da empresa; sem contato automatizado)";
const FONTE_QSA = "https://arquivos.receitafederal.gov.br/index.php/s/YggdBLfdninEJX9?path=%2F2026-09 (Socios*.zip, dados abertos CNPJ, competência 2026-09)";
const DIAS_CACHE = 30;
const PILOTO = { confirmadas: 6, provaveis: 14 };

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const tem = (n: string) => process.argv.includes(`--${n}`);
const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

type Socio = { tipo: string; nome: string; qualificacaoCodigo: string; qualificacao: string; entrada: string | null; cnpjSocio?: string; chaveDoc?: string };
type Cand = { id: string; raiz: string; razao: string; fantasia: string | null; status: string; confianca: string | null; validadoEm: Date | null; unidades: number; nev: number; uf: string | null };

async function main() {
  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) throw new Error(`BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado.`);
  const db = new Client({ connectionString: amb.url });
  await db.connect();
  console.log(`[joao] branch autorizado (${amb.endpointMascarado})`);
  try {
    if (tem("preparar")) await preparar(db);
    if (tem("executar")) await executar(db);
    if (arg("importar-web")) await importarWeb(db, arg("importar-web")!);
    if (tem("relatorio") || tem("executar") || arg("importar-web")) await relatorio(db, arg("publico") ?? "PILOTO_20");
  } finally { await db.end(); }
}

function lerSocios(): Record<string, Socio[]> {
  const f = arg("socios");
  if (!f) throw new Error("informe --socios=<socios.json> (gerado por joao-socios-receita.py)");
  return JSON.parse(readFileSync(f, "utf8"));
}

// ------------------------------------------------------------------------------------------------ preparar
async function carregarPublico(db: Client): Promise<Cand[]> {
  const r = await db.query(`
    SELECT c.id, c."cnpjBasico" raiz, c."razaoSocial" razao, c."nomeFantasia" fantasia, c."statusValidacao"::text status, c.confianca::text confianca,
           c."validadoEm", c."totalUnidadesAtivas" unidades, t.uf,
           (SELECT count(*)::int FROM "ConcreteiraEvidencia" e WHERE e."candidataId" = c.id) nev
      FROM "ConcreteiraCandidata" c LEFT JOIN "ConcreteiraTriagem" t ON t."candidataId" = c.id
     WHERE c."statusValidacao" IN ('CONFIRMADA','PROVAVEL')`);
  return r.rows.map(x => ({ ...x, uf: x.uf ?? null }));
}

/** Ordem: confirmadas primeiro; prováveis pela força da evidência (nº de evidências, confiança alta, porte). */
export function ordenarPublico(c: Cand[]): Cand[] {
  const peso = (x: Cand) => [x.status === "CONFIRMADA" ? 0 : 1, -x.nev, x.confianca === "ALTA" ? 0 : 1, -x.unidades] as number[];
  return [...c].sort((a, b) => { const pa = peso(a), pb = peso(b); for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]; return a.raiz.localeCompare(b.raiz); });
}

async function preparar(db: Client) {
  const socios = lerSocios();
  const cands = ordenarPublico(await carregarPublico(db));
  const piloto = new Set([...cands.filter(c => c.status === "CONFIRMADA").slice(0, PILOTO.confirmadas), ...cands.filter(c => c.status === "PROVAVEL").slice(0, PILOTO.provaveis)].map(c => c.id));
  const porRaiz = new Map(cands.map(c => [c.raiz, c]));
  const ids = cands.map(c => c.id);
  const ligacoes: Ligacao[] = [];
  // vínculos fortes já registrados pelo robô
  const v = await db.query(`SELECT "candidataId" a, "candidataRelacionadaId" b, tipo::text tipo FROM "ConcreteiraVinculo" WHERE forca = 'ALTA' AND "candidataId" = ANY($1) AND "candidataRelacionadaId" = ANY($1)`, [ids]);
  for (const x of v.rows) ligacoes.push({ a: x.a, b: x.b, motivo: `vínculo forte (${x.tipo.toLowerCase()})` });
  // sócio pessoa jurídica e mesmo administrador (QSA)
  const adm = new Map<string, string[]>();
  for (const c of cands) for (const s of socios[c.raiz] ?? []) {
    if (s.tipo === "PJ" && s.cnpjSocio) { const o = porRaiz.get(s.cnpjSocio.slice(0, 8)); if (o && o.id !== c.id) ligacoes.push({ a: c.id, b: o.id, motivo: "sócia pessoa jurídica (QSA)" }); }
    if (s.tipo !== "PJ" && s.chaveDoc && ["49", "05", "10", "16", "28"].includes(s.qualificacaoCodigo)) { if (!adm.has(s.chaveDoc)) adm.set(s.chaveDoc, []); adm.get(s.chaveDoc)!.push(c.id); }
  }
  for (const l of adm.values()) for (let i = 1; i < l.length; i++) ligacoes.push({ a: l[0], b: l[i], motivo: "mesmo administrador (QSA)" });
  const grupos = agruparCandidatas(cands.map((c, i) => ({ candidataId: c.id, raiz: c.raiz, nome: c.fantasia || c.razao, unidadesAtivas: c.unidades, ordem: i })), ligacoes);

  // domínios próprios conhecidos (contatos já registrados, evidências do site, e-mails da Receita)
  const dom = await db.query(`
    SELECT "candidataId" id, valor v FROM "ConcreteiraCandidataContato" WHERE ativo AND tipo IN ('SITE','EMAIL') AND "candidataId" = ANY($1)
    UNION ALL SELECT "candidataId", url FROM "ConcreteiraEvidencia" WHERE "tipoFonte" = 'SITE_EMPRESA' AND url IS NOT NULL AND "candidataId" = ANY($1)
    UNION ALL SELECT u."candidataId", coalesce(r.email, u.email) FROM "ConcreteiraCandidataUnidade" u LEFT JOIN "ReceitaEstabelecimento" r ON r.cnpj = u.cnpj WHERE u."candidataId" = ANY($1)`, [ids]);
  const dominiosDe = new Map<string, Set<string>>();
  for (const x of dom.rows) {
    const s = String(x.v ?? "").trim().toLowerCase();
    if (!s) continue;
    let d: string | null = null;
    if (s.includes("@")) d = dominioDeEmail(s);
    else { try { const u = new URL(/^https?:/.test(s) ? s : `https://${s}`); if (!/(linkedin|instagram|facebook|google|youtube|wa\.me|whatsapp|cnpj|econodata|solutudo|guiamais|telelistas)/.test(u.hostname)) d = u.hostname.replace(/^www\./, ""); } catch { d = null; } }
    if (d) { if (!dominiosDe.has(x.id)) dominiosDe.set(x.id, new Set()); dominiosDe.get(x.id)!.add(d); }
  }
  let novos = 0;
  for (const [i, g] of grupos.entries()) {
    const publico = g.candidataIds.some(id => piloto.has(id)) ? "PILOTO_20" : "LOTE_206";
    const dominios = [...new Set(g.candidataIds.flatMap(id => [...(dominiosDe.get(id) ?? [])]).map(d => dominioRegistravel(d) ?? d))].slice(0, 4);
    const r = await db.query(`
      INSERT INTO "JoaoEnriquecimentoGrupo"(chave, nome, "candidataPrincipalId", "candidataIds", raizes, dominios, publico, ordem, etapas, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb, now(), now())
      ON CONFLICT (chave) DO UPDATE SET "candidataIds" = EXCLUDED."candidataIds", raizes = EXCLUDED.raizes, dominios = EXCLUDED.dominios, ordem = EXCLUDED.ordem,
        publico = CASE WHEN "JoaoEnriquecimentoGrupo".publico = 'PILOTO_20' THEN 'PILOTO_20' ELSE EXCLUDED.publico END, "updatedAt" = now()
      RETURNING (xmax = 0) novo`,
      [g.chave, g.nome, g.principal, g.candidataIds, g.raizes, dominios, publico, i, JSON.stringify({ agrupamento: { motivos: g.motivos } })]);
    if (r.rows[0]?.novo) novos++;
  }
  const multi = grupos.filter(g => g.candidataIds.length > 1);
  console.log(`[joao] fila preparada: ${cands.length} empresas em ${grupos.length} grupos (${novos} novos); grupos com mais de uma empresa: ${multi.length}`);
  for (const g of multi) console.log(`[joao]   grupo ${g.nome}: ${g.candidataIds.length} empresas — ${g.motivos.join("; ")}`);
  const pil = grupos.filter(g => g.candidataIds.some(id => piloto.has(id)));
  console.log(`[joao] piloto: ${piloto.size} empresas selecionadas → ${pil.length} grupos, ${pil.reduce((s, g) => s + g.candidataIds.length, 0)} empresas cobertas`);
}

// ------------------------------------------------------------------------------------------------ executar
type Etapas = Record<string, { feito?: boolean; [k: string]: unknown }>;
type G = { chave: string; nome: string; candidataPrincipalId: string; candidataIds: string[]; raizes: string[]; dominios: string[]; etapas: Etapas; tentativas: number };

const buscarJoao: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string> ?? {}), "User-Agent": USER_AGENT_JOAO } });

async function executar(db: Client) {
  const publico = arg("publico") ?? "PILOTO_20";
  const limite = Number(arg("limite") ?? 1000);
  const prazo = Date.now() + Number(arg("prazo-ms") ?? 140_000);
  const maxPaginas = Number(arg("max-paginas") ?? 6);
  const socios = lerSocios();
  const r = await db.query(`SELECT chave, nome, "candidataPrincipalId", "candidataIds", raizes, dominios, etapas, tentativas FROM "JoaoEnriquecimentoGrupo"
    WHERE publico = $1 AND (situacao IN ('AGUARDANDO','EM_ANDAMENTO') OR (situacao = 'ERRO' AND tentativas < 3)) ORDER BY ordem LIMIT $2`, [publico, limite]);
  console.log(`[joao] ${r.rows.length} grupos a processar (${publico})`);
  let feitos = 0;
  for (const g of r.rows as G[]) {
    if (Date.now() > prazo) { console.log("[joao] prazo atingido — retoma na próxima execução (checkpoint salvo)"); break; }
    await db.query(`UPDATE "JoaoEnriquecimentoGrupo" SET situacao = 'EM_ANDAMENTO', tentativas = tentativas + 1, "iniciadoEm" = coalesce("iniciadoEm", now()), "updatedAt" = now() WHERE chave = $1`, [g.chave]);
    try {
      const membros = (await db.query(`SELECT id, "cnpjBasico" raiz, "razaoSocial" razao, "nomeFantasia" fantasia, "statusValidacao"::text status FROM "ConcreteiraCandidata" WHERE id = ANY($1)`, [g.candidataIds])).rows;
      const tokens = tokensDistintivos(...membros.flatMap(m => [m.razao, m.fantasia]));
      if (!g.etapas.qsa?.feito) await etapaQsa(db, g, membros, socios);
      if (!g.etapas.receita?.feito) await etapaReceita(db, g, membros);
      if (!g.etapas.site?.feito) await etapaSite(db, g, membros, tokens, maxPaginas);
      await finalizar(db, g.chave);
      feitos++;
    } catch (e) {
      await db.query(`UPDATE "JoaoEnriquecimentoGrupo" SET situacao = 'ERRO', erro = $2, "updatedAt" = now() WHERE chave = $1`, [g.chave, (e as Error).message.slice(0, 400)]);
      console.log(`[joao] ERRO ${g.nome}: ${(e as Error).message.slice(0, 160)}`);
    }
  }
  console.log(`[joao] grupos concluídos nesta execução: ${feitos}`);
}

async function salvarEtapa(db: Client, chave: string, etapa: string, dados: Record<string, unknown>) {
  await db.query(`UPDATE "JoaoEnriquecimentoGrupo" SET etapas = etapas || jsonb_build_object($2::text, $3::jsonb), "updatedAt" = now() WHERE chave = $1`, [chave, etapa, JSON.stringify({ feito: true, em: new Date().toISOString(), ...dados })]);
}

async function nomesExistentes(db: Client, ids: string[]): Promise<Map<string, string>> {
  const r = await db.query(`SELECT id, coalesce("nomeNormalizado", upper(nome)) n, nome FROM "ConcreteiraCandidataPessoa" WHERE "candidataId" = ANY($1) AND ativo`, [ids]);
  return new Map(r.rows.map(x => [normalizarNome(x.nome), x.id]));
}

async function inserirPessoa(db: Client, p: { candidataId: string; grupoChave: string; nome: string; funcao: string; papel: string; fonte: string; fonteUrl: string; confianca: string; linkedinUrl?: string | null; observacao: string }) {
  const nn = normalizarNome(p.nome);
  const r = await db.query(`
    INSERT INTO "ConcreteiraCandidataPessoa"(id, "candidataId", nome, funcao, papeis, "linkedinUrl", fonte, "fonteUrl", situacao, observacao, ativo, confianca, "pesquisadoEm", agente, "grupoChave", "nomeNormalizado", "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4,ARRAY[$5]::"PapelPessoaCandidata"[],$6,$7::"TipoFonteEvidencia",$8,'NAO_VERIFICADO',$9,true,$10::"ConfiancaInformacao",now(),$11,$12,$13,now(),now())
    ON CONFLICT (id) DO NOTHING`,
    [`jp-${h(`${p.candidataId}|${nn}`)}`, p.candidataId, p.nome, p.funcao, p.papel, p.linkedinUrl ?? null, p.fonte, p.fonteUrl, p.observacao, p.confianca, AGENTE, p.grupoChave, nn]);
  return (r.rowCount ?? 0) > 0;
}

async function inserirContato(db: Client, c: { candidataId: string; unidadeId?: string | null; grupoChave: string; tipo: string; valor: string; normalizado: string; descricao: string; fonte: string; fonteUrl: string; confianca: string; observacao: string; pessoaId?: string | null }) {
  const ja = await db.query(`SELECT 1 FROM "ConcreteiraCandidataContato" WHERE "candidataId" = $1 AND tipo = $2::"TipoContatoCandidata" AND "valorNormalizado" = $3 LIMIT 1`, [c.candidataId, c.tipo, c.normalizado]);
  if (ja.rowCount) return false;
  await db.query(`
    INSERT INTO "ConcreteiraCandidataContato"(id, "candidataId", "unidadeId", tipo, valor, "valorNormalizado", descricao, situacao, fonte, "fonteUrl", ativo, confianca, "pesquisadoEm", agente, "grupoChave", "pessoaId", observacao, "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4::"TipoContatoCandidata",$5,$6,$7,'NAO_VERIFICADO',$8::"TipoFonteEvidencia",$9,true,$10::"ConfiancaInformacao",now(),$11,$12,$13,$14,now(),now())
    ON CONFLICT (id) DO NOTHING`,
    [`jk-${h(`${c.candidataId}|${c.tipo}|${c.normalizado}`)}`, c.candidataId, c.unidadeId ?? null, c.tipo, c.valor, c.normalizado, c.descricao, c.fonte, c.fonteUrl, c.confianca, AGENTE, c.grupoChave, c.pessoaId ?? null, c.observacao]);
  return true;
}

async function etapaQsa(db: Client, g: G, membros: Array<{ id: string; raiz: string }>, socios: Record<string, Socio[]>) {
  const existentes = await nomesExistentes(db, g.candidataIds);
  let novos = 0, ignorados = 0;
  for (const m of membros) {
    const lista = (socios[m.raiz] ?? []).filter(s => s.tipo !== "PJ" && QUALIFICACOES_DECISOR[s.qualificacaoCodigo] !== undefined)
      .sort((a, b) => QUALIFICACOES_DECISOR[a.qualificacaoCodigo] - QUALIFICACOES_DECISOR[b.qualificacaoCodigo]).slice(0, 8);
    await db.query(`INSERT INTO "JoaoEnriquecimentoCache"(chave, tipo, dados, "fonteUrl") VALUES ($1,'empresa-qsa',$2::jsonb,$3) ON CONFLICT (chave) DO NOTHING`,
      [`qsa:${m.raiz}`, JSON.stringify((socios[m.raiz] ?? []).map(s => ({ nome: s.nome, qualificacao: s.qualificacao, entrada: s.entrada, tipo: s.tipo }))), FONTE_QSA]);
    for (const s of lista) {
      const nn = normalizarNome(s.nome);
      if (existentes.has(nn)) { ignorados++; continue; }
      const c = classificarCargo(s.qualificacao);
      const ok = await inserirPessoa(db, { candidataId: m.id, grupoChave: g.chave, nome: nomeExibicao(s.nome), funcao: s.qualificacao, papel: c.papel, fonte: "RECEITA_FEDERAL", fonteUrl: FONTE_QSA, confianca: "ALTA",
        observacao: `QSA da Receita (CNPJ ${m.raiz}): ${s.qualificacao}${s.entrada ? ` desde ${s.entrada.split("-").reverse().join("/")}` : ""}. Cargo societário público; não traz telefone nem e-mail.` });
      if (ok) { novos++; existentes.set(nn, "novo"); }
    }
  }
  await salvarEtapa(db, g.chave, "qsa", { pessoas: novos, jaExistiam: ignorados });
}

async function etapaReceita(db: Client, g: G, membros: Array<{ id: string; raiz: string; razao: string; fantasia: string | null }>) {
  const uni = (await db.query(`SELECT u.id, u."candidataId", u.cnpj, u."isMatriz", u."municipioNome", u.uf, coalesce(r.ddd1 || r.telefone1, u.telefone) t1, r.ddd2 || r.telefone2 t2, coalesce(r.email, u.email) email
      FROM "ConcreteiraCandidataUnidade" u LEFT JOIN "ReceitaEstabelecimento" r ON r.cnpj = u.cnpj WHERE u."candidataId" = ANY($1) AND u.ativa ORDER BY u."isMatriz" DESC, u.cnpj LIMIT 40`, [g.candidataIds])).rows;
  const tokens = tokensDistintivos(...membros.flatMap(m => [m.razao, m.fantasia]));
  let novos = 0, compartilhados = 0, emailsDescartados = 0;
  for (const u of uni) {
    for (const t of [u.t1, u.t2]) {
      const n = normalizarTelefoneBR(t);
      if (!n) continue;
      // telefone usado por várias empresas diferentes no cadastro = provável escritório contábil → não registra
      const usos = (await db.query(`SELECT count(DISTINCT substr(cnpj,1,8))::int n FROM "ReceitaEstabelecimento" WHERE ddd1 || telefone1 = $1 OR ddd2 || telefone2 = $1`, [n])).rows[0].n as number;
      if (usos > 2) { compartilhados++; continue; }
      if (await inserirContato(db, { candidataId: u.candidataId, unidadeId: u.id, grupoChave: g.chave, tipo: "TELEFONE", valor: n, normalizado: n, descricao: `Telefone do cadastro CNPJ (${u.isMatriz ? "matriz" : "filial"} ${u.municipioNome ?? ""}/${u.uf ?? ""})`,
        fonte: "RECEITA_FEDERAL", fonteUrl: `https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp?cnpj=${u.cnpj}`, confianca: "MEDIA",
        observacao: "Telefone comercial informado à Receita. Pode ser antigo ou do escritório contábil; confirmar antes de usar." })) novos++;
    }
    const v = validarEmail(u.email, g.dominios);
    if (v.valido && v.normalizado && v.corporativo && (v.confereEmpresa || textoCitaEmpresa((v.dominio ?? "").replace(/\./g, " "), tokens))) {
      if (await inserirContato(db, { candidataId: u.candidataId, unidadeId: u.id, grupoChave: g.chave, tipo: "EMAIL", valor: v.normalizado, normalizado: v.normalizado, descricao: "E-mail corporativo do cadastro CNPJ",
        fonte: "RECEITA_FEDERAL", fonteUrl: `https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp?cnpj=${u.cnpj}`, confianca: "MEDIA", observacao: `Domínio validado: ${v.motivo}.` })) novos++;
    } else if (u.email) emailsDescartados++;
  }
  await salvarEtapa(db, g.chave, "receita", { contatos: novos, telefonesCompartilhadosIgnorados: compartilhados, emailsNaoCorporativosIgnorados: emailsDescartados });
}

async function lerComCache(db: Client, url: string): Promise<{ texto: string; links: Array<{ href: string; texto: string }>; titulo: string | null; erro: string | null; doCache: boolean; urlFinal: string }> {
  const c = await db.query(`SELECT dados, erro, "buscadoEm" FROM "JoaoEnriquecimentoCache" WHERE chave = $1`, [`pagina:${url}`]);
  if (c.rowCount && new Date(c.rows[0].buscadoEm).getTime() > Date.now() - DIAS_CACHE * 86_400_000) {
    const d = c.rows[0].dados ?? {};
    return { texto: d.texto ?? "", links: d.links ?? [], titulo: d.titulo ?? null, erro: c.rows[0].erro, doCache: true, urlFinal: d.urlFinal ?? url };
  }
  // página que o robô já viu bloqueada (robots/403) não é tentada de novo
  const rb = await db.query(`SELECT erro FROM "ConcreteiraRoboCache" WHERE url = $1 AND (NOT "permitidoRobots" OR erro LIKE 'acesso restrito%' OR erro LIKE '%CAPTCHA%') AND "buscadoEm" > now() - interval '30 days'`, [url]);
  if (rb.rowCount) return { texto: "", links: [], titulo: null, erro: `já bloqueada para o robô: ${rb.rows[0].erro}`, doCache: true, urlFinal: url };
  const p = await lerPagina(url, buscarJoao);
  const dados = { texto: (p.texto ?? "").slice(0, 80_000), links: p.links.slice(0, 300), titulo: p.titulo, urlFinal: p.urlFinal };
  await db.query(`INSERT INTO "JoaoEnriquecimentoCache"(chave, tipo, dados, "fonteUrl", erro, "buscadoEm") VALUES ($1,'pagina',$2::jsonb,$3,$4,now())
    ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados, erro = EXCLUDED.erro, "buscadoEm" = now()`, [`pagina:${url}`, JSON.stringify(dados), url, p.erro]);
  return { ...dados, erro: p.erro, doCache: false };
}

async function etapaSite(db: Client, g: G, membros: Array<{ id: string }>, tokens: string[], maxPaginas: number) {
  if (!g.dominios.length) { await salvarEtapa(db, g.chave, "site", { resultado: "não localizado: sem site próprio conhecido" }); return; }
  const alvo = g.candidataPrincipalId;
  const existentes = await nomesExistentes(db, g.candidataIds);
  let paginas = 0, doCache = 0, bloqueadas = 0, contatos = 0, pessoas = 0;
  const lidas: string[] = [];
  for (const dom of g.dominios.slice(0, 2)) {
    const fila = [`https://${dom}/`];
    const vistas = new Set<string>();
    while (fila.length && vistas.size < maxPaginas) {
      const url = fila.shift()!;
      if (vistas.has(url)) continue;
      vistas.add(url);
      const p = await lerComCache(db, url);
      if (p.doCache) doCache++; else paginas++;
      if (p.erro) {
        bloqueadas++;
        if (p.erro === "falha de conexão" && url === `https://${dom}/`) fila.push(`http://${dom}/`);
        continue;
      }
      lidas.push(url);
      if (vistas.size === 1 || url.endsWith(`${dom}/`)) { try { fila.push(...linksDeContato(new URL(p.urlFinal), p.links, maxPaginas - 1)); } catch { /* url inválida */ } }
      for (const a of extrairContatos(p.texto, p.links, g.dominios)) {
        let confianca = "ALTA", obs = "Publicado no site oficial da empresa.";
        if (a.tipo === "EMAIL") {
          if (!a.corporativo) { confianca = "MEDIA"; obs = "E-mail de provedor genérico, mas publicado no site oficial da empresa."; }
          else if (!a.confereEmpresa) { confianca = "BAIXA"; obs = "Domínio do e-mail diferente do site; pode ser de terceiro (agência/contador)."; }
          else obs = "E-mail corporativo: domínio confere com o site da empresa.";
        }
        const tipo = a.tipo === "LINKEDIN" ? "LINKEDIN" : a.tipo;
        if (await inserirContato(db, { candidataId: alvo, grupoChave: g.chave, tipo, valor: a.valor, normalizado: a.normalizado, descricao: `${tipo === "LINKEDIN" ? "Página da empresa no LinkedIn" : "Contato comercial"} (site oficial)`,
          fonte: "SITE_EMPRESA", fonteUrl: url, confianca, observacao: `${obs} Trecho: "${a.trecho.slice(0, 200)}"` })) contatos++;
      }
      const lpess = extrairLinkedinPessoas(p.links);
      for (const pc of extrairPessoasComCargo(p.texto)) {
        const nn = normalizarNome(pc.nome);
        if (existentes.has(nn)) continue;
        if (pc.prioridade > 7) continue;
        const c = classificarCargo(pc.cargo);
        const li = lpess.find(l => normalizarNome(l.texto).includes(nn) || nn.split(" ").every(t => l.url.toUpperCase().includes(t)))?.url ?? null;
        if (await inserirPessoa(db, { candidataId: alvo, grupoChave: g.chave, nome: pc.nome, funcao: pc.cargo, papel: c.papel, fonte: "SITE_EMPRESA", fonteUrl: url, confianca: "MEDIA", linkedinUrl: li,
          observacao: `Citado no site oficial com cargo. Trecho: "${pc.trecho.slice(0, 200)}"` })) { pessoas++; existentes.set(nn, "novo"); }
      }
    }
  }
  void membros; void tokens;
  await db.query(`INSERT INTO "JoaoEnriquecimentoConsumo"(id, "grupoChave", etapa, ferramenta, chamadas, "tokensEstimados", "custoUsd", pago) VALUES ($1,$2,'site','fetch (código, gratuito)',$3,0,0,false)`,
    [`jc-${h(`${g.chave}|site|${Date.now()}`)}`, g.chave, paginas]);
  await salvarEtapa(db, g.chave, "site", { paginasLidas: paginas, paginasDoCache: doCache, paginasBloqueadasOuComErro: bloqueadas, contatos, pessoas, urls: lidas.slice(0, 10),
    resultado: lidas.length ? undefined : "não localizado: site inacessível ou bloqueado (não contornado)" });
}

async function finalizar(db: Client, chave: string) {
  const r = (await db.query(`
    SELECT (SELECT count(*)::int FROM "ConcreteiraCandidataPessoa" WHERE "grupoChave" = $1 AND agente = $2 AND ativo) pessoas,
           (SELECT count(*)::int FROM "ConcreteiraCandidataContato" WHERE "grupoChave" = $1 AND agente = $2 AND ativo) contatos,
           (SELECT count(*)::int FROM "ConcreteiraCandidataContato" WHERE "grupoChave" = $1 AND agente = $2 AND ativo AND tipo = 'EMAIL' AND confianca = 'ALTA') emails_corp,
           (SELECT count(*)::int FROM "ConcreteiraCandidataContato" WHERE "grupoChave" = $1 AND agente = $2 AND ativo AND tipo = 'WHATSAPP') whats,
           (SELECT count(*)::int FROM "ConcreteiraCandidataContato" WHERE "grupoChave" = $1 AND agente = $2 AND ativo AND tipo = 'TELEFONE') tels,
           (SELECT count(*)::int FROM "ConcreteiraCandidataPessoa" WHERE "grupoChave" = $1 AND agente = $2 AND ativo AND "linkedinUrl" IS NOT NULL) linkedin`, [chave, AGENTE])).rows[0];
  const nl = (n: number, s: string) => `${s}: ${n || "não localizado"}`;
  const resultado = [nl(r.pessoas, "decisores"), nl(r.linkedin, "LinkedIn de decisor"), nl(r.tels, "telefone comercial"), nl(r.whats, "WhatsApp comercial"), nl(r.emails_corp, "e-mail corporativo")].join(" · ");
  const sit = r.pessoas + r.contatos > 0 ? "CONCLUIDO" : "NAO_LOCALIZADO";
  await db.query(`UPDATE "JoaoEnriquecimentoGrupo" SET situacao = $2::"SituacaoEnriquecimento", "decisoresEncontrados" = $3, "contatosEncontrados" = $4, resultado = $5, erro = NULL, "concluidoEm" = now(), "updatedAt" = now() WHERE chave = $1`,
    [chave, sit, r.pessoas, r.contatos, resultado]);
  const g = (await db.query(`SELECT "candidataIds" FROM "JoaoEnriquecimentoGrupo" WHERE chave = $1`, [chave])).rows[0];
  for (const id of g.candidataIds as string[]) {
    await db.query(`INSERT INTO "ConcreteiraValidacaoHistorico"(id, "candidataId", "tipoEvento", origem, agente, "statusAnterior", "statusNovo", campo, "valorNovo", motivo, "createdAt")
      SELECT $1, c.id, 'ENRIQUECIMENTO', 'JOAO_ENRIQUECIMENTO', $2, c."statusValidacao", c."statusValidacao", 'enriquecimento', $3, $4, now() FROM "ConcreteiraCandidata" c WHERE c.id = $5`,
      [`jh-${h(`${id}|${resultado}|${Date.now()}`)}`, AGENTE, sit, `Pesquisa de decisores (grupo ${chave}): ${resultado}. Nenhum contato foi feito.`, id]);
  }
  console.log(`[joao] ${chave} → ${sit} · ${resultado}`);
}

// ------------------------------------------------------------------------------------------------ importar-web
type AchadoWeb = { nome: string; cargo: string; linkedinUrl?: string | null; fonteUrl: string; trecho: string; candidataId?: string; confianca?: "ALTA" | "MEDIA" | "BAIXA" };
type EntradaWeb = { grupoChave: string; consultas: string[]; tokensEstimados?: number; achados: AchadoWeb[] };

async function importarWeb(db: Client, arquivo: string) {
  const entradas = JSON.parse(readFileSync(arquivo, "utf8")) as EntradaWeb[];
  let aceitos = 0, rejeitados = 0, atualizados = 0;
  for (const e of entradas) {
    const g = (await db.query(`SELECT chave, "candidataPrincipalId", "candidataIds", etapas FROM "JoaoEnriquecimentoGrupo" WHERE chave = $1`, [e.grupoChave])).rows[0];
    if (!g) { console.log(`[joao] grupo inexistente: ${e.grupoChave}`); continue; }
    if (g.etapas?.web?.feito) { console.log(`[joao] ${e.grupoChave}: pesquisa web já registrada — não repete`); continue; }
    const membros = (await db.query(`SELECT id, "razaoSocial" razao, "nomeFantasia" fantasia FROM "ConcreteiraCandidata" WHERE id = ANY($1)`, [g.candidataIds])).rows;
    const tokens = tokensDistintivos(...membros.flatMap(m => [m.razao, m.fantasia]));
    const existentes = (await db.query(`SELECT id, nome, "linkedinUrl" FROM "ConcreteiraCandidataPessoa" WHERE "candidataId" = ANY($1) AND ativo`, [g.candidataIds])).rows;
    const motivos: string[] = [];
    let ac = 0;
    for (const a of e.achados) {
      const li = a.linkedinUrl ? normalizarLinkedinPessoa(a.linkedinUrl) : null;
      if (!/^https:\/\//.test(a.fonteUrl ?? "")) { rejeitados++; motivos.push(`${a.nome}: sem URL de fonte`); continue; }
      if (!nomePessoaPlausivel(a.nome)) { rejeitados++; motivos.push(`${a.nome}: nome não plausível`); continue; }
      if (!textoCitaEmpresa(`${a.trecho} ${a.cargo}`, tokens)) { rejeitados++; motivos.push(`${a.nome}: trecho não cita a empresa (risco de homônimo)`); continue; }
      const c = classificarCargo(a.cargo);
      const nn = normalizarNome(a.nome);
      // 12/10/2026: perfil com nome abreviado ("Marcelo Novais") de alguém já registrado pelo QSA ("Marcelo Gonzales Novais"):
      // mesmo primeiro e último nome + perfil cita a empresa → acrescenta o LinkedIn à pessoa existente (nunca cria outra).
      const pu = (x: string) => { const t = normalizarNome(x).split(" "); return `${t[0]}|${t[t.length - 1]}`; };
      const compat = existentes.filter(x => normalizarNome(x.nome) !== nn && pu(x.nome) === pu(a.nome));
      if (!existentes.some(x => normalizarNome(x.nome) === nn) && compat.length === 1 && li && !compat[0].linkedinUrl) {
        await db.query(`UPDATE "ConcreteiraCandidataPessoa" SET "linkedinUrl" = $2, observacao = concat_ws(' | ', observacao, $3::text), "updatedAt" = now() WHERE id = $1`,
          [compat[0].id, li, `LinkedIn provável (${new Date().toISOString().slice(0, 10)}): perfil "${a.nome}" cita a empresa; mesmo primeiro e último nome — confirmar. Fonte: ${a.fonteUrl}`]);
        atualizados++; ac++; continue;
      }
      if (c.prioridade > 7) { rejeitados++; motivos.push(`${a.nome}: cargo fora do público (${a.cargo || "sem cargo no perfil"})`); continue; }
      const igual = existentes.find(x => normalizarNome(x.nome) === nn);
      if (igual) {
        if (li && !igual.linkedinUrl) {
          await db.query(`UPDATE "ConcreteiraCandidataPessoa" SET "linkedinUrl" = $2, observacao = concat_ws(' | ', observacao, $3::text), "updatedAt" = now() WHERE id = $1`,
            [igual.id, li, `LinkedIn (${new Date().toISOString().slice(0, 10)}): ${a.cargo} — ${a.trecho.slice(0, 160)}`]);
          atualizados++; ac++;
        }
        continue;
      }
      const ok = await inserirPessoa(db, { candidataId: a.candidataId && g.candidataIds.includes(a.candidataId) ? a.candidataId : g.candidataPrincipalId, grupoChave: g.chave, nome: a.nome, funcao: a.cargo, papel: c.papel,
        fonte: li ? "LINKEDIN" : "OUTRA", fonteUrl: a.fonteUrl, confianca: a.confianca ?? "MEDIA", linkedinUrl: li, observacao: `Pesquisa pública: "${a.trecho.slice(0, 220)}"` });
      if (ok) { aceitos++; ac++; existentes.push({ id: "novo", nome: a.nome, linkedinUrl: li }); }
    }
    for (const q of e.consultas) {
      await db.query(`INSERT INTO "JoaoEnriquecimentoCache"(chave, tipo, dados, "buscadoEm") VALUES ($1,'busca',$2::jsonb,now()) ON CONFLICT (chave) DO NOTHING`,
        [`busca:${normalizarNome(q)}`, JSON.stringify({ grupoChave: g.chave, consulta: q, achados: e.achados.length })]);
    }
    await db.query(`INSERT INTO "JoaoEnriquecimentoConsumo"(id, "grupoChave", etapa, ferramenta, chamadas, "tokensEstimados", "custoUsd", pago) VALUES ($1,$2,'web','pesquisa pública via Claude (sem API paga)',$3,$4,0,false)`,
      [`jc-${h(`${g.chave}|web`)}`, g.chave, e.consultas.length, e.tokensEstimados ?? 0]);
    await salvarEtapa(db, g.chave, "web", { consultas: e.consultas.length, aceitos: ac, rejeitados: motivos, resultado: ac ? undefined : "não localizado na pesquisa pública" });
    await finalizar(db, g.chave);
  }
  console.log(`[joao] web: ${aceitos} pessoas novas, ${atualizados} LinkedIn acrescentados a pessoas já registradas, ${rejeitados} achados rejeitados`);
}

// ------------------------------------------------------------------------------------------------ relatório
async function relatorio(db: Client, publico: string) {
  const r = (await db.query(`
    SELECT count(*)::int grupos, sum(cardinality("candidataIds"))::int empresas,
           count(*) FILTER (WHERE situacao = 'CONCLUIDO')::int concluidos, count(*) FILTER (WHERE situacao = 'NAO_LOCALIZADO')::int nao_localizados,
           count(*) FILTER (WHERE situacao IN ('AGUARDANDO','EM_ANDAMENTO','ERRO'))::int pendentes,
           count(*) FILTER (WHERE "decisoresEncontrados" > 0)::int com_decisor
      FROM "JoaoEnriquecimentoGrupo" WHERE publico = $1`, [publico])).rows[0];
  const p = (await db.query(`
    SELECT fonte::text, count(*)::int n, count(*) FILTER (WHERE "linkedinUrl" IS NOT NULL)::int li FROM "ConcreteiraCandidataPessoa" p
      JOIN "JoaoEnriquecimentoGrupo" g ON g.chave = p."grupoChave" WHERE g.publico = $1 AND p.agente = $2 GROUP BY 1`, [publico, AGENTE])).rows;
  const k = (await db.query(`
    SELECT k.tipo::text, k.fonte::text, k.confianca::text, count(*)::int n FROM "ConcreteiraCandidataContato" k
      JOIN "JoaoEnriquecimentoGrupo" g ON g.chave = k."grupoChave" WHERE g.publico = $1 AND k.agente = $2 GROUP BY 1,2,3 ORDER BY 1,2,3`, [publico, AGENTE])).rows;
  const c = (await db.query(`SELECT ferramenta, sum(chamadas)::int chamadas, sum("tokensEstimados")::int tokens, sum("custoUsd")::float custo, bool_or(pago) pago
      FROM "JoaoEnriquecimentoConsumo" k JOIN "JoaoEnriquecimentoGrupo" g ON g.chave = k."grupoChave" WHERE g.publico = $1 GROUP BY 1`, [publico])).rows;
  console.log(`[joao] RELATORIO ${JSON.stringify({ publico, ...r, pessoasPorFonte: p, contatos: k, consumo: c })}`);
}

main().catch(e => { console.error("[joao] ERRO", e instanceof Error ? e.message : e); process.exit(1); });
