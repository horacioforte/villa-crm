// ARQUIVO: scripts/base-nacional/demo-dados-branch.ts
// REGRA: nunca remover. Apenas acrescentar.
// DADOS DE DEMONSTRAÇÃO da Base Nacional de Concreteiras — SOMENTE no branch Neon
// "base-nacional-concreteiras" (endpoint ep-gentle-king-ajo60u4q). Recusa qualquer outro.
//
// - Nomes claramente fictícios ("DEMO — ... Fictícia").
// - CNPJs com dígito verificador propositalmente INVÁLIDO (não correspondem a empresas reais).
// - Grava apenas nas tabelas novas; todo id começa com "demo-bn-".
// - Empresas do CRM são apenas REFERENCIADAS (vínculo/sugestão), nunca alteradas.
//
// Uso:
//   npx tsx scripts/base-nacional/demo-dados-branch.ts              → dry-run (só mostra)
//   npx tsx scripts/base-nacional/demo-dados-branch.ts --commit     → cria os dados
//   npx tsx scripts/base-nacional/demo-dados-branch.ts --remover    → apaga TODOS os dados demo-bn-*
//   npx tsx scripts/base-nacional/demo-dados-branch.ts --remover --simular → testa a remoção e desfaz (ROLLBACK)
//
// v4 (05/10/2026): Confirmadas completas (responsável, data, confiança, justificativa), prioridade,
// potencial por equipamento (geral e por central), contatos (um inativado), pessoas e histórico detalhado.
// Contatos e pessoas são FICTÍCIOS: telefones com número iniciado em 0000 e domínios ".invalid".
// O responsável pela validação é apenas REFERENCIADO (primeiro ADMIN ativo); Usuario não é alterado.

import { createHash } from "node:crypto";
import { Client } from "pg";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { chaveOrdenacao, normalizarContato, normalizarEmail, normalizarTelefone } from "../../lib/base-nacional/contatos";

export const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";
const P = "demo-bn-";

// ─── CNPJ fictício com DV inválido ───────────────────────────────────────────
function dvCorreto(base12: string): string {
  const calc = (b: string, pesos: number[]) => {
    const r = b.split("").reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${d1}${d2}`;
}
export function cnpjFicticio(raiz: string, ordem: number): string {
  const base = raiz + String(ordem).padStart(4, "0");
  const dv = dvCorreto(base);
  const invalido = `${dv[0]}${(Number(dv[1]) + 1) % 10}`; // altera o 2º DV → CNPJ inválido
  return base + invalido;
}
const md5 = (s: string) => createHash("md5").update(s).digest("hex");

// ─── Dados ────────────────────────────────────────────────────────────────────
type Unid = { ordem: number; cidade: string; uf: string; ibge: string; tipo: string; logradouro: string; situacao?: string; so09?: boolean; logradouro08?: string };
type Cand = {
  slug: string; raiz: string; razao: string; fantasia: string; status: string; tipo: string | null; conf: string | null;
  porte: string; capital: number; unidades: Unid[]; vinculo?: "empresa" | "sugestao"; evid?: Array<[string, string, string]>;
  hist?: Array<[string | null, string, string | null, string]>;
};

const DET: Cand[] = [
  { slug: "alfa", raiz: "90000001", razao: "DEMO — CONCRETEIRA FICTÍCIA ALFA LTDA", fantasia: "Alfa Concreto (DEMO)", status: "CONFIRMADA", tipo: "CONCRETO_USINADO", conf: "ALTA", porte: "05", capital: 2500000, vinculo: "empresa",
    unidades: [
      { ordem: 1, cidade: "Recife", uf: "PE", ibge: "2611606", tipo: "ESCRITORIO", logradouro: "Rua Fictícia das Demonstrações, 100" },
      { ordem: 2, cidade: "Caruaru", uf: "PE", ibge: "2604106", tipo: "CENTRAL_CONCRETO", logradouro: "Rodovia Demo BR-000, km 10", logradouro08: "Rua Antiga Demo, 5" },
      { ordem: 3, cidade: "Petrolina", uf: "PE", ibge: "2611101", tipo: "CENTRAL_CONCRETO", logradouro: "Av. Exemplo, 2000" },
      { ordem: 4, cidade: "Jaboatão dos Guararapes", uf: "PE", ibge: "2607901", tipo: "CENTRAL_CONCRETO", logradouro: "Estrada Teste, 77", so09: true },
    ],
    evid: [["SITE_EMPRESA", "Site informa 3 centrais dosadoras", "Atendemos com centrais em Caruaru, Petrolina e Jaboatão (texto fictício)."],
      ["GOOGLE_MAPS", "Central em Caruaru localizada no mapa", "Pin fictício com fotos de caminhões betoneira."],
      ["VAGA_EMPREGO", "Vaga para motorista de betoneira", "Anúncio fictício de vaga em Jaboatão."]],
    hist: [[null, "PENDENTE", null, "Entrada pela Receita (demo)"], ["PENDENTE", "EM_VERIFICACAO", "BAIXA", "Início da verificação (demo)"],
      ["EM_VERIFICACAO", "PROVAVEL", "MEDIA", "Site confirma concreto usinado (demo)"], ["PROVAVEL", "CONFIRMADA", "ALTA", "Três fontes independentes (demo)"]] },
  { slug: "beta", raiz: "90000002", razao: "DEMO — BETA CONCRETOS FICTÍCIOS LTDA", fantasia: "Beta Mix (DEMO)", status: "PROVAVEL", tipo: "CONCRETO_USINADO", conf: "MEDIA", porte: "03", capital: 800000, vinculo: "sugestao",
    unidades: [
      { ordem: 1, cidade: "Salvador", uf: "BA", ibge: "2927408", tipo: "CENTRAL_CONCRETO", logradouro: "Av. Demonstração, 10" },
      { ordem: 2, cidade: "Feira de Santana", uf: "BA", ibge: "2910800", tipo: "CENTRAL_CONCRETO", logradouro: "Rua Exemplo, 300" },
    ],
    evid: [["RECEITA_FEDERAL", "CNAE 2330-3/05 como principal", "Registro fictício."], ["REDE_SOCIAL", "Fotos de bomba-lança", "Perfil fictício."]],
    hist: [[null, "PENDENTE", null, "Entrada pela Receita (demo)"], ["PENDENTE", "PROVAVEL", "MEDIA", "CNAE principal + fotos (demo)"]] },
  { slug: "gama", raiz: "90000003", razao: "DEMO — GAMA ENGENHARIA DE CONCRETO FICTÍCIA S.A.", fantasia: "Gama Concreto (DEMO)", status: "EM_VERIFICACAO", tipo: "DUVIDOSO", conf: "BAIXA", porte: "05", capital: 5000000,
    unidades: [{ ordem: 1, cidade: "Campinas", uf: "SP", ibge: "3509502", tipo: "DESCONHECIDA", logradouro: "Rua dos Testes, 45" }],
    evid: [["NOTICIA", "Notícia fictícia sobre nova planta", "Texto fictício."]], hist: [[null, "PENDENTE", null, "Entrada (demo)"], ["PENDENTE", "EM_VERIFICACAO", "BAIXA", "Aguardando confirmação (demo)"]] },
  { slug: "delta", raiz: "90000004", razao: "DEMO — DELTA ARGAMASSA E CONCRETO FICTÍCIOS LTDA", fantasia: "Delta (DEMO)", status: "PENDENTE", tipo: null, conf: null, porte: "01", capital: 50000,
    unidades: [{ ordem: 1, cidade: "Belo Horizonte", uf: "MG", ibge: "3106200", tipo: "DESCONHECIDA", logradouro: "Av. Exemplo, 1" }] },
  { slug: "epsilon", raiz: "90000005", razao: "DEMO — ÉPSILON ARGAMASSAS FICTÍCIAS LTDA", fantasia: "Épsilon Argamassas (DEMO)", status: "NAO_E_CONCRETEIRA", tipo: "ARGAMASSA", conf: "ALTA", porte: "03", capital: 300000,
    unidades: [{ ordem: 1, cidade: "Curitiba", uf: "PR", ibge: "4106902", tipo: "FABRICA", logradouro: "Rua Demo, 900" }],
    evid: [["SITE_EMPRESA", "Site vende apenas argamassa ensacada", "Texto fictício."]], hist: [[null, "PENDENTE", null, "Entrada (demo)"], ["PENDENTE", "NAO_E_CONCRETEIRA", "ALTA", "Somente argamassa (demo)"]] },
  { slug: "zeta", raiz: "90000006", razao: "DEMO — ZETA CONCRETAGEM FICTÍCIA EIRELI", fantasia: "Zeta (DEMO)", status: "INATIVA", tipo: "CONCRETO_USINADO", conf: "MEDIA", porte: "01", capital: 100000,
    unidades: [{ ordem: 1, cidade: "Goiânia", uf: "GO", ibge: "5208707", tipo: "CENTRAL_CONCRETO", logradouro: "Rua Exemplo, 12", situacao: "08" }],
    hist: [[null, "PENDENTE", null, "Entrada (demo)"], ["PENDENTE", "INATIVA", "MEDIA", "Baixada na Receita (demo)"]] },
  { slug: "eta", raiz: "90000007", razao: "DEMO — ETA SERVIÇOS DE CONCRETO FICTÍCIOS LTDA", fantasia: "Eta Concretos (DEMO)", status: "NAO_LOCALIZADA", tipo: "DUVIDOSO", conf: "BAIXA", porte: "01", capital: 20000,
    unidades: [{ ordem: 1, cidade: "Fortaleza", uf: "CE", ibge: "2304400", tipo: "DESCONHECIDA", logradouro: "Rua Inexistente Demo, s/n" }] },
  { slug: "teta", raiz: "90000008", razao: "DEMO — TETA USINAGEM DE CONCRETO FICTÍCIA LTDA", fantasia: "Teta Usinados (DEMO)", status: "CONFIRMADA", tipo: "CONCRETO_USINADO", conf: "MEDIA", porte: "05", capital: 1200000,
    unidades: [{ ordem: 1, cidade: "Porto Alegre", uf: "RS", ibge: "4314902", tipo: "CENTRAL_CONCRETO", logradouro: "Av. Demo Sul, 400" }],
    evid: [["LICENCA_AMBIENTAL", "Licença de central dosadora (fictícia)", "Publicação fictícia."]], hist: [[null, "PENDENTE", null, "Entrada (demo)"], ["PENDENTE", "CONFIRMADA", "MEDIA", "Licença + site (demo)"]] },
  { slug: "iota", raiz: "90000009", razao: "DEMO — IOTA CONCRETO DA AMAZÔNIA FICTÍCIO LTDA", fantasia: "Iota (DEMO)", status: "PENDENTE", tipo: null, conf: null, porte: "03", capital: 400000,
    unidades: [{ ordem: 1, cidade: "Manaus", uf: "AM", ibge: "1302603", tipo: "DESCONHECIDA", logradouro: "Rua Exemplo Norte, 8" }] },
  { slug: "kappa", raiz: "90000010", razao: "DEMO — KAPPA PRÉ-MOLDADOS FICTÍCIOS LTDA", fantasia: "Kappa Pré-Moldados (DEMO)", status: "PROVAVEL", tipo: "PRE_MOLDADO", conf: "MEDIA", porte: "03", capital: 600000,
    unidades: [{ ordem: 1, cidade: "João Pessoa", uf: "PB", ibge: "2507507", tipo: "FABRICA", logradouro: "Distrito Industrial Demo, 3" }],
    evid: [["SITE_EMPRESA", "Fábrica de pré-moldados com central própria", "Texto fictício."]] },
  { slug: "lambda", raiz: "90000011", razao: "DEMO — LAMBDA BOMBEAMENTO FICTÍCIO LTDA", fantasia: "Lambda Bombas (DEMO)", status: "EM_VERIFICACAO", tipo: "BOMBEAMENTO", conf: "BAIXA", porte: "01", capital: 150000,
    unidades: [{ ordem: 1, cidade: "Natal", uf: "RN", ibge: "2408102", tipo: "DEPOSITO", logradouro: "Rua Demo, 55" }] },
  { slug: "mu", raiz: "90000012", razao: "DEMO — MU CONCRETOS FICTÍCIOS LTDA", fantasia: "Mu Concretos (DEMO)", status: "PENDENTE", tipo: null, conf: null, porte: "01", capital: 30000,
    unidades: [{ ordem: 1, cidade: "São Luís", uf: "MA", ibge: "2111300", tipo: "DESCONHECIDA", logradouro: "Av. Exemplo, 77" }] },
];

const EXTRA_UFS: Array<[string, string, string]> = [
  ["PE", "Olinda", "2609600"], ["BA", "Camaçari", "2905701"], ["SP", "Sorocaba", "3552205"], ["MG", "Uberlândia", "3170206"],
  ["PR", "Londrina", "4113700"], ["SC", "Joinville", "4209102"], ["GO", "Anápolis", "5201108"], ["CE", "Sobral", "2312908"],
];
const EXTRA_STATUS = ["PENDENTE", "PENDENTE", "EM_VERIFICACAO", "PROVAVEL", "CONFIRMADA", "NAO_E_CONCRETEIRA"];
const EXTRA_CONF = [null, "BAIXA", "MEDIA", "ALTA"];

function gerarExtras(): Cand[] {
  const out: Cand[] = [];
  for (let n = 13; n <= 60; n++) {
    const [uf, cidade, ibge] = EXTRA_UFS[n % EXTRA_UFS.length];
    out.push({
      slug: `n${n}`, raiz: `900000${String(n).padStart(2, "0")}`, razao: `DEMO — CONCRETEIRA FICTÍCIA Nº ${n} LTDA`, fantasia: `Fictícia ${n} (DEMO)`,
      status: EXTRA_STATUS[n % EXTRA_STATUS.length], tipo: n % 3 === 0 ? "CONCRETO_USINADO" : null, conf: EXTRA_CONF[n % EXTRA_CONF.length],
      porte: n % 2 ? "01" : "03", capital: 10000 * n,
      unidades: [{ ordem: 1, cidade, uf, ibge, tipo: n % 4 === 0 ? "CENTRAL_CONCRETO" : "DESCONHECIDA", logradouro: `Rua Fictícia ${n}, ${n * 10}` }],
    });
  }
  return out;
}

// ─── v4: qualificação, contatos, pessoas e potenciais (fictícios) ────────────
type Pot = { eq: string; venda: string; loc: string; qtd?: number; unidade?: number; obs?: string; descr?: string };
type Ct = { tipo: string; valor: string; descr?: string; principal?: boolean; verificado?: boolean; unidade?: number; inativo?: string };
type Ps = { nome: string; funcao: string; papeis: string[]; tel?: string; zap?: string; email?: string; verificado?: boolean; inativo?: string };
type V4 = { prioridade?: string; obsComercial?: string; pot?: Pot[]; ct?: Ct[]; ps?: Ps[]; vincularEmpresaTeste?: boolean };

export const DADOS_V4: Record<string, V4> = {
  alfa: {
    prioridade: "ALTA", obsComercial: "Frota de bombas com mais de 10 anos (fictício). Possível renovação em 2027.",
    pot: [
      { eq: "BOMBA_LANCA", venda: "ALTO", loc: "MEDIO", qtd: 3, obs: "3 bombas-lança antigas (demo)" },
      { eq: "CAMINHAO_BETONEIRA", venda: "MEDIO", loc: "BAIXO", qtd: 12 },
      { eq: "PECAS_ACESSORIOS", venda: "MEDIO", loc: "NENHUM" },
      { eq: "BOMBA_ESTACIONARIA", venda: "ALTO", loc: "BAIXO", qtd: 1, unidade: 2, obs: "Central de Caruaru sem bomba estacionária (demo)" },
      { eq: "CENTRAL_CONCRETO", venda: "BAIXO", loc: "NENHUM", unidade: 4 },
    ],
    ct: [
      { tipo: "TELEFONE", valor: "(81) 0000-0101", descr: "Recepção (fictício)", principal: true, verificado: true },
      { tipo: "WHATSAPP", valor: "(81) 90000-0102", descr: "Comercial (fictício)" },
      { tipo: "EMAIL", valor: "comercial@alfa-concreto-demo.invalid", descr: "Comercial (fictício)", verificado: true },
      { tipo: "SITE", valor: "https://alfa-concreto-demo.invalid" },
      { tipo: "TELEFONE", valor: "(87) 0000-0103", descr: "Central Petrolina (fictício)", unidade: 3 },
      { tipo: "TELEFONE", valor: "(81) 0000-0199", descr: "Número antigo (fictício)", inativo: "Número desativado segundo a recepção (demo)" },
    ],
    ps: [
      { nome: "Pessoa Fictícia Alfa Um (DEMO)", funcao: "Sócio-diretor", papeis: ["PROPRIETARIO_SOCIO", "ADMINISTRADOR"], email: "socio@alfa-concreto-demo.invalid", verificado: true },
      { nome: "Pessoa Fictícia Alfa Dois (DEMO)", funcao: "Gerente de frota", papeis: ["RESPONSAVEL_FROTA", "RESPONSAVEL_EQUIPAMENTOS"], zap: "(81) 90000-0201" },
      { nome: "Pessoa Fictícia Alfa Três (DEMO)", funcao: "Comprador", papeis: ["COMPRADOR"], tel: "(81) 0000-0202", inativo: "Saiu da empresa (demo)" },
    ],
    vincularEmpresaTeste: true,
  },
  beta: {
    prioridade: "ALTA", obsComercial: "Usa bomba-lança terceirizada (fictício).",
    pot: [{ eq: "BOMBA_LANCA", venda: "ALTO", loc: "ALTO", qtd: 2 }, { eq: "TELEBELT", venda: "BAIXO", loc: "MEDIO" }],
    ct: [{ tipo: "TELEFONE", valor: "(71) 0000-0301", principal: true }, { tipo: "INSTAGRAM", valor: "https://instagram.invalid/betamix-demo" }],
    ps: [{ nome: "Pessoa Fictícia Beta (DEMO)", funcao: "Responsável de manutenção", papeis: ["RESPONSAVEL_MANUTENCAO"], tel: "(71) 0000-0302" }],
  },
  teta: {
    prioridade: "MEDIA",
    pot: [{ eq: "CAMINHAO_BETONEIRA", venda: "ALTO", loc: "MEDIO", qtd: 8 }, { eq: "BOMBA_LANCA", venda: "MEDIO", loc: "BAIXO", qtd: 1 }],
    ct: [{ tipo: "EMAIL", valor: "contato@teta-demo.invalid", principal: true }],
    vincularEmpresaTeste: true, // decisão 1: a mesma Empresa ligada a mais de uma candidata
  },
  gama: { prioridade: "BAIXA", pot: [{ eq: "OUTRO", venda: "BAIXO", loc: "NENHUM", descr: "Formas metálicas (demo)" }] },
  kappa: { prioridade: "MEDIA", pot: [{ eq: "CENTRAL_CONCRETO", venda: "MEDIO", loc: "NENHUM", qtd: 1 }] },
  lambda: { prioridade: "MEDIA", pot: [{ eq: "BOMBA_LANCA", venda: "ALTO", loc: "ALTO", qtd: 4 }, { eq: "BOMBA_ESTACIONARIA", venda: "MEDIO", loc: "MEDIO", qtd: 2 }] },
};
for (let n = 13; n <= 60; n += 7) {
  DADOS_V4[`n${n}`] = {
    prioridade: ["ALTA", "MEDIA", "BAIXA", "NAO_PRIORITARIA"][n % 4],
    pot: [{ eq: ["BOMBA_LANCA", "CAMINHAO_BETONEIRA", "BOMBA_ESTACIONARIA"][n % 3], venda: ["ALTO", "MEDIO", "BAIXO"][n % 3], loc: "DESCONHECIDO", qtd: (n % 5) + 1 }],
  };
}

// ─── Execução ────────────────────────────────────────────────────────────────
async function main() {
  const modo = process.argv.includes("--remover") ? "remover" : process.argv.includes("--commit") ? "commit" : "dry-run";
  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) {
    throw new Error(`[demo] BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado. Nada foi feito.`);
  }
  console.log(`[demo] branch autorizado confirmado (${amb.endpointMascarado}) — modo ${modo}`);
  const todas = [...DET, ...gerarExtras()];
  if (modo === "dry-run") {
    console.log(`[demo] criaria ${todas.length} candidatas, ${todas.reduce((a, c) => a + c.unidades.length, 0)} unidades, 2 competências.`);
    return;
  }

  const c = new Client({ connectionString: amb.url });
  await c.connect();
  try {
    await c.query("BEGIN");
    if (modo === "remover") {
      const desde = (await c.query(`SELECT min("createdAt") m FROM "ConcreteiraCandidata" WHERE id LIKE $1`, [`${P}%`])).rows[0].m as Date | null;
      // Filhos das candidatas demo (inclusive os criados pela tela durante testes, que têm outro prefixo de id).
      const filhos = ["ConcreteiraPotencialEquipamento", "ConcreteiraCandidataContato", "ConcreteiraCandidataPessoa", "ConcreteiraValidacaoHistorico", "ConcreteiraEvidencia"];
      for (const t of filhos) {
        const r = await c.query(`DELETE FROM "${t}" WHERE id LIKE $1 OR "candidataId" LIKE $1`, [`${P}%`]);
        console.log(`[demo] ${t}: ${r.rowCount} removidos`);
      }
      const tabelas = ["EmpresaUnidade", "ConcreteiraCandidataUnidade", "ConcreteiraCandidata", "ReceitaMudanca", "ReceitaEstabelecimento", "ReceitaCompetencia"];
      for (const t of tabelas) {
        const r = await c.query(`DELETE FROM "${t}" WHERE id LIKE $1`, [`${P}%`]);
        console.log(`[demo] ${t}: ${r.rowCount} removidos`);
      }
      if (desde) {
        const r = await c.query(`DELETE FROM "RelatorioConcreteirasGerado" WHERE "geradoEm" >= $1`, [desde]);
        console.log(`[demo] RelatorioConcreteirasGerado (gerados durante a demonstração): ${r.rowCount} removidos`);
      }
      if (process.argv.includes("--simular")) {
        await c.query("ROLLBACK");
        console.log("[demo] --simular: remoção testada e DESFEITA (ROLLBACK). Nada foi apagado.");
        return;
      }
      await c.query("COMMIT");
      return;
    }

    const ja = (await c.query(`SELECT count(*)::int n FROM "ConcreteiraCandidata" WHERE id LIKE $1`, [`${P}%`])).rows[0].n;
    if (ja > 0) throw new Error(`[demo] já existem ${ja} candidatas demo. Rode --remover antes de recriar.`);

    // Empresas do CRM apenas referenciadas (registros de teste já existentes); nada nelas é alterado.
    const empTeste = (await c.query(`SELECT id FROM "Empresa" WHERE "razaoSocial" = 'Villa Teste' ORDER BY "criadoEm" LIMIT 1`)).rows[0]?.id ?? null;
    const empSug = (await c.query(`SELECT id FROM "Empresa" WHERE "razaoSocial" = 'Teste Betoneira' LIMIT 1`)).rows[0]?.id ?? null;
    // Responsável fictício das validações: apenas referência ao primeiro ADMIN ativo (somente leitura).
    const validador = (await c.query(`SELECT id FROM "Usuario" WHERE papel = 'ADMIN' AND ativo = true ORDER BY nome, id LIMIT 1`)).rows[0]?.id as string | undefined;
    if (!validador) throw new Error("[demo] nenhum usuário ADMIN ativo para referenciar como responsável das validações.");

    const comps: Array<[string, string]> = [[`${P}comp-2026-08`, "2026-08"], [`${P}comp-2026-09`, "2026-09"]];
    for (const [id, comp] of comps) {
      await c.query(
        `INSERT INTO "ReceitaCompetencia"(id, competencia, "fonteUrl", "coletadoEm", status, "cnaesFiltro", "ufsFiltro", "totalRegistros", observacoes, "updatedAt")
         VALUES ($1,$2,'demonstracao://sem-fonte-real', now(), 'CONCLUIDA', '{2330305}', '{}', 0, 'DADOS DE DEMONSTRAÇÃO — não são dados da Receita', now())`,
        [id, comp]);
    }

    let nEst = 0;
    for (const cand of todas) {
      const matriz = cnpjFicticio(cand.raiz, 1);
      const m = cand.unidades.find(u => u.ordem === 1)!;
      const ativas = cand.unidades.filter(u => (u.situacao ?? "02") === "02").length;
      const v4 = DADOS_V4[cand.slug] ?? {};
      const vinculo = (cand.vinculo === "empresa" || v4.vincularEmpresaTeste) && empTeste;
      const confirmada = cand.status === "CONFIRMADA";
      const conf = confirmada ? (cand.conf ?? "MEDIA") : cand.conf;
      const sugestao = cand.vinculo === "sugestao" && empSug;
      const verif = cand.status === "PENDENTE" ? null : new Date(Date.now() - (cand.raiz.charCodeAt(7) % 20) * 86400000);
      await c.query(
        `INSERT INTO "ConcreteiraCandidata"(id,"cnpjBasico","cnpjMatriz","razaoSocial","nomeFantasia","naturezaJuridica",porte,"capitalSocial","ufMatriz","municipioMatriz",
          "totalUnidades","totalUnidadesAtivas","statusValidacao","tipoAtividade",confianca,justificativa,"empresaId","vinculadoEm","empresaSugeridaId","criterioSugestao",
          "primeiraVerificacaoEm","ultimaVerificacaoEm","primeiraCompetencia","ultimaCompetencia",observacoes,"updatedAt",
          "validadoPorId","validadoEm","nomeOrdenacao","prioridadeComercial","observacaoComercial","qualificadoEm","qualificadoPorId","vinculadoPorId")
         VALUES ($1,$2,$3,$4,$5,'206-2 (demo)',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$20,'2026-08','2026-09','DADOS DE DEMONSTRAÇÃO',now(),
          $21,$22,$23,$24,$25,$26,$27,$28)`,
        [`${P}${cand.slug}`, cand.raiz, matriz, cand.razao, cand.fantasia, cand.porte, cand.capital, m.uf, m.cidade,
          cand.unidades.length, ativas, cand.status, cand.tipo, conf,
          cand.status === "PENDENTE" ? null : `Justificativa fictícia de demonstração (${cand.status}).`,
          vinculo ? empTeste : null, vinculo ? new Date() : null, sugestao ? empSug : null, sugestao ? "NOME_CIDADE" : null, verif,
          confirmada ? validador : null, confirmada ? verif : null, chaveOrdenacao(cand.razao),
          v4.prioridade ?? null, v4.obsComercial ?? null, v4.prioridade ? new Date() : null, v4.prioridade ? validador : null, vinculo ? validador : null]);

      for (const u of cand.unidades) {
        const cnpj = cnpjFicticio(cand.raiz, u.ordem);
        const sit = u.situacao ?? "02";
        await c.query(
          `INSERT INTO "ConcreteiraCandidataUnidade"(id,"candidataId",cnpj,"isMatriz","nomeFantasia","tipoUnidade","situacaoCadastral",ativa,"cnaePrincipal","cnaesSecundarios",
            "cnaeAlvoComoPrincipal",logradouro,"municipioCodigoIbge","municipioNome",uf,"primeiraCompetencia","ultimaCompetencia","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'2330305','{4930202}',true,$9,$10,$11,$12,$13,'2026-09',now())`,
          [`${P}${cand.slug}-u${u.ordem}`, `${P}${cand.slug}`, cnpj, u.ordem === 1, cand.fantasia, u.tipo, sit, sit === "02",
            u.logradouro, u.ibge, u.cidade, u.uf, u.so09 ? "2026-09" : "2026-08"]);
        for (const [compId, comp] of comps) {
          if (u.so09 && comp === "2026-08") continue;
          const logr = comp === "2026-08" && u.logradouro08 ? u.logradouro08 : u.logradouro;
          const situ = comp === "2026-08" && u.situacao ? "02" : sit;
          await c.query(
            `INSERT INTO "ReceitaEstabelecimento"(id,"competenciaId",cnpj,"cnpjBasico","cnpjOrdem","cnpjDv","isMatriz","razaoSocial","nomeFantasia","situacaoCadastral",
              "cnaePrincipal","cnaesSecundarios","cnaeAlvoComoPrincipal",porte,"capitalSocial",logradouro,"municipioCodigoIbge","municipioNome",uf,"hashRegistro")
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'2330305','{4930202}',true,$11,$12,$13,$14,$15,$16,$17)`,
            [`${P}est-${comp}-${cnpj}`, compId, cnpj, cnpj.slice(0, 8), cnpj.slice(8, 12), cnpj.slice(12), u.ordem === 1, cand.razao, cand.fantasia, situ,
              cand.porte, cand.capital, logr, u.ibge, u.cidade, u.uf, md5(`${cnpj}|${situ}|${logr}`)]);
          nEst++;
        }
        if (u.so09) {
          await c.query(`INSERT INTO "ReceitaMudanca"(id,"competenciaId","competenciaAnteriorId",cnpj,"cnpjBasico",tipo,campo,"valorNovo") VALUES ($1,$2,$3,$4,$5,'NOVO_ESTABELECIMENTO','estabelecimento',$6)`,
            [`${P}mud-novo-${cnpj}`, comps[1][0], comps[0][0], cnpj, cnpj.slice(0, 8), `Nova filial em ${u.cidade}/${u.uf}`]);
        }
        if (u.logradouro08) {
          await c.query(`INSERT INTO "ReceitaMudanca"(id,"competenciaId","competenciaAnteriorId",cnpj,"cnpjBasico",tipo,campo,"valorAnterior","valorNovo") VALUES ($1,$2,$3,$4,$5,'ENDERECO_ALTERADO','logradouro',$6,$7)`,
            [`${P}mud-end-${cnpj}`, comps[1][0], comps[0][0], cnpj, cnpj.slice(0, 8), u.logradouro08, u.logradouro]);
        }
        if (u.situacao) {
          await c.query(`INSERT INTO "ReceitaMudanca"(id,"competenciaId","competenciaAnteriorId",cnpj,"cnpjBasico",tipo,campo,"valorAnterior","valorNovo") VALUES ($1,$2,$3,$4,$5,'SITUACAO_ALTERADA','situacaoCadastral','02 (Ativa)',$6)`,
            [`${P}mud-sit-${cnpj}`, comps[1][0], comps[0][0], cnpj, cnpj.slice(0, 8), `${u.situacao} (Baixada)`]);
        }
      }

      for (const [i, [fonte, titulo, trecho]] of (cand.evid ?? []).entries()) {
        await c.query(
          `INSERT INTO "ConcreteiraEvidencia"(id,"candidataId","tipoFonte",titulo,url,trecho,"coletadoEm",confianca,agente) VALUES ($1,$2,$3,$4,$5,$6,now() - ($7 || ' days')::interval,$8,'demonstracao')`,
          [`${P}${cand.slug}-ev${i}`, `${P}${cand.slug}`, fonte, `${titulo} (DEMO)`, "https://exemplo.invalid/demo", trecho, String(i * 3 + 1), cand.conf]);
      }
      for (const [i, [de, para, conf, motivo]] of (cand.hist ?? []).entries()) {
        await c.query(
          `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","statusAnterior","statusNovo","confiancaNova",motivo,agente,"createdAt","tipoEvento",origem) VALUES ($1,$2,$3,$4,$5,$6,'demonstracao', now() - ($7 || ' days')::interval,'VALIDACAO','SCRIPT_DEMONSTRACAO')`,
          [`${P}${cand.slug}-h${i}`, `${P}${cand.slug}`, de, para, conf, motivo, String(((cand.hist?.length ?? 0) - i) * 5)]);
      }
    }
    // ─── v4: potenciais, contatos e pessoas (todos fictícios) + histórico ───
    let nPot = 0, nCt = 0, nPs = 0;
    const histV4 = async (cid: string, i: string, tipoEvento: string, status: string, campo: string, valorNovo: string, motivo: string, entidadeId: string, valorAnterior: string | null = null) => {
      await c.query(
        `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","statusAnterior","statusNovo",motivo,agente,"tipoEvento",origem,campo,"valorAnterior","valorNovo","entidadeId","usuarioId")
         VALUES ($1,$2,$3,$3,$4,'demonstracao',$5,'SCRIPT_DEMONSTRACAO',$6,$7,$8,$9,$10)`,
        [`${P}${i}`, cid, status, motivo, tipoEvento, campo, valorAnterior, valorNovo, entidadeId, validador]);
    };
    const mascara = (tipo: string, v: string) => tipo === "EMAIL" ? `${normalizarEmail(v).slice(0, 2)}***@${normalizarEmail(v).split("@")[1]}`
      : tipo === "TELEFONE" || tipo === "WHATSAPP" ? `(${normalizarTelefone(v).slice(0, 2)}) ****-${normalizarTelefone(v).slice(-4)}` : v;
    for (const cand of todas) {
      const v4 = DADOS_V4[cand.slug]; if (!v4) continue;
      const cid = `${P}${cand.slug}`;
      for (const [i, pt] of (v4.pot ?? []).entries()) {
        const id = `${P}${cand.slug}-pot${i}`;
        await c.query(
          `INSERT INTO "ConcreteiraPotencialEquipamento"(id,"candidataId","unidadeId",equipamento,"descricaoOutro","potencialVenda","interesseLocacao","quantidadeEstimada",observacao,"avaliadoPorId","avaliadoEm","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())`,
          [id, cid, pt.unidade ? `${cid}-u${pt.unidade}` : null, pt.eq, pt.descr ?? null, pt.venda, pt.loc, pt.qtd ?? null, pt.obs ?? null, validador]);
        await histV4(cid, `${cand.slug}-hpot${i}`, "POTENCIAL_EQUIPAMENTO", cand.status, `${pt.eq}${pt.unidade ? " (unidade)" : " (geral)"}`, `Venda: ${pt.venda} · Locação: ${pt.loc}`, "Avaliação de potencial (demo)", id);
        nPot++;
      }
      for (const [i, ct] of (v4.ct ?? []).entries()) {
        const id = `${P}${cand.slug}-ct${i}`;
        await c.query(
          `INSERT INTO "ConcreteiraCandidataContato"(id,"candidataId","unidadeId",tipo,valor,"valorNormalizado",descricao,principal,situacao,fonte,"verificadoEm","verificadoPorId",ativo,"inativadoEm","inativadoPorId","motivoInativacao","registradoPorId","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SITE_EMPRESA',$10,$11,$12,$13,$14,$15,$16,now())`,
          [id, cid, ct.unidade ? `${cid}-u${ct.unidade}` : null, ct.tipo, ct.valor, normalizarContato(ct.tipo as never, ct.valor), ct.descr ?? null, Boolean(ct.principal),
            ct.verificado ? "VERIFICADO" : "NAO_VERIFICADO", ct.verificado ? new Date() : null, ct.verificado ? validador : null,
            !ct.inativo, ct.inativo ? new Date() : null, ct.inativo ? validador : null, ct.inativo ?? null, validador]);
        await histV4(cid, `${cand.slug}-hct${i}`, "CONTATO", cand.status, `contato:${ct.tipo}`, mascara(ct.tipo, ct.valor), "Contato registrado (demo)", id);
        if (ct.inativo) await histV4(cid, `${cand.slug}-hcti${i}`, "CONTATO", cand.status, `inativacao:${ct.tipo}`, "inativo", ct.inativo, id, mascara(ct.tipo, ct.valor));
        nCt++;
      }
      for (const [i, ps] of (v4.ps ?? []).entries()) {
        const id = `${P}${cand.slug}-ps${i}`;
        await c.query(
          `INSERT INTO "ConcreteiraCandidataPessoa"(id,"candidataId",nome,funcao,papeis,telefone,"telefoneNormalizado",whatsapp,"whatsappNormalizado",email,"emailNormalizado",fonte,situacao,"verificadoEm","verificadoPorId",ativo,"inativadoEm","inativadoPorId","motivoInativacao","registradoPorId","updatedAt")
           VALUES ($1,$2,$3,$4,$5::"PapelPessoaCandidata"[],$6,$7,$8,$9,$10,$11,'LINKEDIN',$12,$13,$14,$15,$16,$17,$18,$19,now())`,
          [id, cid, ps.nome, ps.funcao, ps.papeis, ps.tel ?? null, ps.tel ? normalizarTelefone(ps.tel) : null, ps.zap ?? null, ps.zap ? normalizarTelefone(ps.zap) : null,
            ps.email ?? null, ps.email ? normalizarEmail(ps.email) : null, ps.verificado ? "VERIFICADO" : "NAO_VERIFICADO", ps.verificado ? new Date() : null, ps.verificado ? validador : null,
            !ps.inativo, ps.inativo ? new Date() : null, ps.inativo ? validador : null, ps.inativo ?? null, validador]);
        await histV4(cid, `${cand.slug}-hps${i}`, "PESSOA", cand.status, "pessoa", `${ps.nome} — ${ps.papeis.join(", ")}`, "Pessoa registrada (demo)", id);
        if (ps.inativo) await histV4(cid, `${cand.slug}-hpsi${i}`, "PESSOA", cand.status, "inativacao:pessoa", "inativa", ps.inativo, id, ps.nome);
        nPs++;
      }
      if (v4.prioridade) await histV4(cid, `${cand.slug}-hq`, "QUALIFICACAO", cand.status, "prioridadeComercial", v4.prioridade, "Prioridade definida (demo)", cid);
    }
    console.log(`[demo] v4: ${nPot} potenciais, ${nCt} contatos, ${nPs} pessoas (todos fictícios).`);

    await c.query(`UPDATE "ReceitaCompetencia" r SET "totalRegistros" = (SELECT count(*) FROM "ReceitaEstabelecimento" e WHERE e."competenciaId" = r.id) WHERE r.id LIKE $1`, [`${P}%`]);
    await c.query("COMMIT");
    console.log(`[demo] criadas ${todas.length} candidatas, ${todas.reduce((a, c2) => a + c2.unidades.length, 0)} unidades, ${nEst} registros da Receita em 2 competências.`);
    console.log(`[demo] vínculo com Empresa de teste: ${empTeste ? "sim" : "não encontrada"} · sugestão: ${empSug ? "sim" : "não encontrada"}`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : "erro"); process.exit(1); });
