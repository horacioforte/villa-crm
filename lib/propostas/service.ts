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
  precoUnitario?: string | null;
  horaExtra?: DecimalLike | null;
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

export const propostaInclude = {
  oportunidade: {
    include: {
      empresa: true,
      pessoa: true,
      obra: true,
      responsavel: true,
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

export function buildPropostaTemplateVariables(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
) {
  return {
    numero_proposta: proposta.numeroProposta,
    cliente:
      oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial,
    obra: oportunidade.obra?.nome ?? "Obra nao informada",
    telefone: proposta.telefone ?? oportunidade.empresa.telefone ?? "",
    email: proposta.email ?? oportunidade.empresa.email ?? "",
    cidade: oportunidade.obra?.cidade ?? "",
    estado: oportunidade.obra?.estado ?? "",
    tipo_servico:
      getPropostaTemplate(proposta.templateUtilizado)?.tipoServico ??
      proposta.templateUtilizado,
    quantidade: proposta.quantidade ?? "01",
    descricao_comercial:
      proposta.descricaoComercial ?? "Caminhao Betoneira - 8m3",
    horas_garantidas: proposta.horasGarantidas ?? "180h",
    preco_unitario: proposta.precoUnitario
      ? formatCurrency(proposta.precoUnitario)
      : formatCurrency(proposta.valorTotal),
    valor: formatCurrency(proposta.valorTotal),
    hora_extra:
      proposta.horaExtra === null || proposta.horaExtra === undefined
        ? "Nao informado"
        : formatCurrency(proposta.horaExtra),
    prazo: proposta.prazoExecucao ?? "A definir",
    validade: formatDate(proposta.validadeProposta),
    responsavel: oportunidade.responsavel?.nome ?? "Equipe Comercial Villa",
    data: formatDate(proposta.createdAt ?? new Date()),
    observacoes_comerciais: proposta.observacoesComerciais ?? "",
  };
}

export function buildPropostaBlocosSnapshot(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
): PropostaBlocoSnapshot[] {
  return buildTemplateBlocosSnapshot(
    proposta.templateUtilizado,
    buildPropostaTemplateVariables(proposta, oportunidade),
  );
}

export function buildPropostaHtmlSnapshot(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
) {
  const template = getPropostaTemplate(proposta.templateUtilizado);
  const blocos =
    proposta.blocos ?? buildPropostaBlocosSnapshot(proposta, oportunidade);

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
