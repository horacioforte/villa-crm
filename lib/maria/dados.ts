import {
  CanalOrigem,
  StatusOportunidade,
  TemperaturaOportunidade,
  TipoContato,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function startOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function diffMinutes(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function tempoRelativo(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h${minutos % 60 ? ` ${minutos % 60}min` : ""}`;
  const dias = Math.floor(horas / 24);
  return `${dias}d`;
}

type OportunidadeComHistorico = {
  id: string;
  titulo: string;
  status: StatusOportunidade;
  temperatura: TemperaturaOportunidade | null;
  canalOrigem: CanalOrigem | null;
  potencialOportunidade: unknown;
  valorContrato: unknown;
  createdAt: Date;
  empresa: { razaoSocial: string; nomeFantasia: string | null; estado: string | null };
  pessoa: { nome: string } | null;
  historicos: Array<{ tipo: TipoContato; createdAt: Date; resumo: string | null }>;
};

function getCanal(o: { canalOrigem: CanalOrigem | null; historicos: Array<{ tipo: TipoContato }> }) {
  if (o.canalOrigem === CanalOrigem.SITE) return "SITE" as const;
  if (o.historicos.some((h) => h.tipo === TipoContato.WHATSAPP)) return "WHATSAPP" as const;
  if (o.historicos.some((h) => h.tipo === TipoContato.EMAIL)) return "EMAIL" as const;
  return "OUTROS" as const;
}

/** Limiares de urgência calibrados em horas — o backlog real da Maria
 * acumula dias/semanas, não minutos, então um corte em "30 min" faria
 * praticamente tudo cair em "Alta" sem nenhuma diferenciação. */
const URGENCIA = { ALTA_MIN: 24 * 60, MEDIA_MIN: 4 * 60 } as const;

function prioridadePorTempoParado(minutosParado: number) {
  if (minutosParado >= URGENCIA.ALTA_MIN) return "critical" as const;
  if (minutosParado >= URGENCIA.MEDIA_MIN) return "warning" as const;
  return "good" as const;
}

const PIPELINE_ORDEM: { status: StatusOportunidade; label: string }[] = [
  { status: "NOVA", label: "Novo Lead" },
  { status: "PRE_QUALIFICADA", label: "Primeiro Contato" },
  { status: "EM_ATENDIMENTO", label: "Conversando" },
  { status: "PROPOSTA_ENVIADA", label: "Proposta Enviada" },
  { status: "NEGOCIACAO", label: "Negociação" },
  { status: "GANHA", label: "Qualificado / Ganho" },
];

const TEMPERATURA_SCORE: Record<TemperaturaOportunidade, number> = {
  FRIA: 33,
  MEDIA: 66,
  QUENTE: 100,
};

export async function getMariaInteligenciaAtendimento() {
  const agora = new Date();
  const hoje = startOfDay(agora);
  const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);

  const [oportunidades, tarefasWhatsappPendentes] = await Promise.all([
    prisma.oportunidade.findMany({
      where: {
        ativa: true,
        OR: [
          { canalOrigem: { in: [CanalOrigem.SITE, CanalOrigem.OUTROS] } },
          { historicos: { some: { tipo: { in: [TipoContato.EMAIL, TipoContato.WHATSAPP] } } } },
        ],
      },
      select: {
        id: true,
        titulo: true,
        status: true,
        temperatura: true,
        canalOrigem: true,
        potencialOportunidade: true,
        valorContrato: true,
        createdAt: true,
        empresa: { select: { razaoSocial: true, nomeFantasia: true, estado: true } },
        pessoa: { select: { nome: true } },
        historicos: {
          where: { tipo: { in: [TipoContato.EMAIL, TipoContato.WHATSAPP, TipoContato.OUTRO] } },
          orderBy: { createdAt: "desc" },
          select: { tipo: true, createdAt: true, resumo: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }) as Promise<OportunidadeComHistorico[]>,
    prisma.tarefa.findMany({
      where: { tipo: "WHATSAPP", status: "PENDENTE" },
      select: {
        id: true,
        titulo: true,
        dataVencimento: true,
        prioridade: true,
        empresa: { select: { razaoSocial: true, nomeFantasia: true } },
        oportunidade: { select: { id: true, titulo: true } },
      },
      orderBy: { dataVencimento: "asc" },
    }),
  ]);

  // ─── Métricas agregadas ────────────────────────────────────────────────
  const leadsHoje = oportunidades.filter((o) => o.createdAt >= hoje);
  const leadsOntem = oportunidades.filter((o) => o.createdAt >= ontem && o.createdAt < hoje);

  const porCanal = { SITE: 0, WHATSAPP: 0, EMAIL: 0, OUTROS: 0 };
  const porCanalGanhas = { SITE: 0, WHATSAPP: 0, EMAIL: 0, OUTROS: 0 };
  let quentes = 0;
  let medias = 0;
  let frias = 0;
  let ganhas = 0;
  let scoreSoma = 0;
  let scoreCount = 0;
  const temposAte1Contato: number[] = [];
  let valorPotencialAtivo = 0;
  let qualificadas = 0;

  const distribuicaoStatus: Record<string, number> = {};

  for (const o of oportunidades) {
    const canal = getCanal(o);
    porCanal[canal] += 1;
    if (o.status === "GANHA") porCanalGanhas[canal] += 1;

    if (o.temperatura) {
      scoreSoma += TEMPERATURA_SCORE[o.temperatura];
      scoreCount += 1;
      if (o.temperatura === "QUENTE") quentes += 1;
      if (o.temperatura === "MEDIA") medias += 1;
      if (o.temperatura === "FRIA") frias += 1;
    }

    if (o.status === "GANHA") ganhas += 1;
    if (o.status !== "PERDIDA") {
      valorPotencialAtivo += Number(o.potencialOportunidade ?? o.valorContrato ?? 0);
    }
    if (o.status !== "NOVA" && o.status !== "PERDIDA") qualificadas += 1;

    distribuicaoStatus[o.status] = (distribuicaoStatus[o.status] ?? 0) + 1;

    const primeiroHistorico = [...o.historicos].reverse()[0];
    if (primeiroHistorico) {
      temposAte1Contato.push(diffMinutes(o.createdAt, primeiroHistorico.createdAt));
    }
  }

  const totalLeads = oportunidades.length;
  const tempoMedioResposta =
    temposAte1Contato.length > 0
      ? Math.round(temposAte1Contato.reduce((a, b) => a + b, 0) / temposAte1Contato.length)
      : 0;
  const taxaConversao = totalLeads > 0 ? Math.round((ganhas / totalLeads) * 1000) / 10 : 0;
  const taxaQualificacao = totalLeads > 0 ? Math.round((qualificadas / totalLeads) * 100) : 0;
  const temperaturaMedia = scoreCount > 0 ? Math.round(scoreSoma / scoreCount) : 0;

  // ─── Fila Inteligente — leads ativos sem contato recente + tarefas vencidas
  const leadsAguardando = oportunidades
    .filter((o) => ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO"].includes(o.status))
    .map((o) => {
      const ultimoContato = o.historicos[0]?.createdAt ?? o.createdAt;
      return { o, minutosParado: diffMinutes(ultimoContato, agora) };
    })
    .sort((a, b) => b.minutosParado - a.minutosParado)
    .slice(0, 5)
    .map(({ o, minutosParado }) => {
      const prioridade = prioridadePorTempoParado(minutosParado);
      return {
        id: o.id,
        titulo: `Aguardando contato há ${tempoRelativo(minutosParado)}`,
        empresa: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
        prioridade,
        icone: prioridade === "critical" ? "🔥" : prioridade === "warning" ? "◷" : "●",
      };
    });

  const tarefasFila = tarefasWhatsappPendentes.slice(0, 4).map((t) => {
    const atrasada = t.dataVencimento && t.dataVencimento < agora;
    return {
      id: t.id,
      titulo: t.titulo,
      empresa: t.empresa?.nomeFantasia ?? t.empresa?.razaoSocial ?? t.oportunidade?.titulo ?? "Sem empresa",
      prioridade: atrasada ? "critical" : t.prioridade === "URGENTE" ? "critical" : t.prioridade === "ALTA" ? "warning" : "neutral",
      icone: "📄",
    };
  });

  const filaInteligente = [...leadsAguardando, ...tarefasFila].slice(0, 7);

  // ─── Pipeline — distribuição real atual por etapa ─────────────────────
  const maxPipeline = Math.max(1, ...PIPELINE_ORDEM.map((p) => distribuicaoStatus[p.status] ?? 0));
  const pipeline = PIPELINE_ORDEM.map((p) => ({
    status: p.status,
    label: p.label,
    quantidade: distribuicaoStatus[p.status] ?? 0,
    percentualDoMax: Math.round(((distribuicaoStatus[p.status] ?? 0) / maxPipeline) * 100),
  }));

  // ─── Origem dos leads ───────────────────────────────────────────────────
  const CANAL_LABEL: Record<string, string> = {
    SITE: "Site institucional",
    WHATSAPP: "WhatsApp",
    EMAIL: "E-mail",
    OUTROS: "Outros / não identificado",
  };
  const origemLeads = (["SITE", "WHATSAPP", "EMAIL", "OUTROS"] as const)
    .map((canal) => {
      const total = porCanal[canal];
      const conv = total > 0 ? Math.round((porCanalGanhas[canal] / total) * 100) : 0;
      return {
        canal,
        label: CANAL_LABEL[canal],
        quantidade: total,
        conversaoPct: conv,
        qualidade: conv >= 20 ? "Alta" : conv >= 8 ? "Média" : "Baixa",
      };
    })
    .filter((c) => c.quantidade > 0);

  // ─── Conversas recentes (via HistoricoContato — Conversa/Mensagem não é
  // populada pelo fluxo real da Maria hoje) ──────────────────────────────
  const conversasRecentes = oportunidades
    .filter((o) => o.historicos.length > 0)
    .sort((a, b) => b.historicos[0].createdAt.getTime() - a.historicos[0].createdAt.getTime())
    .slice(0, 5)
    .map((o) => ({
      id: o.id,
      empresa: o.empresa.nomeFantasia ?? o.empresa.razaoSocial,
      resumo: o.historicos[0].resumo ?? "Sem resumo registrado",
      minutosAtras: diffMinutes(o.historicos[0].createdAt, agora),
      temperatura: o.temperatura,
    }));

  // ─── Insights — computados a partir de dados reais ─────────────────────
  const insights: string[] = [];
  const paradosCritico = leadsAguardando.filter((l) => l.prioridade === "critical").length;
  if (paradosCritico > 0) {
    insights.push(`${paradosCritico} lead${paradosCritico > 1 ? "s estão" : " está"} sem contato há mais de 24 horas.`);
  }
  const melhorCanal = [...origemLeads].sort((a, b) => b.conversaoPct - a.conversaoPct)[0];
  if (melhorCanal && melhorCanal.quantidade >= 3) {
    insights.push(`O canal com melhor conversão é ${melhorCanal.label} (${melhorCanal.conversaoPct}%).`);
  }
  const etapaGargalo = [...pipeline].filter((p) => p.status !== "GANHA").sort((a, b) => b.quantidade - a.quantidade)[0];
  if (etapaGargalo && etapaGargalo.quantidade > 0) {
    insights.push(`A etapa com mais leads parados é "${etapaGargalo.label}", com ${etapaGargalo.quantidade} oportunidade${etapaGargalo.quantidade > 1 ? "s" : ""}.`);
  }
  if (tarefasWhatsappPendentes.length > 0) {
    insights.push(`Existem ${tarefasWhatsappPendentes.length} follow-up${tarefasWhatsappPendentes.length > 1 ? "s" : ""} de WhatsApp pendentes aguardando ação humana.`);
  }

  // ─── Recomendações — leads quentes sem contato / tarefas urgentes ──────
  const recomendacoes = oportunidades
    .filter((o) => o.status !== "GANHA" && o.status !== "PERDIDA")
    .map((o) => {
      const minutosParado = diffMinutes(o.historicos[0]?.createdAt ?? o.createdAt, agora);
      let peso = minutosParado;
      if (o.temperatura === "QUENTE") peso += 10000;
      return { o, minutosParado, peso };
    })
    .filter((x) => x.o.temperatura === "QUENTE" || x.minutosParado >= URGENCIA.MEDIA_MIN)
    .sort((a, b) => b.peso - a.peso)
    .slice(0, 4)
    .map(({ o, minutosParado }) => {
      const empresa = o.empresa.nomeFantasia ?? o.empresa.razaoSocial;
      const acao =
        o.status === "PROPOSTA_ENVIADA"
          ? `Fazer follow-up da proposta com ${empresa}`
          : minutosParado >= URGENCIA.ALTA_MIN
            ? `Ligar imediatamente para ${empresa}`
            : `Responder ${empresa}`;
      return {
        id: o.id,
        titulo: acao,
        motivo:
          o.temperatura === "QUENTE"
            ? "Lead quente — alta chance de conversão."
            : `Parado há ${tempoRelativo(minutosParado)} sem contato.`,
        prioridade: o.temperatura === "QUENTE" || minutosParado >= URGENCIA.ALTA_MIN ? "critical" : "warning",
      };
    });

  // ─── Resumo executivo do dia ────────────────────────────────────────────
  const conversasIniciadasHoje = oportunidades.reduce(
    (total, o) => total + o.historicos.filter((h) => h.createdAt >= hoje).length,
    0,
  );

  return {
    estadoIA: {
      conversasAtivas: oportunidades.filter((o) => ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO"].includes(o.status)).length,
      aguardandoHumano: tarefasWhatsappPendentes.length,
      tempoMedioResposta,
      taxaQualificacao,
    },
    metricas: {
      novosLeadsHoje: leadsHoje.length,
      novosLeadsHojeDelta: leadsOntem.length > 0 ? Math.round(((leadsHoje.length - leadsOntem.length) / leadsOntem.length) * 100) : null,
      conversasAtivas: oportunidades.filter((o) => ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO"].includes(o.status)).length,
      aguardandoResposta: leadsAguardando.length + tarefasWhatsappPendentes.length,
      followupsPendentes: tarefasWhatsappPendentes.length,
      oportunidadesQualificadasHoje: leadsHoje.filter((o) => o.status !== "NOVA").length,
      taxaConversao,
      tempoMedioResposta,
      temperaturaMedia,
    },
    filaInteligente,
    pipeline,
    origemLeads,
    insights,
    conversasRecentes,
    recomendacoes,
    resumoDia: {
      leadsAtendidos: leadsHoje.length,
      conversasIniciadas: conversasIniciadasHoje,
      oportunidadesGeradas: leadsHoje.length,
      receitaPotencial: valorPotencialAtivo,
    },
    totalLeadsAtivos: totalLeads,
  };
}

export type MariaInteligenciaAtendimento = Awaited<ReturnType<typeof getMariaInteligenciaAtendimento>>;
