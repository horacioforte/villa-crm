// ARQUIVO: lib/base-nacional/joao/categorizar.ts
// REGRA: nunca remover. Apenas acrescentar.
// Fila comercial do João (13/10/2026) — categoria A/B/C por regra fixa, sem IA, só com dados já gravados.
//   C — GRANDE GRUPO: muitas unidades, vários estados ou capital social alto → pesquisar depois quem cuida de
//       operações, frota, manutenção, compras e suprimentos (sócio não decide isso sozinho).
//   A — PRONTA PARA REVISÃO COMERCIAL: decisor societário + WhatsApp comercial ou e-mail corporativo confiável.
//   B — PRECISA DE CONTATO MELHOR: decisor societário, mas só telefone geral / contato da Receita (ou nenhum).
// O contato geral é da EMPRESA: nunca é atribuído ao sócio.

export type Categoria = "A" | "B" | "C";

export type Indicadores = {
  empresas: number;
  unidadesAtivas: number;
  ufs: string[];
  portes: string[];
  capitalSocial: number;
  decisoresSocietarios: number;
  outrosDecisores: number;
  whatsapp: number;
  emailCorporativo: number;
  telefoneSite: number;
  telefoneReceita: number;
  emailOutros: number;
};

/** Limites do "grande grupo". Ajustáveis num lugar só. */
export const LIMITES_GRANDE_GRUPO = { unidadesAtivas: 8, estados: 3, capitalSocial: 20_000_000 } as const;

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  A: "A · Pronta para revisão comercial",
  B: "B · Precisa de contato melhor",
  C: "C · Grande grupo",
};
export const CATEGORIA_COR: Record<Categoria, string> = { A: "bg-emerald-100 text-emerald-800", B: "bg-amber-100 text-amber-800", C: "bg-indigo-100 text-indigo-800" };
export const PORTE_LABEL: Record<string, string> = { "00": "Não informado", "01": "Microempresa", "03": "Pequeno porte (EPP)", "05": "Demais (médio/grande)" };

export function categorizar(i: Indicadores): { categoria: Categoria; motivo: string } {
  const grande: string[] = [];
  if (i.unidadesAtivas >= LIMITES_GRANDE_GRUPO.unidadesAtivas) grande.push(`${i.unidadesAtivas} unidades ativas`);
  if (i.ufs.length >= LIMITES_GRANDE_GRUPO.estados) grande.push(`${i.ufs.length} estados`);
  if (i.capitalSocial >= LIMITES_GRANDE_GRUPO.capitalSocial) grande.push(`capital social de R$ ${Math.round(i.capitalSocial / 1_000_000)} milhões`);
  if (grande.length) return { categoria: "C", motivo: `Grande grupo (${grande.join(", ")}): pesquisar depois responsáveis por operações, frota, manutenção, compras e suprimentos.` };
  const temSocio = i.decisoresSocietarios > 0;
  const canais = [i.whatsapp ? `${i.whatsapp} WhatsApp comercial` : "", i.emailCorporativo ? `${i.emailCorporativo} e-mail corporativo` : ""].filter(Boolean);
  if (temSocio && canais.length) return { categoria: "A", motivo: `Decisor societário + ${canais.join(" e ")} (contato geral da empresa, não do sócio).` };
  const falta = !temSocio ? "sem decisor societário" : i.telefoneSite + i.telefoneReceita ? "só telefone geral ou da Receita" : "nenhum contato comercial";
  return { categoria: "B", motivo: `Precisa de contato melhor: ${falta}.` };
}
