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
  createdAt?: Date | string;
};

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

  return getPropostaBlocosExibicao(proposta, proposta.blocos ?? []);
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

  return getPropostaBlocosExibicao(proposta, blocos)
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
    data: proposta.createdAt ?? new Date(),
  });
}
