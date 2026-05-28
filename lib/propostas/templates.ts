export const PROPOSTA_VARIAVEIS = [
  "cliente",
  "obra",
  "cidade",
  "estado",
  "tipo_servico",
  "valor",
  "prazo",
  "validade",
  "responsavel",
  "data",
] as const;

export type PropostaVariavel = (typeof PROPOSTA_VARIAVEIS)[number];

export type PropostaTemplate = {
  id: string;
  nome: string;
  tipoServico: string;
  titulo: string;
  descricao: string;
  escopo: string[];
  observacoesTecnicasPadrao: string;
  condicoesPagamentoPadrao: string;
};

export const PROPOSTA_TEMPLATES = [
  {
    id: "locacao-caminhao-betoneira",
    nome: "Locacao de caminhao betoneira",
    tipoServico: "Locacao de caminhao betoneira",
    titulo: "Proposta comercial para locacao de caminhao betoneira",
    descricao:
      "Fornecimento de caminhao betoneira Villa para apoio ao transporte e lancamento de concreto conforme demanda da obra.",
    escopo: [
      "Disponibilizacao do equipamento conforme agenda operacional aprovada.",
      "Operacao conduzida por equipe qualificada da Villa Empreendimentos.",
      "Acompanhamento comercial durante todo o periodo contratado.",
    ],
    observacoesTecnicasPadrao:
      "A obra deve garantir acesso seguro, area de manobra compativel e condicoes adequadas para operacao do equipamento.",
    condicoesPagamentoPadrao:
      "Pagamento conforme medicao aprovada, com faturamento e vencimento definidos entre as partes.",
  },
  {
    id: "locacao-bomba-lanca",
    nome: "Locacao de bomba lanca",
    tipoServico: "Locacao de bomba lanca",
    titulo: "Proposta comercial para locacao de bomba lanca",
    descricao:
      "Locacao de bomba lanca para concretagem com alcance e produtividade adequados ao planejamento da obra.",
    escopo: [
      "Mobilizacao da bomba lanca em data previamente alinhada.",
      "Operador especializado e suporte tecnico Villa durante a concretagem.",
      "Orientacao previa sobre posicionamento, acesso e seguranca operacional.",
    ],
    observacoesTecnicasPadrao:
      "O cliente deve confirmar volume, traco, horario de concreto e condicoes de patolamento antes da mobilizacao.",
    condicoesPagamentoPadrao:
      "Pagamento mediante aprovacao da medicao, impostos inclusos conforme regime fiscal aplicavel.",
  },
  {
    id: "locacao-bomba-estacionaria",
    nome: "Locacao de bomba estacionaria",
    tipoServico: "Locacao de bomba estacionaria",
    titulo: "Proposta comercial para locacao de bomba estacionaria",
    descricao:
      "Locacao de bomba estacionaria para bombeamento de concreto em obras com necessidade de linha e planejamento tecnico dedicado.",
    escopo: [
      "Disponibilizacao da bomba estacionaria e orientacao para montagem da linha.",
      "Operacao com equipe Villa conforme programacao aprovada.",
      "Apoio tecnico para conferir condicoes minimas de bombeamento.",
    ],
    observacoesTecnicasPadrao:
      "Linha, acessos e condicoes do concreto devem ser validados previamente para reduzir riscos de parada operacional.",
    condicoesPagamentoPadrao:
      "Condicoes comerciais sujeitas a confirmacao de escopo, periodo de locacao e volume previsto.",
  },
  {
    id: "telebelt",
    nome: "Telebelt",
    tipoServico: "Telebelt",
    titulo: "Proposta comercial para servico com Telebelt",
    descricao:
      "Solucao Telebelt para transporte e distribuicao de concreto ou agregados com eficiencia em areas de dificil acesso.",
    escopo: [
      "Mobilizacao do equipamento Telebelt conforme viabilidade operacional.",
      "Operacao assistida por equipe especializada.",
      "Planejamento de posicionamento e fluxo de abastecimento.",
    ],
    observacoesTecnicasPadrao:
      "A contratacao depende de avaliacao previa de acesso, altura, alcance e material a ser transportado.",
    condicoesPagamentoPadrao:
      "Faturamento conforme proposta aprovada e condicoes especificas de mobilizacao.",
  },
  {
    id: "central-in-loco",
    nome: "Central in loco",
    tipoServico: "Central in loco",
    titulo: "Proposta comercial para central de concreto in loco",
    descricao:
      "Implantacao e operacao de central in loco para fornecimento dedicado de concreto na obra do cliente.",
    escopo: [
      "Analise inicial de demanda, area disponivel e logistica de insumos.",
      "Operacao da central conforme parametros acordados.",
      "Controle operacional e acompanhamento de producao.",
    ],
    observacoesTecnicasPadrao:
      "A proposta final depende de estudo de volume, local de instalacao, energia, agua, licencas e acesso de fornecedores.",
    condicoesPagamentoPadrao:
      "Condicoes de pagamento definidas conforme prazo de contrato, volume estimado e estrutura necessaria.",
  },
  {
    id: "concreto-usinado",
    nome: "Concreto usinado",
    tipoServico: "Concreto usinado",
    titulo: "Proposta comercial para fornecimento de concreto usinado",
    descricao:
      "Fornecimento de concreto usinado com qualidade controlada para atender as necessidades tecnicas da obra.",
    escopo: [
      "Programacao de fornecimento conforme volume e janela de concretagem.",
      "Entrega com acompanhamento comercial Villa.",
      "Orientacao sobre informacoes necessarias de traco, slump e resistencia.",
    ],
    observacoesTecnicasPadrao:
      "Volumes, tracos, horarios e condicoes de descarga devem ser confirmados antes da producao.",
    condicoesPagamentoPadrao:
      "Pagamento conforme volume entregue e condicoes comerciais aprovadas no pedido.",
  },
  {
    id: "venda-equipamento-usado",
    nome: "Venda de equipamento usado",
    tipoServico: "Venda de equipamento usado",
    titulo: "Proposta comercial para venda de equipamento usado",
    descricao:
      "Venda de equipamento usado da Villa, conforme disponibilidade, estado de conservacao e condicoes negociadas.",
    escopo: [
      "Apresentacao do equipamento disponivel e suas principais caracteristicas.",
      "Negociacao comercial conforme estado atual e documentacao aplicavel.",
      "Apoio no alinhamento de retirada, entrega ou transferencia.",
    ],
    observacoesTecnicasPadrao:
      "Equipamento vendido no estado em que se encontra, salvo condicoes especificas registradas em contrato.",
    condicoesPagamentoPadrao:
      "Pagamento conforme negociacao aprovada, sujeito a confirmacao antes da reserva do equipamento.",
  },
  {
    id: "servicos-especiais",
    nome: "Servicos especiais",
    tipoServico: "Servicos especiais",
    titulo: "Proposta comercial para servicos especiais",
    descricao:
      "Atendimento Villa para demandas especiais de locacao, concretagem, bombeamento ou suporte operacional.",
    escopo: [
      "Levantamento comercial e tecnico da necessidade do cliente.",
      "Definicao de recursos, equipe e agenda conforme viabilidade.",
      "Execucao conforme escopo aprovado entre as partes.",
    ],
    observacoesTecnicasPadrao:
      "Servicos especiais podem exigir visita tecnica, validacao operacional e condicoes comerciais complementares.",
    condicoesPagamentoPadrao:
      "Condicoes comerciais definidas conforme escopo, prazo, equipe e recursos envolvidos.",
  },
] as const satisfies PropostaTemplate[];

export type PropostaTemplateId = (typeof PROPOSTA_TEMPLATES)[number]["id"];

export function getPropostaTemplate(templateId: string) {
  return PROPOSTA_TEMPLATES.find((template) => template.id === templateId);
}
