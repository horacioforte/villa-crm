import type {
  PrioridadeTarefa,
  StatusTarefa,
  TipoAtividade,
} from "@/app/generated/prisma/client";

export const TIPO_CONFIG: Partial<
  Record<TipoAtividade, { emoji: string; label: string }>
> = {
  LIGACAO: { emoji: "📞", label: "Ligacao" },
  WHATSAPP: { emoji: "💬", label: "WhatsApp" },
  REUNIAO: { emoji: "🤝", label: "Reuniao" },
  VISITA: { emoji: "🏗️", label: "Visita Comercial" },
  VISTORIA: { emoji: "🔍", label: "Visita de Obra" },
  RETORNO_CLIENTE: { emoji: "🔁", label: "Follow-up" },
  COBRANCA: { emoji: "💰", label: "Cobranca" },
  PROPOSTA: { emoji: "📄", label: "Envio de Proposta" },
  CONTRATO: { emoji: "📋", label: "Contrato" },
  OUTRO: { emoji: "•", label: "Outros" },
};

export const TIPOS_RAPIDOS: TipoAtividade[] = [
  "LIGACAO",
  "WHATSAPP",
  "REUNIAO",
  "VISITA",
  "VISTORIA",
  "RETORNO_CLIENTE",
  "COBRANCA",
  "PROPOSTA",
  "CONTRATO",
  "OUTRO",
];

export const PRIORIDADE_CONFIG: Record<
  PrioridadeTarefa,
  { label: string; badgeClassName: string; borderClassName: string }
> = {
  URGENTE: {
    label: "Urgente",
    badgeClassName: "bg-red-100 text-red-700",
    borderClassName: "border-l-red-500",
  },
  ALTA: {
    label: "Alta",
    badgeClassName: "bg-orange-100 text-orange-700",
    borderClassName: "border-l-orange-500",
  },
  MEDIA: {
    label: "Media",
    badgeClassName: "bg-amber-100 text-amber-700",
    borderClassName: "border-l-amber-400",
  },
  BAIXA: {
    label: "Baixa",
    badgeClassName: "bg-emerald-100 text-emerald-700",
    borderClassName: "border-l-emerald-500",
  },
};

export const STATUS_TAREFA_CONFIG: Record<StatusTarefa, { label: string }> = {
  PENDENTE: { label: "Pendente" },
  EM_ANDAMENTO: { label: "Em andamento" },
  CONCLUIDA: { label: "Concluida" },
  CANCELADA: { label: "Cancelada" },
  ATRASADA: { label: "Atrasada" },
};
