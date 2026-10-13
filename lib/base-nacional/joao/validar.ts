// ARQUIVO: lib/base-nacional/joao/validar.ts
// REGRA: nunca remover. Apenas acrescentar.
// João (enriquecimento de decisores) — normalização e validação comuns, funções puras.
// Nada aqui busca na internet, grava no banco ou contata alguém.

import { DOMINIOS_GENERICOS } from "../robo/site";

export type Papel = "PROPRIETARIO_SOCIO" | "ADMINISTRADOR" | "COMPRADOR" | "RESPONSAVEL_FROTA" | "RESPONSAVEL_MANUTENCAO" | "RESPONSAVEL_EQUIPAMENTOS" | "OUTRO";

/** Nome em caixa alta, sem acento, sem pontuação e com espaços simples (chave de comparação). */
export function normalizarNome(s: string | null | undefined): string {
  return (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Nome para exibição: "JOAO DA SILVA" → "Joao da Silva". */
export function nomeExibicao(s: string): string {
  const minus = new Set(["DA", "DE", "DO", "DAS", "DOS", "E"]);
  return s.trim().replace(/\s+/g, " ").split(" ").map((p, i) => (i > 0 && minus.has(p.toUpperCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())).join(" ");
}

/**
 * Prioridade do cargo (pedido de Horácio, 12/10/2026):
 * 1 proprietário/sócio/presidente · 2 diretor · 3 gerente de operações · 4 gerente de manutenção ·
 * 5 gerente de frota · 6 gerente de compras/suprimentos · 9 outro.
 */
export function classificarCargo(cargo: string | null | undefined): { prioridade: number; papel: Papel; rotulo: string } {
  const c = normalizarNome(cargo);
  if (!c) return { prioridade: 9, papel: "OUTRO", rotulo: "Não informado" };
  if (/\b(SOCI[OA]|PROPRIETARI[OA]|DON[OA]|PRESIDENTE|FUNDADOR[A]?|EMPRESARI[OA]|TITULAR|CEO|OWNER|FOUNDER|CO ?FOUNDER|PARTNER)\b/.test(c)) return { prioridade: 1, papel: "PROPRIETARIO_SOCIO", rotulo: "Proprietário, sócio ou presidente" };
  if (/\b(DIRETOR[A]?|DIRECTOR|ADMINISTRADOR[A]?|SUPERINTENDENTE|COO|CFO|CTO|VICE PRESIDENTE|VP)\b/.test(c)) return { prioridade: 2, papel: "ADMINISTRADOR", rotulo: "Diretor" };
  if (/\b(OPERAC(AO|OES)|OPERATIONS|PRODUCAO|INDUSTRIAL|USINA|CENTRAL)\b/.test(c) && /\b(GERENTE|COORDENADOR[A]?|SUPERVISOR[A]?|MANAGER|HEAD|LIDER|ENCARREGAD[OA])\b/.test(c)) return { prioridade: 3, papel: "OUTRO", rotulo: "Gerente de operações" };
  if (/\bMANUTEN(CAO|COES)|MAINTENANCE\b/.test(c)) return { prioridade: 4, papel: "RESPONSAVEL_MANUTENCAO", rotulo: "Gerente de manutenção" };
  if (/\b(FROTA|FLEET|EQUIPAMENTOS|TRANSPORTE|LOGISTICA)\b/.test(c)) return { prioridade: 5, papel: /EQUIPAMENTOS/.test(c) ? "RESPONSAVEL_EQUIPAMENTOS" : "RESPONSAVEL_FROTA", rotulo: "Gerente de frota" };
  if (/\b(COMPRAS|SUPRIMENTOS|PROCUREMENT|PURCHASING|COMPRADOR[A]?|SUPPLY)\b/.test(c)) return { prioridade: 6, papel: "COMPRADOR", rotulo: "Gerente de compras ou suprimentos" };
  if (/\b(GERENTE|MANAGER)\b/.test(c)) return { prioridade: 7, papel: "OUTRO", rotulo: "Gerente (outra área)" };
  return { prioridade: 9, papel: "OUTRO", rotulo: "Outro" };
}

/** Qualificações do QSA da Receita que contam como decisor (código → prioridade). Procurador, conselheiro etc. ficam de fora. */
export const QUALIFICACOES_DECISOR: Record<string, number> = {
  "49": 1, "22": 1, "28": 1, "50": 1, "65": 1, "16": 1, "54": 1, "47": 1, "52": 1, "74": 1, "73": 1,
  "10": 2, "05": 2, "72": 2, "70": 2,
};

/** Telefone brasileiro normalizado: só dígitos, com DDD, sem +55 (10 ou 11 dígitos). Null se inválido. */
export function normalizarTelefoneBR(v: string | null | undefined): string | null {
  let d = (v ?? "").replace(/\D/g, "");
  if (d.startsWith("0800") || d.startsWith("0300") || d.startsWith("4004") || d.startsWith("4003")) return d.length >= 8 && d.length <= 11 ? d : null; // número nacional de empresa
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11 && d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1); // 0 + DDD + 8 dígitos
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99 || d[0] === "0") return null;
  if (d.length === 11 && d[2] !== "9") return null; // celular tem 9 na frente
  if (/^(\d)\1+$/.test(d.slice(2))) return null; // 0000-0000, 9999-9999
  if (/^9?(12345678|23456789|87654321)$/.test(d.slice(2))) return null; // número de exemplo (13/10/2026)
  return d;
}
export const ehCelular = (n: string) => n.length === 11 && n[2] === "9";
export function formatarTelefone(n: string): string {
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}

const SUFIXOS_2 = new Set(["com.br", "net.br", "ind.br", "eng.br", "org.br", "art.br", "emp.br", "srv.br", "log.br", "adv.br", "eco.br", "agr.br", "tec.br", "co.uk", "com.ar", "com.py"]);
/** Domínio registrável: "mail.polimix.com.br" → "polimix.com.br". */
export function dominioRegistravel(host: string | null | undefined): string | null {
  const h = (host ?? "").toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return null;
  const p = h.split(".");
  const ult2 = p.slice(-2).join(".");
  return SUFIXOS_2.has(ult2) ? p.slice(-3).join(".") : ult2;
}

export type ValidacaoEmail = { valido: boolean; normalizado: string | null; dominio: string | null; corporativo: boolean; confereEmpresa: boolean; motivo: string };
const EMAIL_FALSO = /^(seu|sua|nome|email|e-mail|exemplo|example|teste|test|usuario|user|fulano)(\.|@|_)|@(exemplo|example|dominio|domain|email|seudominio|sentry|wixpress)\./i;
/**
 * Valida e-mail e o domínio: corporativo = domínio próprio (não Gmail/Hotmail etc.);
 * confereEmpresa = domínio igual (registrável) a um domínio conhecido da empresa.
 */
export function validarEmail(email: string | null | undefined, dominiosEmpresa: string[] = []): ValidacaoEmail {
  let e0 = (email ?? "").trim();
  try { e0 = decodeURIComponent(e0); } catch { /* mantém */ } // "%20contato@..." de links mailto (13/10/2026)
  const e = e0.trim().toLowerCase().replace(/^mailto:\s*/, "").replace(/\?.*$/, "").trim();
  const m = e.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m) return { valido: false, normalizado: null, dominio: null, corporativo: false, confereEmpresa: false, motivo: "formato inválido" };
  if (EMAIL_FALSO.test(e) || /\.(png|jpe?g|gif|webp|svg)$/.test(e)) return { valido: false, normalizado: null, dominio: null, corporativo: false, confereEmpresa: false, motivo: "endereço de exemplo ou imagem" };
  const dom = m[2].replace(/^www\./, "");
  const generico = DOMINIOS_GENERICOS.has(dom);
  const reg = dominioRegistravel(dom);
  const regsEmpresa = new Set(dominiosEmpresa.map(dominioRegistravel).filter(Boolean) as string[]);
  const confere = Boolean(reg && regsEmpresa.has(reg));
  return { valido: true, normalizado: e, dominio: dom, corporativo: !generico, confereEmpresa: confere,
    motivo: generico ? "provedor genérico (não corporativo)" : confere ? "domínio da empresa" : "domínio corporativo diferente do site da empresa" };
}

/** Palavras do nome da empresa que a distinguem (sem LTDA, CONCRETO, SERVIÇOS etc.). Usadas contra homônimos. */
const COMUNS = new Set(["LTDA", "LTD", "SA", "S", "A", "ME", "EPP", "EIRELI", "CIA", "COMPANHIA", "DE", "DA", "DO", "DOS", "DAS", "E", "EM", "CONCRETO", "CONCRETOS",
  "CONCRETAGEM", "CONCRETAGENS", "SERVICOS", "SERVICO", "COMERCIO", "INDUSTRIA", "CONSTRUCAO", "CONSTRUCOES", "CONSTRUTORA", "ENGENHARIA", "MATERIAIS", "PARA",
  "BRASIL", "DO", "GRUPO", "USINADO", "USINADOS", "PRESTACAO", "RECUPERACAO", "JUDICIAL", "LOCACAO", "LOCACOES", "TRANSPORTES", "BOMBEAMENTO", "MIX", "ARGAMASSA",
  "ARGAMASSAS", "TECNOLOGIA", "SOLUCOES", "REPRESENTACOES", "MINERACAO", "EMPREENDIMENTOS", "PARTICIPACOES", "HOLDING", "LTDA."]);
export function tokensDistintivos(...nomes: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const n of nomes) for (const t of normalizarNome(n).split(" ")) if (t.length >= 4 && !COMUNS.has(t) && !/^\d+$/.test(t)) out.add(t);
  return [...out];
}
/** O texto cita a empresa? (pelo menos um token distintivo). Sem token distintivo, não há como afirmar. */
export function textoCitaEmpresa(texto: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const n = ` ${normalizarNome(texto)} `;
  return tokens.some(t => n.includes(` ${t} `) || n.includes(t));
}

/** Nome de pessoa plausível: 2 a 6 palavras, letras, sem palavras de empresa. */
export function nomePessoaPlausivel(nome: string): boolean {
  const n = normalizarNome(nome);
  const p = n.split(" ").filter(Boolean);
  if (p.length < 2 || p.length > 5) return false;
  if (p.some(x => /\d/.test(x))) return false;
  if (/\b(LTDA|CONCRETO|CONCRETOS|EMPRESA|SERVICOS|CONTATO|ATENDIMENTO|COMERCIAL|VENDAS|FINANCEIRO|DEPARTAMENTO|SETOR|SAC|CENTRAL|UNIDADE|TELEFONE|EMAIL|WHATSAPP)\b/.test(n)) return false;
  // 13/10/2026: menus, cidades e cargos colados ao nome ("Fale Conosco Matriz", "Presidente Prudente", "Sônia Regina Diretora Rogério")
  if (/\b(FALE|CONOSCO|CLIENTES?|ORCAMENTOS?|MATRIZ|FILIAL|HOME|INICIO|SOBRE|PRODUTOS?|BLOG|MAPA|SITE|PRUDENTE|JANEIRO|HORIZONTE|ALEGRE|IR|PARA|CONTEUDO|NOSSA|NOSSO|EQUIPE|DIRETORA?|GERENTE|COORDENADORA?|FISCAL|SOCIA?|PRESIDENTE|CEO|ADMINISTRADORA?|CONTABILIDADE|CONTABIL)\b/.test(n)) return false;
  return p.filter(x => x.length >= 2).length >= 2;
}

/** URL de perfil pessoal do LinkedIn normalizada (https://www.linkedin.com/in/slug) ou null. */
export function normalizarLinkedinPessoa(url: string | null | undefined): string | null {
  const m = (url ?? "").trim().match(/^https?:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/in\/([^/?#\s]+)/i);
  return m ? `https://www.linkedin.com/in/${decodeURIComponent(m[1]).toLowerCase()}` : null;
}
export function normalizarLinkedinEmpresa(url: string | null | undefined): string | null {
  const m = (url ?? "").trim().match(/^https?:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/company\/([^/?#\s]+)/i);
  return m ? `https://www.linkedin.com/company/${decodeURIComponent(m[1]).toLowerCase()}` : null;
}
