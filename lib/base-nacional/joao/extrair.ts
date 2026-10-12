// ARQUIVO: lib/base-nacional/joao/extrair.ts
// REGRA: nunca remover. Apenas acrescentar.
// João — extração de contatos profissionais e pessoas com cargo a partir de páginas PÚBLICAS do site da empresa.
// Funções puras: recebem texto/links já baixados (respeitando robots.txt) e devolvem achados com o trecho de origem.
// Nunca inventa: só devolve o que está escrito na página.

import { classificarCargo, nomePessoaPlausivel, normalizarLinkedinEmpresa, normalizarLinkedinPessoa, normalizarTelefoneBR, validarEmail } from "./validar";

export type AchadoContato = { tipo: "TELEFONE" | "WHATSAPP" | "EMAIL" | "LINKEDIN"; valor: string; normalizado: string; trecho: string; confereEmpresa?: boolean; corporativo?: boolean };
export type AchadoPessoa = { nome: string; cargo: string; prioridade: number; trecho: string; linkedinUrl?: string | null };

const trechoEm = (texto: string, i: number, tam: number) => texto.slice(Math.max(0, i - 60), i + tam + 60).replace(/\s+/g, " ").trim();

const RE_FONE = /(?:\+?55\s*)?\(?\b([1-9]\d)\)?[\s.-]*(9?\s?\d{4})[\s.-]?(\d{4})\b/g;
const RE_0800 = /\b(0800|4004|4003|0300)[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function extrairContatos(texto: string, links: Array<{ href: string; texto: string }>, dominiosEmpresa: string[]): AchadoContato[] {
  const out = new Map<string, AchadoContato>();
  const add = (a: AchadoContato) => { const k = `${a.tipo}:${a.normalizado}`; if (!out.has(k)) out.set(k, a); };

  // WhatsApp: links wa.me / api.whatsapp.com e número escrito perto da palavra "WhatsApp"
  for (const l of links) {
    const h = l.href.trim();
    const w = h.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|web\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=)\+?(\d{10,13})/i);
    if (w) { const n = normalizarTelefoneBR(w[1]); if (n) add({ tipo: "WHATSAPP", valor: n, normalizado: n, trecho: `link do site: ${h.slice(0, 120)}` }); }
    const tel = h.match(/^tel:\s*([+\d\s().-]{8,})/i);
    if (tel) { const n = normalizarTelefoneBR(tel[1]); if (n) add({ tipo: "TELEFONE", valor: n, normalizado: n, trecho: `link do site: ${h.slice(0, 80)}` }); }
    if (/^mailto:/i.test(h)) {
      const v = validarEmail(h, dominiosEmpresa);
      if (v.valido && v.normalizado) add({ tipo: "EMAIL", valor: v.normalizado, normalizado: v.normalizado, trecho: `link do site: ${h.slice(0, 80)}`, confereEmpresa: v.confereEmpresa, corporativo: v.corporativo });
    }
    const li = normalizarLinkedinEmpresa(h);
    if (li) add({ tipo: "LINKEDIN", valor: li, normalizado: li, trecho: `link do site: ${h.slice(0, 120)}` });
  }
  for (const m of texto.matchAll(RE_EMAIL)) {
    const v = validarEmail(m[0], dominiosEmpresa);
    if (v.valido && v.normalizado) add({ tipo: "EMAIL", valor: v.normalizado, normalizado: v.normalizado, trecho: trechoEm(texto, m.index ?? 0, m[0].length), confereEmpresa: v.confereEmpresa, corporativo: v.corporativo });
  }
  for (const m of texto.matchAll(RE_FONE)) {
    const bruto = m[0];
    const n = normalizarTelefoneBR(`${m[1]}${m[2]}${m[3]}`);
    if (!n) continue;
    const i = m.index ?? 0;
    const antes = texto.slice(Math.max(0, i - 40), i).toLowerCase();
    if (/cnpj|cep|cpf|inscri|cnae/.test(antes.slice(-15))) continue; // número de documento, não telefone
    const tipo = /whats|wpp|zap/.test(antes) ? "WHATSAPP" : "TELEFONE";
    add({ tipo, valor: n, normalizado: n, trecho: trechoEm(texto, i, bruto.length) });
  }
  for (const m of texto.matchAll(RE_0800)) {
    const n = `${m[1]}${m[2]}${m[3]}`;
    add({ tipo: "TELEFONE", valor: n, normalizado: n, trecho: trechoEm(texto, m.index ?? 0, m[0].length) });
  }
  return [...out.values()];
}

const CARGO = String.raw`(?:s[óo]ci[oa](?:[- ]?(?:administrador|diretor|fundador|propriet[áa]rio)[a]?)?|propriet[áa]ri[oa]|presidente|fundador[a]?|diretor[a]?(?:[- ](?:comercial|geral|t[ée]cnic[oa]|industrial|de opera[çc][õo]es|operacional|administrativ[oa]|financeir[oa]|executiv[oa]|presidente))?|ceo|gerente(?:[- ](?:geral|comercial|de opera[çc][õo]es|operacional|de manuten[çc][ãa]o|de frota|industrial|de produ[çc][ãa]o|de compras|de suprimentos|t[ée]cnic[oa]|administrativ[oa]))?|coordenador[a]? de (?:opera[çc][õo]es|manuten[çc][ãa]o|frota|compras|suprimentos|produ[çc][ãa]o)|comprador[a]?)`;
/** Torna as letras de um padrão insensíveis a maiúsculas sem usar a flag "i" (que estragaria a regra de nome com inicial maiúscula). */
function ci(src: string): string {
  let out = "", dentro = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      // escape inteiro (\uXXXX, \xXX, \s, \b ...) é copiado sem mexer
      const n = src[i + 1] ?? "";
      const tam = n === "u" ? 6 : n === "x" ? 4 : 2;
      out += src.slice(i, i + tam);
      if (n === "u" && dentro) { // letra acentuada escapada: acrescenta a maiúscula
        const ch = String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)), up = ch.toUpperCase();
        if (up !== ch && up.length === 1) out += `\\u${up.charCodeAt(0).toString(16).padStart(4, "0")}`;
      }
      i += tam - 1; continue;
    }
    if (c === "[") { dentro = true; out += c; continue; }
    if (c === "]") { dentro = false; out += c; continue; }
    const up = c.toUpperCase();
    if (up !== c.toLowerCase() || c !== up) { if (c !== up) out += dentro ? c + up : `[${c}${up}]`; else out += c; continue; }
    out += c;
  }
  return out;
}
const CARGO_CI = ci(CARGO);
const NOME = String.raw`((?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçü]+|[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,})(?:\s+(?:d[aeo]s?|e)?\s*(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçü]+|[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}|[A-Z]\.)){1,4})`;
const RE_NOME_CARGO = new RegExp(`${NOME}\\s*(?:[-–—,:|(]\\s*)${CARGO_CI}\\b`, "g");
const RE_CARGO_NOME = new RegExp(`\\b${CARGO_CI}\\s*(?:[-–—,:|]\\s*|\\s+)${NOME}`, "g");

/** Pessoas citadas com cargo no site ("Fulano de Tal – Diretor Comercial", "Diretor: Fulano"). */
export function extrairPessoasComCargo(texto: string): AchadoPessoa[] {
  const out = new Map<string, AchadoPessoa>();
  const cargoRe = new RegExp(CARGO, "i");
  const tentar = (nome: string, trechoBase: string, i: number) => {
    const n = nome.trim().replace(/\s+/g, " ");
    if (!nomePessoaPlausivel(n)) return;
    const cargo = trechoBase.match(cargoRe)?.[0] ?? "";
    const c = classificarCargo(cargo);
    const k = n.toUpperCase();
    if (!out.has(k) || out.get(k)!.prioridade > c.prioridade) out.set(k, { nome: n, cargo: cargo.trim(), prioridade: c.prioridade, trecho: trechoEm(texto, i, trechoBase.length) });
  };
  for (const m of texto.matchAll(RE_NOME_CARGO)) tentar(m[1], m[0], m.index ?? 0);
  for (const m of texto.matchAll(RE_CARGO_NOME)) {
    // no padrão "cargo nome" o nome precisa vir com iniciais maiúsculas de verdade (o "i" da regex não vale para ele)
    const nome = m[1];
    if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(nome)) continue;
    tentar(nome, m[0], m.index ?? 0);
  }
  return [...out.values()];
}

/** Links de perfis pessoais do LinkedIn presentes no site (ex.: página "equipe"). */
export function extrairLinkedinPessoas(links: Array<{ href: string; texto: string }>): Array<{ url: string; texto: string }> {
  const out = new Map<string, { url: string; texto: string }>();
  for (const l of links) { const u = normalizarLinkedinPessoa(l.href); if (u && !out.has(u)) out.set(u, { url: u, texto: l.texto }); }
  return [...out.values()];
}

/** Páginas internas que costumam ter contato/equipe (máximo `limite`). */
export function linksDeContato(base: URL, links: Array<{ href: string; texto: string }>, limite = 5): string[] {
  const alvo = /(contato|fale|atendimento|quem-somos|quem_somos|sobre|empresa|institucional|equipe|diretoria|time|nossa-historia|unidades|filiais|trabalhe)/i;
  const out: string[] = [];
  for (const l of links) {
    let u: URL;
    try { u = new URL(l.href, base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (!alvo.test(u.pathname + " " + l.texto)) continue;
    if (/\.(pdf|jpg|jpeg|png|gif|webp|zip|rar|docx?|xlsx?|mp4)$/i.test(u.pathname)) continue;
    u.hash = "";
    const s = u.toString();
    if (s !== base.toString() && !out.includes(s)) out.push(s);
    if (out.length >= limite) break;
  }
  return out;
}
