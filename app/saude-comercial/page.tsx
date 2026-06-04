"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType, ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Target,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; nome: string };
type HealthColor = "verde" | "amarelo" | "vermelho";
type DetailSection =
  | "sem-proxima-acao"
  | "tarefas-vencidas"
  | "propostas-retorno"
  | "dias-sem-interacao"
  | "taxa-tarefas"
  | "sem-responsavel"
  | "cadencia";

type SaudeComercialData = {
  filtros: {
    vendedores: Option[];
    gerentes: Option[];
    filiais: Option[];
  };
  indicadores: {
    oportunidadesAbertas: number;
    oportunidadesSemProximaAcao: number;
    tarefasVencidas: number;
    propostasAguardandoRetorno: number;
    oportunidadesSemResponsavel: number;
    cumprimentoCadencia: number;
  };
  listas: {
    oportunidadesSemProximaAcao: Array<{
      id: string;
      titulo: string;
      cliente: string;
      obra: string | null;
      responsavel: string;
      motivo: string;
    }>;
    oportunidadesSemResponsavel: Array<{
      id: string;
      titulo: string;
      cliente: string;
      obra: string | null;
    }>;
    tarefasVencidasPorUsuario: Array<{
      usuarioId: string;
      nome: string;
      quantidade: number;
    }>;
    tarefasVencidas: Array<{
      id: string;
      titulo: string;
      cliente: string;
      oportunidade: string | null;
      responsavel: string;
      vencimento: string;
      diasVencida: number;
    }>;
    propostasAguardandoRetorno: Array<{
      id: string;
      numeroProposta: string;
      cliente: string;
      obra: string | null;
      valor: number;
      responsavel: string;
      diasSemContato: number;
    }>;
    diasSemInteracao: Array<{
      id: string;
      titulo: string;
      cliente: string;
      responsavel: string;
      dias: number;
      cor: HealthColor;
      ultimaInteracao: string;
    }>;
    tarefasPorUsuario: Array<{
      usuarioId: string;
      nome: string;
      criadas: number;
      concluidas: number;
      taxa: number;
    }>;
  };
};

const periodos = [
  { id: "7d", nome: "Últimos 7 dias" },
  { id: "30d", nome: "Últimos 30 dias" },
  { id: "90d", nome: "Últimos 90 dias" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function buildQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== "todos") {
      params.set(key, value);
    }
  });

  return params.toString();
}

function SelectFiltro({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "todos")}>
      <SelectTrigger className="h-11 min-w-48 rounded-2xl bg-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusBadge({ color }: { color: HealthColor }) {
  const config = {
    verde: "bg-emerald-100 text-emerald-700",
    amarelo: "bg-amber-100 text-amber-800",
    vermelho: "bg-red-100 text-red-700",
  };

  return (
    <Badge className={config[color]}>
      {color === "verde" ? "Em dia" : color === "amarelo" ? "Atenção" : "Crítico"}
    </Badge>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ElementType;
  tone: "green" | "yellow" | "red" | "blue";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-[#E8EEFB] text-[#1E4FAB]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        active ? "border-[#1E4FAB] ring-2 ring-[#1E4FAB]/20" : "border-[#D7DEEA]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#667085]">{title}</p>
          <p className="mt-2 text-3xl font-bold text-[#1A2E5A]">{value}</p>
          <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
        </div>
        <span className={`rounded-2xl p-3 ${toneClass[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
    </button>
  );
}

function DetailPanel({
  section,
  data,
}: {
  section: DetailSection;
  data: SaudeComercialData;
}) {
  if (section === "sem-proxima-acao") {
    return (
      <DetailCard title="Oportunidades sem próxima ação">
        {data.listas.oportunidadesSemProximaAcao.map((item) => (
          <DetailRow
            key={item.id}
            title={item.titulo}
            subtitle={`${item.cliente}${item.obra ? ` · ${item.obra}` : ""}`}
            right={item.responsavel}
            alert={item.motivo}
          />
        ))}
      </DetailCard>
    );
  }

  if (section === "tarefas-vencidas") {
    return (
      <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <DetailCard title="Tarefas vencidas por usuário">
          {data.listas.tarefasVencidasPorUsuario.map((item) => (
            <DetailRow
              key={item.usuarioId}
              title={item.nome}
              subtitle="Tarefas vencidas"
              right={String(item.quantidade)}
              alert={item.quantidade > 0 ? "Atraso" : "Em dia"}
            />
          ))}
        </DetailCard>
        <DetailCard title="Lista detalhada de tarefas vencidas">
          {data.listas.tarefasVencidas.map((item) => (
            <DetailRow
              key={item.id}
              title={item.titulo}
              subtitle={`${item.cliente}${item.oportunidade ? ` · ${item.oportunidade}` : ""}`}
              right={`${item.diasVencida} dia(s)`}
              alert={`Venceu em ${formatDate(item.vencimento)} · ${item.responsavel}`}
            />
          ))}
        </DetailCard>
      </div>
    );
  }

  if (section === "propostas-retorno") {
    return (
      <DetailCard title="Propostas aguardando retorno">
        {data.listas.propostasAguardandoRetorno.map((item) => (
          <DetailRow
            key={item.id}
            title={`${item.numeroProposta} · ${item.cliente}`}
            subtitle={`${item.obra ?? "Obra não informada"} · ${formatCurrency(item.valor)}`}
            right={`${item.diasSemContato} dia(s)`}
            alert={item.responsavel}
          />
        ))}
      </DetailCard>
    );
  }

  if (section === "dias-sem-interacao") {
    return (
      <DetailCard title="Dias sem interação">
        {data.listas.diasSemInteracao.slice(0, 30).map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 border-b border-[#D7DEEA] py-3 last:border-0 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold text-[#1A2E5A]">{item.cliente}</p>
              <p className="text-sm text-[#667085]">
                {item.titulo} · {item.responsavel} · última interação em{" "}
                {formatDate(item.ultimaInteracao)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge color={item.cor} />
              <span className="font-bold text-[#1A2E5A]">{item.dias} dia(s)</span>
            </div>
          </div>
        ))}
      </DetailCard>
    );
  }

  if (section === "taxa-tarefas") {
    return (
      <DetailCard title="Taxa de conclusão de tarefas">
        {data.listas.tarefasPorUsuario.map((item) => (
          <DetailRow
            key={item.usuarioId}
            title={item.nome}
            subtitle={`${item.concluidas}/${item.criadas} tarefas concluídas`}
            right={`${item.taxa}%`}
            alert={item.taxa >= 90 ? "Excelente" : item.taxa >= 75 ? "Atenção" : "Acompanhar"}
          />
        ))}
      </DetailCard>
    );
  }

  if (section === "sem-responsavel") {
    return (
      <DetailCard title="Oportunidades sem responsável">
        {data.listas.oportunidadesSemResponsavel.map((item) => (
          <DetailRow
            key={item.id}
            title={item.titulo}
            subtitle={`${item.cliente}${item.obra ? ` · ${item.obra}` : ""}`}
            right="Sem vendedor"
            alert="Meta: zero"
          />
        ))}
      </DetailCard>
    );
  }

  return (
    <DetailCard title="Cumprimento da cadência comercial">
      <div className="rounded-3xl bg-[#F4F6FA] p-6">
        <p className="text-sm text-[#667085]">
          Percentual de oportunidades abertas com tarefa futura ou interação recente.
        </p>
        <p className="mt-3 text-5xl font-bold text-[#1A2E5A]">
          {data.indicadores.cumprimentoCadencia}%
        </p>
        <p className="mt-2 text-sm text-[#667085]">
          Quanto maior, melhor. Verde indica operação com follow-up em dia.
        </p>
      </div>
    </DetailCard>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardContent className="p-5">
        <h2 className="text-lg font-bold text-[#1A2E5A]">{title}</h2>
        <div className="mt-4">
          {children && Array.isArray(children) && children.length === 0 ? (
            <p className="text-sm text-[#667085]">Nenhum item encontrado.</p>
          ) : (
            children
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  title,
  subtitle,
  right,
  alert,
}: {
  title: string;
  subtitle: string;
  right: string;
  alert: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[#D7DEEA] py-3 last:border-0 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-semibold text-[#1A2E5A]">{title}</p>
        <p className="text-sm text-[#667085]">{subtitle}</p>
        <p className="mt-1 text-xs font-semibold text-amber-700">{alert}</p>
      </div>
      <span className="font-bold text-[#1A2E5A]">{right}</span>
    </div>
  );
}

export default function SaudeComercialPage() {
  const [data, setData] = useState<SaudeComercialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSection, setSelectedSection] =
    useState<DetailSection>("sem-proxima-acao");
  const [filters, setFilters] = useState({
    vendedorId: "todos",
    gerenteId: "todos",
    filialId: "todos",
    periodo: "30d",
  });

  async function loadData() {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/saude-comercial?${buildQuery(filters)}`);
      if (!response.ok) {
        throw new Error("Falha ao carregar Saúde Comercial.");
      }
      setData(await response.json());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar painel.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const criticalInteractions = useMemo(
    () => data?.listas.diasSemInteracao.filter((item) => item.cor === "vermelho").length ?? 0,
    [data],
  );

  return (
    <main className="min-h-screen bg-[#F4F6FA] p-4 text-[#1A2E5A] md:p-6">
      <PageNavigation currentPage="Saúde Comercial" currentHref="/saude-comercial" />

      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Gestão Comercial
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Saúde Comercial
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[#667085]">
              Painel para identificar oportunidades esquecidas, tarefas vencidas,
              propostas sem retorno e disciplina de cadência da equipe.
            </p>
          </div>
          <Button
            type="button"
            onClick={loadData}
            className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Atualizar
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <SelectFiltro
            value={filters.vendedorId}
            onChange={(vendedorId) =>
              setFilters((current) => ({ ...current, vendedorId }))
            }
            options={data?.filtros.vendedores ?? []}
            placeholder="Todos os vendedores"
          />
          <SelectFiltro
            value={filters.gerenteId}
            onChange={(gerenteId) =>
              setFilters((current) => ({ ...current, gerenteId }))
            }
            options={data?.filtros.gerentes ?? []}
            placeholder="Todos os gerentes"
          />
          <SelectFiltro
            value={filters.filialId}
            onChange={(filialId) =>
              setFilters((current) => ({ ...current, filialId }))
            }
            options={data?.filtros.filiais ?? []}
            placeholder="Todas as filiais"
          />
          <SelectFiltro
            value={filters.periodo}
            onChange={(periodo) => setFilters((current) => ({ ...current, periodo }))}
            options={periodos}
            placeholder="Período"
          />
          <Button
            type="button"
            variant="outline"
            onClick={loadData}
            className="h-11 rounded-2xl"
          >
            Aplicar filtros
          </Button>
        </div>
      </section>

      {isLoading || !data ? (
        <div className="mt-6 flex items-center rounded-3xl border border-[#D7DEEA] bg-white p-6 text-[#667085]">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Carregando painel de saúde comercial...
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Oportunidades abertas"
              value={data.indicadores.oportunidadesAbertas}
              subtitle="Em atendimento, proposta ou negociação"
              icon={ClipboardList}
              tone="blue"
            />
            <MetricCard
              title="Sem próxima ação"
              value={data.indicadores.oportunidadesSemProximaAcao}
              subtitle="Sem follow-up futuro ou sem responsável"
              icon={ShieldAlert}
              tone="red"
              active={selectedSection === "sem-proxima-acao"}
              onClick={() => setSelectedSection("sem-proxima-acao")}
            />
            <MetricCard
              title="Tarefas vencidas"
              value={data.indicadores.tarefasVencidas}
              subtitle="Pendentes ou em andamento fora do prazo"
              icon={AlertTriangle}
              tone="red"
              active={selectedSection === "tarefas-vencidas"}
              onClick={() => setSelectedSection("tarefas-vencidas")}
            />
            <MetricCard
              title="Propostas sem retorno"
              value={data.indicadores.propostasAguardandoRetorno}
              subtitle="Enviadas há mais de 5 dias sem interação"
              icon={Clock3}
              tone="yellow"
              active={selectedSection === "propostas-retorno"}
              onClick={() => setSelectedSection("propostas-retorno")}
            />
            <MetricCard
              title="Mais de 10 dias sem contato"
              value={criticalInteractions}
              subtitle="Oportunidades com interação crítica"
              icon={BarChart3}
              tone="red"
              active={selectedSection === "dias-sem-interacao"}
              onClick={() => setSelectedSection("dias-sem-interacao")}
            />
            <MetricCard
              title="Conclusão de tarefas"
              value={`${Math.round(
                data.listas.tarefasPorUsuario.reduce((sum, item) => sum + item.taxa, 0) /
                  Math.max(data.listas.tarefasPorUsuario.length, 1),
              )}%`}
              subtitle="Média por usuário no período"
              icon={CheckCircle2}
              tone="green"
              active={selectedSection === "taxa-tarefas"}
              onClick={() => setSelectedSection("taxa-tarefas")}
            />
            <MetricCard
              title="Sem responsável"
              value={data.indicadores.oportunidadesSemResponsavel}
              subtitle="Meta: zero"
              icon={UserX}
              tone="red"
              active={selectedSection === "sem-responsavel"}
              onClick={() => setSelectedSection("sem-responsavel")}
            />
            <MetricCard
              title="Cumprimento da cadência"
              value={`${data.indicadores.cumprimentoCadencia}%`}
              subtitle="Oportunidades com ação ou interação recente"
              icon={Target}
              tone={data.indicadores.cumprimentoCadencia >= 85 ? "green" : "yellow"}
              active={selectedSection === "cadencia"}
              onClick={() => setSelectedSection("cadencia")}
            />
          </div>

          <DetailPanel section={selectedSection} data={data} />
        </div>
      )}
    </main>
  );
}
