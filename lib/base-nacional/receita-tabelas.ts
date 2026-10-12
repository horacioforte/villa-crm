// ARQUIVO: lib/base-nacional/receita-tabelas.ts
// REGRA: nunca remover. Apenas acrescentar.
// Tradução de códigos da Receita Federal para exibição (porte, natureza jurídica, CNAE).
// O código original é sempre preservado e exibido como informação secundária (auditoria).
// Tabelas PARCIAIS abaixo (curadas, focadas no setor de concreto/construção) continuam
// valendo como primeira opção. A partir de 07/10/2026, códigos fora delas caem no
// fallback das tabelas OFICIAIS COMPLETAS geradas por scripts/base-nacional/gerar-tabelas-receita.ts
// (lib/base-nacional/receita-tabelas-completo.generated.ts) — nunca inventadas.

import { CNAE_DESCRICAO_RFB, NATUREZA_JURIDICA_RFB } from "./receita-tabelas-completo.generated";
export { CNAE_DESCRICAO_RFB, NATUREZA_JURIDICA_RFB, MOTIVO_SITUACAO_RFB, QUALIFICACAO_RFB, PAIS_RFB } from "./receita-tabelas-completo.generated";

export const PORTE_RECEITA: Record<string, string> = {
  "00": "Não informado",
  "01": "Microempresa (ME)",
  "03": "Empresa de pequeno porte (EPP)",
  "05": "Demais empresas",
};

// Tabela de Natureza Jurídica (Receita/CONCLA) — grupo 2 (entidades empresariais).
export const NATUREZA_JURIDICA: Record<string, string> = {
  "2011": "Empresa pública",
  "2038": "Sociedade de economia mista",
  "2046": "Sociedade anônima aberta",
  "2054": "Sociedade anônima fechada",
  "2062": "Sociedade empresária limitada",
  "2070": "Sociedade empresária em nome coletivo",
  "2089": "Sociedade empresária em comandita simples",
  "2097": "Sociedade empresária em comandita por ações",
  "2127": "Sociedade em conta de participação",
  "2135": "Empresário (individual)",
  "2143": "Cooperativa",
  "2151": "Consórcio de sociedades",
  "2160": "Grupo de sociedades",
  "2194": "Estabelecimento, no Brasil, de sociedade estrangeira",
  "2216": "Empresa domiciliada no exterior",
  "2232": "Sociedade simples pura",
  "2240": "Sociedade simples limitada",
  "2259": "Sociedade simples em nome coletivo",
  "2267": "Sociedade simples em comandita simples",
  "2291": "Consórcio simples",
  "2305": "Empresa individual de responsabilidade limitada (natureza empresária)",
  "2313": "Empresa individual de responsabilidade limitada (natureza simples)",
  "2348": "Empresa simples de inovação — Inova Simples",
};

// CNAEs mais relevantes para concreteiras, pré-moldados, bombeamento e construção.
export const CNAE_DESCRICAO: Record<string, string> = {
  "2330305": "Preparação de massa de concreto e argamassa para construção",
  "2330301": "Fabricação de estruturas pré-moldadas de concreto armado, em série e sob encomenda",
  "2330302": "Fabricação de artefatos de cimento para uso na construção",
  "2330303": "Fabricação de artefatos de fibrocimento para uso na construção",
  "2330304": "Fabricação de casas pré-moldadas de concreto",
  "2330399": "Fabricação de outros artefatos e produtos de concreto, cimento, fibrocimento, gesso e materiais semelhantes",
  "2320600": "Fabricação de cimento",
  "0810006": "Extração de areia, cascalho ou pedregulho e beneficiamento associado",
  "0810099": "Extração e britamento de pedras e outros materiais para construção e beneficiamento associado",
  "4120400": "Construção de edifícios",
  "4211101": "Construção de rodovias e ferrovias",
  "4299599": "Outras obras de engenharia civil não especificadas anteriormente",
  "4399103": "Obras de alvenaria",
  "4399199": "Serviços especializados para construção não especificados anteriormente",
  "4679699": "Comércio atacadista de materiais de construção em geral",
  "4744099": "Comércio varejista de materiais de construção em geral",
  "4744005": "Comércio varejista de materiais de construção não especificados anteriormente",
  "4930201": "Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal",
  "4930202": "Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional",
  "7732201": "Aluguel de máquinas e equipamentos para construção sem operador, exceto andaimes",
};

/** CNAEs que indicam atividade de concreto usinado (destacados na tela). */
export const CNAES_CONCRETO_USINADO = new Set(["2330305"]);

const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export function descreverPorte(codigo: string | null | undefined): { texto: string; codigo: string | null } {
  if (!codigo) return { texto: "—", codigo: null };
  const c = soDigitos(codigo).padStart(2, "0").slice(-2);
  return { texto: PORTE_RECEITA[c] ?? "Código de porte não cadastrado", codigo: c };
}

export function formatarNaturezaCodigo(codigo: string | null | undefined): string | null {
  const d = soDigitos(codigo);
  return d.length === 4 ? `${d.slice(0, 3)}-${d.slice(3)}` : codigo ?? null;
}

export function descreverNatureza(codigo: string | null | undefined): { texto: string; codigo: string | null } {
  if (!codigo) return { texto: "—", codigo: null };
  const d = soDigitos(codigo);
  return { texto: NATUREZA_JURIDICA[d] ?? NATUREZA_JURIDICA_RFB[d] ?? "Descrição não cadastrada", codigo: formatarNaturezaCodigo(codigo) };
}

/** 2330305 → "2330-3/05". */
export function formatarCnae(codigo: string | null | undefined): string | null {
  const d = soDigitos(codigo);
  if (d.length !== 7) return codigo ?? null;
  return `${d.slice(0, 4)}-${d.slice(4, 5)}/${d.slice(5)}`;
}

export function descreverCnae(codigo: string | null | undefined) {
  const d = soDigitos(codigo);
  return {
    original: codigo ?? null,
    formatado: formatarCnae(codigo),
    descricao: CNAE_DESCRICAO[d] ?? CNAE_DESCRICAO_RFB[d] ?? "Descrição não cadastrada",
    concretoUsinado: CNAES_CONCRETO_USINADO.has(d),
  };
}

/** Classifica um link de evidência para exibição. */
export function classificarLink(url: string | null | undefined): "valido" | "ficticio" | "indisponivel" {
  if (!url || !url.trim()) return "indisponivel";
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "indisponivel";
  }
  if (!["http:", "https:"].includes(u.protocol)) return "indisponivel";
  if (/(^|\.)(invalid|example|test|localhost)$/.test(u.hostname) || u.hostname.startsWith("exemplo.")) return "ficticio";
  return "valido";
}

const CAMPO_LABEL: Record<string, string> = {
  logradouro: "endereço",
  situacaoCadastral: "situação na Receita",
  estabelecimento: "estabelecimento",
  nomeFantasia: "nome fantasia",
  razaoSocial: "razão social",
  cnaePrincipal: "CNAE principal",
  telefone1: "telefone",
  email: "e-mail",
  porte: "porte",
  capitalSocial: "capital social",
};

/** Frase simples para uma mudança entre competências. */
export function descreverMudanca(m: { tipo: string; campo: string | null; valorAnterior: string | null; valorNovo: string | null }): string {
  const campo = m.campo ? CAMPO_LABEL[m.campo] ?? m.campo : "dado";
  switch (m.tipo) {
    case "NOVO_ESTABELECIMENTO": return "Novo estabelecimento apareceu na Receita";
    case "SAIU_DO_FILTRO": return "Estabelecimento deixou de aparecer no filtro de CNAE";
    case "SITUACAO_ALTERADA": return "A situação na Receita mudou";
    case "ENDERECO_ALTERADO": return "O endereço mudou";
    case "CNAE_ALTERADO": return "O CNAE mudou";
    case "NOME_ALTERADO": return "O nome mudou";
    case "CONTATO_ALTERADO": return "O contato mudou";
    case "PORTE_ALTERADO": return "O porte mudou";
    case "CAPITAL_ALTERADO": return "O capital social mudou";
    default: return `Alteração em ${campo}`;
  }
}
