import { redirect } from "next/navigation";
import { Bot, Flame, PhoneCall, RefreshCw, Send, MessageCircle } from "lucide-react";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { OrigemLeadsDonut } from "@/components/maria/OrigemLeadsDonut";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getMariaInteligenciaAtendimento } from "@/lib/maria/dados";

function tempoRelativo(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h`;
  return `${Math.floor(horas / 24)}d`;
}

const PRIORIDADE_CHIP: Record<string, string> = {
  critical: "bg-[#FBE9E9] text-[#D03B3B]",
  warning: "bg-[#FCF1DA] text-[#B5790A]",
  good: "bg-[#E4F5EA] text-[#0C8A3E]",
  neutral: "bg-[#EEF1F6] text-[#667085]",
};

const PRIORIDADE_LABEL: Record<string, string> = {
  critical: "Alta",
  warning: "Média",
  good: "Baixa",
  neutral: "Acompanhar",
};

function MetricCard({
  icon,
  iconClass,
  label,
  value,
  delta,
  compact,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  delta?: { positivo: boolean; texto: string } | null;
  compact?: boolean;
}) {
  return (
    <Card className={`rounded-[20px] border-[#D7DEEA] ${compact ? "p-4" : "p-[18px]"} flex flex-col gap-2.5`}>
      <div
        className={`flex items-center justify-center rounded-[10px] ${iconClass} ${compact ? "size-7" : "size-[34px]"}`}
      >
        {icon}
      </div>
      <p className={`font-semibold text-[#667085] ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}>{label}</p>
      <p className={`font-extrabold leading-none text-[#1A2E5A] tabular-nums ${compact ? "text-[19px]" : "text-[28px]"}`}>
        {value}
      </p>
      {delta ? (
        <span className={`text-xs font-bold ${delta.positivo ? "text-[#0C8A3E]" : "text-[#D03B3B]"}`}>
          {delta.positivo ? "▲" : "▼"} {delta.texto}
        </span>
      ) : null}
    </Card>
  );
}

export default async function MariaPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (!can(currentUser.papel, "relatorios", "read")) {
    redirect("/");
  }

  const dados = await getMariaInteligenciaAtendimento();
  const ultimaInteracaoMin = dados.conversasRecentes[0]?.minutosAtras ?? null;

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Maria — Inteligência de Atendimento" currentHref="/maria" />

        {/* Cabeçalho */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[26px] font-bold text-[#1A2E5A]">
              Maria — Inteligência de Atendimento
              <span className="text-[#1E4FAB]">✦</span>
            </h1>
            <p className="mt-1 text-sm text-[#667085]">Transformando leads em oportunidades.</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E4F5EA] px-3.5 py-1.5 text-[13px] font-bold text-[#0C8A3E]">
              <span className="relative flex size-[7px]">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0C8A3E] opacity-60" />
                <span className="relative inline-flex size-[7px] rounded-full bg-[#0C8A3E]" />
              </span>
              Maria Online
            </span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#98A2B3]">Última interação</p>
              <p className="text-[15px] font-bold text-[#1A2E5A]">
                {ultimaInteracaoMin !== null ? `${tempoRelativo(ultimaInteracaoMin)} atrás` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#98A2B3]">Tempo até 1º contato</p>
              <p className="text-[15px] font-bold text-[#1A2E5A] tabular-nums">
                {dados.estadoIA.tempoMedioResposta} min
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#98A2B3]">Conversas ativas</p>
              <p className="text-[15px] font-bold text-[#1A2E5A] tabular-nums">{dados.estadoIA.conversasAtivas}</p>
            </div>
            <div className="flex items-center gap-2.5 border-l border-[#D7DEEA] pl-4">
              <div className="flex size-[38px] items-center justify-center rounded-full bg-gradient-to-br from-[#2A78D6] to-[#1A2E5A] text-sm font-bold text-white">
                M
              </div>
              <div>
                <p className="text-[13.5px] font-bold text-[#1A2E5A]">Maria</p>
                <p className="text-[11.5px] text-[#667085]">SDR IA</p>
              </div>
            </div>
          </div>
        </header>

        {/* Estado da IA */}
        <Card className="mt-6 flex flex-wrap items-center gap-6 rounded-[20px] border-[#D7DEEA] px-5 py-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#98A2B3]">Estado da IA</span>
          <div>
            <p className="text-xs text-[#667085]">Atendendo agora</p>
            <p className="text-[15px] font-bold text-[#1A2E5A] tabular-nums">{dados.estadoIA.conversasAtivas} conversas</p>
          </div>
          <div className="h-[30px] w-px bg-[#D7DEEA]" />
          <div>
            <p className="text-xs text-[#667085]">Aguardando ação humana</p>
            <p className="text-[15px] font-bold text-[#B5790A] tabular-nums">{dados.estadoIA.aguardandoHumano} conversas</p>
          </div>
          <div className="h-[30px] w-px bg-[#D7DEEA]" />
          <div>
            <p className="text-xs text-[#667085]">Taxa de qualificação</p>
            <p className="text-[15px] font-bold text-[#1E4FAB] tabular-nums">{dados.estadoIA.taxaQualificacao}%</p>
          </div>
        </Card>

        {/* Métricas primárias */}
        <div className="mt-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MetricCard
            icon={<Bot className="size-4" />}
            iconClass="bg-[#E8EEFB] text-[#1E4FAB]"
            label="Novos Leads Hoje"
            value={String(dados.metricas.novosLeadsHoje)}
            delta={
              dados.metricas.novosLeadsHojeDelta !== null
                ? { positivo: dados.metricas.novosLeadsHojeDelta >= 0, texto: `${Math.abs(dados.metricas.novosLeadsHojeDelta)}% vs. ontem` }
                : null
            }
          />
          <MetricCard
            icon={<MessageCircle className="size-4" />}
            iconClass="bg-[#E4F5EA] text-[#0C8A3E]"
            label="Conversas Ativas"
            value={String(dados.metricas.conversasAtivas)}
          />
          <MetricCard
            icon={<Flame className="size-4" />}
            iconClass="bg-[#FCF1DA] text-[#B5790A]"
            label="Aguardando Resposta"
            value={String(dados.metricas.aguardandoResposta)}
          />
          <MetricCard
            icon={<Send className="size-4" />}
            iconClass="bg-[#EEEBFB] text-[#4A3AA7]"
            label="Leads Qualificados Hoje"
            value={String(dados.metricas.oportunidadesQualificadasHoje)}
          />
        </div>

        {/* Métricas secundárias */}
        <div className="mt-3.5 grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <MetricCard
            compact
            icon={<RefreshCw className="size-3.5" />}
            iconClass="bg-[#E8EEFB] text-[#1E4FAB]"
            label="Follow-ups Pendentes"
            value={String(dados.metricas.followupsPendentes)}
          />
          <MetricCard
            compact
            icon={<span className="text-[13px] font-bold">%</span>}
            iconClass="bg-[#E4F5EA] text-[#0C8A3E]"
            label="Taxa de Conversão"
            value={`${dados.metricas.taxaConversao}%`}
          />
          <MetricCard
            compact
            icon={<span className="text-[13px] font-bold">⏱</span>}
            iconClass="bg-[#FCF1DA] text-[#B5790A]"
            label="Tempo até 1º Contato"
            value={`${dados.metricas.tempoMedioResposta} min`}
          />
          <MetricCard
            compact
            icon={<span className="text-[13px] font-bold">★</span>}
            iconClass="bg-[#EEEBFB] text-[#4A3AA7]"
            label="Temperatura Média"
            value={`${dados.metricas.temperaturaMedia}/100`}
          />
        </div>

        {/* Segunda faixa */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1.3fr_1.05fr]">
          {/* Fila Inteligente */}
          <Card className="rounded-[20px] border-[#D7DEEA] p-5">
            <h3 className="text-[15px] font-bold text-[#1A2E5A]">Fila Inteligente</h3>
            <div className="mt-2">
              {dados.filaInteligente.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#98A2B3]">
                  Nenhum lead aguardando ação agora. 🎉
                </p>
              ) : (
                dados.filaInteligente.map((item, i) => (
                  <div
                    key={item.id + i}
                    className="flex items-start gap-2.5 border-b border-[#D7DEEA] py-2.5 last:border-none"
                  >
                    <span
                      className={`mt-0.5 flex size-[26px] flex-shrink-0 items-center justify-center rounded-lg text-[13px] ${PRIORIDADE_CHIP[item.prioridade]}`}
                    >
                      {item.icone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[#1A2E5A]">{item.titulo}</p>
                      <p className="mt-0.5 text-[12.5px] text-[#667085]">{item.empresa}</p>
                    </div>
                    <span className={`h-fit rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${PRIORIDADE_CHIP[item.prioridade]}`}>
                      {PRIORIDADE_LABEL[item.prioridade]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Pipeline da Maria */}
          <Card className="rounded-[20px] border-[#D7DEEA] p-5">
            <h3 className="text-[15px] font-bold text-[#1A2E5A]">Pipeline da Maria</h3>
            <p className="mt-0.5 text-[11.5px] text-[#98A2B3]">Distribuição atual de leads por etapa</p>
            <div className="mt-4 flex flex-col gap-2">
              {dados.pipeline.map((etapa, i) => (
                <div key={etapa.status} className="grid grid-cols-[120px_1fr_36px] items-center gap-2.5">
                  <span className="text-xs font-semibold text-[#1A2E5A]">{etapa.label}</span>
                  <div className="h-[24px] overflow-hidden rounded-md bg-[#F4F6FA]">
                    <div
                      className="flex h-full items-center rounded-md px-2.5 text-[11.5px] font-bold text-white tabular-nums"
                      style={{
                        width: `${Math.max(etapa.percentualDoMax, etapa.quantidade > 0 ? 8 : 0)}%`,
                        background: [
                          "#86B6EF",
                          "#5598E7",
                          "#2A78D6",
                          "#1C5CAB",
                          "#184F95",
                          "#104281",
                        ][i],
                        color: i < 2 ? "#1A2E5A" : "#fff",
                      }}
                    >
                      {etapa.quantidade}
                    </div>
                  </div>
                  <span className="text-right text-[11px] tabular-nums text-[#667085]">
                    {dados.totalLeadsAtivos > 0 ? Math.round((etapa.quantidade / dados.totalLeadsAtivos) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Origem dos Leads */}
          <Card className="rounded-[20px] border-[#D7DEEA] p-5">
            <h3 className="text-[15px] font-bold text-[#1A2E5A]">Origem dos Leads</h3>
            <p className="mt-0.5 text-[11.5px] text-[#98A2B3]">
              Google Ads e LinkedIn ainda não têm atribuição automática
            </p>
            <div className="mt-3">
              <OrigemLeadsDonut dados={dados.origemLeads} />
            </div>
          </Card>
        </div>

        {/* Terceira faixa */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Inteligência da Maria */}
          <Card className="rounded-[20px] border-[#D7DEEA] p-5">
            <h3 className="text-[15px] font-bold text-[#1A2E5A]">Inteligência da Maria</h3>
            <div className="mt-2">
              {dados.insights.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#98A2B3]">
                  Ainda não há dados suficientes para gerar análises.
                </p>
              ) : (
                dados.insights.map((texto, i) => (
                  <div key={i} className="flex items-start gap-2.5 border-b border-[#D7DEEA] py-2.5 last:border-none">
                    <span className="mt-0.5 flex size-6 flex-shrink-0 items-center justify-center rounded-[7px] bg-[#E8EEFB] text-[12px] text-[#1E4FAB]">
                      ◷
                    </span>
                    <p className="text-[13px] leading-relaxed text-[#1A2E5A]">{texto}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Conversas em Andamento */}
          <Card className="rounded-[20px] border-[#D7DEEA] p-5">
            <h3 className="text-[15px] font-bold text-[#1A2E5A]">Conversas em Andamento</h3>
            <div className="mt-2">
              {dados.conversasRecentes.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#98A2B3]">Nenhuma conversa recente.</p>
              ) : (
                dados.conversasRecentes.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 border-b border-[#D7DEEA] py-2.5 last:border-none">
                    <div className="flex size-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-[#E8EEFB] text-[12px] font-bold text-[#1E4FAB]">
                      {c.empresa.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-bold text-[#1A2E5A]">{c.empresa}</p>
                        <span className="flex-shrink-0 text-[11px] text-[#98A2B3]">{tempoRelativo(c.minutosAtras)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#667085]">{c.resumo}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recomendações da Maria */}
          <Card className="rounded-[20px] border-[#D7DEEA] p-5">
            <h3 className="text-[15px] font-bold text-[#1A2E5A]">Recomendações da Maria</h3>
            <div className="mt-2">
              {dados.recomendacoes.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#98A2B3]">Nenhuma recomendação no momento.</p>
              ) : (
                dados.recomendacoes.map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 border-b border-[#D7DEEA] py-2.5 last:border-none">
                    <span
                      className={`mt-0.5 flex size-[26px] flex-shrink-0 items-center justify-center rounded-lg ${PRIORIDADE_CHIP[r.prioridade]}`}
                    >
                      <PhoneCall className="size-3.5" />
                    </span>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#1A2E5A]">{r.titulo}</p>
                      <p className="mt-0.5 text-xs text-[#667085]">{r.motivo}</p>
                    </div>
                    <span className={`h-fit rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${PRIORIDADE_CHIP[r.prioridade]}`}>
                      {PRIORIDADE_LABEL[r.prioridade]}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Rodapé */}
        <Card className="mt-4 flex flex-col overflow-hidden rounded-[20px] border-[#D7DEEA] lg:flex-row lg:items-center">
          <div className="flex items-center gap-3 border-b border-[#D7DEEA] p-4 lg:flex-[1.3] lg:border-b-0">
            <div className="flex size-[38px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2A78D6] to-[#1A2E5A] text-sm font-bold text-white">
              M
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A2E5A]">Maria está aprendendo e evoluindo</p>
              <p className="text-xs text-[#667085]">Cada conversa é uma oportunidade de gerar valor para a Villa.</p>
            </div>
          </div>
          <div className="flex flex-1 flex-wrap">
            <div className="flex-1 border-t border-[#D7DEEA] p-4 lg:border-l lg:border-t-0">
              <p className="text-[11px] text-[#667085]">Leads atendidos hoje</p>
              <p className="text-[19px] font-extrabold text-[#1A2E5A] tabular-nums">{dados.resumoDia.leadsAtendidos}</p>
            </div>
            <div className="flex-1 border-t border-[#D7DEEA] p-4 lg:border-l lg:border-t-0">
              <p className="text-[11px] text-[#667085]">Conversas iniciadas</p>
              <p className="text-[19px] font-extrabold text-[#1A2E5A] tabular-nums">{dados.resumoDia.conversasIniciadas}</p>
            </div>
            <div className="flex-1 border-t border-[#D7DEEA] p-4 lg:border-l lg:border-t-0">
              <p className="text-[11px] text-[#667085]">Oportunidades geradas</p>
              <p className="text-[19px] font-extrabold text-[#1A2E5A] tabular-nums">{dados.resumoDia.oportunidadesGeradas}</p>
            </div>
            <div className="flex-1 border-t border-[#D7DEEA] p-4 lg:border-l lg:border-t-0">
              <p className="text-[11px] text-[#667085]">Receita potencial</p>
              <p className="text-[19px] font-extrabold text-[#1A2E5A] tabular-nums">
                {dados.resumoDia.receitaPotencial.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#E8EEFB] p-4 lg:flex-1">
            <p className="text-[13px] font-bold italic text-[#1A2E5A]">
              "Nenhum lead será esquecido. Essa é a nossa missão." — Maria
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
