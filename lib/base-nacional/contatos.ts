// ARQUIVO: lib/base-nacional/contatos.ts
// REGRA: nunca remover. Apenas acrescentar.
// Normalização, validação e MÁSCARA de contatos da Base Nacional (funções puras).
// Decisão aprovada: telefone e e-mail completos NUNCA vão para o histórico — só a versão mascarada.

import type { TipoContato } from "./rotulos";

export function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/** Telefone brasileiro: só dígitos, sem o 55 do país e sem o 0 de operadora/DDD. */
export function normalizarTelefone(v: string): string {
  let d = soDigitos(v);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  while (d.length > 10 && d.startsWith("0")) d = d.slice(1); // 0 de DDD/operadora (ex.: 081..., 0xx81...)
  return d;
}

export function normalizarEmail(v: string): string {
  return v.trim().toLowerCase();
}

export function normalizarUrl(v: string): string {
  return v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

export function normalizarContato(tipo: TipoContato, valor: string): string {
  if (tipo === "TELEFONE" || tipo === "WHATSAPP") return normalizarTelefone(valor);
  if (tipo === "EMAIL") return normalizarEmail(valor);
  if (tipo === "OUTRO") return valor.trim().toLowerCase();
  return normalizarUrl(valor);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarContato(tipo: TipoContato, valor: string): string | null {
  const v = (valor ?? "").trim();
  if (!v) return "Informe o contato.";
  if (v.length > 300) return "Contato muito longo.";
  if (tipo === "TELEFONE" || tipo === "WHATSAPP") {
    const d = normalizarTelefone(v);
    if (d.length < 10 || d.length > 11) return "Telefone deve ter DDD + número (10 ou 11 dígitos).";
  }
  if (tipo === "EMAIL" && !EMAIL_RE.test(v)) return "E-mail inválido.";
  if (["SITE", "LINKEDIN", "INSTAGRAM", "FACEBOOK"].includes(tipo)) {
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try { const u = new URL(url); if (!u.hostname.includes(".")) return "Endereço inválido."; } catch { return "Endereço inválido."; }
  }
  return null;
}

/** "(81) 9****-1234" — mantém DDD e 4 últimos dígitos. */
export function mascararTelefone(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = normalizarTelefone(v);
  if (d.length < 6) return "****";
  const ddd = d.slice(0, 2), fim = d.slice(-4);
  return `(${ddd}) ${"*".repeat(Math.max(1, d.length - 6))}-${fim}`;
}

/** "jo***@dominio.com.br" — mantém 2 letras e o domínio. */
export function mascararEmail(v: string | null | undefined): string | null {
  if (!v) return null;
  const e = normalizarEmail(v);
  const [usuario, dominio] = e.split("@");
  if (!dominio) return "***";
  return `${usuario.slice(0, 2)}***@${dominio}`;
}

/** Valor seguro para o histórico: telefone/WhatsApp/e-mail sempre mascarados. */
export function valorParaHistorico(tipo: TipoContato, valor: string | null | undefined): string | null {
  if (!valor) return null;
  if (tipo === "TELEFONE" || tipo === "WHATSAPP") return mascararTelefone(valor);
  if (tipo === "EMAIL") return mascararEmail(valor);
  return valor.trim().slice(0, 200);
}

/** Link clicável para o contato (tel:, mailto:, wa.me ou URL). Nunca dispara envio automático. */
export function linkContato(tipo: TipoContato, valor: string): string | null {
  if (tipo === "TELEFONE") return `tel:+55${normalizarTelefone(valor)}`;
  if (tipo === "WHATSAPP") return `https://wa.me/55${normalizarTelefone(valor)}`;
  if (tipo === "EMAIL") return `mailto:${normalizarEmail(valor)}`;
  if (tipo === "OUTRO") return null;
  return /^https?:\/\//i.test(valor) ? valor.trim() : `https://${valor.trim()}`;
}

export function formatarTelefone(v: string): string {
  const d = normalizarTelefone(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

/** Chave de ordenação sem acentos — mesma regra do SQL da migration v4. */
export function chaveOrdenacao(nome: string | null | undefined): string {
  return (nome ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
