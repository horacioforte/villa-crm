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

// ─── v4 (05/10/2026): qualificação, contatos, pessoas e histórico ─────────────

/** Foco comercial: venda de equipamentos usados; locação é secundária. */
export const EQUIPAMENTOS = ["BOMBA_LANCA", "BOMBA_ESTACIONARIA", "CAMINHAO_BETONEIRA", "CENTRAL_CONCRETO", "TELEBELT", "PECAS_ACESSORIOS", "OUTRO"] as const;
export type Equipamento = (typeof EQUIPAMENTOS)[number];
export const EQUIPAMENTO_LABEL: Record<Equipamento, string> = {
  BOMBA_LANCA: "Bomba-lança",
  BOMBA_ESTACIONARIA: "Bomba estacionária",
  CAMINHAO_BETONEIRA: "Caminhão betoneira",
  CENTRAL_CONCRETO: "Central de concreto",
  TELEBELT: "Telebelt",
  PECAS_ACESSORIOS: "Peças e acessórios",
  OUTRO: "Outro",
};

export const NIVEIS_POTENCIAL = ["ALTO", "MEDIO", "BAIXO", "NENHUM", "DESCONHECIDO"] as const;
export type NivelPotencial = (typeof NIVEIS_POTENCIAL)[number];
export const NIVEL_LABEL: Record<NivelPotencial, string> = { ALTO: "Alto", MEDIO: "Médio", BAIXO: "Baixo", NENHUM: "Nenhum", DESCONHECIDO: "Não avaliado" };
export const NIVEL_COR: Record<NivelPotencial, string> = {
  ALTO: "bg-emerald-100 text-emerald-700",
  MEDIO: "bg-amber-100 text-amber-700",
  BAIXO: "bg-slate-100 text-slate-600",
  NENHUM: "bg-zinc-100 text-zinc-500",
  DESCONHECIDO: "bg-white text-slate-400 border border-slate-200",
};

export const PRIORIDADES = ["ALTA", "MEDIA", "BAIXA", "NAO_PRIORITARIA"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];
export const PRIORIDADE_LABEL: Record<Prioridade, string> = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa", NAO_PRIORITARIA: "Não prioritária" };
export const PRIORIDADE_COR: Record<Prioridade, string> = {
  ALTA: "bg-indigo-600 text-white",
  MEDIA: "bg-indigo-100 text-indigo-700",
  BAIXA: "bg-slate-100 text-slate-600",
  NAO_PRIORITARIA: "bg-zinc-100 text-zinc-500",
};

export const TIPOS_CONTATO = ["TELEFONE", "WHATSAPP", "EMAIL", "SITE", "LINKEDIN", "INSTAGRAM", "FACEBOOK", "OUTRO"] as const;
export type TipoContato = (typeof TIPOS_CONTATO)[number];
export const TIPO_CONTATO_LABEL: Record<TipoContato, string> = {
  TELEFONE: "Telefone", WHATSAPP: "WhatsApp", EMAIL: "E-mail", SITE: "Site", LINKEDIN: "LinkedIn", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", OUTRO: "Outro",
};

export const SITUACOES_VERIFICACAO = ["VERIFICADO", "NAO_VERIFICADO", "INVALIDO"] as const;
export type SituacaoVerificacao = (typeof SITUACOES_VERIFICACAO)[number];
export const SITUACAO_VERIFICACAO_LABEL: Record<SituacaoVerificacao, string> = { VERIFICADO: "Verificado", NAO_VERIFICADO: "Não verificado", INVALIDO: "Inválido" };

export const PAPEIS_PESSOA = ["PROPRIETARIO_SOCIO", "ADMINISTRADOR", "COMPRADOR", "RESPONSAVEL_FROTA", "RESPONSAVEL_MANUTENCAO", "RESPONSAVEL_EQUIPAMENTOS", "OUTRO"] as const;
export type PapelPessoa = (typeof PAPEIS_PESSOA)[number];
export const PAPEL_PESSOA_LABEL: Record<PapelPessoa, string> = {
  PROPRIETARIO_SOCIO: "Proprietário/sócio",
  ADMINISTRADOR: "Administrador",
  COMPRADOR: "Comprador",
  RESPONSAVEL_FROTA: "Responsável pela frota",
  RESPONSAVEL_MANUTENCAO: "Responsável pela manutenção",
  RESPONSAVEL_EQUIPAMENTOS: "Responsável pelos equipamentos",
  OUTRO: "Outro",
};

export const TIPO_EVENTO_LABEL: Record<string, string> = {
  VALIDACAO: "Validação",
  TIPO_UNIDADE: "Tipo de unidade",
  VINCULO_EMPRESA: "Vínculo com Empresa",
  EVIDENCIA: "Evidência",
  CONTATO: "Contato",
  PESSOA: "Pessoa",
  POTENCIAL_EQUIPAMENTO: "Potencial por equipamento",
  QUALIFICACAO: "Qualificação comercial",
  OUTRO: "Outro",
};
export const ORIGEM_LABEL: Record<string, string> = {
  TELA_BASE_NACIONAL: "Tela da Base Nacional",
  IMPORTACAO_RECEITA: "Importação da Receita",
  SCRIPT_DEMONSTRACAO: "Dados de demonstração",
  NAO_INFORMADA: "Não informada",
};
