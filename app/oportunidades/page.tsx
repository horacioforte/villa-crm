"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CircleDollarSign, FileText, Loader2, Plus, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OportunidadeDetalhe } from "@/components/kanban/OportunidadeDetalhe";
import { OportunidadeModal } from "@/components/kanban/OportunidadeModal";
import { PageNavigation } from "@/components/layout/PageNavigation";
import { temProximaAcao } from "@/lib/utils";
import {
  statusOportunidadeValues,
  tipoServicoValues,
} from "@/lib/validations/oportunidade";

type StatusOportunidade = (typeof statusOportunidadeValues)[number];
type TemperaturaOportunidade = "FRIA" | "MEDIA" | "QUENTE";
type TipoNegocioFiltro = "TODOS" | "LOCACAO" | "EQUIPAMENTO_USADO";
type TipoServico = (typeof tipoServicoValues)[number];

const TEMPERATURA_CONFIG: Record<
  TemperaturaOportunidade,
  { emoji: string; label: string; className: string }
> = {
  QUENTE: { emoji: "🟢", label: "Quente", className: "bg-emerald-100 text-emerald-700" },
  MEDIA: { emoji: "🟡", label: "Média", className: "bg-amber-100 text-amber-700" },
  FRIA: { emoji: "🔴", label: "Fria", className: "bg-red-100 text-red-700" },
};

type Oportunidade = {
  id: string;
  titulo: string;
  tipo: "LOCACAO" | "EQUIPAMENTO_USADO";
  tipoServico?: TipoServico | null;
  status: StatusOportunidade;
  potencialOportunidade: string | number | null;
  valorContrato: string | number | null;
  canalOrigem?: string | null;
  temperatura: TemperaturaOportunidade | null;
  temperaturaMotivo: string | null;
  empresa: {
    razaoSocial: string;
    nomeFantasia: string | null;
  };
  pessoa: {
    nome: string;
  } | null;
  obra: {
    nome: string;
  } | null;
  tarefas?: Array<{
    status: string;
  }>;
  propostas?: Array<{
    valorTotal: string | number;
    status: string;
  }>;
};

const tipoServicoLabels: Record<TipoServico, string> = {
  BOMBA_LANCA: "Bomba Lanca",
  BOMBA_ESTACIONARIA: "Bomba Estacionaria",
  TELEBELT: "Telebelt",
  BETONEIRA: "Caminhao Betoneira",
  CENTRAL_IN_LOCO: "Central In Loco",
  CONCRETO: "Concreto",
  SERVICO_ESPECIAL: "Servico Especial",
};

const columns: Array<{
  status: StatusOportunidade;
  title: string;
  badgeClassName: string;
}> = [
  {
    status: "NOVA",
    title: "Nova",
    badgeClassName: "bg-[#E8EEFB] text-[#1A2E5A]",
  },
  {
    status: "EM_ATENDIMENTO",
    title: "Em atendimento",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  {
    status: "PROPOSTA_ENVIADA",
    title: "Proposta enviada",
    badgeClassName: "bg-amber-100 text-amber-700",
  },
  {
    status: "NEGOCIACAO",
    title: "Negociacao",
    badgeClassName: "bg-violet-100 text-violet-700",
  },
  {
    status: "GANHA",
    title: "Ganha",
    badgeClassName: "bg-emerald-100 text-emerald-700",
  },
  {
    status: "PERDIDA",
    title: "Perdida",
    badgeClassName: "bg-red-100 text-red-700",
  },
];

function formatCurrency(value: string | number | null) {
  if (value === null) {
    return "Valor nao informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function getValorPipeline(oportunidade: Oportunidade) {
  if (oportunidade.valorContrato !== null) {
    return {
      label: "Contrato",
      value: oportunidade.valorContrato,
    };
  }

  const propostaAtiva = oportunidade.propostas?.[0];

  if (propostaAtiva) {
    return {
      label: "Proposta",
      value: propostaAtiva.valorTotal,
    };
  }

  if (oportunidade.potencialOportunidade !== null) {
    return {
      label: "Potencial",
      value: oportunidade.potencialOportunidade,
    };
  }

  return null;
}

export default function OportunidadesPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [statusInicial, setStatusInicial] =
    useState<StatusOportunidade>("NOVA");
  const [oportunidadeEditandoId, setOportunidadeEditandoId] = useState<
    string | null
  >(null);
  const [oportunidadeDetalheId, setOportunidadeDetalheId] = useState<
    string | null
  >(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoNegocioFiltro>("TODOS");

  useEffect(() => {
    async function loadOportunidades() {
      try {
        const response = await fetch("/api/oportunidades");

        if (!response.ok) {
          throw new Error("Falha ao carregar oportunidades.");
        }

        setOportunidades(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar as oportunidades.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOportunidades();
  }, []);

  const totalPipeline = useMemo(
    () =>
      oportunidades.reduce((total, oportunidade) => {
        const valorPipeline = getValorPipeline(oportunidade);

        return total + Number(valorPipeline?.value ?? 0);
      }, 0),
    [oportunidades],
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const id = String(active.id);
    const nextStatus = String(over.id) as StatusOportunidade;
    const oportunidade = oportunidades.find((item) => item.id === id);

    if (!oportunidade || oportunidade.status === nextStatus) {
      return;
    }

    const previous = oportunidades;
    setOportunidades((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item,
      ),
    );

    try {
      const response = await fetch(`/api/oportunidades/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao atualizar status.");
      }

      toast.success("Status da oportunidade atualizado.");
    } catch (error) {
      setOportunidades(previous);
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel mover a oportunidade.",
      );
    }
  }

  function handleAbrirCriacao(status: StatusOportunidade = "NOVA") {
    setStatusInicial(status);
    setOportunidadeEditandoId(null);
    setModalAberto(true);
  }

  function handleFecharModal() {
    setModalAberto(false);
    setOportunidadeEditandoId(null);
  }

  const oportunidadesFiltradas = useMemo(
    () =>
      oportunidades.filter((oportunidade) =>
        filtroTipo === "TODOS" ? true : oportunidade.tipo === filtroTipo,
      ),
    [filtroTipo, oportunidades],
  );

  function handleSalvar(oportunidade: Omit<Oportunidade, "temperatura" | "temperaturaMotivo"> & { temperatura?: TemperaturaOportunidade | null; temperaturaMotivo?: string | null }) {
    setOportunidades((current) => {
      const exists = current.some((item) => item.id === oportunidade.id);
      const merged: Oportunidade = {
        temperatura: null,
        temperaturaMotivo: null,
        ...oportunidade,
      };

      if (exists) {
        return current.map((item) =>
          item.id === oportunidade.id
            ? { ...item, ...merged }
            : item,
        );
      }

      return [merged, ...current];
    });
  }

  function handleEditar(id: string) {
    const oportunidade = oportunidades.find((item) => item.id === id);

    setOportunidadeDetalheId(null);
    setStatusInicial(oportunidade?.status ?? "NOVA");
    setOportunidadeEditandoId(id);
    setModalAberto(true);
  }

  function handleDeletar(id: string) {
    setOportunidades((current) => current.filter((item) => item.id !== id));
    setOportunidadeDetalheId(null);
  }

  function handleTemperaturaAtualizada(
    id: string,
    temperatura: TemperaturaOportunidade,
    motivo: string | null,
  ) {
    setOportunidades((current) =>
      current.map((item) =>
        item.id === id ? { ...item, temperatura, temperaturaMotivo: motivo } : item,
      ),
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-[1600px]">
        <PageNavigation
          currentPage="Pipeline de oportunidades"
          currentHref="/oportunidades"
        />
        <header className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Pipeline de oportunidades
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Arraste oportunidades entre etapas para acompanhar locacoes e
              vendas de bombas de concreto e betoneiras.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,auto)_minmax(150px,1fr)_minmax(220px,1fr)] 2xl:w-auto">
            <Button
              type="button"
              onClick={() => handleAbrirCriacao("NOVA")}
              className="h-full min-h-16 rounded-3xl bg-[#1E4FAB] px-5 text-white hover:bg-[#1A2E5A] sm:col-span-2 lg:col-span-1"
            >
              <Plus className="size-4" />
              Nova Oportunidade
            </Button>
            <Card className="min-w-0 rounded-3xl border-[#D7DEEA] bg-white px-2">
              <CardHeader className="p-5">
                <CardDescription>Oportunidades</CardDescription>
                <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
                  {oportunidades.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="min-w-0 rounded-3xl border-[#D7DEEA] bg-white px-2">
              <CardHeader className="p-5">
                <CardDescription>Pipeline total</CardDescription>
                <CardTitle className="break-words text-2xl font-bold text-[#1A2E5A]">
                  {formatCurrency(totalPipeline)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </header>

        <section className="mt-6 flex flex-wrap gap-2">
          {[
            { label: "Todos", value: "TODOS" },
            { label: "Locacao", value: "LOCACAO" },
            { label: "Equipamento usado", value: "EQUIPAMENTO_USADO" },
          ].map((item) => (
            <Button
              key={item.value}
              type="button"
              variant={filtroTipo === item.value ? "default" : "outline"}
              onClick={() => setFiltroTipo(item.value as TipoNegocioFiltro)}
              className={`rounded-2xl ${
                filtroTipo === item.value
                  ? "bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
                  : "border-[#D7DEEA] text-[#1A2E5A] hover:bg-[#E8EEFB]"
              }`}
            >
              {item.label}
            </Button>
          ))}
        </section>

        {isLoading ? (
          <div className="mt-10 flex items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando oportunidades...
          </div>
        ) : oportunidades.length === 0 ? (
          <Card className="mt-10 rounded-3xl border-dashed border-[#D7DEEA] bg-white">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <Target className="size-10 text-[#1E4FAB]" />
              <h2 className="mt-4 text-xl font-bold text-[#1A2E5A]">
                Nenhuma oportunidade cadastrada
              </h2>
              <p className="mt-2 max-w-md text-sm text-[#667085]">
                As oportunidades criadas pela API aparecerao aqui agrupadas por
                etapa do pipeline.
              </p>
            </CardContent>
          </Card>
        ) : (
          <DndContext onDragEnd={handleDragEnd}>
            <section className="mt-10 grid gap-4 overflow-x-auto pb-4 xl:grid-cols-6">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.status}
                  status={column.status}
                  title={column.title}
                  badgeClassName={column.badgeClassName}
                  onNovo={() => handleAbrirCriacao(column.status)}
                  onAbrirDetalhe={(id) => setOportunidadeDetalheId(id)}
                  onTemperaturaAtualizada={handleTemperaturaAtualizada}
                  oportunidades={oportunidadesFiltradas.filter(
                    (oportunidade) => oportunidade.status === column.status,
                  )}
                />
              ))}
            </section>
          </DndContext>
        )}
      </div>

      <OportunidadeModal
        aberto={modalAberto}
        onFechar={handleFecharModal}
        onSalvar={handleSalvar}
        statusInicial={statusInicial}
        oportunidadeId={oportunidadeEditandoId}
      />

      {oportunidadeDetalheId ? (
        <OportunidadeDetalhe
          id={oportunidadeDetalheId}
          onFechar={() => setOportunidadeDetalheId(null)}
          onEditar={handleEditar}
          onDeletar={handleDeletar}
        />
      ) : null}
    </main>
  );
}

function KanbanColumn({
  status,
  title,
  badgeClassName,
  oportunidades,
  onNovo,
  onAbrirDetalhe,
  onTemperaturaAtualizada,
}: {
  status: StatusOportunidade;
  title: string;
  badgeClassName: string;
  oportunidades: Oportunidade[];
  onNovo: () => void;
  onAbrirDetalhe: (id: string) => void;
  onTemperaturaAtualizada: (id: string, temperatura: TemperaturaOportunidade, motivo: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[520px] min-w-72 rounded-3xl border border-[#D7DEEA] bg-white/80 p-4 transition ${
        isOver ? "ring-2 ring-[#1E4FAB]" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <Badge variant="secondary" className={badgeClassName}>
          {title}
        </Badge>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#F4F6FA] px-3 py-1 text-xs font-bold text-[#1A2E5A]">
            {oportunidades.length}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onNovo}
            className="rounded-full text-[#1E4FAB] hover:bg-[#E8EEFB]"
            aria-label={`Criar oportunidade em ${title}`}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {oportunidades.map((oportunidade) => (
          <OpportunityCard
            key={oportunidade.id}
            oportunidade={oportunidade}
            onAbrirDetalhe={onAbrirDetalhe}
            onTemperaturaAtualizada={onTemperaturaAtualizada}
          />
        ))}
      </div>
    </div>
  );
}

function OpportunityCard({
  oportunidade,
  onAbrirDetalhe,
  onTemperaturaAtualizada,
}: {
  oportunidade: Oportunidade;
  onAbrirDetalhe: (id: string) => void;
  onTemperaturaAtualizada: (id: string, temperatura: TemperaturaOportunidade, motivo: string | null) => void;
}) {
  const [classificando, setClassificando] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: oportunidade.id,
      data: {
        status: oportunidade.status,
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  function handleGerarProposta(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onAbrirDetalhe(oportunidade.id);
  }

  async function handleClassificar(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setClassificando(true);
    try {
      const response = await fetch(`/api/oportunidades/${oportunidade.id}/temperatura`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Erro ao classificar.");
      }
      const data = await response.json();
      onTemperaturaAtualizada(oportunidade.id, data.temperatura, data.temperaturaMotivo);
      toast.success("Temperatura classificada pela IA.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao classificar oportunidade.");
    } finally {
      setClassificando(false);
    }
  }

  const precisaProximaAcao = ["NOVA", "EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIACAO"].includes(oportunidade.status);
  const semProximaAcao = precisaProximaAcao && !temProximaAcao(oportunidade.tarefas ?? []);
  const valorPipeline = getValorPipeline(oportunidade);

  async function handleAlterarTemperatura(temperatura: TemperaturaOportunidade) {
    if (oportunidade.temperatura === temperatura) return;
    try {
      const response = await fetch(`/api/oportunidades/${oportunidade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperatura }),
      });
      if (!response.ok) throw new Error("Erro ao alterar temperatura.");
      onTemperaturaAtualizada(oportunidade.id, temperatura, null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar temperatura.");
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onAbrirDetalhe(oportunidade.id)}
      className={`cursor-grab rounded-3xl border-[#D7DEEA] bg-white shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-70 shadow-xl" : ""
      } ${
        semProximaAcao ? "border-red-300 ring-2 ring-red-100" : ""
      }`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-bold text-[#1A2E5A]">
            {oportunidade.titulo}
          </CardTitle>
          <Badge
            variant="secondary"
            className={
              oportunidade.tipo === "LOCACAO"
                ? "bg-[#E8EEFB] text-[#1A2E5A]"
                : "bg-emerald-100 text-emerald-700"
            }
          >
            {oportunidade.tipo === "LOCACAO" ? "Locação" : "Equip. usado"}
          </Badge>
        </div>
        <CardDescription>
          {oportunidade.empresa.nomeFantasia ??
            oportunidade.empresa.razaoSocial}
        </CardDescription>
        {oportunidade.tipo === "LOCACAO" && oportunidade.tipoServico ? (
          <Badge
            variant="secondary"
            className="w-fit bg-[#E8EEFB] text-xs text-[#1A2E5A]"
          >
            {tipoServicoLabels[oportunidade.tipoServico]}
          </Badge>
        ) : null}
        {oportunidade.tipo === "EQUIPAMENTO_USADO" ? (
          <Badge
            variant="secondary"
            className="w-fit bg-amber-100 text-xs text-amber-700"
          >
            Equipamento usado
          </Badge>
        ) : null}
        {semProximaAcao ? (
          <Badge className="w-fit bg-red-100 text-xs text-red-700">
            SEM PROXIMA ACAO
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {valorPipeline ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2E5A]">
            <CircleDollarSign className="size-4 text-[#1E4FAB]" />
            {valorPipeline.label}: {formatCurrency(valorPipeline.value)}
          </div>
        ) : null}
        <div className="mt-4 space-y-1 text-xs text-[#667085]">
          <p>Contato: {oportunidade.pessoa?.nome ?? "Não informado"}</p>
          <p>Obra: {oportunidade.obra?.nome ?? "Não vinculada"}</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleGerarProposta}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex-1 rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            <FileText className="size-4" />
            Gerar proposta
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={classificando}
            onClick={handleClassificar}
            onPointerDown={(event) => event.stopPropagation()}
            className="rounded-2xl border-[#D7DEEA] px-3 text-[#1E4FAB] hover:bg-[#E8EEFB]"
            aria-label="Classificar temperatura com IA"
            title="Classificar temperatura com IA"
          >
            {classificando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-1">
          {(["QUENTE", "MEDIA", "FRIA"] as TemperaturaOportunidade[]).map((t) => {
            const cfg = TEMPERATURA_CONFIG[t];
            const ativo = oportunidade.temperatura === t;
            return (
              <button
                key={t}
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAlterarTemperatura(t); }}
                onPointerDown={(e) => e.stopPropagation()}
                title={cfg.label}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                  ativo
                    ? `${cfg.className} ring-2 ring-offset-1 ring-current`
                    : "bg-[#F4F6FA] text-[#667085] hover:bg-[#E8EEFB]"
                }`}
              >
                {cfg.emoji} {cfg.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
