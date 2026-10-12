// ARQUIVO: lib/base-nacional/triagem.ts
// REGRA: nunca remover. Apenas acrescentar.
// Triagem automática SEM pesquisa web — versão 2 (auditoria de Pernambuco, 08/10/2026).
// Porta fiel de scripts/base-nacional/triagem-sem-web.py (v2). Função pura: só lê CNAE, nome,
// porte, natureza, unidades e localização. O resultado é PRELIMINAR: nunca confirma uma empresa
// e nunca a declara "não é concreteira" — só decide se ela vai para verificação ou fica dispensada.

export const VERSAO_TRIAGEM = "v2-2026-10-08";

export const CLASSES_TRIAGEM = [
  "FORTE_INDICIO_CONCRETEIRA",
  "POSSIVEL_CONCRETEIRA",
  "INCONCLUSIVA",
  "PROVAVEL_ARGAMASSEIRA",
  "PROVAVEL_CONSTRUTORA",
  "PROVAVEL_LOJA_REVENDA",
  "PROVAVEL_TRANSPORTADORA",
  "PROVAVEL_NAO_CONCRETEIRA",
] as const;
export type ClasseTriagem = (typeof CLASSES_TRIAGEM)[number];

export const CLASSE_TRIAGEM_LABEL: Record<ClasseTriagem, string> = {
  FORTE_INDICIO_CONCRETEIRA: "Forte indício de concreteira",
  POSSIVEL_CONCRETEIRA: "Possível concreteira",
  INCONCLUSIVA: "Inconclusiva",
  PROVAVEL_ARGAMASSEIRA: "Provável argamasseira",
  PROVAVEL_CONSTRUTORA: "Provável construtora",
  PROVAVEL_LOJA_REVENDA: "Provável loja ou revenda",
  PROVAVEL_TRANSPORTADORA: "Provável transportadora",
  PROVAVEL_NAO_CONCRETEIRA: "Provável não concreteira",
};

/** Classes que exigem verificação; as demais ficam dispensadas (continuam PENDENTE e revisáveis por amostragem). */
export const CLASSES_PARA_VERIFICAR: ClasseTriagem[] = ["FORTE_INDICIO_CONCRETEIRA", "POSSIVEL_CONCRETEIRA", "INCONCLUSIVA"];

export type UnidadeTriagem = {
  ativa: boolean;
  cnaePrincipal: string;
  cnaesSecundarios?: string[] | null;
  cnaeAlvoComoPrincipal: boolean;
  nomeFantasia?: string | null;
  municipioNome?: string | null;
  uf?: string | null;
};
export type CandidataTriagem = {
  razaoSocial?: string | null;
  nomeFantasia?: string | null;
  porte?: string | null;
  naturezaJuridica?: string | null;
  capitalSocial?: number | string | null;
  unidades: UnidadeTriagem[];
};
export type ResultadoTriagem = {
  classificacao: ClasseTriagem;
  sinais: string[];
  pontuacao: number;
  unidadesInterior: number;
  prioridadeReceita: "A" | "B";
  paraVerificar: boolean;
};

export function normalizarNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9@. ]+/g, " ");
}

// Regiões metropolitanas (municípios que NÃO contam como interior). PE detalhado; demais UFs: só a capital.
const METRO: Record<string, Set<string>> = {
  PE: new Set(["RECIFE", "JABOATAO DOS GUARARAPES", "OLINDA", "PAULISTA", "CABO DE SANTO AGOSTINHO", "CAMARAGIBE",
    "SAO LOURENCO DA MATA", "IGARASSU", "ABREU E LIMA", "IPOJUCA", "MORENO", "ITAPISSUMA", "ILHA DE ITAMARACA",
    "ITAMARACA", "ARACOIABA"]),
};
export const CAPITAIS: Record<string, string> = {
  AC: "RIO BRANCO", AL: "MACEIO", AP: "MACAPA", AM: "MANAUS", BA: "SALVADOR", CE: "FORTALEZA", DF: "BRASILIA",
  ES: "VITORIA", GO: "GOIANIA", MA: "SAO LUIS", MT: "CUIABA", MS: "CAMPO GRANDE", MG: "BELO HORIZONTE", PA: "BELEM",
  PB: "JOAO PESSOA", PR: "CURITIBA", PE: "RECIFE", PI: "TERESINA", RJ: "RIO DE JANEIRO", RN: "NATAL", RS: "PORTO ALEGRE",
  RO: "PORTO VELHO", RR: "BOA VISTA", SC: "FLORIANOPOLIS", SP: "SAO PAULO", SE: "ARACAJU", TO: "PALMAS",
};
export function ehInterior(cidade: string | null | undefined, uf: string | null | undefined): boolean {
  const c = normalizarNome(cidade).trim();
  const u = (uf ?? "").toUpperCase();
  return !(METRO[u]?.has(c) ?? false) && c !== CAPITAIS[u];
}

const KW_CONCRETO = /\b(CONCRET\w*|CONCREMIX|BETON\w*|\w*MIX|USINA\w*|BOMBEAMENTO|CONCRET)\b/;
const KW_ARGAMASSA = /\b(ARGAMASS\w*|\w*MASSA|REBOCO|REJUNTE|GESSO|CAL|CIMENTO COLA|ACRILIC\w*)\b/;
const KW_PREMOLD = /\b(PRE ?MOLDAD\w*|PREMOLDAD\w*|ARTEFATO\w*|BLOCO\w*|LAJE\w*|POSTE\w*|TUBO\w*|MOUR\w*|PAVI\w*|BLOKRET\w*|PISO\w*|CERAMIC\w*)\b/;
const KW_CONSTR = /\b(CONSTRU\w*|ENGENHARIA|INCORPORA\w*|EDIFICA\w*|OBRAS?|EMPREENDIMENTO\w*|PROJETO\w*|ARQUITETURA)\b/;
const KW_LOJA = /\b(MATERIA\w* DE CONSTRUCAO|MAT CONSTRUCAO|MADEIREIRA|DEPOSITO|HOME CENTER|FERRAGENS?|VIDRACARIA)\b/;
const KW_FORTE = /\b(CONCRETEIRA|CONCRETAGEM|CONCREMIX|USINA DE CONCRETO|BETONEIRA\w*|BOMBEAMENTO)\b/;
const KW_TRANSP = /\b(TRANSPORT\w*|LOGISTIC\w*|FRETE\w*|CARGAS?)\b/;
// v2: a descrição do CNAE 2330-3/05 copiada na razão social não pode disparar "argamassa".
const FRASE_CNAE = /\b(PREPARACAO DE MASSAS? DE CONCRETO( E ARGAMASSA)?( PARA CONSTRUCAO)?|MASSAS? DE CONCRETO|PREPARACAO DE MASSAS?)\b/g;
const NAO_CONC = /\b(ARTEFATOS?|BLOCOS?|PRE ?MOLDADOS?|PISOS?|LAJES?|TUBOS?) DE CONCRETO\b/g;

const PREMOLD_CNAE = new Set(["2330301", "2330302", "2330303", "2330304", "2330399", "2391501", "2391502", "2391503"]);
export const ARGAM_CNAE = new Set(["2392300", "2320600", "2399199", "2399101"]);
const CONSTR_PREF = ["41", "42", "43", "71"];
const LOJA_PREF = ["4744", "4742", "4743", "4679", "4674", "4673", "4741", "4789", "4761"];
const TRANSP_PREF = ["49", "52"];
const MINER_PREF = ["08"];
export const LOCACAO_CNAE = new Set(["7732201", "7739099", "7732202"]);
const SERV_CONCRETO = new Set(["4399103", "4399105"]);
const SERVICOS_CONSTRUCAO = new Set(["4399101", "4399199", "4399104"]);
const RELACIONADOS_PREF = ["23", "08", "43", "41", "42", "77", "46", "47", "49", "71"];

const comeca = (p: string, pref: string[]) => pref.some(x => p.startsWith(x));

/** Triagem v2 de uma candidata. `uf` restringe a contagem de unidades no interior (opcional). */
export function triar(c: CandidataTriagem, uf?: string | null): ResultadoTriagem {
  const units = c.unidades.filter(u => u.ativa);
  let nome = normalizarNome(`${c.razaoSocial ?? ""} ${c.nomeFantasia ?? ""} ${units.map(u => u.nomeFantasia ?? "").join(" ")}`);
  const princ = new Set(units.map(u => u.cnaePrincipal));
  const sec = new Set<string>();
  units.forEach(u => (u.cnaesSecundarios ?? []).forEach(s => sec.add(s)));
  const A = units.some(u => u.cnaeAlvoComoPrincipal);
  const sinais: string[] = [];

  nome = nome.replace(FRASE_CNAE, " ");
  const nomeC = nome.replace(NAO_CONC, " ");
  const forte = KW_FORTE.test(nomeC);
  const conc = KW_CONCRETO.test(nomeC) || forte;
  const arg = KW_ARGAMASSA.test(nome);
  const pre = KW_PREMOLD.test(nome);
  const con = KW_CONSTR.test(nome);
  const loja = KW_LOJA.test(nome);
  const tra = KW_TRANSP.test(nome);

  sinais.push(A ? "CNAE principal 2330-3/05" : "2330-3/05 só secundário");
  if (conc) sinais.push("nome: concreto/mix/beton");
  if (arg) sinais.push("nome: argamassa/massa/cal/gesso");
  if (pre) sinais.push("nome: pré-moldado/artefato");
  if (con) sinais.push("nome: construtora/engenharia");
  if (loja) sinais.push("nome: comércio/materiais");
  if (tra) sinais.push("nome: transporte");
  const todos = [...princ, ...sec];
  if (todos.some(p => LOCACAO_CNAE.has(p))) sinais.push("CNAE locação de máquinas");
  if ([...princ].some(p => comeca(p, MINER_PREF))) sinais.push("CNAE principal mineração (areia/brita)");

  const pPre = [...princ].some(p => PREMOLD_CNAE.has(p));
  const pArg = [...princ].some(p => ARGAM_CNAE.has(p));
  const pCon = [...princ].some(p => comeca(p, CONSTR_PREF) && !SERVICOS_CONSTRUCAO.has(p) && !SERV_CONCRETO.has(p));
  const pLoja = [...princ].some(p => comeca(p, LOJA_PREF));
  const pTra = [...princ].some(p => comeca(p, TRANSP_PREF));
  const pMin = [...princ].some(p => comeca(p, MINER_PREF));
  const pLoc = [...princ].some(p => LOCACAO_CNAE.has(p));
  const pCim = princ.has("2320600");
  const mei = c.naturezaJuridica === "2135" && c.porte === "01";

  let cl: ClasseTriagem;
  if (forte || (conc && !arg && (A || pLoc || pMin || [...princ].join("").includes("4399")))) cl = "FORTE_INDICIO_CONCRETEIRA";
  else if (A && !(arg || pre || loja || tra)) cl = conc ? "FORTE_INDICIO_CONCRETEIRA" : "POSSIVEL_CONCRETEIRA";
  else if (conc && !arg) cl = "POSSIVEL_CONCRETEIRA";
  else if (conc && arg) { cl = "POSSIVEL_CONCRETEIRA"; sinais.push("v2: nome mistura concreto e argamassa → pesquisar"); }
  else if (A && arg && ![...princ].some(p => ARGAM_CNAE.has(p))) { cl = "POSSIVEL_CONCRETEIRA"; sinais.push("v2: CNAE principal 2330-3/05 com nome de argamassa → pesquisar"); }
  else if (pCim) { cl = "PROVAVEL_NAO_CONCRETEIRA"; sinais.push("perfil cimenteira"); }
  else if (arg || (pArg && !conc)) cl = "PROVAVEL_ARGAMASSEIRA";
  else if (pMin || pLoc) cl = "POSSIVEL_CONCRETEIRA";
  else if (pre || pPre) { cl = "PROVAVEL_NAO_CONCRETEIRA"; sinais.push("perfil pré-moldados/artefatos"); }
  else if (pCon || (con && !pLoja)) cl = "PROVAVEL_CONSTRUTORA";
  else if (pLoja || loja) cl = "PROVAVEL_LOJA_REVENDA";
  else if (pTra || tra) cl = "PROVAVEL_TRANSPORTADORA";
  else if (A) cl = "INCONCLUSIVA";
  else if (mei && !conc) { cl = "PROVAVEL_NAO_CONCRETEIRA"; sinais.push("empresário individual/ME sem sinal de concreto"); }
  else if (princ.size && ![...princ].some(p => comeca(p, RELACIONADOS_PREF))) cl = "PROVAVEL_NAO_CONCRETEIRA";
  else cl = "INCONCLUSIVA";

  const doUf = uf ? units.filter(u => (u.uf ?? "").toUpperCase() === uf.toUpperCase()) : units;
  const nInt = doUf.filter(u => ehInterior(u.municipioNome, u.uf)).length;
  const capital = Number(c.capitalSocial ?? 0) || 0;
  const bonusPorte = ({ "05": 10, "03": 5 } as Record<string, number>)[c.porte ?? ""] ?? 0;
  const pont = (A ? 40 : 0) + (conc && !arg ? 30 : 0) + 5 * Math.min(units.length, 6)
    + (nInt ? 10 : 0) + bonusPorte
    + (capital >= 500_000 ? 5 : 0) + (pLoc || pMin ? 5 : 0) - (c.naturezaJuridica === "2135" ? 10 : 0);

  return {
    classificacao: cl, sinais, pontuacao: pont, unidadesInterior: nInt,
    prioridadeReceita: A ? "A" : "B", paraVerificar: CLASSES_PARA_VERIFICAR.includes(cl),
  };
}
