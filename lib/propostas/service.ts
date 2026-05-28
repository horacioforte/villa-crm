import type { AuthenticatedUser } from "@/lib/auth/session";
import { renderPropostaHtml } from "@/lib/propostas/render";
import { getPropostaTemplate } from "@/lib/propostas/templates";

type OportunidadeProposta = {
  id: string;
  titulo: string;
  responsavelId: string | null;
  createdById: string | null;
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
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

export function buildPropostaHtmlSnapshot(
  proposta: PropostaSnapshotInput,
  oportunidade: OportunidadeProposta,
) {
  const template = getPropostaTemplate(proposta.templateUtilizado);

  return renderPropostaHtml({
    numeroProposta: proposta.numeroProposta,
    versao: proposta.versao,
    templateUtilizado: proposta.templateUtilizado,
    cliente:
      oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial,
    obra: oportunidade.obra?.nome ?? "Obra nao informada",
    cidade: oportunidade.obra?.cidade,
    estado: oportunidade.obra?.estado,
    valorTotal: proposta.valorTotal,
    validadeProposta: proposta.validadeProposta,
    prazoExecucao: proposta.prazoExecucao,
    responsavel: oportunidade.responsavel?.nome,
    observacoesComerciais: proposta.observacoesComerciais,
    observacoesTecnicas:
      proposta.observacoesTecnicas ?? template?.observacoesTecnicasPadrao,
    condicoesPagamento:
      proposta.condicoesPagamento ?? template?.condicoesPagamentoPadrao,
    data: proposta.createdAt ?? new Date(),
  });
}
