import { addBusinessDays, addDays } from "date-fns";

import type { TipoAtividade } from "@/app/generated/prisma/client";

export type ResultadoCodigo = string;

export type ResultadoOpcao = {
  codigo: ResultadoCodigo;
  label: string;
  icone?: string;
};

export type ProximaAcaoSugerida = {
  tipo: TipoAtividade;
  titulo: string;
  prazo: (hoje: Date) => Date;
  acao?: "ENCERRAR_OPORTUNIDADE" | "CRIAR_PROPOSTA" | "PEDIR_DATA_RETORNO";
};

export type RegrasCadencia = {
  resultados: ResultadoOpcao[];
  proximaAcao: Record<ResultadoCodigo, ProximaAcaoSugerida | null>;
};

export const CADENCIA: Partial<Record<TipoAtividade, RegrasCadencia>> = {
  LIGACAO: {
    resultados: [
      { codigo: "NAO_ATENDEU", label: "Nao atendeu", icone: "📵" },
      { codigo: "CAIXA_POSTAL", label: "Caixa postal", icone: "📬" },
      { codigo: "CONVERSOU", label: "Conversou", icone: "✅" },
      { codigo: "PEDIU_PROPOSTA", label: "Pediu proposta", icone: "📄" },
      { codigo: "PEDIU_RETORNO", label: "Pediu retorno", icone: "🔁" },
      { codigo: "SEM_INTERESSE", label: "Sem interesse", icone: "🚫" },
      { codigo: "NUMERO_INVALIDO", label: "Numero invalido", icone: "❌" },
    ],
    proximaAcao: {
      NAO_ATENDEU: { tipo: "LIGACAO", titulo: "Tentar nova ligacao", prazo: (d) => addBusinessDays(d, 2) },
      CAIXA_POSTAL: { tipo: "WHATSAPP", titulo: "Enviar WhatsApp apos caixa postal", prazo: (d) => addDays(d, 1) },
      CONVERSOU: { tipo: "RETORNO_CLIENTE", titulo: "Follow-up apos conversa", prazo: (d) => addBusinessDays(d, 5) },
      PEDIU_PROPOSTA: { tipo: "PROPOSTA", titulo: "Elaborar e enviar proposta", prazo: (d) => d, acao: "CRIAR_PROPOSTA" },
      PEDIU_RETORNO: { tipo: "LIGACAO", titulo: "Retorno conforme combinado", prazo: (d) => addBusinessDays(d, 1), acao: "PEDIR_DATA_RETORNO" },
      SEM_INTERESSE: null,
      NUMERO_INVALIDO: { tipo: "LIGACAO", titulo: "Localizar contato correto", prazo: (d) => d },
    },
  },
  WHATSAPP: {
    resultados: [
      { codigo: "VISUALIZOU", label: "Visualizou", icone: "👁️" },
      { codigo: "RESPONDEU", label: "Respondeu", icone: "💬" },
      { codigo: "NAO_RESPONDEU", label: "Nao respondeu", icone: "🔇" },
      { codigo: "PEDIU_PROPOSTA", label: "Pediu proposta", icone: "📄" },
      { codigo: "PEDIU_RETORNO", label: "Pediu retorno", icone: "🔁" },
    ],
    proximaAcao: {
      VISUALIZOU: { tipo: "LIGACAO", titulo: "Ligar apos visualizacao", prazo: (d) => addBusinessDays(d, 2) },
      RESPONDEU: { tipo: "RETORNO_CLIENTE", titulo: "Follow-up apos resposta", prazo: (d) => addBusinessDays(d, 5) },
      NAO_RESPONDEU: { tipo: "WHATSAPP", titulo: "Novo WhatsApp sem resposta", prazo: (d) => addDays(d, 3) },
      PEDIU_PROPOSTA: { tipo: "PROPOSTA", titulo: "Elaborar e enviar proposta", prazo: (d) => d, acao: "CRIAR_PROPOSTA" },
      PEDIU_RETORNO: { tipo: "LIGACAO", titulo: "Retorno conforme combinado", prazo: (d) => addBusinessDays(d, 1), acao: "PEDIR_DATA_RETORNO" },
    },
  },
  EMAIL: {
    resultados: [
      { codigo: "ENVIADO", label: "Enviado", icone: "📤" },
      { codigo: "RESPONDIDO", label: "Respondido", icone: "↩️" },
      { codigo: "SEM_RETORNO", label: "Sem retorno", icone: "🔇" },
      { codigo: "PEDIU_PROPOSTA", label: "Pediu proposta", icone: "📄" },
    ],
    proximaAcao: {
      ENVIADO: { tipo: "LIGACAO", titulo: "Ligar para confirmar recebimento", prazo: (d) => addBusinessDays(d, 3) },
      RESPONDIDO: { tipo: "RETORNO_CLIENTE", titulo: "Follow-up apos resposta", prazo: (d) => addBusinessDays(d, 5) },
      SEM_RETORNO: { tipo: "LIGACAO", titulo: "Ligar sem retorno ao e-mail", prazo: (d) => addBusinessDays(d, 3) },
      PEDIU_PROPOSTA: { tipo: "PROPOSTA", titulo: "Elaborar e enviar proposta", prazo: (d) => d, acao: "CRIAR_PROPOSTA" },
    },
  },
  VISITA: {
    resultados: [
      { codigo: "INTERESSADO", label: "Interessado", icone: "✅" },
      { codigo: "PRECISA_ORCAMENTO", label: "Precisa de orcamento", icone: "📄" },
      { codigo: "PRECISA_TECNICA", label: "Precisa visita tecnica", icone: "🔍" },
      { codigo: "SEM_INTERESSE", label: "Sem interesse", icone: "🚫" },
    ],
    proximaAcao: {
      INTERESSADO: { tipo: "RETORNO_CLIENTE", titulo: "Follow-up apos visita comercial", prazo: (d) => addBusinessDays(d, 3) },
      PRECISA_ORCAMENTO: { tipo: "PROPOSTA", titulo: "Elaborar proposta pos-visita", prazo: (d) => d, acao: "CRIAR_PROPOSTA" },
      PRECISA_TECNICA: { tipo: "VISTORIA", titulo: "Agendar visita tecnica", prazo: (d) => addBusinessDays(d, 2) },
      SEM_INTERESSE: null,
    },
  },
  PROPOSTA: {
    resultados: [
      { codigo: "ENVIADA", label: "Enviada", icone: "📤" },
      { codigo: "CONFIRMADA", label: "Recebimento confirmado", icone: "✅" },
      { codigo: "EM_ANALISE", label: "Em analise", icone: "🔍" },
      { codigo: "APROVADA", label: "Aprovada", icone: "🎉" },
      { codigo: "REJEITADA", label: "Rejeitada", icone: "❌" },
      { codigo: "PEDIU_REVISAO", label: "Pediu revisao", icone: "✏️" },
    ],
    proximaAcao: {
      ENVIADA: { tipo: "LIGACAO", titulo: "Confirmar recebimento da proposta", prazo: (d) => addBusinessDays(d, 2) },
      CONFIRMADA: { tipo: "RETORNO_CLIENTE", titulo: "Follow-up comercial da proposta", prazo: (d) => addBusinessDays(d, 5) },
      EM_ANALISE: { tipo: "RETORNO_CLIENTE", titulo: "Novo follow-up de proposta em analise", prazo: (d) => addBusinessDays(d, 7) },
      APROVADA: { tipo: "CONTRATO", titulo: "Iniciar elaboracao de contrato", prazo: (d) => addBusinessDays(d, 1) },
      REJEITADA: null,
      PEDIU_REVISAO: { tipo: "PROPOSTA", titulo: "Enviar proposta revisada", prazo: (d) => addBusinessDays(d, 2) },
    },
  },
};

export function getResultados(tipo: TipoAtividade): ResultadoOpcao[] {
  return CADENCIA[tipo]?.resultados ?? [];
}

export function getResultadoLabel(tipo: TipoAtividade, codigo?: string | null) {
  return CADENCIA[tipo]?.resultados.find((resultado) => resultado.codigo === codigo)?.label ?? codigo ?? null;
}

export function getProximaAcao(
  tipo: TipoAtividade,
  resultadoCodigo: ResultadoCodigo,
): ProximaAcaoSugerida | null | undefined {
  return CADENCIA[tipo]?.proximaAcao[resultadoCodigo];
}

export function temCadencia(tipo: TipoAtividade): boolean {
  return tipo in CADENCIA;
}

// TODO Fase 2: Reativacao automatica para oportunidades paradas > 30 dias.
// TODO Fase 2: Dashboard de cadencia.
// TODO Fase 2: Cadencia para Visita de Obra, Reuniao e Contrato.
