"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bug,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import {
  FeedbackDetalheModal,
  type FeedbackDetalhe,
} from "@/components/feedback/FeedbackDetalheModal";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import {
  statusFeedbackConfig,
  tipoFeedbackConfig,
  type StatusFeedbackValue,
  type TipoFeedbackValue,
} from "@/components/feedback/feedback-config";
import { PageNavigation } from "@/components/layout/PageNavigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FeedbackApiResponse = {
  canManage: boolean;
  currentUserId: string;
  feedbacks: FeedbackDetalhe[];
};

type TipoFiltro = TipoFeedbackValue | "TODOS";
type StatusFiltro = StatusFeedbackValue | "TODOS";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function FeedbackPage() {
  const [feedbacks, setFeedbacks] = useState<FeedbackDetalhe[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [feedbackSelecionado, setFeedbackSelecionado] =
    useState<FeedbackDetalhe | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("TODOS");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("TODOS");
  const [autorFiltro, setAutorFiltro] = useState("TODOS");

  const loadFeedbacks = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/feedback");

      if (!response.ok) {
        throw new Error("Falha ao carregar feedbacks.");
      }

      const data = (await response.json()) as FeedbackApiResponse;
      setFeedbacks(data.feedbacks);
      setCanManage(data.canManage);
    } catch {
      toast.error("Nao foi possivel carregar os feedbacks.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const autores = useMemo(() => {
    const map = new Map<string, string>();

    for (const feedback of feedbacks) {
      map.set(feedback.autor.id, feedback.autor.nome);
    }

    return [...map].map(([id, nome]) => ({ id, nome }));
  }, [feedbacks]);

  const resumo = useMemo(
    () =>
      Object.keys(statusFeedbackConfig).map((status) => ({
        status: status as StatusFeedbackValue,
        total: feedbacks.filter((feedback) => feedback.status === status).length,
      })),
    [feedbacks],
  );

  const feedbacksFiltrados = useMemo(
    () =>
      feedbacks.filter((feedback) => {
        if (tipoFiltro !== "TODOS" && feedback.tipo !== tipoFiltro) {
          return false;
        }

        if (statusFiltro !== "TODOS" && feedback.status !== statusFiltro) {
          return false;
        }

        if (autorFiltro !== "TODOS" && feedback.autor.id !== autorFiltro) {
          return false;
        }

        return true;
      }),
    [autorFiltro, feedbacks, statusFiltro, tipoFiltro],
  );

  function openDetalhe(feedback: FeedbackDetalhe) {
    if (!canManage) {
      return;
    }

    setFeedbackSelecionado(feedback);
    setDetalheAberto(true);
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Feedback" currentHref="/feedback" />

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Canal interno
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Feedback da equipe
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#667085]">
              Registre bugs, melhorias e sugestoes sem depender de WhatsApp ou
              e-mail.
            </p>
          </div>

          <Button
            onClick={() => setModalAberto(true)}
            className="h-11 rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
          >
            <Plus className="size-4" />
            Novo Feedback
          </Button>
        </div>

        {canManage ? (
          <div className="grid gap-4 md:grid-cols-4">
            {resumo.map((item) => {
              const config = statusFeedbackConfig[item.status];

              return (
                <Card
                  key={item.status}
                  className="rounded-3xl border-[#D7DEEA] bg-white"
                >
                  <CardHeader className="pb-2">
                    <CardDescription>{config.label}</CardDescription>
                    <CardTitle className="flex items-center gap-3 text-3xl text-[#1A2E5A]">
                      <MessageSquarePlus className="size-6 text-[#1E4FAB]" />
                      {item.total}
                    </CardTitle>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        ) : null}

        <Card className="mt-6 rounded-3xl border-[#D7DEEA]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-[#1A2E5A]">
                  <MessageSquarePlus className="size-5 text-[#1E4FAB]" />
                  Feedbacks
                </CardTitle>
                <CardDescription>
                  {canManage
                    ? "Acompanhe todos os retornos enviados pela equipe."
                    : "Acompanhe os feedbacks que voce enviou."}
                </CardDescription>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#667085]">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManage ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  value={tipoFiltro}
                  onValueChange={(value) => setTipoFiltro(value as TipoFiltro)}
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os tipos</SelectItem>
                    {Object.entries(tipoFeedbackConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.emoji} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={statusFiltro}
                  onValueChange={(value) =>
                    setStatusFiltro(value as StatusFiltro)
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os status</SelectItem>
                    {Object.entries(statusFeedbackConfig).map(
                      ([value, config]) => (
                        <SelectItem key={value} value={value}>
                          {config.label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>

                <Select
                  value={autorFiltro}
                  onValueChange={(value) => setAutorFiltro(value ?? "TODOS")}
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os usuarios</SelectItem>
                    {autores.map((autor) => (
                      <SelectItem key={autor.id} value={autor.id}>
                        {autor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-3">
              {feedbacksFiltrados.length === 0 && !isLoading ? (
                <div className="rounded-3xl border border-dashed border-[#D7DEEA] bg-white p-8 text-center text-sm text-[#667085]">
                  Nenhum feedback encontrado.
                </div>
              ) : (
                feedbacksFiltrados.map((feedback) => {
                  const tipoConfig = tipoFeedbackConfig[feedback.tipo];
                  const statusConfig = statusFeedbackConfig[feedback.status];
                  const Icon = feedback.tipo === "BUG" ? Bug : Lightbulb;

                  return (
                    <article
                      key={feedback.id}
                      className={cn(
                        "rounded-3xl border border-[#D7DEEA] bg-white p-5 shadow-sm transition",
                        canManage && "cursor-pointer hover:border-[#1E4FAB]",
                      )}
                      onClick={() => openDetalhe(feedback)}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-2xl bg-[#1A2E5A] px-3 py-1 text-sm font-bold text-white">
                              #{feedback.numero}
                            </span>
                            <Badge className={tipoConfig.className}>
                              {tipoConfig.emoji} {tipoConfig.label}
                            </Badge>
                            <Badge className={statusConfig.className}>
                              {statusConfig.label}
                            </Badge>
                            {feedback.area ? (
                              <Badge variant="outline">{feedback.area}</Badge>
                            ) : null}
                          </div>
                          <h2 className="mt-3 flex items-center gap-2 text-lg font-bold text-[#1A2E5A]">
                            <Icon className="size-5 text-[#1E4FAB]" />
                            {feedback.titulo}
                          </h2>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#667085]">
                            {feedback.descricao}
                          </p>
                          {feedback.respostaAdmin ? (
                            <div className="mt-3 rounded-2xl bg-[#E8EEFB] p-3 text-sm text-[#1A2E5A]">
                              <b>Resposta:</b> {feedback.respostaAdmin}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-left text-xs font-semibold text-[#667085] lg:text-right">
                          <p>{formatDate(feedback.criadoEm)}</p>
                          {canManage ? <p>{feedback.autor.nome}</p> : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <FeedbackModal
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onSalvar={loadFeedbacks}
      />
      <FeedbackDetalheModal
        aberto={detalheAberto}
        feedback={feedbackSelecionado}
        onFechar={() => setDetalheAberto(false)}
        onSalvar={loadFeedbacks}
      />
    </main>
  );
}
