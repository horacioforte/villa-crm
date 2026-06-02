export const PROPOSTA_VARIAVEIS = [
  "cliente",
  "obra",
  "telefone",
  "email",
  "cidade",
  "estado",
  "tipo_servico",
  "quantidade",
  "descricao_comercial",
  "horas_garantidas",
  "preco_unitario",
  "valor",
  "prazo",
  "validade",
  "responsavel",
  "data",
  "numero_proposta",
  "observacoes_comerciais",
  "hora_extra",
  "singular_plural",
  "singular_plural_caps",
  "singular_plural_operador",
  "equipamento_plural",
  "nos_equipamentos",
  "dos_equipamentos",
  "aos_equipamentos",
  "os_equipamentos",
  "os_pronome",
  "numero_por_extenso",
] as const;

export type PropostaVariavel = (typeof PROPOSTA_VARIAVEIS)[number];
export type TipoBlocoGovernanca =
  | "BLOQUEADO"
  | "EDITAVEL"
  | "EDITAVEL_COM_APROVACAO";

export type PropostaTemplateBlocoDef = {
  chave: string;
  titulo: string;
  tipo: TipoBlocoGovernanca;
  ordem: number;
  conteudo: string;
};

export type PropostaTemplateDefaults = {
  descricaoComercial: string;
  horasGarantidas: string;
  prazoExecucao: string;
  validadeDias: number;
  horaExtra?: string;
};

export type PropostaTemplate = {
  id: string;
  codigo: string;
  nome: string;
  tipoServico: string;
  titulo: string;
  descricao: string;
  disponivel: boolean;
  escopo: string[];
  observacoesTecnicasPadrao: string;
  condicoesPagamentoPadrao: string;
  defaults: PropostaTemplateDefaults;
  blocos: PropostaTemplateBlocoDef[];
};

export type PropostaBlocoSnapshot = PropostaTemplateBlocoDef & {
  conteudoOriginal: string;
  conteudoAtual: string;
};

export type PropostaTemplateVariables = Partial<
  Record<PropostaVariavel, string>
>;

const bloco = (
  ordem: number,
  chave: string,
  titulo: string,
  tipo: TipoBlocoGovernanca,
  linhas: string[],
): PropostaTemplateBlocoDef => ({
  ordem,
  chave,
  titulo,
  tipo,
  conteudo: linhas.join("\n"),
});

export const PROPOSTA_TEMPLATES = [
  {
    id: "locacao-betoneira-com-operador",
    codigo: "CBCO",
    nome: "Locação de betoneira com operador",
    tipoServico: "CAMINHÕES BETONEIRAS COM OPERADORES",
    titulo:
      "Proposta comercial para locação de caminhões betoneiras com operadores",
    descricao:
      "Template oficial CBCO extraido da minuta padrao aprovada pelo comercial.",
    disponivel: true,
    escopo: [
      "Fornecimento de caminhões betoneiras com operadores para prestação de serviço mensal.",
      "Documento com valor de pré-contrato até assinatura do contrato definitivo.",
    ],
    observacoesTecnicasPadrao:
      "Equipamentos com capacidade de 8m3, operação em 1 turno e manutenção conforme minuta oficial CBCO.",
    condicoesPagamentoPadrao:
      "Medição mensal, faturamento após aprovação e boleto com vencimento em até 15 dias, sujeito à aprovação cadastral financeira.",
    defaults: {
      descricaoComercial: "Caminhão Betoneira - 8m3 com operador",
      horasGarantidas: "200h",
      prazoExecucao: "Início na chegada do equipamento à obra",
      validadeDias: 5,
      horaExtra: "225,00",
    },
    blocos: [
      bloco(10, "cabecalho", "Cabeçalho e saudação", "EDITAVEL", [
        "Proposta Nº {{numero_proposta}}                                    Recife, {{data}}.",
        "À",
        "{{cliente}}",
        "Obra: {{obra}}",
        "Fone: {{telefone}}",
        "Email: {{email}}",
        "Prezado(a) Cliente,",
        "Conforme solicitação de V. Sa., temos o prazer de apresentar nossa proposta de locação de {{tipo_servico}}, conforme segue:",
      ]),
      bloco(20, "condicoes_base", "Condições base", "BLOQUEADO", [
        "Todas as condições, principalmente no que diz respeito a preços e responsabilidades contidas nesta proposta/pré-contrato, são baseadas nas informações passadas no ato da solicitação da proposta pela empresa solicitante.",
        "Caso durante a prestação dos serviços/locação o escopo seja alterado, principalmente quanto ao local de carregamento do concreto, será feita nova proposta ou aditivo contratual.",
        "Caso o local de carregamento seja superior a 30 km do local da concretagem, a Contratada deverá aprovar previamente as solicitações de saída dos equipamentos, podendo reprovar os pedidos. Em caso de aprovação, serão acrescidos seguros totais e taxas adicionais por quilômetros excedentes cobrados da Contratante.",
      ]),
      bloco(30, "objeto", "1. Objeto", "BLOQUEADO", [
        "Fornecimento de {{singular_plural}}, para prestação de serviço mensal.",
      ]),
      bloco(40, "responsabilidade_contratada", "2. Responsabilidade da Contratada", "BLOQUEADO", [
        "{{singular_plural_caps}} com capacidade de 8m3, da marca Schwing ou similar.",
        "ESPECIFICAÇÕES {{dos_equipamentos}}:",
        "Modelo: Caminhão VW 26.280 ou similar",
        "Balão: 8 m3",
        "Tração: 6X4 (Traçado)",
        "Cor: Branca (Cabine e Betoneira)",
        "Ano: 2020 a 2024 com Ar Condicionado",
        "*Não é permitido colocar nenhum tipo de adesivo que obstrua ou dificulte as identificações da Villa Empreendimentos {{nos_equipamentos}}, seja total ou parcial*",
        "O implemento tem capacidade máxima de 8 m3, devendo a Contratante respeitar os pesos máximos estabelecidos pelo fabricante e pela legislação de balança vigente.",
        "Fornecimento de manutenção preventiva conforme manual dos fabricantes, incluindo troca periódica de óleos e filtros, verificação e manutenção agendada de componentes sujeitos a desgaste.",
        "A Contratada também se responsabiliza pela manutenção corretiva.",
        "Operador para 1 (um) turno de trabalho e {{equipamento_plural}}: segunda a quinta das 07h00 às 17h00, com intervalo de 1h para refeição; sexta das 07h00 às 16h00, com intervalo de 1h para refeição.",
        "Após o turno estabelecido, sábado, domingo e feriado serão cobrados como extra.",
        "Impostos inclusos referentes à locação {{dos_equipamentos}}.",
        "A Contratada possui documentação legal para cadastro da empresa e de seus funcionários, incluindo documentação de Segurança do Trabalho e Medicina, como PPRA e PCMSO. Ajustes ou modificações nesses programas terão custos repassados à Contratante.",
        "A Contratada não se responsabiliza por concretos perdidos por especificidades técnicas, como slump, traço, concreto vencido, desagregado ou desargamassado, nem por qualquer outro custo, independentemente de sua natureza, mesmo em caso de falha mecânica, ressalvados sinistros cobertos por seguros existentes no equipamento.",
      ]),
      bloco(50, "responsabilidade_contratante", "3. Responsabilidade da Contratante", "BLOQUEADO", [
        "Durante a vigência do contrato, a Contratante assume integral responsabilidade pela guarda e segurança {{dos_equipamentos}}, protegendo-{{os_pronome}} contra ação danosa de terceiros e por prejuízos causados a terceiros, pessoas ou bens, por uso inadequado, imperícia, imprudência ou dolo.",
        "Garantir que os acessos estejam em bom estado de conservação para o tráfego {{dos_equipamentos}}, minimizando os riscos de dano aos mesmos. No caso de danos aos pneus e molas, causados por má qualidade dos acessos, os custos com conserto e/ou troca assim como as horas paradas para o conserto, serão de responsabilidade da Contratante; caso seja identificado algum problema com acesso que venha prejudicar a operação a Contratada poderá se negar a operacionalizar no local e qualquer tipo de dano que possa vir a acontecer será responsabilidade da Contratante;",
        "Fiscalizar as velocidades {{dos_equipamentos}} no canteiro ou vias de acesso, principalmente controles semanais dos tacógrafos, assumindo custos decorrentes de acidentes com excesso de velocidade.",
        "Disponibilizar ajudante para operação do equipamento nos canteiros de obras, caso julgue necessário.",
        "Fornecer alimentação, alojamento e transporte para operador, supervisor, mecânicos e técnico de segurança quando enviados à obra.",
        "Os alojamentos deverão atender às NR 18 e NR 24.",
        "Eventuais diferenças salariais, benefícios ou valores exigidos por sindicato local serão medidos e pagos pela Contratada e posteriormente apresentados em medição para repasse à Contratante.",
        "Responsabilizar-se pelo abastecimento e reposição de todos os insumos necessários ao funcionamento do caminhão e implementos, observando especificações do fabricante e classificação ambiental do veículo, incluindo diesel adequado, ARLA 32, óleos, graxas e demais fluidos necessários.",
        "Disponibilizar local adequado para limpeza diária {{dos_equipamentos}}, observando normas técnicas e ambientais brasileiras. Multas, autuações ou não conformidades serão de responsabilidade da Contratante.",
        "Toda e qualquer quebra, deverá ser solicitado o reparo por e-mail pelas pessoas envolvidas na contratação:",
        "Comercial: comercial@villaempreendimentos.com.br;",
        "Logística: logistica@villaempreendimentos.com.br;",
        "Operação: marcio@villaempreendimentos.com.br;",
        "O atendimento às solicitações deverá ocorrer em até 24 horas do recebimento da comunicação. A partir da chegada do técnico ou mecânico, a Contratada terá até 72 horas para reparo ou substituição sem desconto; ultrapassado esse prazo, o tempo excedente será descontado proporcionalmente.",
        "Reparos poderão ocorrer na obra, em unidade da Contratante ou em unidade da Contratada, quando necessária estrutura mais adequada.",
        "A Contratante deverá assinar controles de bombeamento/transporte de concreto (mapas diários) no dia seguinte ao trabalho/disposição. A falta de assinatura poderá interromper os trabalhos e somente esses mapas terão validade para medição.",
        "Devolver {{os_equipamentos}} nas mesmas condições em que foram recebidos e documentados no checklist de entrega, principalmente quanto a resíduos de concreto e avarias.",
      ]),
      bloco(60, "precos", "4. Preços", "EDITAVEL", [
        "O preço ofertado nesta proposta será o seguinte:",
        "Qtd.: {{quantidade}}",
        "Descrição: {{descricao_comercial}}",
        "Horas Garantidas: {{horas_garantidas}}",
        "Preço Unit./mês: {{preco_unitario}}",
        "Preço Total/mês: {{valor}}",
        "Hora Extra/h: {{hora_extra}}",
        "{{observacoes_comerciais}}",
      ]),
      bloco(70, "observacoes_preco", "Observações de preço e horas extras", "EDITAVEL_COM_APROVACAO", [
        "Obs.01: Será cobrado R$ 14,00 por KM rodado referente à mobilização e desmobilização de cada equipamento, pago antecipadamente. Equipamento sairá de Bezerros-PE ou Barra Funda-SP conforme disponibilidade.",
        "Obs.02: Os serviços com transporte de concreto são concluídos diariamente após a lavagem do equipamento, que em média dura 1h00.",
        "Obs.03: Equipamentos destinados à execução de meios-fios e trabalhos similares, por trabalharem em meia embreagem, terão substituição do kit de embreagem. Havendo essa operação, custos com dias parados, peças e mão de obra serão repassados à Contratante.",
        "Obs.04: Os horários de trabalho deverão respeitar o descanso dos funcionários entre jornadas conforme legislação vigente.",
        "Obs.05: A Contratada declara que não disponibiliza seguro total dos equipamentos. Caso haja interesse da Contratante em transitar com os caminhões, a Contratada poderá cotar seguro e repassar o custo na medição mensal, desde que previamente aprovado.",
        "Os equipamentos serão contratados com 200 horas mínimas.",
        "Hora Extra | Valor da Hora Extra",
        "Caminhão betoneira/ operador | R$ 225,00",
        "Não será concedido desconto por dias parados devido a períodos festivos, feriados ou recessos indicados pela Contratante.",
        "Para cálculo proporcional de valores, considera-se o mês com 30 dias corridos, independentemente do número real de dias.",
      ]),
      bloco(80, "prazo_duracao", "5. Prazo para inicialização e 6. Duração do contrato", "EDITAVEL_COM_APROVACAO", [
        "5. Prazo para inicialização da locação:",
        "O contrato começa a prevalecer na chegada do equipamento à obra, independentemente do tempo em que permaneça parado aguardando trâmites legais da Contratante ou de seu cliente.",
        "6. Duração do Contrato:",
        "O contrato terá duração mínima de 03 (três) meses, podendo ser renovado por período maior conforme necessidade da Contratante.",
        "Caso a devolução {{dos_equipamentos}} ocorra antes do período mínimo, as mensalidades restantes serão pagas integralmente sem abatimento até a data da efetiva devolução.",
        "O instrumento poderá ser rescindido por qualquer parte, a qualquer momento, sem motivo relevante, mediante comunicação prévia de 15 dias, sempre por e-mail.",
        "A Contratante deverá informar a Contratada com prazo mínimo de 15 dias para devolução {{dos_equipamentos}}. A falta dessa informação acarretará cobrança da diferença dos dias mencionados.",
      ]),
      bloco(90, "contrato_pagamento", "7. Elaboração do contrato e 8. Medição, faturamento e pagamento", "EDITAVEL_COM_APROVACAO", [
        "7. Elaboração do Contrato:",
        "Serão feitos dois contratos: um referente a 90% do faturamento, com fatura de locação de equipamento, e outro referente a 10% de locação de mão de obra, com nota fiscal.",
        "Esta proposta tem valor de pré-contrato e garante o pagamento das medições mensais nos seus termos, mesmo que o contrato definitivo esteja em assinatura.",
        "8. Medição, Faturamento e Pagamento:",
        "Os serviços executados serão medidos do dia 1º ao último dia do mês anterior ao mês de pagamento.",
        "No primeiro dia útil subsequente aos 30 dias de utilização, a Contratada emitirá Boletim de Medição e enviará à Contratante, que terá até 5 dias corridos para aprovação.",
        "O pagamento deverá ser efetuado exclusivamente via boleto bancário até o 15º dia corrido contado do fechamento da medição.",
        "Após aprovação expressa ou tácita, caso a Contratante não aprove o Boletim de Medição no prazo, a Contratada emitirá fatura e boleto com vencimento em até 15 dias.",
        "As condições de faturamento estão sujeitas à aprovação do cadastro financeiro.",
        "Faturas emitidas com incorreções ou em desacordo com a legislação serão devolvidas e o prazo de pagamento será o mesmo indicado acima.",
        "A impontualidade sujeitará a Contratante a multa de 2% sobre o valor devido, além de juros de mora de 1% ao mês calculados pro rata die a partir do primeiro dia subsequente ao vencimento.",
        "Caso as faturas não sejam aceitas sem motivo justo, serão aplicadas todas as penalidades previstas.",
        "Qualquer tolerância no recebimento fora do prazo não constituirá novação nem precedente.",
        "Após 48 horas do vencimento sem pagamento, a Contratada poderá paralisar a operação sem penalidade, independentemente de notificação, contabilizando {{os_equipamentos}} como à disposição até regularização.",
        "Inadimplência superior a 15 dias autoriza rescisão a critério da Contratada, com pagamento imediato de parcelas em atraso, correções, multas e perdas e danos. A Contratante deverá devolver o equipamento no prazo máximo de 10 dias úteis, assumindo custos de remoção, transporte e logística.",
      ]),
      bloco(100, "reajuste_validade", "9. Reajustes e 10. Validade da proposta", "EDITAVEL_COM_APROVACAO", [
        "9. Reajustes:",
        "Os preços estabelecidos nesta proposta serão reajustados semestralmente, com base nos índices de reajustes da construção civil que melhor se adequarem ao serviço prestado de acordo com a FGV.",
        "10. Validade da proposta:",
        "A proposta terá validade de {{validade}}.",
      ]),
      bloco(110, "assinaturas", "11. Aceite, assinaturas e testemunhas", "BLOQUEADO", [
        "Confirmamos e estamos de acordo com os serviços ofertados nesta proposta de nº {{numero_proposta}}, como também todos os seus termos.",
        "{{cliente}}",
        "_________________________________",
        "Assinatura",
        "Nome:",
        "Cargo:",
        "Data:_____/____/_______",
        "__________________________________",
        "Carimbo CNPJ",
        "{{cliente}}",
        "_________________________________",
        "Assinatura",
        "Nome:",
        "Cargo:",
        "Data:_____/____/_______",
        "__________________________________",
        "Carimbo CNPJ",
        "Atenciosamente,",
        "Morgana Albertim",
        "Supervisora Comercial",
        "Villa Empreendimentos",
        "Testemunha:",
        "Nome:",
        "CPF:",
        "Testemunha:",
        "Nome:",
        "CPF:",
      ]),
    ],
  },
  {
    id: "locacao-betoneira-sem-operador",
    codigo: "CBSO",
    nome: "Locação de betoneira sem operador",
    tipoServico: "CAMINHÕES BETONEIRAS SEM OPERADORES",
    titulo:
      "Proposta comercial para locação de caminhões betoneiras sem operadores",
    descricao:
      "Template oficial CBSO extraido da minuta padrao aprovada pelo comercial.",
    disponivel: true,
    escopo: [
      "Locacao de caminhoes betoneiras sem operadores para periodo mensal.",
      "Documento com valor de pre-contrato ate assinatura do contrato definitivo.",
    ],
    observacoesTecnicasPadrao:
      "Os equipamentos devem ser operados pela Locataria conforme manual, checklist e responsabilidades previstas na minuta oficial.",
    condicoesPagamentoPadrao:
      "Medicao mensal, faturamento apos aprovacao e boleto com vencimento em ate 25 dias, sujeito a aprovacao cadastral financeira.",
    defaults: {
      descricaoComercial: "Caminhão Betoneira - 8m3",
      horasGarantidas: "180h",
      prazoExecucao: "Retirada em até 72h após solicitação formal por e-mail",
      validadeDias: 30,
      horaExtra: "166,67",
    },
    blocos: [
      bloco(10, "cabecalho", "Cabeçalho e saudação", "EDITAVEL", [
        "Proposta Nº {{numero_proposta}}                                    Recife, {{data}}.",
        "À",
        "{{cliente}}",
        "Obra: {{obra}}",
        "Fone: {{telefone}}",
        "Email: {{email}}",
        "Prezado(a) Cliente,",
        "Conforme solicitação de V. Sa., temos o prazer de apresentar nossa proposta de locação de {{tipo_servico}}, conforme segue:",
      ]),
      bloco(20, "condicoes_base", "1. Objeto", "BLOQUEADO", [
        "Todas as condições, principalmente no que diz respeito a preços e responsabilidades contidas nesta proposta/pré-contrato, são baseadas nas informações passadas no ato da solicitação da proposta pela empresa solicitante. Caso durante a prestação dos serviços/locação o escopo seja alterado, principalmente no que se diz respeito ao local de carregamento do concreto, será feita uma nova proposta/aditivo contratual para a mudança/nova prestação do serviço. Caso o local de carregamento seja superior a 30 km do local da concretagem, a LOCADORA deverá aprovar previamente as solicitações de saída {{dos_equipamentos}}, reservando-se o direito de reprovar os pedidos. Em caso de aprovação, serão acrescidos os seguros totais {{dos_equipamentos}}, bem como serão aplicadas taxas adicionais por quilômetros excedentes que serão cobradas da LOCATÁRIA;",
        "Locação de {{tipo_servico}} para período mensal;",
      ]),
      bloco(30, "responsabilidade_locadora", "2. Responsabilidade da Locadora", "BLOQUEADO", [
        "Fornecimento de {{singular_plural_caps}} com capacidade de 8m³, em boas condições de uso e operação;",
        "ESPECIFICAÇÕES {{dos_equipamentos}}:",
        "Modelos: Caminhão VW, Mercedez ou Volvo",
        "Balão: 8 m³ Siti ou Similar",
        "Tração: 6X4 (Traçado)",
        "Cor: Branca e Azul (Cabine e Betoneira)",
        "Ano: 2019 a 2025 com AR Condicionado",
        "*Não é permitido colocar nenhum tipo de adesivo que obstrua ou dificulte as identificações da Villa Empreendimentos {{nos_equipamentos}}, seja total ou parcial*",
        "O implemento betoneira possui capacidade maxima de 8 m3, devendo a Locataria respeitar rigorosamente os limites de peso estabelecidos pelo fabricante e pela legislacao de transito vigente, especialmente quanto ao peso bruto total e peso por eixo em fiscalizacoes de balanca rodoviaria, considerando que o peso do metro cubico de concreto pode variar conforme sua composicao;",
        "Todas as multas, autuacoes ou penalidades de transito, incluindo aquelas decorrentes de excesso de peso, excesso por eixo ou irregularidades na circulacao dos veiculos, serao de inteira responsabilidade da Locataria, que tambem devera realizar a identificacao do condutor junto aos orgaos competentes, isentando a Locadora de qualquer responsabilidade durante o periodo da locacao;",
        "Garantia por equipamento e de 180 horas/mes (horimetro);",
        "Obs.: A disponibilidade contratada considera {{os_equipamentos}} e o que ultrapassar as 180 horas/mes (horimetro) sera cobrado como horas excedentes;",
        "O estado de conservacao {{dos_equipamentos}} sera verificado atraves de um Termo de Vistoria/Checklist composto por fotografias e descricoes detalhadas, o qual sera assinado por ambas as partes, antecedente a retirada {{dos_equipamentos}} na sede da Locadora;",
        "A Locataria reconhece o recebimento {{dos_equipamentos}} em perfeito estado de funcionamento, com vistoria devidamente realizada e aptidão técnica para a finalidade contratada. Assim, qualquer perda de concreto, inutilizacoes de concreto transportado {{nos_equipamentos}}, incluindo, mas nao se limitando a problemas relacionados a slump inadequado, traco incorreto, desagregacao, desargamassado, concreto vencido ou qualquer outro fator tecnico que venha a comprometer a integridade do material ainda que decorrente de eventual falha mecanica de algum equipamento durante o transporte ou a concretagem, sera de inteira e exclusiva responsabilidade da Locataria;",
        "Impostos inclusos referentes as locacoes {{dos_equipamentos}};",
        "A Locadora assumira custos com pneus dentro das seguintes regras: A vida util de um pneu para uso fora da estrada e aproximadamente 80.000km sendo 40.000km para primeira vida e 40.000km para as duas outras coberturas de vidas, em caso de pneus rasgados ou danificados por impacto, sera responsabilidade da Locataria. Todos os pneus sao marcados e catalogados existindo um acompanhamento de suas vidas uteis;",
        "A Locadora assumira o custo com molas quebradas dentro do tempo de vida util de 06 (seis) meses para arqueamento. Molas quebradas e ou danificadas fora deste criterio, sera de total responsabilidade da Locataria;",
        "Manutenção preventiva - A Locadora será responsável por indicar a oficina ou concessionária para a realização das manutenções preventivas, bem como por arcar integralmente com os custos decorrentes desses serviços. A Locatária, por sua vez, deverá conduzir os equipamentos até o local indicado, sendo certo que o tempo despendido para tal procedimento não acarretará qualquer desconto nas medições. Fica ainda estabelecido que todas as despesas relacionadas ao deslocamento dos equipamentos até a oficina e o retorno à obra - incluindo, mas não se limitando, a custos de combustível, lubrificantes, pedágios, pneus, molas, sinistros, acidentes e quaisquer outros encargos ocorridos durante o trajeto - serão de inteira e exclusiva responsabilidade da Locatária, não cabendo à Locadora qualquer ônus ou corresponsabilidade por tais ocorrências;",
        "Disponibilização de equipamento substituto - A Locadora disponibilizará outro equipamento em caso de defeito grave não reparável na obra. Se constatado mau uso pela Locatária, todos os custos de substituição e reparo serão de sua responsabilidade;",
        "Fornecimento de manual e orientação de uso;",
        "Treinamento básico e orientação técnica da operação {{dos_equipamentos}};",
      ]),
      bloco(40, "responsabilidade_locataria", "3. Responsabilidade da Locatária", "BLOQUEADO", [
        "Devolução {{dos_equipamentos}} - A Locatária deverá devolver {{os_equipamentos}} nas mesmas condições em que foram recebidos, conforme registrado no check-list de entrega, especialmente quanto a resíduos de concreto e avarias. A Locatária será integral e exclusivamente responsável por quaisquer danos {{aos_equipamentos}}, incluindo tombamento, perda total, avarias decorrentes de acidentes, ou qualquer outra situação similar, considerando que não há seguro para {{os_equipamentos}}. Ademais, a Locatária reconhece e aceita ser exclusivamente responsável por quaisquer acidentes, danos materiais ou morais, lucros cessantes, prejuízos diretos ou indiretos que venham a ocorrer durante a vigência deste contrato, seja contra {{os_equipamentos}} da Locadora, contra terceiros ou contra pessoas físicas, em razão da operação {{dos_equipamentos}} por seus funcionários, prepostos ou quaisquer pessoas indicadas por ela. Todos os custos decorrentes dessas ocorrências, incluindo reparo, substituição, transporte e eventuais indenizações, serão de responsabilidade exclusiva da Locatária;",
        "Não ceder ou transferir o presente contrato, sob qualquer forma, no todo ou em parte, a quem quer que seja, sem prévia autorização, por escrito da Locadora;",
        "A Locatária se compromete, portanto, a arcar com todos os custos e indenizações decorrentes de tais eventos, isentando a Locadora de qualquer responsabilidade civil ou penal relativa à operação dos equipamentos durante o período da locação;",
        "Disponibilizar mão de obra qualificada para operação {{dos_equipamentos}};",
        "Disponibilizar bons acessos ou caminhos de serviço em boas condições de trânsito e segurança como também controlar as velocidades {{dos_equipamentos}};",
        "Utilizar {{os_equipamentos}} exclusivamente para os fins a que se destinam, observando rigorosamente as orientações constantes no manual do fabricante. Fica expressamente proibido o reboque ou tração {{dos_equipamentos}} por outros veículos ou máquinas, tais como tratores;",
        "Descartar os resíduos de concretos em espaços de bota fora se responsabilizando por qualquer penalidade de não cumprimento perante as leis vigentes, principalmente as ambientais;",
        "A Locatária deverá responsabilizar-se integralmente pela guarda e segurança {{dos_equipamentos}}, mantendo-{{os_pronome}} em local seguro, com controle de acesso, vigilância e, sempre que possível, monitoramento eletrônico. Durante todo o período da locação, a Locatária será responsável por qualquer ocorrência de roubo, furto, tentativa de furto, vandalismo, desaparecimento ou dano {{aos_equipamentos}}, inclusive quanto a pequenos furtos de componentes ou acessórios, tais como, mas não se limitando a baterias, pneus (inclusive estepe), macaco, triângulo, ferramentas, equipamentos de apoio ou quaisquer itens que integrem ou acompanhem o caminhão. Em qualquer dessas hipóteses, caberá exclusivamente à Locatária providenciar a imediata reposição ou indenização correspondente, isentando a Locadora de qualquer responsabilidade sobre tais ocorrências durante o período da locação.",
        "A responsabilidade técnica, civil e penal pelos serviços executados com {{os_equipamentos}};",
        "Manutenção Corretiva - A Locatária será responsável pela execução integral da manutenção corretiva {{dos_equipamentos}} locados independente da causa da falha, incluindo substituição de peças, mão de obra, transporte e custos decorrentes do tempo de paralisação, em razão de ser a responsável direta pela operação {{dos_equipamentos}}. A peça danificada deverá ser removida pela Locatária e enviada, sob ciência da Locadora, para análise técnica do fabricante, cujo laudo será vinculante para definição da responsabilidade:",
        "Constatado defeito de fabricação ou desgaste natural dentro da vida útil, os custos serão assumidos pela Locadora, que providenciará o desconto em medição;",
        "Identificado mau uso ou sobrecarga ou até instalação inadequada (caso tenha sido uma peça anteriormente substituída pela Locatária) os custos serão de responsabilidade exclusiva da Locatária.",
        "Caso a Locatária tenha interesse na disponibilização de um mecânico em regime full time, será cobrado valor adicional ao contrato. A atuação desse profissional terá caráter exclusivamente de apoio, não implicando em qualquer responsabilidade técnica, operacional, civil, ou penal da Locadora, ficando ele subordinado integralmente às ordens e diretrizes da Locatária;",
        "A locação contempla a visita periódica de um supervisor, porém, os custos com alimentação, alojamento e transporte do mesmo dentro da obra, deverão ser de responsabilidade da Locatária;",
        "Caso a Locatária tenha interesse na disponibilização de um supervisor full time de logística em seu projeto, com a finalidade exclusiva de apoiar e dar celeridade à execução dos serviços de transporte, será cobrado um valor adicional ao contrato. Fica estabelecido que a atuação desse supervisor terá caráter meramente consultivo e de acompanhamento, não implicando, em hipótese alguma, na assunção de responsabilidades técnicas, operacionais, civis ou penais por parte da Locadora. O referido supervisor estará integralmente subordinado às diretrizes, ordens e determinações da Locatária, sendo esta a única e exclusiva responsável por toda a operação dos equipamentos e pelos resultados decorrentes;",
        "Realizar as manutenções e verificações diárias (níveis de óleo, vazamentos, lubrificação, reapertos, substituição de lâmpadas, conforme manual dos fabricantes localizados no interior dos caminhões), zelando pela conservação e bom funcionamento dos equipamentos;",
        "Abastecer com combustível de acordo com a classificação do ano e modelo do caminhão: euro 3, combustível S500 ou euro 5, combustível S10, como também aditivos do combustível (ARLA) óleo Shell Tellus 68 e completar os produtos engraxantes dos equipamentos. Se algum equipamento apresentar problemas, decorrente da má qualidade do combustível ou a falta de alguma responsabilidade acima, os custos com a franquia e demais despesas com o conserto do equipamento serão de total responsabilidade da Locatária;",
        "Toda e qualquer quebra ou reparo realizado nos equipamentos deverá ser imediatamente comunicado pela Locatária à Locadora, por e-mail, através dos endereços oficiais: comercial@villaempreendimentos.com.br, logistica@villaempreendimentos.com.br, marcio@villaempreendimentos.com.br e logistica1@villaempreendimentos.com.br;",
        "A Locatária reconhece que é de sua exclusiva responsabilidade informar a Locadora todas as ocorrências e intervenções de manutenção ou reparo executadas nos equipamentos, sob pena de responder integralmente por quaisquer danos, perdas ou prejuízos decorrentes da ausência de comunicação. Serão de responsabilidade da Locatária os custos com os dias parados e as despesas referentes aos reparos;",
        "Manter os equipamentos sempre limpos, preservando a aparência externa, incluindo a cabine do caminhão, e realizar a limpeza interna dos balões e implementos, prevenindo o acúmulo de concreto em facas, bicas e demais componentes;",
        "Comunicar a Locatária e a autoridade policial competente a ocorrência de sinistro com os citados equipamentos, solicitando a lavratura do competente boletim de ocorrência, imediatamente após a ocorrência do fato, encaminhamento a cópia do mesmo à Locadora;",
        "A Locatária deverá entregar cópia dos discos do tacógrafo de cada equipamento, à Locadora, no fechamento de cada mês;",
        "A Locatária se responsabiliza em assinar os controles de transporte de concreto (mapas diários), no dia seguinte ao trabalho/disposição. A falta desta assinatura pode interromper a continuidade dos trabalhos. Para a Locadora só esses mapas terão validade, onde os mesmos servirão para comprovar os dias de cobranças que constarão em medição;",
        "No término da vigência, a Locatária se obriga ainda a devolver os equipamentos na sede da Locadora após a aprovação do checklist/termo de vistoria onde os mesmos deverão estar no mesmo estado de conservação registrado no momento checklist da retirada. A Locadora poderá reprovar o checklist caso seja identificado qualquer desacordo ou irregularidade nos equipamentos, cabendo a Locatária executar, as suas expensas, todos os serviços necessários para que o bem seja entregue em pleno funcionamento e em perfeitas condições de uso, conforme constatado no referido documento;",
      ]),
      bloco(50, "precos", "4. Preços", "EDITAVEL", [
        "Os preços ofertados nesta proposta serão os seguintes:",
        "Qtd.: {{quantidade}}",
        "Descrição: {{descricao_comercial}}",
        "Horas Garantidas: {{horas_garantidas}}",
        "Preço Unit./mês: {{preco_unitario}}",
        "Preço Total/mês: {{valor}}",
        "Hora Extra/h: {{hora_extra}}",
        "{{observacoes_comerciais}}",
      ]),
      bloco(60, "observacoes_preco", "Observações de preço", "EDITAVEL_COM_APROVACAO", [
        "Obs.01: Caso as horas garantidas no periodo mensal nao sejam atingidas, a Locataria obriga-se a realizar o pagamento do valor integral da franquia mensal, conforme acordado na tabela constante do item 4 acima.",
        "Obs.02: A retirada e o transporte {{dos_equipamentos}} sao de responsabilidade da Locataria. Isso inclui todos os deslocamentos {{dos_equipamentos}}, bem como a mobilizacao e desmobilizacao, tendo como ponto de partida a base da Locadora, localizada em Bezerros-PE.",
        "Obs.03: Caso as 180 horas minimas sejam ultrapassadas, a Locataria devera pagar, alem da franquia acordada, o valor proporcional as horas excedentes, no montante de R$ 166,67 (cento e sessenta e seis reais e sessenta e sete centavos) por hora.",
        "Obs.04: Nao sera concedido nenhum tipo de desconto na locacao {{dos_equipamentos}} da Contratada por dias parados devido a periodos festivos, feriados ou recessos indicados pela Contratante.",
        "Obs.05: A Locadora declara que nao disponibiliza seguros {{dos_equipamentos}}. No entanto, caso haja interesse da Locataria, a Locadora podera realizar a cotacao do seguro correspondente e repassar o respectivo custo na medicao mensal acrescido dos seus impostos, desde que previamente aprovado pela Locataria.",
        "Obs.06: Para fins de calculo proporcional de valores, considera-se o mes como composto por 30 (trinta) dias corridos, independentemente do numero real de dias no mes.",
      ]),
      bloco(70, "prazo_duracao", "5. Prazo para inicialização e 6. Duração do contrato", "EDITAVEL_COM_APROVACAO", [
        "5. Prazo para inicializacao do contrato:",
        "A retirada podera ser programada para sair da Matriz da Locadora, em ate 72 (setenta e duas) horas apos a sua solicitacao formal via e-mail, a contar da assinatura desta proposta, pois ela tem valor de pre-contrato ate a assinatura do contrato;",
        "O contrato comeca a prevalecer na saida {{dos_equipamentos}} na sede da Locadora;",
        "6. Duracao do Contrato:",
        "O contrato tera duracao minima de 03 (tres) meses, podendo ser renovado por um periodo maior, de acordo com a necessidade da Locataria;",
        "Na hipotese de a Locataria solicitar a desmobilizacao {{dos_equipamentos}} antes do termino do prazo minimo de 03 (tres) meses, sera obrigada a pagar, a titulo de multa compensatoria, o valor correspondente a franquia minima de 03 (tres) meses, independentemente do periodo efetivamente utilizado;",
        "Independente se a devolucao {{dos_equipamentos}} esteja ou nao no prazo vigente do contrato, a Locataria devera informar a Locadora com um prazo minimo de 15 (quinze) dias, para devolucao {{dos_equipamentos}} hora locados, para que a mesma possa proceder com os tramites de recebimento. A falta desta informacao acarretara a cobranca da diferenca dos dias acima mencionados;",
        "A Locataria sera responsavel pela devolucao {{dos_equipamentos}} na sede da Locadora, como ja mencionado anteriormente, em data previamente acordada, nas mesmas condicoes de uso e conservacao de acordo com o checklist de retirada, conforme previsto nas demais clausulas contratuais;",
      ]),
      bloco(80, "contrato_pagamento", "7. Elaboração do contrato e 8. Medição, faturamento e pagamento", "EDITAVEL_COM_APROVACAO", [
        "7. Elaboração do Contrato:",
        "Sera feito 01 contrato de locacao de equipamentos que representa 100% (cem por cento) do faturamento;",
        "Esta proposta tem carater de pre-contrato, garantindo que os servicos realizados possam ser medidos e faturados mensalmente, onde as faturas deverao ser pagas nos seus respectivos vencimentos, mesmo que o contrato definitivo ainda esteja em processo de assinatura ou em analise;",
        "Podera o presente instrumento ser rescindido por qualquer uma das partes, em qualquer momento, respeitando os 03 (tres) meses minimos de contrato, sem que haja qualquer tipo de motivo relevante, mediante simples e expressa comunicacao previa, no prazo de 15 (quinze) dias de antecedencia, sempre formalizado via e-mail;",
        "8. Medicao, Faturamento e Pagamento:",
        "Os servicos executados serao medidos no periodo do dia 1° ao ultimo dia do mes anterior ao mes em que sera efetuado o pagamento;",
        "No primeiro dia util subsequente aos 30 (trinta) dias de utilizacao {{dos_equipamentos}} ora locados, a Locadora ira emitir, entao, o Boletim de Medicao, onde constara o total da medicao do mes vencido, devendo, ato continuo, no mesmo dia envia-la para a Locataria, a qual, por sua vez, tera o prazo maximo de 5 (cinco) dias corridos, contados do seu recebimento, para sua aprovacao;",
        "Apos a aprovacao prevista no item anterior, seja de forma expressa ou tacita, caso a Locataria nao aprove o Boletim de Medicao dentro do prazo estabelecido, a Locadora devera emitir e enviar a Locataria a fatura correspondente a locacao, juntamente com o boleto bancario, com vencimento em ate 25 (vinte e cinco) dias;",
        "Obs.: condicoes de faturamento acima indicadas estao sujeitas a aprovacao do cadastro financeiro.",
        "Caso as faturas tenham sido emitidas com incorrecoes ou em desacordo com a legislacao vigente serao devolvidas e o prazo para pagamento sera o mesmo indicado nos pontos acima;",
        "A impontualidade no pagamento sujeitara a Locataria ao pagamento de juros de mora a razao de 1% (um por cento) ao mes, multa de 2% (dois por cento) apos o 1º (primeiro) dia corrido do vencimento, independente da correcao monetaria e das demais sancoes previstas em Lei e no presente contrato, aplicaveis as hipoteses de inadimplente;",
        "Obs.: Serao aplicadas todas as penalidades previstas na clausula acima, caso as faturas nao sejam aceitas sem motivo justo pela Locataria.",
        "Qualquer eventual tolerancia da Locadora no recebimento das faturas, fora do prazo pactuado, nao constituira novacao nem, tampouco, servira para alegacao de existencia de precedente para repeticao do fato tolerado;",
        "Caso a Locataria nao realize o pagamento na data do seu vencimento corrente, apos o prazo de 48 (quarenta e oito) horas do vencimento da fatura, a Locadora podera paralisar a operacao {{dos_equipamentos}} locados, sem que ocorra qualquer tipo de penalidade, independente de previa notificacao, e o periodo sera contabilizado com {{os_equipamentos}} a disposicao ate a regularizacao da pendencia;",
        "Caso a Locataria se torne inadimplente por periodo superior a 15 (quinze) dias, contados a partir do vencimento da fatura correspondente, a Locadora podera rescindir o presente contrato, a seu exclusivo criterio, sem necessidade de notificacao adicional. Nessa hipotese, a Locataria sera responsavel pelo pagamento imediato de todas as parcelas em atraso, devidamente corrigidas e atualizadas, incluindo multas e eventuais perdas e danos previstos neste contrato. A Locataria devera devolver {{os_equipamentos}} no prazo maximo de 05 (cinco) dias uteis, considerando o tempo necessario para organizacao das desmobilizacoes. Caso a devolucao nao ocorra dentro do prazo estipulado, a Locadora estara autorizada a recolher {{os_equipamentos}} no canteiro de obras da Locataria, que desde ja se declara livre e desimpedida para a retirada. Todos os custos decorrentes da remocao, transporte e logistica {{dos_equipamentos}} serao de responsabilidade exclusiva da Locataria, devendo ser pagos de imediato apos a conclusao da retirada;",
      ]),
      bloco(90, "reajuste_validade", "9. Reajustes e 10. Validade da proposta", "EDITAVEL_COM_APROVACAO", [
        "9. Reajustes:",
        "Os precos estabelecidos nesta proposta serao reajustados semestralmente, com base nos indices de reajustes da construcao civil que melhor se adequarem a locacao de acordo com a FGV (Fundacao Getulio Vargas);",
        "Na ocorrencia de fatos ou hipoteses nao previstas nem disciplinadas neste documento, na ausencia de um contrato selado posteriormente, as partes se reportarao ao que a respeito dispoe a legislacao civil e comercial brasileira aplicavel a especie;",
        "10. Validade da proposta:",
        "A proposta tera validade de {{validade}};",
      ]),
      bloco(100, "assinaturas", "11. Aceite, assinaturas e testemunhas", "BLOQUEADO", [
        "Confirmamos e estamos de acordo com os serviços ofertados nesta proposta de nº {{numero_proposta}}, como também todos os seus termos.",
        "{{cliente}}",
        "_________________________________",
        "Assinatura",
        "Nome:",
        "Cargo:",
        "Data:_____/____/_______",
        "__________________________________",
        "Carimbo CNPJ",
        "{{cliente}}",
        "_________________________________",
        "Assinatura",
        "Nome:",
        "Cargo:",
        "Data:_____/____/_______",
        "__________________________________",
        "Carimbo CNPJ",
        "Atenciosamente,",
        "Morgana Albertim",
        "Supervisora Comercial",
        "Villa Empreendimentos",
        "Testemunha:",
        "Nome:",
        "CPF:",
        "Testemunha:",
        "Nome:",
        "CPF:",
      ]),
    ],
  },
  {
    id: "locacao-bomba-concreto-com-operacao",
    codigo: "ABCO",
    nome: "Locação de bomba de concreto com operação",
    tipoServico: "AUTO BOMBA COM LANÇA DE CONCRETO COM OPERADOR",
    titulo:
      "Proposta comercial para locação de auto bomba com lança de concreto com operador",
    descricao:
      "Template oficial de auto bomba extraido da minuta padrao aprovada pelo comercial.",
    disponivel: true,
    escopo: [
      "Fornecimento de auto bomba com lança de concreto com operador para prestação de serviço mensal.",
      "Documento com valor de pré-contrato até assinatura do contrato definitivo.",
    ],
    observacoesTecnicasPadrao:
      "Auto bomba com lança Schwing ou similar, operação em 1 turno e manutenção conforme minuta oficial.",
    condicoesPagamentoPadrao:
      "Medição mensal, faturamento após aprovação e boleto com vencimento em até 15 dias, sujeito à aprovação cadastral financeira.",
    defaults: {
      descricaoComercial: "Auto Bomba Lança 32 metros",
      horasGarantidas: "1.800 m3/mês",
      prazoExecucao: "Início na chegada do equipamento à obra",
      validadeDias: 5,
      horaExtra: "350,00",
    },
    blocos: [
      bloco(10, "cabecalho", "Cabeçalho e saudação", "EDITAVEL", [
        "Proposta Nº {{numero_proposta}}                                    Recife, {{data}}.",
        "À",
        "{{cliente}}",
        "Obra: {{obra}}",
        "Email: {{email}}",
        "Prezado(a) Cliente,",
        "Conforme solicitação de V. Sa., temos o prazer de apresentar nossa proposta de locação de {{tipo_servico}}, conforme segue:",
      ]),
      bloco(20, "objeto", "1. Objeto", "BLOQUEADO", [
        "Fornecimento de AUTO BOMBA COM LANÇA COM OPERADOR, para prestação de serviço mensal.",
      ]),
      bloco(30, "responsabilidade_contratada", "2. Responsabilidade da Contratada", "BLOQUEADO", [
        "Auto bomba com lança da marca Schwing ou similar.",
        "*Não é permitido colocar nenhum tipo de adesivo que obstrua ou dificulte as identificações da Villa Empreendimentos no equipamento, seja total ou parcial*",
        "Fornecimento de manutenção preventiva conforme manual dos fabricantes, incluindo troca periódica de óleos e filtros, verificação e manutenção agendada de componentes sujeitos a desgaste. A Contratada também se responsabiliza pela manutenção corretiva.",
        "1 (um) turno de trabalho para operador e equipamento: segunda a quinta das 07h00 às 17h00, com intervalo de 1h para refeição; sexta das 07h00 às 16h00, com intervalo de 1h para refeição.",
        "Após o turno estabelecido, sábado, domingo e feriado serão cobrados como extra.",
        "Impostos inclusos referentes à locação do equipamento e serviço.",
        "A Contratada possui documentação legal para cadastro da empresa e de seus funcionários, bem como documentação de Segurança do Trabalho e Medicina, como PPRA e PCMSO. Ajustes ou modificações nesses programas terão custos repassados à Contratante.",
        "A Contratada não se responsabiliza por concretos perdidos decorrentes de especificidades técnicas, como slump, traço, concreto vencido, desagregado ou desargamassado, nem por qualquer outro custo, independentemente de sua natureza, mesmo em caso de falha mecânica, ressalvados sinistros cobertos por seguros existentes no equipamento.",
      ]),
      bloco(40, "responsabilidade_contratante", "3. Responsabilidade da Contratante", "BLOQUEADO", [
        "Durante a vigência do contrato, a Contratante assume integral responsabilidade pela guarda e segurança do equipamento, protegendo-o contra ação danosa de terceiros e respondendo por prejuízos causados a terceiros, pessoas ou bens, por uso inadequado, imperícia, imprudência ou dolo.",
        "Garantir acessos em bom estado de conservação para tráfego do equipamento. Danos a pneus e molas causados por má qualidade dos acessos, bem como horas paradas para conserto, serão de responsabilidade da Contratante.",
        "Fiscalizar velocidades do equipamento no canteiro ou vias de acesso, especialmente controles semanais de tacógrafos, assumindo custos decorrentes de acidentes com excesso de velocidade.",
        "Disponibilizar ajudante para operação do equipamento nos canteiros de obras.",
        "Eventuais diferenças salariais, benefícios ou valores exigidos por sindicato local serão medidos e pagos pela Contratada e posteriormente apresentados em medição para repasse à Contratante.",
        "Fornecer alimentação, alojamento e transporte para operador, supervisor, mecânicos e técnico de segurança quando enviados à obra. Os alojamentos deverão atender às NR 18 e NR 24.",
        "Responsabilizar-se pelo abastecimento e reposição de todos os insumos necessários ao funcionamento do caminhão e implementos, observando especificações do fabricante e classificação ambiental do veículo, incluindo diesel adequado, ARLA 32, óleos, graxas e demais fluidos necessários.",
        "Disponibilizar local adequado para limpeza diária dos equipamentos, atendendo normas técnicas e ambientais brasileiras. Multas, autuações ou não conformidades serão de responsabilidade da Contratante.",
        "O local de limpeza deverá conter boa iluminação para serviços à noite, água pressurizada, liberação de uso de produtos químicos e descarte de resíduos de concreto. A falta desses itens poderá causar endurecimento de resíduos na tubulação e componentes, cuja remoção será de responsabilidade da Contratante, com dias parados contabilizados como à disposição.",
        "Toda e qualquer quebra, deverá ser solicitado o reparo por e-mail pelas pessoas envolvidas na contratação:",
        "Comercial: comercial@villaempreendimentos.com.br;",
        "Logística: logistica@villaempreendimentos.com.br;",
        "Operação: marcio@villaempreendimentos.com.br;",
        "O atendimento às solicitações deverá ocorrer em até 24 horas do recebimento da comunicação. A partir da chegada do técnico ou mecânico, a Contratada terá até 72 horas para reparo ou substituição sem desconto; ultrapassado esse prazo, o tempo excedente será descontado proporcionalmente.",
        "Reparos poderão ocorrer na obra, em unidade da Contratante ou em unidade da Contratada, quando necessária estrutura mais adequada.",
        "A Contratante deverá assinar controles de bombeamento/transporte de concreto (mapas diários) no dia seguinte ao trabalho/disposição. A falta de assinatura poderá interromper os trabalhos e somente esses mapas terão validade para medição.",
      ]),
      bloco(50, "precos", "4. Preços", "EDITAVEL", [
        "O preço estabelecido por equipamento será o seguinte:",
        "Qtd.: {{quantidade}}",
        "Descrição: {{descricao_comercial}}",
        "Volume mínimo: {{horas_garantidas}}",
        "Preço por m³: {{preco_unitario}}",
        "Valor total: {{valor}}",
        "{{observacoes_comerciais}}",
      ]),
      bloco(60, "precos_referencia", "Tabela oficial de referência", "EDITAVEL_COM_APROVACAO", [
        "Auto Bomba Lança 32 metros | Volume mínimo/mês: 1.800 m3 | Valor m3: R$ 55,00 | Mensalidade: R$ 99.000,00",
        "Auto Bomba Lança 36 metros | Volume mínimo/mês: 2.000 m3 | Valor m3: R$ 55,00 | Mensalidade: R$ 110.000,00",
        "Auto Bomba Lança 38 metros | Volume mínimo/mês: 2.000 m3 | Valor m3: R$ 55,00 | Mensalidade: R$ 110.000,00",
        "Auto Bomba Lança 42/43 metros | Volume mínimo/mês: 2.200 m3 | Valor m3: R$ 55,00 | Mensalidade: R$ 121.000,00",
        "Auto Bomba Lança 56/58 metros | Volume mínimo/mês: 3.500 m3 | Valor m3: R$ 65,00 | Mensalidade: R$ 227.500,00",
        "Obs.01: Será cobrado R$ 14,00 por KM rodado referente à mobilização e desmobilização de cada equipamento, pago antecipadamente. Equipamento sairá de Bezerros-PE ou Barra Funda-SP conforme disponibilidade.",
        "Obs.02: Os serviços com bombeamento de concreto são concluídos diariamente após a lavagem do equipamento, que em média dura 1h00.",
        "Obs.03: A Contratada declara que não disponibiliza seguro total dos equipamentos. Caso haja interesse da Contratante em transitar com a Auto Bomba Lança, a Contratada poderá cotar seguro e repassar o custo na medição mensal, desde que previamente aprovado.",
        "Obs.04: Equipamentos destinados à execução de meios-fios e trabalhos similares, por trabalharem em meia embreagem, terão substituição do kit de embreagem. Havendo essa operação, custos com dias parados, peças e mão de obra serão repassados à Contratante.",
        "Obs.05: Caso a garantia mínima descrita na tabela não seja atingida pela Contratante no período mensal, o valor acordado continuará devido à Contratada, independentemente do produzido.",
      ]),
      bloco(70, "trabalho_extra", "Trabalho fora do expediente", "EDITAVEL_COM_APROVACAO", [
        "Os serviços realizados pela auto bomba lança aos sábados, domingos, feriados e horários fora do expediente normal serão cobrados separadamente por hora excedente, sem alterar o volume mínimo mensal contratado.",
        "Auto bomba lança 28 metros: R$ 350,00 por hora excedente.",
        "Auto bomba lança 32 metros: R$ 350,00 por hora excedente.",
        "Auto bomba lança 36 metros: R$ 350,00 por hora excedente.",
        "Auto bomba lança 38 metros: R$ 350,00 por hora excedente.",
        "Auto bomba lança 42/43 metros: R$ 350,00 por hora excedente.",
        "Auto bomba lança 56/58 metros: R$ 450,00 por hora excedente.",
        "Não será concedido desconto por dias parados devido a períodos festivos, feriados ou recessos indicados pela Contratante.",
        "Para cálculo proporcional de valores, considera-se o mês com 30 dias corridos, independentemente do número real de dias.",
      ]),
      bloco(80, "prazo_inicializacao", "5. Prazo para inicialização do serviço", "EDITAVEL_COM_APROVACAO", [
        "O contrato começa a prevalecer na chegada do equipamento à obra, independentemente do tempo em que permaneça parado aguardando trâmites legais da Contratante ou de seu cliente.",
      ]),
      bloco(90, "duracao_contrato", "6. Duração do contrato", "EDITAVEL_COM_APROVACAO", [
        "O contrato terá duração mínima de 03 (três) meses, podendo ser renovado por período maior conforme necessidade da Contratante.",
        "Caso a devolução do equipamento ocorra antes do período mínimo, as mensalidades restantes serão pagas integralmente sem abatimento até a data da efetiva devolução.",
        "O instrumento poderá ser rescindido por qualquer parte, a qualquer momento, sem motivo relevante, mediante comunicação prévia de 15 dias, sempre por e-mail.",
        "A Contratante deverá informar a Contratada com prazo mínimo de 15 dias para devolução do equipamento locado. A falta dessa informação acarretará cobrança da diferença dos dias mencionados.",
      ]),
      bloco(100, "elaboracao_contrato", "7. Elaboração do contrato", "EDITAVEL_COM_APROVACAO", [
        "Serão feitos dois contratos: um referente a 90% do faturamento, com fatura de locação de equipamento, e outro referente a 10% com nota fiscal de locação de mão de obra.",
        "Esta proposta tem valor de pré-contrato e garante o pagamento das medições mensais nos seus termos, mesmo que o contrato definitivo esteja em assinatura.",
      ]),
      bloco(110, "medicao_pagamento", "8. Medição, faturamento e pagamento", "EDITAVEL_COM_APROVACAO", [
        "Os serviços executados serão medidos do dia 1º ao último dia do mês anterior ao mês de pagamento.",
        "No primeiro dia útil subsequente aos 30 dias de utilização, a Contratada emitirá Boletim de Medição e enviará à Contratante, que terá até 5 dias corridos para aprovação.",
        "O pagamento deverá ser efetuado exclusivamente via boleto bancário até o 15º dia corrido contado do fechamento da medição.",
        "Após aprovação expressa ou tácita, caso a Contratante não aprove o Boletim de Medição no prazo, a Contratada emitirá fatura e boleto com vencimento em até 15 dias.",
        "As condições de faturamento estão sujeitas à aprovação do cadastro financeiro.",
        "Faturas emitidas com incorreções ou em desacordo com a legislação serão devolvidas e o prazo de pagamento será o mesmo indicado acima.",
        "A impontualidade sujeitará a Contratante a multa de 2% sobre o valor devido, além de juros de mora de 1% ao mês calculados pro rata die a partir do primeiro dia subsequente ao vencimento.",
        "Caso as faturas não sejam aceitas sem motivo justo, serão aplicadas todas as penalidades previstas.",
        "Qualquer tolerância no recebimento fora do prazo não constituirá novação nem precedente.",
        "Após 48 horas do vencimento sem pagamento, a Contratada poderá paralisar a operação sem penalidade, independentemente de notificação, contabilizando o equipamento como à disposição até regularização.",
        "Inadimplência superior a 15 dias autoriza rescisão a critério da Contratada, com pagamento imediato de parcelas em atraso, correções, multas e perdas e danos. A Contratante deverá devolver o equipamento no prazo máximo de 10 dias úteis, assumindo custos de remoção, transporte e logística.",
      ]),
      bloco(120, "reajustes", "9. Reajustes", "EDITAVEL_COM_APROVACAO", [
        "Os preços estabelecidos nesta proposta serão reajustados anualmente, com base nos índices de reajustes da construção civil que melhor se adequarem ao serviço prestado de acordo com a FGV (Fundação Getúlio Vargas);",
      ]),
      bloco(130, "validade", "10. Validade da proposta", "EDITAVEL_COM_APROVACAO", [
        "A proposta terá validade de {{validade}}.",
      ]),
      bloco(140, "assinaturas", "11. Aceite, assinaturas e testemunhas", "BLOQUEADO", [
        "Confirmamos e estamos de acordo com os serviços ofertados nesta proposta de nº {{numero_proposta}}, como também todos os seus termos.",
        "{{cliente}}",
        "_________________________________",
        "Assinatura",
        "Nome:",
        "Cargo:",
        "Data:_____/____/_______",
        "__________________________________",
        "Carimbo CNPJ",
        "{{cliente}}",
        "_________________________________",
        "Assinatura",
        "Nome:",
        "Cargo:",
        "Data:_____/____/_______",
        "__________________________________",
        "Carimbo CNPJ",
        "Atenciosamente,",
        "Morgana Albertim",
        "Supervisora Comercial",
        "Villa Empreendimentos",
        "Testemunha:",
        "Nome:",
        "CPF:",
        "Testemunha:",
        "Nome:",
        "CPF:",
      ]),
    ],
  },
] as const satisfies PropostaTemplate[];

export type PropostaTemplateId = (typeof PROPOSTA_TEMPLATES)[number]["id"];

export function getPropostaTemplate(templateId: string) {
  return PROPOSTA_TEMPLATES.find((template) => template.id === templateId);
}

export function interpolateTemplate(
  content: string,
  variables: PropostaTemplateVariables,
) {
  return content.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, key: string) => {
    const value = variables[key as PropostaVariavel];
    return value && value.trim() ? value : "Nao informado";
  });
}

export function buildTemplateBlocosSnapshot(
  templateId: string,
  variables: PropostaTemplateVariables,
): PropostaBlocoSnapshot[] {
  const template = getPropostaTemplate(templateId);

  if (!template?.disponivel) {
    return [];
  }

  return template.blocos.map((item) => {
    const conteudo = interpolateTemplate(item.conteudo, variables);

    return {
      ...item,
      conteudoOriginal: conteudo,
      conteudoAtual: conteudo,
    };
  });
}
