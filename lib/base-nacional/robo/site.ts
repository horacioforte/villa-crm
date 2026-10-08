// ARQUIVO: lib/base-nacional/robo/site.ts
// REGRA: nunca remover. Apenas acrescentar.
// Robô gratuito — leitura de sites PRÓPRIOS das candidatas (domínio do e-mail da Receita).
// Regras: só páginas públicas; respeita robots.txt; não faz login, não envia formulário, não contorna
// CAPTCHA ou bloqueio; não usa Google/Maps/redes sociais; não usa API paga. Funções de análise são puras.

export const USER_AGENT = "VillaCRM-RoboGratuito/1.0 (+verificacao de cadastro publico; sem coleta de dados pessoais)";
export const TOKEN_ROBOTS = "villacrm-robogratuito";

/** Provedores de e-mail genéricos e domínios que não identificam a empresa. */
export const DOMINIOS_GENERICOS = new Set([
  "gmail.com", "hotmail.com", "hotmail.com.br", "yahoo.com", "yahoo.com.br", "outlook.com", "outlook.com.br", "live.com",
  "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "icloud.com", "globo.com", "msn.com", "globomail.com",
  "zipmail.com.br", "r7.com", "oi.com.br", "me.com", "aol.com", "protonmail.com", "gmx.com", "yandex.com", "ymail.com",
  "email.com", "mail.com", "googlemail.com", "rocketmail.com",
]);

export function dominioDeEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  const m = e.match(/^[^@\s]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m) return null;
  const d = m[1].replace(/^www\./, "");
  if (DOMINIOS_GENERICOS.has(d)) return null;
  if (/(^|\.)(gov|jus|leg|mp|def)\.br$/.test(d)) return null; // órgão público nunca é site da candidata
  return d;
}

// ---------------------------------------------------------------------------------------------
// robots.txt (implementação simples e conservadora: na dúvida, NÃO visita)
// ---------------------------------------------------------------------------------------------
type Regra = { allow: boolean; caminho: string };
export function interpretarRobots(texto: string): Map<string, Regra[]> {
  const grupos = new Map<string, Regra[]>();
  let agentes: string[] = [];
  let ultimoFoiAgente = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, "").trim();
    if (!linha) continue;
    const m = linha.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const campo = m[1].toLowerCase();
    const valor = m[2].trim();
    if (campo === "user-agent") {
      if (!ultimoFoiAgente) agentes = [];
      agentes.push(valor.toLowerCase());
      for (const a of agentes) if (!grupos.has(a)) grupos.set(a, []);
      ultimoFoiAgente = true;
      continue;
    }
    ultimoFoiAgente = false;
    if (campo === "allow" || campo === "disallow") {
      for (const a of agentes) grupos.get(a)!.push({ allow: campo === "allow", caminho: valor });
    }
  }
  return grupos;
}

function casaCaminho(padrao: string, caminho: string): boolean {
  if (!padrao) return false;
  const ancorado = padrao.endsWith("$");
  const p = ancorado ? padrao.slice(0, -1) : padrao;
  const re = new RegExp("^" + p.split("*").map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (ancorado ? "$" : ""));
  return re.test(caminho);
}

/** true = pode visitar. Usa o grupo do nosso robô, senão o grupo "*". Regra mais longa vence; empate → allow. */
export function robotsPermite(texto: string | null, caminho: string): boolean {
  if (texto === null) return true; // robots.txt inexistente (404) = sem restrição
  const grupos = interpretarRobots(texto);
  const regras = grupos.get(TOKEN_ROBOTS) ?? [...grupos.entries()].find(([k]) => TOKEN_ROBOTS.startsWith(k) && k !== "*")?.[1] ?? grupos.get("*") ?? [];
  let melhor: Regra | null = null;
  for (const r of regras) {
    if (r.caminho === "" && !r.allow) continue; // "Disallow:" vazio = permite tudo
    if (!casaCaminho(r.caminho, caminho)) continue;
    if (!melhor || r.caminho.length > melhor.caminho.length || (r.caminho.length === melhor.caminho.length && r.allow)) melhor = r;
  }
  return melhor ? melhor.allow : true;
}

// ---------------------------------------------------------------------------------------------
// Análise de texto
// ---------------------------------------------------------------------------------------------
export function normalizarTexto(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Termos que indicam produção/fornecimento de concreto (sem acento, minúsculos). */
export const TERMOS_CONCRETO = [
  "concreto usinado", "concretos usinados", "usina de concreto", "central de concreto", "centrais de concreto",
  "concretagem", "concreteira", "bombeamento de concreto", "bomba de concreto", "bombas de concreto", "bomba lanca",
  "caminhao betoneira", "caminhoes betoneira", "autobetoneira", "fornecimento de concreto", "concreto bombeado",
  "concreto convencional", "concreto estrutural", "fck",
];
/** Indícios de outra atividade (sozinhos NÃO bastam para dizer que não é concreteira). */
export const TERMOS_OUTROS = [
  "argamassa", "gesso", "drywall", "pre-moldado", "pre moldado", "premoldado", "artefatos de cimento", "bloco de concreto",
  "blocos de concreto", "laje", "contabilidade", "contabil", "escritorio de contabilidade", "tintas", "material de construcao",
  "materiais de construcao", "transportadora", "logistica", "locacao de veiculos", "agropecuaria", "alimentos",
];

export function extrairTexto(html: string): { titulo: string | null; texto: string; links: Array<{ href: string; texto: string }> } {
  const titulo = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  const links: Array<{ href: string; texto: string }> = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    links.push({ href: m[1], texto: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) });
  }
  const texto = html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"").replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&([a-z])(acute|grave|circ|tilde|cedil|uml);/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return { titulo, texto, links };
}

export type AnalisePagina = {
  termosConcreto: string[];
  termosOutros: string[];
  cnpjs: string[];
  trechos: Array<{ termo: string; trecho: string }>;
};

export function analisarTexto(texto: string): AnalisePagina {
  const n = normalizarTexto(texto);
  const achar = (lista: string[]) => lista.filter(t => new RegExp(`(^|[^a-z])${t.replace(/[-]/g, "[- ]?")}([^a-z]|$)`).test(n));
  let termosConcreto = achar(TERMOS_CONCRETO);
  // "fck" sozinho é fraco; só conta junto de outro termo de concreto.
  if (termosConcreto.length === 1 && termosConcreto[0] === "fck") termosConcreto = [];
  const termosOutros = achar(TERMOS_OUTROS);
  const cnpjs = [...new Set([...texto.matchAll(/\b(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})\b/g)].map(m => m.slice(1, 6).join("")))];
  const trechos: Array<{ termo: string; trecho: string }> = [];
  for (const termo of termosConcreto.slice(0, 3)) {
    const i = n.search(new RegExp(termo.replace(/[-]/g, "[- ]?")));
    if (i >= 0) trechos.push({ termo, trecho: texto.slice(Math.max(0, i - 80), i + termo.length + 80).replace(/\s+/g, " ").trim() });
  }
  return { termosConcreto, termosOutros, cnpjs, trechos };
}

/** Links internos que valem a visita (empresa, serviços, produtos, contato). No máximo 3. */
export function linksInternosRelevantes(base: URL, links: Array<{ href: string; texto: string }>, limite = 3): string[] {
  const alvo = /(empresa|sobre|quem-somos|quem_somos|institucional|servic|produt|concreto|solucoes|contato|fale-conosco)/i;
  const out: string[] = [];
  for (const l of links) {
    let u: URL;
    try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (!alvo.test(u.pathname + " " + l.texto)) continue;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|zip|rar|doc|docx|xls|xlsx|mp4)$/i.test(u.pathname)) continue;
    u.hash = "";
    const s = u.toString();
    if (s !== base.toString() && !out.includes(s)) out.push(s);
    if (out.length >= limite) break;
  }
  return out;
}

/**
 * Conclusão do robô sobre o site (nunca confirma; nunca decide "não é" por ausência):
 * - CONCRETO_NO_SITE: o site próprio cita produção/fornecimento de concreto;
 * - OUTRA_ATIVIDADE_NO_SITE: o site existe, não cita concreto e mostra outra atividade;
 * - SITE_DE_TERCEIRO: o domínio parece ser de contador/terceiro (CNPJ de outra raiz ou termos de contabilidade);
 * - SEM_CONCLUSAO: inacessível, bloqueado ou sem termos.
 */
export type ConclusaoSite = "CONCRETO_NO_SITE" | "OUTRA_ATIVIDADE_NO_SITE" | "SITE_DE_TERCEIRO" | "SEM_CONCLUSAO";
export function concluirSite(args: { raiz: string; paginas: AnalisePagina[]; algumaLida: boolean }): { conclusao: ConclusaoSite; cnpjConfere: boolean } {
  const cnpjs = new Set(args.paginas.flatMap(p => p.cnpjs));
  const cnpjConfere = [...cnpjs].some(c => c.startsWith(args.raiz));
  const outrosCnpjs = [...cnpjs].filter(c => !c.startsWith(args.raiz));
  const concreto = new Set(args.paginas.flatMap(p => p.termosConcreto));
  const outros = new Set(args.paginas.flatMap(p => p.termosOutros));
  if (!args.algumaLida) return { conclusao: "SEM_CONCLUSAO", cnpjConfere };
  const pareceContador = outros.has("contabilidade") || outros.has("escritorio de contabilidade") || outros.has("contabil");
  if (!cnpjConfere && (outrosCnpjs.length > 0 && pareceContador)) return { conclusao: "SITE_DE_TERCEIRO", cnpjConfere };
  if (!cnpjConfere && pareceContador && concreto.size === 0) return { conclusao: "SITE_DE_TERCEIRO", cnpjConfere };
  if (concreto.size > 0) return { conclusao: "CONCRETO_NO_SITE", cnpjConfere };
  if (outros.size > 0) return { conclusao: "OUTRA_ATIVIDADE_NO_SITE", cnpjConfere };
  return { conclusao: "SEM_CONCLUSAO", cnpjConfere };
}

// ---------------------------------------------------------------------------------------------
// Rede (única parte não pura). Respeita robots.txt e limites de tamanho/tempo; segue no máx. 3 redirecionamentos.
// ---------------------------------------------------------------------------------------------
export type PaginaLida = {
  url: string; urlFinal: string; dominio: string; permitidoRobots: boolean; statusHttp: number | null; erro: string | null;
  titulo: string | null; analise: AnalisePagina | null; links: Array<{ href: string; texto: string }>;
};

const LIMITE_BYTES = 1_500_000;
const TEMPO_MS = 10_000;

async function baixar(url: string, buscar: typeof fetch): Promise<{ status: number; texto: string; tipo: string; local: string | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_MS);
  try {
    const r = await buscar(url, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9" } });
    const tipo = r.headers.get("content-type") ?? "";
    const local = r.headers.get("location");
    if (r.status >= 300 && r.status < 400) return { status: r.status, texto: "", tipo, local };
    const buf = await r.arrayBuffer();
    const texto = new TextDecoder(/charset=iso-8859-1|latin1|windows-1252/i.test(tipo) ? "latin1" : "utf-8").decode(buf.slice(0, LIMITE_BYTES));
    return { status: r.status, texto, tipo, local: null };
  } finally {
    clearTimeout(t);
  }
}

const robotsCache = new Map<string, string | null | "ERRO">();
async function robotsDe(origem: string, buscar: typeof fetch): Promise<string | null | "ERRO"> {
  if (robotsCache.has(origem)) return robotsCache.get(origem)!;
  let v: string | null | "ERRO";
  try {
    const r = await baixar(`${origem}/robots.txt`, buscar);
    if (r.status === 404 || r.status === 410) v = null;
    else if (r.status >= 200 && r.status < 300) v = /text\/html/i.test(r.tipo) ? null : r.texto; // HTML no lugar do robots = inexistente
    else if (r.status >= 300 && r.status < 400) v = null;
    else v = "ERRO"; // 401/403/5xx: conservador → não visita
  } catch {
    v = "ERRO";
  }
  robotsCache.set(origem, v);
  return v;
}

export async function lerPagina(url: string, buscar: typeof fetch = fetch): Promise<PaginaLida> {
  let atual = url;
  const dominioInicial = new URL(url).hostname.replace(/^www\./, "");
  for (let salto = 0; salto < 4; salto++) {
    const u = new URL(atual);
    const base: Omit<PaginaLida, "permitidoRobots" | "statusHttp" | "erro" | "titulo" | "analise" | "links"> = { url, urlFinal: atual, dominio: dominioInicial };
    const robots = await robotsDe(u.origin, buscar);
    if (robots === "ERRO") return { ...base, permitidoRobots: false, statusHttp: null, erro: "robots.txt inacessível — não visitado", titulo: null, analise: null, links: [] };
    if (!robotsPermite(robots, u.pathname + u.search)) return { ...base, permitidoRobots: false, statusHttp: null, erro: "bloqueado por robots.txt — não visitado", titulo: null, analise: null, links: [] };
    let r;
    try { r = await baixar(atual, buscar); } catch (e) {
      return { ...base, permitidoRobots: true, statusHttp: null, erro: e instanceof Error && e.name === "AbortError" ? "tempo esgotado" : "falha de conexão", titulo: null, analise: null, links: [] };
    }
    if (r.local && r.status >= 300 && r.status < 400) {
      try { atual = new URL(r.local, atual).toString(); continue; } catch { return { ...base, permitidoRobots: true, statusHttp: r.status, erro: "redirecionamento inválido", titulo: null, analise: null, links: [] }; }
    }
    if (r.status === 401 || r.status === 403 || r.status === 429) return { ...base, permitidoRobots: true, statusHttp: r.status, erro: "acesso restrito — não contornado", titulo: null, analise: null, links: [] };
    if (r.status >= 400) return { ...base, permitidoRobots: true, statusHttp: r.status, erro: `HTTP ${r.status}`, titulo: null, analise: null, links: [] };
    if (!/text\/html|text\/plain/i.test(r.tipo) && r.tipo) return { ...base, permitidoRobots: true, statusHttp: r.status, erro: "não é página HTML", titulo: null, analise: null, links: [] };
    if (/captcha|cf-challenge|just a moment|verify you are human/i.test(r.texto.slice(0, 5000))) {
      return { ...base, permitidoRobots: true, statusHttp: r.status, erro: "página de verificação (CAPTCHA) — não contornada", titulo: null, analise: null, links: [] };
    }
    const { titulo, texto, links } = extrairTexto(r.texto);
    return { ...base, permitidoRobots: true, statusHttp: r.status, erro: null, titulo, analise: analisarTexto(`${titulo ?? ""} ${texto}`), links };
  }
  return { url, urlFinal: atual, dominio: dominioInicial, permitidoRobots: true, statusHttp: null, erro: "redirecionamentos demais", titulo: null, analise: null, links: [] };
}
