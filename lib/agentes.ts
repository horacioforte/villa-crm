export type AgentePromptInput = {
  nome: string;
  descricao: string;
  personalidade: string;
  regrasQuente: string;
  regrasMedia: string;
  regrasFria: string;
  ignorar: string;
  exemplosLead: string;
  exemplosNaoLead: string;
  historicoErros: string;
};

export type InitialAgenteConfig = AgentePromptInput & {
  agente: "MARIA" | "JOAO";
};

export const initialAgenteConfigs: InitialAgenteConfig[] = [
  {
    agente: "MARIA",
    nome: "Maria",
    descricao:
      "SDR receptiva da Villa. Recebe leads inbound via formulário, email e WhatsApp.",
    personalidade:
      "Rápida, precisa, simpática, organizada. Tom humano, nunca robótico. Uma pergunta por mensagem.",
    regrasQuente:
      "Volume > 500m³/mês | Prazo < 30 dias | Perguntou preço | Mencionou urgência | Obra com data definida",
    regrasMedia:
      "Interesse claro mas sem urgência | Pediu informações gerais | Sem prazo definido",
    regrasFria:
      "Apenas curiosidade | Sem dados de obra | Email genérico sem detalhes",
    ignorar:
      "Spam | Newsletter | Marketing | Fornecedores | Concorrentes | Emails sem relação com concreto",
    exemplosLead:
      "Preciso de bomba para obra em Recife, agosto, 800m³/mês | Orçamento betoneira urgente | Central de concreto para condomínio",
    exemplosNaoLead:
      "Promoção de software | Vaga de emprego | Fornecedor de cimento",
    historicoErros: "",
  },
  {
    agente: "JOAO",
    nome: "João",
    descricao:
      "SDR ativo da Villa. Prospecta obras no PNCP, LinkedIn e notícias de construção.",
    personalidade: "",
    regrasQuente: "",
    regrasMedia: "",
    regrasFria: "",
    ignorar: "",
    exemplosLead: "",
    exemplosNaoLead: "",
    historicoErros: "",
  },
];

export function gerarPromptCompleto(config: AgentePromptInput) {
  return [
    `# ${config.nome} — Villa Empreendimentos`,
    "",
    "## Descricao",
    config.descricao,
    "",
    "## Personalidade",
    config.personalidade,
    "",
    "## Regras de qualificacao",
    "",
    "### Lead QUENTE",
    config.regrasQuente,
    "",
    "### Lead MEDIA",
    config.regrasMedia,
    "",
    "### Lead FRIO",
    config.regrasFria,
    "",
    "## Ignorar completamente",
    config.ignorar,
    "",
    "## Exemplos de leads reais",
    config.exemplosLead,
    "",
    "## Exemplos de nao-leads",
    config.exemplosNaoLead,
    "",
    "## Historico de correcoes",
    config.historicoErros || "Nenhuma correcao registrada.",
  ].join("\n");
}
