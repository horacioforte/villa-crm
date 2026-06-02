import type { AuthenticatedUser } from "@/lib/auth/session";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { renderPropostaHtml } from "@/lib/propostas/render";
import {
  buildTemplateBlocosSnapshot,
  getPropostaTemplate,
  type PropostaBlocoSnapshot,
} from "@/lib/propostas/templates";

type DecimalLike = string | number | { toString(): string };
const BOMBA_TEMPLATE_ID = "locacao-bomba-concreto-com-operacao";

type OportunidadeProposta = {
  id: string;
  titulo: string;
  responsavelId: string | null;
  createdById: string | null;
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
    telefone?: string | null;
    email?: string | null;
  };
  pessoa: {
    id: string;
    nome: string;
  } | null;
  obra: {
    id: string;
    nome: string;
    cidade: string | null;
    estado: string | null;
  } | null;
  responsavel: {
    nome: string;
  } | null;
  equipamento?: {
    tipo: string;
  } | null;
};

type PropostaItemSnapshot = {
  ordem: number;
  descricao: string;
  quantidade: number;
  precoM3?: DecimalLike | null;
  volumeMinimoM3?: DecimalLike | null;
  horasGarantidas?: string | null;
  precoUnitario?: DecimalLike | null;
  horaExtra?: DecimalLike | null;
  valorTotal: DecimalLike;
};

type PropostaBlocoAplicavel = {
  id?: string;
  chave?: string;
  titulo: string;
  ordem: number;
  conteudoAtual: string;
  conteudoOriginal?: string;
};

type PropostaSnapshotInput = {
  numeroProposta: string;
  versao: number;
  templateUtilizado: string;
  valorTotal: string | number | { toString(): string };
  validadeProposta: Date | string;
  prazoExecucao?: string | null;
  observacoesComerciais?: string | null;
  observacoesTecnicas?: string | null;
  condicoesPagamento?: string | null;
  quantidade?: string | null;
  descricaoComercial?: string | null;
  horasGarantidas?: string | null;
  precoUnitario?: DecimalLike | null;
  horaExtra?: DecimalLike | null;
  precoM3?: DecimalLike | null;
  volumeMinimoM3?: DecimalLike | null;
  telefone?: string | null;
  email?: string | null;
  blocos?: Array<{
    chave?: string;
    titulo: string;
    tipo: string;
    ordem: number;
    conteudoAtual: string;
  }>;
  itens?: PropostaItemSnapshot[];
  createdAt?: Date | string;
};

const bombaHoraExtraPatterns = [
  /auto bomba lan[cç]a 28 metros/i,
  /auto bomba lan[cç]a 32 metros/i,
  /auto bomba lan[cç]a 36 metros/i,
  /auto bomba lan[cç]a 38 metros/i,
  /auto bomba lan[cç]a 42\/43 metros/i,
  /auto bomba lan[cç]a 56\/58 metros/i,
];

function getHoraExtraBombaPadrao(descricao: string) {
  const normalizedDescricao = descricao.toLowerCase();

  if (normalizedDescricao.includes("56") || normalizedDescricao.includes("58")) {
    return 450;
  }

  if (
    ["28", "32", "36", "38", "42", "43"].some((metragem) =>
      normalizedDescricao.includes(metragem),
    )
  ) {
    return 350;
  }

  return null;
}

function formatHoraExtraItem(item: PropostaItemSnapshot) {
  const horaExtra = item.horaExtra ?? getHoraExtraBombaPadrao(item.descricao);

  if (!horaExtra) {
    return null;
  }

  return `${item.descricao}: ${formatCurrency(horaExtra)} por hora excedente.`;
}

function filtrarTrabalhoExtraBomba(
  content: string,
  itens: PropostaSnapshotInput["itens"] | undefined,
) {
  if (!itens?.length) {
    return content;
  }

  const linhas = content.split("\n");
  const linhasManuais = itens
    .map((item) => formatHoraExtraItem(item))
    .filter(Boolean) as string[];
  const linhasFinais = linhas.filter(
    (line) =>
      !bombaHoraExtraPatterns.some((pattern) => pattern.test(line)),
  );
  const insertIndex = Math.max(
    1,
    linhasFinais.findIndex((line) => line.startsWith("Não será concedido")),
  );

  linhasFinais.splice(insertIndex, 0, ...linhasManuais);

  return linhasFinais.join("\n");
}

function splitConteudoPorMarcador(content: string, marcador: string) {
  const linhas = content.split("\n");
  const index = linhas.findIndex((line) =>
    line.toLowerCase().startsWith(marcador.toLowerCase()),
  );

  if (index < 0) {
    return [content, ""] as const;
  }

  const limparTitulo = (line: string) =>
    /^\d+\.\s/.test(line.trim()) ? "" : line;

  return [
    linhas.slice(0, index).map(limparTitulo).filter(Boolean).join("\n"),
    linhas.slice(index + 1).map(limparTitulo).filter(Boolean).join("\n"),
  ] as const;
}

function splitBlocoCombinado<T extends PropostaBlocoAplicavel>(
  bloco: T,
  config: {
    marcador: string;
    first: { chave: string; titulo: string; ordem: number };
    second: { chave: string; titulo: string; ordem: number };
  },
) {
  const [firstAtual, secondAtual] = splitConteudoPorMarcador(
    bloco.conteudoAtual,
    config.marcador,
  );
  const [firstOriginal, secondOriginal] = bloco.conteudoOriginal
    ? splitConteudoPorMarcador(bloco.conteudoOriginal, config.marcador)
    : [undefined, undefined];

  return [
    {
      ...bloco,
      id: bloco.id ? `${bloco.id}-${config.first.chave}` : undefined,
      chave: config.first.chave,
      titulo: config.first.titulo,
      ordem: config.first.ordem,
      conteudoAtual: firstAtual,
      ...(firstOriginal ? { conteudoOriginal: firstOriginal } : {}),
    },
    {
      ...bloco,
      id: bloco.id ? `${bloco.id}-${config.second.chave}` : undefined,
      chave: config.second.chave,
      titulo: config.second.titulo,
      ordem: config.second.ordem,
      conteudoAtual: secondAtual,
      ...(secondOriginal ? { conteudoOriginal: secondOriginal } : {}),
    },
  ] as T[];
}

function separarClausulasBomba<T extends PropostaBlocoAplicavel>(blocos: T[]) {
  return blocos.flatMap((bloco) => {
    if (bloco.chave === "prazo_duracao") {
      return splitBlocoCombinado(bloco, {
        marcador: "6. Duração",
        first: {
          chave: "prazo_inicializacao",
          titulo: "5. Prazo para inicialização do serviço",
          ordem: 80,
        },
        second: {
          chave: "duracao_contrato",
          titulo: "6. Duração do contrato",
          ordem: 90,
        },
      });
    }

    if (bloco.chave === "contrato_pagamento") {
      return splitBlocoCombinado(bloco, {
        marcador: "8. Medição",
        first: {
          chave: "elaboracao_contrato",
          titulo: "7. Elaboração do contrato",
          ordem: 100,
        },
        second: {
          chave: "medicao_pagamento",
          titulo: "8. Medição, faturamento e pagamento",
          ordem: 110,
        },
      });
    }

    if (bloco.chave === "reajuste_validade") {
      return splitBlocoCombinado(bloco, {
        marcador: "10. Validade",
        first: {
          chave: "reajustes",
          titulo: "9. Reajustes",
          ordem: 120,
        },
        second: {
          chave: "validade",
          titulo: "10. Validade da proposta",
          ordem: 130,
        },
      });
    }

    if (bloco.chave === "assinaturas" && bloco.ordem < 140) {
      return [{ ...bloco, ordem: 140 }];
    }

    return [bloco];
  });
}

function aplicarRegrasBlocosProposta<T extends PropostaBlocoAplicavel>(
  proposta: PropostaSnapshotInput,
  blocos: T[],
) {
  if (proposta.templateUtilizado !== BOMBA_TEMPLATE_ID) {
    return blocos;
  }

  return separarClausulasBomba(blocos).map((bloco) =>
    bloco.chave === "trabalho_extra"
      ? {
          ...bloco,
          conteudoAtual: filtrarTrabalhoExtraBomba(
            bloco.conteudoAtual,
            proposta.itens,
          ),
          ...(bloco.conteudoOriginal
            ? {
                conteudoOriginal: filtrarTrabalhoExtraBomba(
                  bloco.conteudoOriginal,
                  proposta.itens,
                ),
              }
            : {}),
        }
      : bloco,
  );
}

export function isPropostaModeloM3(
  proposta: Pick<PropostaSnapshotInput, "precoM3" | "volumeMinimoM3">,
) {
  return (
    proposta.precoM3 !== null &&
    proposta.precoM3 !== undefined &&
    proposta.volumeMinimoM3 !== null &&
    proposta.volumeMinimoM3 !== undefined
  );
}

export function getPropostaBlocosExibicao<T extends { chave?: string }>(
  proposta: Pick<PropostaSnapshotInput, "precoM3" | "volumeMinimoM3">,
  blocos: T[],
) {
  if (!isPropostaModeloM3(proposta)) {
    return blocos;
  }

  return blocos.filter((bloco) => bloco.chave !== "precos_referencia");
}

function getFieldFromBlock(content: string, label: string) {
  const line = content
    .split("\n")
    .find((item) => item.toLowerCase().startsWith(label.toLowerCase()));

  return line?.split(":").slice(1).join(":").trim() || null;
}

function getBlocoPrecos(
  proposta: Pick<PropostaSnapshotInput, "blocos">,
) {
  return proposta.blocos?.find((bloco) => bloco.chave === "precos");
}

export function getPropostaTemplateUtilizadoExibicao(
  proposta: Pick<PropostaSnapshotInput, "templateUtilizado">,
  oportunidade: OportunidadeProposta,
) {
  if (oportunidade.equipamento?.tipo === "BOMBA_CONCRETO") {
    return BOMBA_TEMPLATE_ID;
  }

  return proposta.templateUtilizado;
}

export function getPropostaBlocosExibicaoCompleta(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
) {
  const templateUtilizado = getPropostaTemplateUtilizadoExibicao(
    proposta,
    oportunidade,
  );

  if (templateUtilizado !== proposta.templateUtilizado) {
    const blocoPrecos = getBlocoPrecos(proposta);

    return buildPropostaBlocosSnapshot(
      {
        ...proposta,
        templateUtilizado,
        quantidade:
          proposta.quantidade ??
          (blocoPrecos ? getFieldFromBlock(blocoPrecos.conteudoAtual, "Qtd.") : null),
        descricaoComercial:
          proposta.descricaoComercial ??
          (blocoPrecos
            ? getFieldFromBlock(blocoPrecos.conteudoAtual, "Descrição") ??
              getFieldFromBlock(blocoPrecos.conteudoAtual, "Descricao")
            : null),
      },
      oportunidade,
    );
  }

  return aplicarRegrasBlocosProposta(
    { ...proposta, templateUtilizado },
    getPropostaBlocosExibicao(proposta, proposta.blocos ?? []),
  );
}

export const propostaInclude = {
  oportunidade: {
    include: {
      empresa: true,
      pessoa: true,
      obra: true,
      responsavel: true,
      equipamento: true,
    },
  },
  blocos: {
    orderBy: {
      ordem: "asc",
    },
  },
  excecoes: {
    orderBy: {
      createdAt: "desc",
    },
    include: {
      bloco: true,
      solicitante: true,
      aprovador: true,
    },
  },
  auditorias: {
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      usuario: true,
      bloco: true,
    },
  },
  itens: {
    orderBy: {
      ordem: "asc",
    },
    include: {
      equipamento: true,
    },
  },
  criadoPor: true,
  updatedBy: true,
} as const;

export function getOportunidadeAccessWhere(
  id: string,
  user: AuthenticatedUser,
) {
  return {
    id,
    ativa: true,
    ...(user.papel === "COMERCIAL"
      ? {
          OR: [{ responsavelId: user.id }, { createdById: user.id }],
        }
      : {}),
  };
}

export function getPropostaAccessWhere(id: string, user: AuthenticatedUser) {
  return {
    id,
    ...(user.papel === "COMERCIAL"
      ? {
          oportunidade: {
            OR: [{ responsavelId: user.id }, { createdById: user.id }],
          },
        }
      : {}),
  };
}

export function buildNumeroProposta(oportunidadeId: string, date = new Date()) {
  return `VILLA-${date.getFullYear()}-${oportunidadeId.slice(-6).toUpperCase()}`;
}

function formatDate(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
}

function formatCurrency(value: string | number | { toString(): string }) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatVolume(value: DecimalLike) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function numerosPorExtenso(value: number) {
  const mapa: Record<number, string> = {
    1: "um",
    2: "dois",
    3: "tres",
    4: "quatro",
    5: "cinco",
    6: "seis",
    7: "sete",
    8: "oito",
    9: "nove",
    10: "dez",
  };

  return mapa[value] ?? String(value);
}

function getTipoServicoProposta(templateId: string, fallback: string, plural: boolean) {
  if (templateId === "locacao-betoneira-com-operador") {
    return plural
      ? "CAMINHÕES BETONEIRAS COM OPERADORES"
      : "CAMINHÃO BETONEIRA COM OPERADOR";
  }

  if (templateId === "locacao-betoneira-sem-operador") {
    return plural
      ? "CAMINHÕES BETONEIRAS SEM OPERADORES"
      : "CAMINHÃO BETONEIRA SEM OPERADOR";
  }

  return fallback;
}

export function buildPropostaTemplateVariables(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
) {
  const template = getPropostaTemplate(proposta.templateUtilizado);
  const modeloPorM3 = isPropostaModeloM3(proposta);
  const quantidadeNumero = Number.parseInt(proposta.quantidade ?? "1", 10);
  const quantidadeValida =
    Number.isFinite(quantidadeNumero) && quantidadeNumero > 0
      ? quantidadeNumero
      : 1;
  const plural = quantidadeValida > 1;

  return {
    numero_proposta: proposta.numeroProposta,
    cliente:
      oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial,
    obra: oportunidade.obra?.nome ?? "Obra nao informada",
    telefone: proposta.telefone ?? oportunidade.empresa.telefone ?? "",
    email: proposta.email ?? oportunidade.empresa.email ?? "",
    cidade: oportunidade.obra?.cidade ?? "",
    estado: oportunidade.obra?.estado ?? "",
    tipo_servico: getTipoServicoProposta(
      proposta.templateUtilizado,
      template?.tipoServico ?? proposta.templateUtilizado,
      plural,
    ),
    quantidade: proposta.quantidade ?? "01",
    descricao_comercial:
      proposta.descricaoComercial ??
      template?.defaults.descricaoComercial ??
      "Caminhao Betoneira - 8m3",
    horas_garantidas:
      modeloPorM3
        ? `${formatVolume(proposta.volumeMinimoM3!)} m³`
        : proposta.horasGarantidas ?? template?.defaults.horasGarantidas ?? "180h",
    preco_unitario: modeloPorM3
      ? `${formatCurrency(proposta.precoM3!)}/m³`
      : proposta.precoUnitario
        ? formatCurrency(proposta.precoUnitario)
        : formatCurrency(proposta.valorTotal),
    valor: formatCurrency(proposta.valorTotal),
    hora_extra:
      proposta.horaExtra === null || proposta.horaExtra === undefined
        ? "Nao informado"
        : formatCurrency(proposta.horaExtra),
    prazo:
      proposta.prazoExecucao ?? template?.defaults.prazoExecucao ?? "A definir",
    validade: formatDate(proposta.validadeProposta),
    responsavel: oportunidade.responsavel?.nome ?? "Equipe Comercial Villa",
    data: formatDate(proposta.createdAt ?? new Date()),
    observacoes_comerciais: proposta.observacoesComerciais ?? "",
    singular_plural: plural ? "CAMINHÕES BETONEIRAS" : "CAMINHÃO BETONEIRA",
    singular_plural_caps: plural ? "Caminhões Betoneiras" : "Caminhão Betoneira",
    singular_plural_operador: plural
      ? "caminhões betoneiras com operadores"
      : "caminhão betoneira com operador",
    equipamento_plural: plural ? "equipamentos" : "equipamento",
    nos_equipamentos: plural ? "nos equipamentos" : "no equipamento",
    dos_equipamentos: plural ? "dos equipamentos" : "do equipamento",
    aos_equipamentos: plural ? "aos equipamentos" : "ao equipamento",
    os_equipamentos: plural ? "os equipamentos" : "o equipamento",
    os_pronome: plural ? "os" : "o",
    numero_por_extenso: `${quantidadeValida} (${numerosPorExtenso(
      quantidadeValida,
    )})`,
  };
}

export function buildPropostaBlocosSnapshot(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
): PropostaBlocoSnapshot[] {
  const blocos = buildTemplateBlocosSnapshot(
    proposta.templateUtilizado,
    buildPropostaTemplateVariables(proposta, oportunidade),
  );
  const modeloPorM3 =
    proposta.precoM3 !== null &&
    proposta.precoM3 !== undefined &&
    proposta.volumeMinimoM3 !== null &&
    proposta.volumeMinimoM3 !== undefined;

  if (!modeloPorM3) {
    return blocos;
  }

  const blocosModeloM3 = getPropostaBlocosExibicao(proposta, blocos)
    .map((bloco) =>
      bloco.chave === "precos"
        ? {
            ...bloco,
            conteudoAtual: bloco.conteudoAtual
              .split("\n")
              .filter((line) => !line.startsWith("Hora Extra/h:"))
              .map((line) =>
                line
                  .replace("Horas Garantidas:", "Volume mínimo:")
                  .replace("Preço Unit./mês:", "Preço por m³:")
                  .replace("Preco Unit./mes:", "Preco por m3:")
                  .replace("Preço Total/mês:", "Valor total:")
                  .replace("Preco Total/mes:", "Valor total:"),
              )
              .join("\n"),
          }
        : bloco,
    );

  return aplicarRegrasBlocosProposta(proposta, blocosModeloM3);
}

export function buildPropostaHtmlSnapshot(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
) {
  const template = getPropostaTemplate(proposta.templateUtilizado);
  const rawBlocos =
    proposta.blocos ?? buildPropostaBlocosSnapshot(proposta, oportunidade);
  const blocos = getPropostaBlocosExibicao(proposta, rawBlocos);

  return renderPropostaHtml({
    numeroProposta: proposta.numeroProposta,
    versao: proposta.versao,
    templateUtilizado: proposta.templateUtilizado,
    cliente:
      oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial,
    obra: oportunidade.obra?.nome ?? "Obra nao informada",
    cidade: oportunidade.obra?.cidade,
    estado: oportunidade.obra?.estado,
    telefone: proposta.telefone ?? oportunidade.empresa.telefone,
    email: proposta.email ?? oportunidade.empresa.email,
    quantidade: proposta.quantidade,
    descricaoComercial: proposta.descricaoComercial,
    horasGarantidas: proposta.horasGarantidas,
    precoUnitario: proposta.precoUnitario,
    horaExtra: proposta.horaExtra,
    precoM3: proposta.precoM3,
    volumeMinimoM3: proposta.volumeMinimoM3,
    valorTotal: proposta.valorTotal,
    validadeProposta: proposta.validadeProposta,
    prazoExecucao: proposta.prazoExecucao,
    responsavel: oportunidade.responsavel?.nome,
    observacoesComerciais: proposta.observacoesComerciais,
    observacoesTecnicas:
      proposta.observacoesTecnicas ?? template?.observacoesTecnicasPadrao,
    condicoesPagamento:
      proposta.condicoesPagamento ?? template?.condicoesPagamentoPadrao,
    blocos,
    itens: proposta.itens,
    data: proposta.createdAt ?? new Date(),
  });
}
