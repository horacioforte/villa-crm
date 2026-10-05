// ARQUIVO: lib/base-nacional/rotulos.ts
// REGRA: nunca remover. Apenas acrescentar.
// Rótulos e cores dos enums da Base Nacional de Concreteiras (somente apresentação).

export const STATUS_VALIDACAO = [
  "PENDENTE",
  "EM_VERIFICACAO",
  "PROVAVEL",
  "CONFIRMADA",
  "NAO_E_CONCRETEIRA",
  "INATIVA",
  "NAO_LOCALIZADA",
] as const;
export type StatusValidacao = (typeof STATUS_VALIDACAO)[number];

export const STATUS_LABEL: Record<StatusValidacao, string> = {
  PENDENTE: "Sem análise",
  EM_VERIFICACAO: "Em verificação",
  PROVAVEL: "Provável",
  CONFIRMADA: "Confirmada",
  NAO_E_CONCRETEIRA: "Não é concreteira",
  INATIVA: "Inativa",
  NAO_LOCALIZADA: "Não localizada",
};

export const STATUS_COR: Record<StatusValidacao, string> = {
  PENDENTE: "bg-slate-100 text-slate-600",
  EM_VERIFICACAO: "bg-amber-100 text-amber-700",
  PROVAVEL: "bg-violet-100 text-violet-700",
  CONFIRMADA: "bg-emerald-100 text-emerald-700",
  NAO_E_CONCRETEIRA: "bg-red-100 text-red-700",
  INATIVA: "bg-zinc-200 text-zinc-600",
  NAO_LOCALIZADA: "bg-orange-100 text-orange-700",
};

/** Agrupamentos usados no cabeçalho. */
export const GRUPO_EM_ANALISE: StatusValidacao[] = ["EM_VERIFICACAO", "PROVAVEL"];
export const GRUPO_DESCARTADO: StatusValidacao[] = ["NAO_E_CONCRETEIRA", "INATIVA", "NAO_LOCALIZADA"];

export const CONFIANCAS = ["ALTA", "MEDIA", "BAIXA"] as const;
export type Confianca = (typeof CONFIANCAS)[number];
export const CONFIANCA_LABEL: Record<Confianca, string> = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };
export const CONFIANCA_COR: Record<Confianca, string> = {
  ALTA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIA: "bg-amber-50 text-amber-700 border-amber-200",
  BAIXA: "bg-red-50 text-red-700 border-red-200",
};

export const TIPOS_UNIDADE = ["CENTRAL_CONCRETO", "ESCRITORIO", "FABRICA", "DEPOSITO", "DESCONHECIDA"] as const;
export type TipoUnidade = (typeof TIPOS_UNIDADE)[number];
export const TIPO_UNIDADE_LABEL: Record<TipoUnidade, string> = {
  CENTRAL_CONCRETO: "Central de concreto",
  ESCRITORIO: "Escritório",
  FABRICA: "Fábrica",
  DEPOSITO: "Depósito",
  DESCONHECIDA: "Não identificado",
};

export const TIPOS_ATIVIDADE = ["CONCRETO_USINADO", "ARGAMASSA", "PRE_MOLDADO", "BOMBEAMENTO", "OUTRA_ATIVIDADE", "DUVIDOSO"] as const;
export type TipoAtividade = (typeof TIPOS_ATIVIDADE)[number];
export const TIPO_ATIVIDADE_LABEL: Record<TipoAtividade, string> = {
  CONCRETO_USINADO: "Concreto usinado",
  ARGAMASSA: "Argamassa",
  PRE_MOLDADO: "Pré-moldado",
  BOMBEAMENTO: "Bombeamento",
  OUTRA_ATIVIDADE: "Outra atividade",
  DUVIDOSO: "Duvidoso",
};

/** Segmento (slug de SegmentoEmpresa) → tipo de atividade equivalente da candidata. */
export const SEGMENTO_PARA_ATIVIDADE: Record<string, TipoAtividade[]> = {
  concreteira: ["CONCRETO_USINADO"],
  "pre-moldado": ["PRE_MOLDADO"],
  "bombeamento-de-concreto": ["BOMBEAMENTO"],
};

export const SITUACAO_RECEITA_LABEL: Record<string, string> = {
  "01": "Nula",
  "02": "Ativa",
  "03": "Suspensa",
  "04": "Inapta",
  "08": "Baixada",
};

export const TIPO_MUDANCA_LABEL: Record<string, string> = {
  NOVO_ESTABELECIMENTO: "Novo estabelecimento",
  SAIU_DO_FILTRO: "Saiu do filtro",
  SITUACAO_ALTERADA: "Situação alterada",
  ENDERECO_ALTERADO: "Endereço alterado",
  CNAE_ALTERADO: "CNAE alterado",
  NOME_ALTERADO: "Nome alterado",
  CONTATO_ALTERADO: "Contato alterado",
  PORTE_ALTERADO: "Porte alterado",
  CAPITAL_ALTERADO: "Capital alterado",
  OUTRA: "Outra",
};

export const FONTE_LABEL: Record<string, string> = {
  RECEITA_FEDERAL: "Receita Federal",
  SITE_EMPRESA: "Site da empresa",
  GOOGLE_MAPS: "Google Maps",
  REDE_SOCIAL: "Rede social",
  LINKEDIN: "LinkedIn",
  NOTICIA: "Notícia",
  VAGA_EMPREGO: "Vaga de emprego",
  LICENCA_AMBIENTAL: "Licença ambiental",
  DIARIO_OFICIAL: "Diário Oficial",
  ASSOCIACAO_SETORIAL: "Associação setorial",
  CONTATO_DIRETO: "Contato direto",
  OUTRA: "Outra",
};
