"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CircleDollarSign, Loader2, Plus, Target } from "lucide-react";
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
import { statusOportunidadeValues } from "@/lib/validations/oportunidade";

type StatusOportunidade = (typeof statusOportunidadeValues)[number];

type Oportunidade = {
  id: string;
  titulo: string;
  tipo: "LOCACAO" | "VENDA";
  status: StatusOportunidade;
  valor: string | number | null;
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
      oportunidades.reduce(
        (total, oportunidade) => total + Number(oportunidade.valor ?? 0),
        0,
      ),
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

  function handleSalvar(oportunidade: Oportunidade) {
    setOportunidades((current) => {
      const exists = current.some((item) => item.id === oportunidade.id);

      if (exists) {
        return current.map((item) =>
          item.id === oportunidade.id ? oportunidade : item,
        );
      }

      return [oportunidade, ...current];
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

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-[1600px]">
        <PageNavigation
          currentPage="Pipeline de oportunidades"
          currentHref="/oportunidades"
        />
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
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

          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto]">
            <Button
              type="button"
              onClick={() => handleAbrirCriacao("NOVA")}
              className="h-full min-h-16 rounded-3xl bg-[#1E4FAB] px-5 text-white hover:bg-[#1A2E5A]"
            >
              <Plus className="size-4" />
              Nova Oportunidade
            </Button>
            <Card className="rounded-3xl border-[#D7DEEA] bg-white px-2">
              <CardHeader>
                <CardDescription>Oportunidades</CardDescription>
                <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
                  {oportunidades.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="rounded-3xl border-[#D7DEEA] bg-white px-2">
              <CardHeader>
                <CardDescription>Pipeline total</CardDescription>
                <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
                  {formatCurrency(totalPipeline)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </header>

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
                  oportunidades={oportunidades.filter(
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
}: {
  status: StatusOportunidade;
  title: string;
  badgeClassName: string;
  oportunidades: Oportunidade[];
  onNovo: () => void;
  onAbrirDetalhe: (id: string) => void;
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
          />
        ))}
      </div>
    </div>
  );
}

function OpportunityCard({
  oportunidade,
  onAbrirDetalhe,
}: {
  oportunidade: Oportunidade;
  onAbrirDetalhe: (id: string) => void;
}) {
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

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onAbrirDetalhe(oportunidade.id)}
      className={`cursor-grab rounded-3xl border-[#D7DEEA] bg-white shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-70 shadow-xl" : ""
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
            {oportunidade.tipo === "LOCACAO" ? "Locacao" : "Venda"}
          </Badge>
        </div>
        <CardDescription>
          {oportunidade.empresa.nomeFantasia ??
            oportunidade.empresa.razaoSocial}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2E5A]">
          <CircleDollarSign className="size-4 text-[#1E4FAB]" />
          {formatCurrency(oportunidade.valor)}
        </div>
        <div className="mt-4 space-y-1 text-xs text-[#667085]">
          <p>Contato: {oportunidade.pessoa?.nome ?? "Nao informado"}</p>
          <p>Obra: {oportunidade.obra?.nome ?? "Nao vinculada"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
