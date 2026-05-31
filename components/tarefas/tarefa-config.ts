import type {
  PrioridadeTarefa,
  StatusTarefa,
  TipoAtividade,
} from "@/app/generated/prisma/client";

export const TIPO_CONFIG: Record<
  TipoAtividade,
  { emoji: string; label: string }
> = {
  LIGACAO: { emoji: "📞", label: "Ligacao" },
  WHATSAPP: { emoji: "💬", label: "WhatsApp" },
  VISITA: { emoji: "🏗️", label: "Visita" },
  REUNIAO: { emoji: "🤝", label: "Reuniao" },
  REUNIAO_ONLINE: { emoji: "💻", label: "Reuniao Online" },
  PROPOSTA: { emoji: "📄", label: "Proposta" },
  CONTRATO: { emoji: "📋", label: "Contrato" },
  COBRANCA: { emoji: "💰", label: "Cobranca" },
  RETORNO_CLIENTE: { emoji: "🔁", label: "Retorno Cliente" },
  POS_VENDA: { emoji: "⭐", label: "Pos-Venda" },
  LOGISTICA: { emoji: "🚛", label: "Logistica" },
  MANUTENCAO: { emoji: "🔧", label: "Manutencao" },
  VISTORIA: { emoji: "🔍", label: "Vistoria" },
  APRESENTACAO_COMERCIAL: { emoji: "🎯", label: "Apresentacao" },
  TAREFA_INTERNA: { emoji: "📝", label: "Tarefa Interna" },
  OUTRO: { emoji: "•", label: "Outro" },
};

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
