"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  Clock3,
  DollarSign,
  Flame,
  Globe2,
  Loader2,
  Mail,
  MessageCircle,
  Snowflake,
  Target,
  ThermometerSun,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type MariaDashboardData = {
  totalLeads: number;
  leadsHoje: number;
  leadsSemana: number;
  leadsMes: number;
  quentes: number;
  medias: number;
  frias: number;
  porCanal: {
    SITE: number;
    EMAIL: number;
    WHATSAPP: number;
  };
  oportunidadesGanhas: number;
  oportunidadesPerdidas: number;
  oportunidadesEmAndamento: number;
  taxaConversao: number;
  valorPotencial: number;
  tempoMedioResposta: number;
  ultimasOportunidades: Array<{
    id: string;
    titulo: string;
    temperatura: string | null;
    canalOrigem: "SITE" | "EMAIL" | "WHATSAPP";
    status: string;
    createdAt: string;
  }>;
};

const canalConfig = {
  SITE: {
    label: "Site",
    icon: Globe2,
    className: "bg-blue-100 text-blue-700",
  },
  EMAIL: {
    label: "E-mail",
    icon: Mail,
    className: "bg-violet-100 text-violet-700",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: MessageCircle,
    className: "bg-emerald-100 text-emerald-700",
  },
};

const temperaturaConfig = {
  QUENTE: {
    label: "Quente",
    className: "bg-red-100 text-red-700",
  },
  MEDIA: {
    label: "Média",
    className: "bg-amber-100 text-amber-800",
  },
  FRIA: {
    label: "Fria",
    className: "bg-blue-100 text-blue-700",
  },
};

const statusConfig: Record<string, string> = {
  NOVA: "Nova",
  EM_ATENDIMENTO: "Em atendimento",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: typeof Users;
  tone?: "blue" | "green" | "yellow" | "red";
}) {
  const toneClass = {
    blue: "bg-[#E8EEFB] text-[#1E4FAB]",
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  }[tone];

  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#667085]">{title}</p>
            <p className="mt-2 text-3xl font-bold text-[#1A2E5A]">{value}</p>
            <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
          </div>
          <span className={`rounded-2xl p-3 ${toneClass}`}>
            <Icon className="size-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CanalBadge({ canal }: { canal: keyof typeof canalConfig }) {
  const config = canalConfig[canal];
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon className="mr-1 size-3" />
      {config.label}
    </Badge>
  );
}

function TemperaturaBadge({ temperatura }: { temperatura: string | null }) {
  const config =
    temperatura && temperatura in temperaturaConfig
      ? temperaturaConfig[temperatura as keyof typeof temperaturaConfig]
      : null;

  if (!config) {
    return <Badge className="bg-zinc-100 text-zinc-700">Sem temperatura</Badge>;
  }

  return <Badge className={config.className}>{config.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "GANHA"
      ? "bg-emerald-100 text-emerald-700"
      : status === "PERDIDA"
        ? "bg-red-100 text-red-700"
        : "bg-[#E8EEFB] text-[#1E4FAB]";

  return <Badge className={tone}>{statusConfig[status] ?? status}</Badge>;
}

export function DashboardMaria() {
  const [data, setData] = useState<MariaDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMariaDashboard() {
      try {
        const response = await fetch("/api/saude-comercial/maria");

        if (!response.ok) {
          throw new Error("Falha ao carregar dashboard da Maria.");
        }

        setData(await response.json());
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Erro ao carregar dashboard da Maria.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadMariaDashboard();
  }, []);

  const canalData = useMemo(
    () =>
      data
        ? [
            { canal: "Site", leads: data.porCanal.SITE },
            { canal: "E-mail", leads: data.porCanal.EMAIL },
            { canal: "WhatsApp", leads: data.porCanal.WHATSAPP },
          ]
        : [],
    [data],
  );

  if (isLoading || !data) {
    return (
      <div className="mt-6 flex items-center rounded-3xl border border-[#D7DEEA] bg-white p-6 text-[#667085]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Carregando dashboard da Maria...
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Leads hoje"
          value={data.leadsHoje}
          subtitle="Criados hoje"
          icon={Users}
          tone="blue"
        />
        <MetricCard
          title="Leads 7 dias"
          value={data.leadsSemana}
          subtitle="Últimos 7 dias"
          icon={TrendingUp}
          tone="green"
        />
        <MetricCard
          title="Leads 30 dias"
          value={data.leadsMes}
          subtitle="Últimos 30 dias"
          icon={Target}
          tone="yellow"
        />
        <MetricCard
          title="Total"
          value={data.totalLeads}
          subtitle="Leads atribuídos à Maria"
          icon={CheckCircle2}
          tone="blue"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Quentes"
          value={data.quentes}
          subtitle="Alta prioridade comercial"
          icon={Flame}
          tone="red"
        />
        <MetricCard
          title="Médias"
          value={data.medias}
          subtitle="Interesse claro em qualificação"
          icon={ThermometerSun}
          tone="yellow"
        />
        <MetricCard
          title="Frias"
          value={data.frias}
          subtitle="Baixa urgência ou dados iniciais"
          icon={Snowflake}
          tone="blue"
        />
      </div>

      <Card className="rounded-3xl border-[#D7DEEA] bg-white">
        <CardContent className="p-5">
          <h2 className="text-lg font-bold text-[#1A2E5A]">Leads por canal</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Distribuição de entradas da Maria por site, e-mail e WhatsApp.
          </p>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={canalData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="canal" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="leads" fill="#1E4FAB" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="Taxa de conversão"
          value={`${data.taxaConversao}%`}
          subtitle={`${data.oportunidadesGanhas} ganha(s) de ${data.totalLeads}`}
          icon={Target}
          tone="green"
        />
        <MetricCard
          title="Valor potencial"
          value={formatCurrency(data.valorPotencial)}
          subtitle="Soma do potencial das oportunidades"
          icon={DollarSign}
          tone="blue"
        />
        <MetricCard
          title="Tempo médio resposta"
          value={`${data.tempoMedioResposta} min`}
          subtitle="Entre oportunidade e primeiro histórico"
          icon={Clock3}
          tone="yellow"
        />
      </div>

      <Card className="rounded-3xl border-[#D7DEEA] bg-white">
        <CardContent className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1A2E5A]">
                Últimas oportunidades da Maria
              </h2>
              <p className="mt-1 text-sm text-[#667085]">
                Clique em uma linha para abrir a oportunidade.
              </p>
            </div>
            <div className="text-sm font-semibold text-[#667085]">
              {data.oportunidadesEmAndamento} em andamento · {data.oportunidadesPerdidas} perdida(s)
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[#D7DEEA] text-left text-[#667085]">
                  <th className="py-3">Data</th>
                  <th className="py-3">Lead</th>
                  <th className="py-3">Canal</th>
                  <th className="py-3">Temperatura</th>
                  <th className="py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.ultimasOportunidades.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-[#667085]" colSpan={5}>
                      Nenhuma oportunidade encontrada.
                    </td>
                  </tr>
                ) : (
                  data.ultimasOportunidades.map((oportunidade) => (
                    <tr
                      key={oportunidade.id}
                      tabIndex={0}
                      onClick={() => {
                        window.location.href = `/oportunidades?id=${oportunidade.id}`;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          window.location.href = `/oportunidades?id=${oportunidade.id}`;
                        }
                      }}
                      className="cursor-pointer border-b border-[#EEF2F7] transition hover:bg-[#F4F6FA]"
                    >
                      <td className="py-3 text-[#667085]">
                        {formatDate(oportunidade.createdAt)}
                      </td>
                      <td className="py-3 font-semibold text-[#1A2E5A]">
                        {oportunidade.titulo}
                      </td>
                      <td className="py-3">
                        <CanalBadge canal={oportunidade.canalOrigem} />
                      </td>
                      <td className="py-3">
                        <TemperaturaBadge temperatura={oportunidade.temperatura} />
                      </td>
                      <td className="py-3">
                        <StatusBadge status={oportunidade.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
