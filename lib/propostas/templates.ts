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
    id: "locacao-caminhao-betoneira-sem-operador",
    codigo: "CBSO",
    nome: "Locacao de caminhoes betoneiras sem operadores",
    tipoServico: "Locacao de caminhoes betoneiras sem operadores",
    titulo:
      "Proposta comercial para locacao de caminhoes betoneiras sem operadores",
    descricao:
      "Template master oficial Villa/CBSO extraido da minuta padrao aprovada.",
    disponivel: true,
    escopo: [
      "Locacao de caminhoes betoneiras sem operadores para periodo mensal.",
      "Documento com valor de pre-contrato ate assinatura do contrato definitivo.",
    ],
    observacoesTecnicasPadrao:
      "Os equipamentos devem ser operados pela Locataria conforme manual, checklist e responsabilidades previstas na minuta oficial.",
    condicoesPagamentoPadrao:
      "Medicao mensal, faturamento apos aprovacao e boleto com vencimento em ate 25 dias, sujeito a aprovacao cadastral financeira.",
    blocos: [
      bloco(10, "cabecalho", "Dados da proposta", "EDITAVEL", [
        "Proposta N˚ {{numero_proposta}}                                    Recife, {{data}}.",
        "A",
        "{{cliente}}",
        "Obra: {{obra}}",
        "Fone: {{telefone}}",
        "Email: {{email}}",
        "Prezado(a) Cliente,",
        "Conforme solicitacao de V. Sa., temos o prazer de apresentar nossa proposta de locacao de CAMINHOES BETONEIRAS SEM OPERADORES, conforme segue:",
      ]),
      bloco(20, "condicoes_base", "Condicoes base e escopo", "BLOQUEADO", [
        "Todas as condicoes, principalmente no que diz respeito a precos e responsabilidades contidas nesta proposta/pre-contrato, sao baseadas nas informacoes passadas no ato da solicitacao da proposta pela empresa solicitante. Caso durante a prestacao dos servicos/locacao o escopo seja alterado, principalmente no que se diz respeito ao local de carregamento do concreto, sera feita uma nova proposta/aditivo contratual para a mudanca/nova prestacao do servico. Caso o local de carregamento seja superior a 30 km do local da concretagem, a LOCADORA devera aprovar previamente as solicitacoes de saida dos equipamentos, reservando-se o direito de reprovar os pedidos. Em caso de aprovacao, serao acrescidos os seguros totais dos equipamentos, bem como serao aplicadas taxas adicionais por quilometros excedentes que serao cobradas da LOCATARIA;",
        "Objeto:",
        "Locacao de CAMINHOES BETONEIRAS SEM OPERADORES para periodo mensal;",
      ]),
      bloco(30, "responsabilidade_locadora", "Responsabilidade da Locadora", "BLOQUEADO", [
        "Fornecimento de Caminhoes betoneiras com capacidade de 8m3 que deverao estar aptos e em bom estado de uso;",
        "ESPECIFICACOES DOS EQUIPAMENTOS:",
        "Modelos: Caminhao VW, Mercedez ou Volvo",
        "Balao: 8 m3 Siti ou Similar",
        "Tracao: 6X4 (Tracado)",
        "Cor: Branca e Azul (Cabine e Betoneira)",
        "Ano: 2019 a 2025 com AR Condicionado",
        "*Nao e permitido colocar nenhum tipo de adesivo que obstrua ou dificulte as identificacoes da Villa Empreendimentos nos equipamentos, seja total ou parcial*",
        "O implemento betoneira possui capacidade maxima de 8 m3, devendo a Locataria respeitar rigorosamente os limites de peso estabelecidos pelo fabricante e pela legislacao de transito vigente, especialmente quanto ao peso bruto total e peso por eixo em fiscalizacoes de balanca rodoviaria, considerando que o peso do metro cubico de concreto pode variar conforme sua composicao;",
        "Todas as multas, autuacoes ou penalidades de transito, incluindo aquelas decorrentes de excesso de peso, excesso por eixo ou irregularidades na circulacao dos veiculos, serao de inteira responsabilidade da Locataria, que tambem devera realizar a identificacao do condutor junto aos orgaos competentes, isentando a Locadora de qualquer responsabilidade durante o periodo da locacao;",
        "Garantia por equipamento e de 180 horas/mes (horimetro);",
        "Obs.: Os equipamentos estarao disponiveis e o que ultrapassar as 180 horas/mes (horimetro) serao cobrados como horas excedentes;",
        "O estado de conservacao dos equipamentos sera verificado atraves de um Termo de Vistoria/Checklist composto por fotografias e descricoes detalhadas, o qual sera assinado por ambas as partes, antecedente a retirada dos equipamentos na sede da Locadora;",
        "A Locataria reconhece que os equipamentos foram entregues em perfeito estado de funcionamento, com vistoria devidamente realizada, e que sao tecnicamente aptos para a finalidade contratada. Assim, qualquer perda de concreto, inutilizacoes de concreto transportado nos equipamentos locados, incluindo, mas nao se limitando a problemas relacionados a slump inadequado, traco incorreto, desagregacao, desargamassado, concreto vencido ou qualquer outro fator tecnico que venha a comprometer a integridade do material ainda que decorrente de eventual falha mecanica de algum equipamento durante o transporte ou a concretagem, sera de inteira e exclusiva responsabilidade da Locataria;",
        "Impostos inclusos referentes as locacoes dos equipamentos;",
        "A Locadora assumira custos com pneus dentro das seguintes regras: A vida util de um pneu para uso fora da estrada e aproximadamente 80.000km sendo 40.000km para primeira vida e 40.000km para as duas outras coberturas de vidas, em caso de pneus rasgados ou danificados por impacto, sera responsabilidade da Locataria. Todos os pneus sao marcados e catalogados existindo um acompanhamento de suas vidas uteis;",
        "A Locadora assumira o custo com molas quebradas dentro do tempo de vida util de 06 (seis) meses para arqueamento. Molas quebradas e ou danificadas fora deste criterio, sera de total responsabilidade da Locataria;",
        "Manutencao preventiva - A Locadora sera responsavel por indicar a oficina ou concessionaria para a realizacao das manutencoes preventivas, bem como por arcar integralmente com os custos decorrentes desses servicos. A Locataria, por sua vez, devera conduzir os equipamentos ate o local indicado, sendo certo que o tempo despendido para tal procedimento nao acarretara qualquer desconto nas medicoes. Fica ainda estabelecido que todas as despesas relacionadas ao deslocamento dos equipamentos ate a oficina e o retorno a obra - incluindo, mas nao se limitando, a custos de combustivel, lubrificantes, pedagios, pneus, molas, sinistros, acidentes e quaisquer outros encargos ocorridos durante o trajeto - serao de inteira e exclusiva responsabilidade da Locataria, nao cabendo a Locadora qualquer onus ou corresponsabilidade por tais ocorrencias;",
        "Disponibilizacao de equipamento substituto - A Locadora disponibilizara outro equipamento em caso de defeito grave nao reparavel na obra. Se constatado mau uso pela Locataria, todos os custos de substituicao e reparo serao de sua responsabilidade;",
        "Fornecimento de manual e orientacao de uso;",
        "Treinamento basico e orientacao tecnica da operacao dos equipamentos;",
      ]),
      bloco(40, "responsabilidade_locataria", "Responsabilidade da Locataria", "BLOQUEADO", [
        "Devolucao dos Equipamentos - A Locataria devera devolver os equipamentos nas mesmas condicoes em que foram recebidos, conforme registrado no check-list de entrega, especialmente quanto a residuos de concreto e avarias. A Locataria sera integral e exclusivamente responsavel por quaisquer danos aos equipamentos, incluindo tombamento, perda total, avarias decorrentes de acidentes, ou qualquer outra situacao similar, considerando que os equipamentos nao possuem seguro. Ademais, a Locataria reconhece e aceita ser exclusivamente responsavel por quaisquer acidentes, danos materiais ou morais, lucros cessantes, prejuizos diretos ou indiretos que venham a ocorrer durante a vigencia deste contrato, seja contra os equipamentos da Locadora, contra terceiros ou contra pessoas fisicas, em razao da operacao dos equipamentos por seus funcionarios, prepostos ou quaisquer pessoas indicadas por ela. Todos os custos decorrentes dessas ocorrencias, incluindo reparo, substituicao, transporte e eventuais indenizacoes, serao de responsabilidade exclusiva da Locataria;",
        "Nao ceder ou transferir o presente contrato, sob qualquer forma, no todo ou em parte, a quem quer que seja, sem previa autorizacao, por escrito da Locadora;",
        "A Locataria se compromete, portanto, a arcar com todos os custos e indenizacoes decorrentes de tais eventos, isentando a Locadora de qualquer responsabilidade civil ou penal relativa a operacao dos equipamentos durante o periodo da locacao;",
        "Disponibilizar mao de obra qualificada para operacao dos equipamentos;",
        "Disponibilizar bons acessos ou caminhos de servico em boas condicoes de transito e seguranca como tambem controlar as velocidades dos equipamentos;",
        "Utilizar os equipamentos exclusivamente para os fins a que se destinam, observando rigorosamente as orientacoes constantes no manual do fabricante. Fica expressamente proibido o reboque ou tracao dos equipamentos por outros veiculos ou maquinas, tais como tratores;",
        "Descartar os residuos de concretos em espacos de bota fora se responsabilizando por qualquer penalidade de nao cumprimento perante as leis vigentes, principalmente as ambientais;",
        "A Locataria devera responsabilizar-se integralmente pela guarda e seguranca dos equipamentos, mantendo-os em local seguro, com controle de acesso, vigilancia e, sempre que possivel, monitoramento eletronico. Durante todo o periodo da locacao, a Locataria sera responsavel por qualquer ocorrencia de roubo, furto, tentativa de furto, vandalismo, desaparecimento ou dano aos equipamentos, inclusive quanto a pequenos furtos de componentes ou acessorios, tais como, mas nao se limitando a baterias, pneus (inclusive estepe), macaco, triangulo, ferramentas, equipamentos de apoio ou quaisquer itens que integrem ou acompanhem o caminhao. Em qualquer dessas hipoteses, cabera exclusivamente a Locataria providenciar a imediata reposicao ou indenizacao correspondente, isentando a Locadora de qualquer responsabilidade sobre tais ocorrencias durante o periodo da locacao.",
        "A responsabilidade tecnica, civil e penal pelos servicos executados com os equipamentos;",
        "Manutencao Corretiva - A Locataria sera responsavel pela execucao integral da manutencao corretiva dos equipamentos locados independente da causa da falha, incluindo substituicao de pecas, mao de obra, transporte e custos decorrentes do tempo de paralisacao, em razao de ser a responsavel direta pela operacao dos equipamentos. A peca danificada devera ser removida pela Locataria e enviada, sob ciencia da Locadora, para analise tecnica do fabricante, cujo laudo sera vinculante para definicao da responsabilidade:",
        "Constatado defeito de fabricacao ou desgaste natural dentro da vida util, os custos serao assumidos pela Locadora, que providenciara o desconto em medicao;",
        "Identificado mau uso ou sobrecarga ou ate instalacao inadequada (caso tenha sido uma peca anteriormente substituida pela Locataria) os custos serao de responsabilidade exclusiva da Locataria.",
        "Caso a Locataria tenha interesse na disponibilizacao de um mecanico em regime full time, sera cobrado valor adicional ao contrato. A atuacao desse profissional tera carater exclusivamente de apoio, nao implicando em qualquer responsabilidade tecnica, operacional, civil, ou penal da Locadora, ficando ele subordinado integralmente as ordens e diretrizes da Locataria;",
        "A locacao contempla a visita periodica de um supervisor, porem, os custos com alimentacao, alojamento e transporte do mesmo dentro da obra, deverao ser de responsabilidade da Locataria;",
        "Caso a Locataria tenha interesse na disponibilizacao de um supervisor full time de logistica em seu projeto, com a finalidade exclusiva de apoiar e dar celeridade a execucao dos servicos de transporte, sera cobrado um valor adicional ao contrato. Fica estabelecido que a atuacao desse supervisor tera carater meramente consultivo e de acompanhamento, nao implicando, em hipotese alguma, na assuncao de responsabilidades tecnicas, operacionais, civis ou penais por parte da Locadora. O referido supervisor estara integralmente subordinado as diretrizes, ordens e determinacoes da Locataria, sendo esta a unica e exclusiva responsavel por toda a operacao dos equipamentos e pelos resultados decorrentes;",
        "Realizar as manutencoes e verificacoes diarias (niveis de oleo, vazamentos, lubrificacao, reapertos, substituicao de lampadas, conforme manual dos fabricantes localizados no interior dos caminhoes), zelando pela conservacao e bom funcionamento dos equipamentos;",
        "Abastecer com combustivel de acordo com a classificacao do ano e modelo do caminhao: euro 3, combustivel S500 ou euro 5, combustivel S10, como tambem aditivos do combustivel (ARLA) oleo Shell Tellus 68 e completar os produtos engraxantes dos equipamentos. Se algum equipamento apresentar problemas, decorrente da ma qualidade do combustivel ou a falta de alguma responsabilidade acima, os custos com a franquia e demais despesas com o conserto do equipamento serao de total responsabilidade da Locataria;",
        "Toda e qualquer quebra ou reparo realizado nos equipamentos devera ser imediatamente comunicado pela Locataria a Locadora, por e-mail, atraves dos enderecos oficiais: comercial@villaempreendimentos.com.br, logistica@villaempreendimentos.com.br, marcio@villaempreendimentos.com.br e logistica1@villaempreendimentos.com.br;",
        "A Locataria reconhece que e de sua exclusiva responsabilidade informar a Locadora todas as ocorrencias e intervencoes de manutencao ou reparo executadas nos equipamentos, sob pena de responder integralmente por quaisquer danos, perdas ou prejuizos decorrentes da ausencia de comunicacao. Serao de responsabilidade da Locataria os custos com os dias parados e as despesas referentes aos reparos;",
        "Manter os equipamentos sempre limpos, preservando a aparencia externa, incluindo a cabine do caminhao, e realizar a limpeza interna dos baloes e implementos, prevenindo o acumulo de concreto em facas, bicas e demais componentes;",
        "Comunicar a Locataria e a autoridade policial competente a ocorrencia de sinistro com os citados equipamentos, solicitando a lavratura do competente boletim de ocorrencia, imediatamente apos a ocorrencia do fato, encaminhamento a copia do mesmo a Locadora;",
        "A Locataria devera entregar copia dos discos do tacografo de cada equipamento, a Locadora, no fechamento de cada mes;",
        "A Locataria se responsabiliza em assinar os controles de transporte de concreto (mapas diarios), no dia seguinte ao trabalho/disposicao. A falta desta assinatura pode interromper a continuidade dos trabalhos. Para a Locadora so esses mapas terao validade, onde os mesmos servirao para comprovar os dias de cobrancas que constarao em medicao;",
        "No termino da vigencia, a Locataria se obriga ainda a devolver os equipamentos na sede da Locadora apos a aprovacao do checklist/termo de vistoria onde os mesmos deverao estar no mesmo estado de conservacao registrado no momento checklist da retirada. A Locadora podera reprovar o checklist caso seja identificado qualquer desacordo ou irregularidade nos equipamentos, cabendo a Locataria executar, as suas expensas, todos os servicos necessarios para que o bem seja entregue em pleno funcionamento e em perfeitas condicoes de uso, conforme constatado no referido documento;",
      ]),
      bloco(50, "precos", "Precos e dados comerciais", "EDITAVEL", [
        "Os precos ofertados nesta proposta serao o seguinte:",
        "Qtd.: {{quantidade}}",
        "Descricao: {{descricao_comercial}}",
        "Horas Garantidas: {{horas_garantidas}}",
        "Preco Unit./mes: {{preco_unitario}}",
        "Preco Total/mes: {{valor}}",
        "{{observacoes_comerciais}}",
      ]),
      bloco(60, "observacoes_preco", "Observacoes de preco", "EDITAVEL_COM_APROVACAO", [
        "Obs.01: Caso as horas garantidas no periodo mensal nao sejam atingidas, a Locataria obriga-se a realizar o pagamento do valor integral da franquia mensal, conforme acordado na tabela constante do item 4 acima.",
        "Obs.02: A retirada e o transporte dos equipamentos sao de responsabilidade da Locataria. Isso inclui todos os deslocamentos dos caminhoes, bem como a mobilizacao e desmobilizacao, tendo como ponto de partida a base da Locadora, localizada em Bezerros-PE.",
        "Obs.03: Caso as 180 horas minimas sejam ultrapassadas, a Locataria devera pagar, alem da franquia acordada, o valor proporcional as horas excedentes, no montante de R$ 166,67 (cento e sessenta e seis reais e sessenta e sete centavos) por hora.",
        "Obs.04: Nao sera concedido nenhum tipo de desconto na locacao dos equipamentos da Contratada por dias parados devido a periodos festivos, feriados ou recessos indicados pela Contratante.",
        "Obs.05: A Locadora declara que nao disponibiliza seguros dos equipamentos. No entanto, caso haja interesse da Locataria, a Locadora podera realizar a cotacao do seguro correspondente e repassar o respectivo custo na medicao mensal acrescido dos seus impostos, desde que previamente aprovado pela Locataria.",
        "Obs.06: Para fins de calculo proporcional de valores, considera-se o mes como composto por 30 (trinta) dias corridos, independentemente do numero real de dias no mes.",
      ]),
      bloco(70, "prazo_duracao", "Prazo e duracao do contrato", "EDITAVEL_COM_APROVACAO", [
        "5. Prazo para inicializacao do contrato:",
        "A retirada podera ser programada para sair da Matriz da Locadora, em ate 72 (setenta e duas) horas apos a sua solicitacao formal via e-mail, a contar da assinatura desta proposta, pois ela tem valor de pre-contrato ate a assinatura do contrato;",
        "O contrato comeca a prevalecer na saida dos equipamentos na sede da Locadora;",
        "6. Duracao do Contrato:",
        "O contrato tera duracao minima de 03 (tres) meses, podendo ser renovado por um periodo maior, de acordo com a necessidade da Locataria;",
        "Na hipotese de a Locataria solicitar a desmobilizacao dos equipamentos antes do termino do prazo minimo de 03 (tres) meses, sera obrigada a pagar, a titulo de multa compensatoria, o valor correspondente a franquia minima de 03 (tres) meses, independentemente do periodo efetivamente utilizado;",
        "Independente se a devolucao dos equipamentos esteja ou nao no prazo vigente do contrato, a Locataria devera informar a Locadora com um prazo minimo de 15 (quinze) dias, para devolucao dos equipamentos hora locados, para que a mesma possa proceder com os tramites de recebimento dos mesmos. A falta desta informacao acarretara a cobranca da diferenca dos dias acima mencionados;",
        "A Locataria sera responsavel pela devolucao dos equipamentos na sede da Locadora, como ja mencionado anteriormente, em data previamente acordada, nas mesmas condicoes de uso e conservacao de acordo com o checklist de retirada, conforme previsto nas demais clausulas contratuais;",
      ]),
      bloco(80, "contrato_pagamento", "Pre-contrato, medicao, faturamento e pagamento", "EDITAVEL_COM_APROVACAO", [
        "7. Elaboracao do Contrato:",
        "Sera feito 01 contrato de locacao de equipamentos que representa 100% (cem por cento) do faturamento;",
        "Esta proposta tem carater de pre-contrato, garantindo que os servicos realizados possam ser medidos e faturados mensalmente, onde as faturas deverao ser pagas nos seus respectivos vencimentos, mesmo que o contrato definitivo ainda esteja em processo de assinatura ou em analise;",
        "Podera o presente instrumento ser rescindido por qualquer uma das partes, em qualquer momento, respeitando os 03 (tres) meses minimos de contrato, sem que haja qualquer tipo de motivo relevante, mediante simples e expressa comunicacao previa, no prazo de 15 (quinze) dias de antecedencia, sempre formalizado via e-mail;",
        "8. Medicao, Faturamento e Pagamento:",
        "Os servicos executados serao medidos no periodo do dia 1° ao ultimo dia do mes anterior ao mes em que sera efetuado o pagamento;",
        "No primeiro dia util subsequente aos 30 (trinta) dias de utilizacao dos equipamentos ora locados, a Locadora ira emitir, entao, o Boletim de Medicao, onde constara o total da medicao do mes vencido, devendo, ato continuo, no mesmo dia envia-la para a Locataria, a qual, por sua vez, tera o prazo maximo de 5 (cinco) dias corridos, contados do seu recebimento, para sua aprovacao;",
        "Apos a aprovacao prevista no item anterior, seja de forma expressa ou tacita, caso a Locataria nao aprove o Boletim de Medicao dentro do prazo estabelecido, a Locadora devera emitir e enviar a Locataria a fatura correspondente a locacao, juntamente com o boleto bancario, com vencimento em ate 25 (vinte e cinco) dias;",
        "Obs.: condicoes de faturamento acima indicadas estao sujeitas a aprovacao do cadastro financeiro.",
        "Caso as faturas tenham sido emitidas com incorrecoes ou em desacordo com a legislacao vigente serao devolvidas e o prazo para pagamento sera o mesmo indicado nos pontos acima;",
        "A impontualidade no pagamento sujeitara a Locataria ao pagamento de juros de mora a razao de 1% (um por cento) ao mes, multa de 2% (dois por cento) apos o 1º (primeiro) dia corrido do vencimento, independente da correcao monetaria e das demais sancoes previstas em Lei e no presente contrato, aplicaveis as hipoteses de inadimplente;",
        "Obs.: Serao aplicadas todas as penalidades previstas na clausula acima, caso as faturas nao sejam aceitas sem motivo justo pela Locataria.",
        "Qualquer eventual tolerancia da Locadora no recebimento das faturas, fora do prazo pactuado, nao constituira novacao nem, tampouco, servira para alegacao de existencia de precedente para repeticao do fato tolerado;",
        "Caso a Locataria nao realize o pagamento na data do seu vencimento corrente, apos o prazo de 48 (quarenta e oito) horas do vencimento da fatura, a Locadora podera paralisar a operacao dos equipamentos locados, sem que ocorra qualquer tipo de penalidade, independente de previa notificacao, onde os equipamentos serao contabilizados como a disposicao durante o periodo que estiverem parados ate a sua regularizacao da pendencia;",
        "Caso a Locataria se torne inadimplente por periodo superior a 15 (quinze) dias, contados a partir do vencimento da fatura correspondente, a Locadora podera rescindir o presente contrato, a seu exclusivo criterio, sem necessidade de notificacao adicional. Nessa hipotese, a Locataria sera responsavel pelo pagamento imediato de todas as parcelas em atraso, devidamente corrigidas e atualizadas, incluindo multas e eventuais perdas e danos previstos neste contrato. A Locataria devera devolver os equipamentos no prazo maximo de 05 (cinco) dias uteis, considerando o tempo necessario para organizacao das desmobilizacoes. Caso os equipamentos nao sejam devolvidos dentro do prazo estipulado, a Locadora estara autorizada a recolher os caminhoes betoneira no canteiro de obras da Locataria, que desde ja se declara livre e desimpedida para a retirada. Todos os custos decorrentes da remocao, transporte e logistica dos equipamentos serao de responsabilidade exclusiva da Locataria, devendo ser pagos de imediato apos a conclusao da retirada;",
      ]),
      bloco(90, "reajuste_validade", "Reajuste e validade", "EDITAVEL_COM_APROVACAO", [
        "9. Reajustes:",
        "Os precos estabelecidos nesta proposta serao reajustados semestralmente, com base nos indices de reajustes da construcao civil que melhor se adequarem a locacao de acordo com a FGV (Fundacao Getulio Vargas);",
        "Na ocorrencia de fatos ou hipoteses nao previstas nem disciplinadas neste documento, na ausencia de um contrato selado posteriormente, as partes se reportarao ao que a respeito dispoe a legislacao civil e comercial brasileira aplicavel a especie;",
        "10. Validade da proposta:",
        "A proposta tera validade de {{validade}};",
      ]),
      bloco(100, "assinaturas", "Aceite, assinaturas e testemunhas", "BLOQUEADO", [
        "Confirmamos e estamos de acordo com os servicos ofertados nesta proposta de n˚ {{numero_proposta}}, como tambem todos os seus termos.",
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
