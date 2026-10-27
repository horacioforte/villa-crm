// ARQUIVO: lib/base-nacional/joao/links-conferencia.ts
// REGRA: nunca remover. Apenas acrescentar.
// Botões de conferência rápida da tela do grupo (Fila comercial do João): funções puras que montam os links.
// Tudo só ABRE uma página em nova aba para a pessoa conferir — nada é enviado, nenhuma conversa recebe texto.

import { linksDeBusca } from "../fila";
import { dominioDeEmail } from "../robo/site";
import { formatarTelefone, normalizarTelefoneBR } from "./validar";

export type ContatoConferencia = { tipo: string; valor: string; fonteUrl?: string | null };
export type EmpresaConferencia = {
  razaoSocial: string | null; nomeFantasia?: string | null; cnpjMatriz?: string | null; totalUnidadesAtivas?: number | null; municipioMatriz?: string | null; ufMatriz?: string | null;
};
export type LinkConferencia = { rotulo: string; url: string; fonteUrl: string | null };
export type LinksConferenciaGrupo = {
  /** Null = sem site: a tela mostra o botão desabilitado "sem site". */
  site: (LinkConferencia & { origem: "SITE" | "EMAIL" }) | null;
  maps: string | null; instagram: string | null; google: string | null;
  whatsapps: LinkConferencia[];
};

/** Só aceita http(s): impede que um fonteUrl malformado (ex.: "javascript:") vire link clicável. */
export function urlSegura(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(s)) return null;
  try { return new URL(s).toString(); } catch { return null; }
}

/** Site informado (com ou sem http://, www., caminho) → URL https; null se não parecer um domínio. */
export function urlDeSite(valor: string | null | undefined): string | null {
  const s = (valor ?? "").trim();
  if (!s || /\s/.test(s)) return null;
  const comEsquema = /^https?:\/\//i.test(s) ? s : /^[a-z][a-z0-9+.-]*:/i.test(s) ? "" : `https://${s}`;
  if (!comEsquema) return null;
  try {
    const u = new URL(comEsquema);
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname) ? u.toString() : null;
  } catch { return null; }
}

/** Site do grupo: contato do tipo SITE; senão, domínio de e-mail corporativo (não gratuito, não órgão público). */
export function siteDoGrupo(contatos: ContatoConferencia[]): (LinkConferencia & { origem: "SITE" | "EMAIL" }) | null {
  for (const c of contatos) {
    if (c.tipo !== "SITE") continue;
    const url = urlDeSite(c.valor);
    if (url) return { rotulo: "Site", url, fonteUrl: urlSegura(c.fonteUrl), origem: "SITE" };
  }
  for (const c of contatos) {
    if (c.tipo !== "EMAIL") continue;
    const dominio = dominioDeEmail(c.valor);
    if (dominio) return { rotulo: "Site", url: `https://${dominio}`, fonteUrl: urlSegura(c.fonteUrl), origem: "EMAIL" };
  }
  return null;
}

/** wa.me com DDI 55, aceitando o número com ou sem 55. Sem texto pré-preenchido. Null se não for um número BR válido. */
export function linkWhatsapp(numero: string | null | undefined): string | null {
  const nacional = normalizarTelefoneBR(numero);
  return nacional ? `https://wa.me/55${nacional}` : null;
}

/** Até `max` WhatsApps distintos do grupo, com o texto do botão e a fonte (quando houver). */
export function whatsappsDoGrupo(contatos: ContatoConferencia[], max = 3): LinkConferencia[] {
  const vistos = new Set<string>();
  const out: LinkConferencia[] = [];
  for (const c of contatos) {
    if (c.tipo !== "WHATSAPP") continue;
    const nacional = normalizarTelefoneBR(c.valor);
    if (!nacional || vistos.has(nacional)) continue;
    vistos.add(nacional);
    out.push({ rotulo: `WhatsApp ${formatarTelefone(nacional)}`, url: `https://wa.me/55${nacional}`, fonteUrl: urlSegura(c.fonteUrl) });
    if (out.length >= max) break;
  }
  return out;
}

/** Empresa principal do grupo: a de mais unidades ativas (empate: a primeira). */
export function empresaPrincipal<T extends EmpresaConferencia>(empresas: T[]): T | null {
  return empresas.reduce<T | null>((melhor, e) => (!melhor || (e.totalUnidadesAtivas ?? 0) > (melhor.totalUnidadesAtivas ?? 0) ? e : melhor), null);
}

export function linksConferenciaGrupo(args: { empresas: EmpresaConferencia[]; contatos: ContatoConferencia[] }): LinksConferenciaGrupo {
  const principal = empresaPrincipal(args.empresas);
  const busca = principal
    ? linksDeBusca({ razaoSocial: principal.razaoSocial, nomeFantasia: principal.nomeFantasia, cidade: principal.municipioMatriz, uf: principal.ufMatriz, cnpj: principal.cnpjMatriz })
    : [];
  const url = (chave: string) => busca.find(l => l.chave === chave)?.url ?? null;
  return { site: siteDoGrupo(args.contatos), maps: url("maps"), instagram: url("instagram"), google: url("google"), whatsapps: whatsappsDoGrupo(args.contatos) };
}
