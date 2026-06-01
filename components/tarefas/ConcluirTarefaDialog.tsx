"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { TipoAtividade } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TIPO_CONFIG, TIPOS_RAPIDOS } from "@/components/tarefas/tarefa-config";
import {
  getProximaAcao,
  getResultadoLabel,
  getResultados,
  temCadencia,
} from "@/lib/tarefas/cadencia";
import { cn } from "@/lib/utils";

type TarefaConcluir = {
  id: string;
  titulo: string;
  tipo: TipoAtividade;
  oportunidadeId: string | null;
  empresaId: string | null;
  pessoaId: string | null;
  obraId: string | null;
  responsavelId: string | null;
};

type Props = {
  aberto: boolean;
  tarefa: TarefaConcluir | null;
  onFechar: () => void;
  onConcluido: () => void;
};

type Passo = "RESULTADO" | "PROXIMA_ACAO" | "ENCERRAR_OPORTUNIDADE" | "PEDIR_DATA";

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function ConcluirTarefaDialog({
  aberto,
  tarefa,
  onFechar,
  onConcluido,
}: Props) {
  const [passo, setPasso] = useState<Passo>("RESULTADO");
  const [resultadoCodigo, setResultadoCodigo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dataProxima, setDataProxima] = useState("");
  const [tipoProxima, setTipoProxima] = useState<TipoAtividade>("LIGACAO");
  const [tituloProxima, setTituloProxima] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resultados = tarefa ? getResultados(tarefa.tipo) : [];
  const semCadencia = tarefa ? !temCadencia(tarefa.tipo) : true;
  const proxima = tarefa
    ? getProximaAcao(tarefa.tipo, resultadoCodigo)
    : undefined;
  const resultadoLabel = tarefa
    ? getResultadoLabel(tarefa.tipo, resultadoCodigo)
    : null;

  const tipoConfig = tarefa
    ? (TIPO_CONFIG[tarefa.tipo] ?? { emoji: "•", label: "Tarefa" })
    : { emoji: "•", label: "Tarefa" };
  const tipoProximaConfig = TIPO_CONFIG[tipoProxima] ?? {
    emoji: "•",
    label: "Tarefa",
  };

  const podeAvancar = semCadencia || Boolean(resultadoCodigo);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    queueMicrotask(() => {
      setPasso("RESULTADO");
      setResultadoCodigo("");
      setObservacao("");
      setDataProxima("");
      setTipoProxima("LIGACAO");
      setTituloProxima("");
    });
  }, [aberto, tarefa?.id]);

  const proximaPayload = useMemo(() => {
    if (!tarefa || !tituloProxima || !dataProxima) {
      return null;
    }

    return {
      titulo: tituloProxima,
      descricao: tituloProxima,
      tipo: tipoProxima,
      prioridade: "MEDIA",
      dataVencimento: dataProxima,
      oportunidadeId: tarefa.oportunidadeId,
      empresaId: tarefa.empresaId,
      pessoaId: tarefa.pessoaId,
      obraId: tarefa.obraId,
      responsavelId: tarefa.responsavelId,
    };
  }, [dataProxima, tarefa, tipoProxima, tituloProxima]);

  async function handleConfirmarResultado() {
    if (!tarefa) {
      return;
    }

    if (semCadencia) {
      await salvarConclusao(null);
      return;
    }

    if (!resultadoCodigo) {
      toast.error("Selecione o resultado da tarefa.");
      return;
    }

    if (proxima === null) {
      if (["SEM_INTERESSE", "REJEITADA"].includes(resultadoCodigo)) {
        setPasso("ENCERRAR_OPORTUNIDADE");
        return;
      }

      await salvarConclusao(null);
      return;
    }

    if (proxima?.acao === "PEDIR_DATA_RETORNO") {
      setDataProxima(toDateInput(proxima.prazo(new Date())));
      setTipoProxima(proxima.tipo);
      setTituloProxima(proxima.titulo);
      setPasso("PEDIR_DATA");
      return;
    }

    if (proxima) {
      setDataProxima(toDateInput(proxima.prazo(new Date())));
      setTipoProxima(proxima.tipo);
      setTituloProxima(proxima.titulo);
      setPasso("PROXIMA_ACAO");
      return;
    }

    await salvarConclusao(null);
  }

  async function salvarConclusao(
    proximaTarefa: typeof proximaPayload,
    encerrarOportunidade = false,
  ) {
    if (!tarefa) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/tarefas/${tarefa.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CONCLUIDA",
          resultado: observacao || resultadoLabel || resultadoCodigo || null,
          resultadoCodigo: resultadoCodigo || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Falha ao concluir tarefa.");
      }

      if (proximaTarefa) {
        const criarResponse = await fetch("/api/tarefas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proximaTarefa),
        });

        if (!criarResponse.ok) {
          const data = await criarResponse.json().catch(() => null);
          throw new Error(data?.message ?? "Falha ao criar proxima tarefa.");
        }
      }

      if (encerrarOportunidade && tarefa.oportunidadeId) {
        const oportunidadeResponse = await fetch(
          `/api/oportunidades/${tarefa.oportunidadeId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "PERDIDA",
              motivoPerda: observacao || resultadoLabel || "Sem interesse",
            }),
          },
        );

        if (!oportunidadeResponse.ok) {
          const data = await oportunidadeResponse.json().catch(() => null);
          throw new Error(data?.message ?? "Falha ao encerrar oportunidade.");
        }
      }

      toast.success(proximaTarefa ? "Tarefa concluida e proxima acao criada." : "Tarefa concluida.");
      onConcluido();
      onFechar();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel concluir a tarefa.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!tarefa) {
    return null;
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-[#1A2E5A]">
            Concluir: {tipoConfig.emoji} {tarefa.titulo}
          </DialogTitle>
          <DialogDescription>
            Registre o resultado e deixe a proxima acao pronta.
          </DialogDescription>
        </DialogHeader>

        {passo === "RESULTADO" ? (
          <div className="space-y-4">
            {semCadencia ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Este tipo ainda nao tem cadencia automatica. A tarefa sera apenas concluida.
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Qual foi o resultado?</Label>
                <div className="flex flex-wrap gap-2">
                  {resultados.map((resultado) => {
                    const ativo = resultadoCodigo === resultado.codigo;

                    return (
                      <button
                        key={resultado.codigo}
                        type="button"
                        onClick={() => setResultadoCodigo(resultado.codigo)}
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors",
                          ativo
                            ? "border-[#1E4FAB] bg-[#1E4FAB] text-white"
                            : "border-[#D7DEEA] bg-white text-[#1A2E5A] hover:border-[#1E4FAB]",
                        )}
                      >
                        {resultado.icone} {resultado.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="resultadoObservacao">Observacao opcional</Label>
              <Textarea
                id="resultadoObservacao"
                value={observacao}
                onChange={(event) => setObservacao(event.target.value)}
                className="resize-none rounded-2xl bg-[#F4F6FA]"
                rows={3}
                placeholder="Ex: cliente pediu retorno na quinta-feira"
              />
            </div>
          </div>
        ) : null}

        {passo === "PROXIMA_ACAO" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Resultado registrado: <b>{resultadoLabel}</b>
            </div>
            {proxima?.acao === "CRIAR_PROPOSTA" ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                O cliente pediu proposta. A proxima tarefa vai lembrar o vendedor de elaborar e enviar a proposta.
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={tipoProxima}
                  onValueChange={(value) => setTipoProxima(value as TipoAtividade)}
                >
                  <SelectTrigger className="h-11 rounded-2xl bg-[#F4F6FA]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_RAPIDOS.map((tipo) => {
                      const config = TIPO_CONFIG[tipo];

                      return config ? (
                        <SelectItem key={tipo} value={tipo}>
                          {config.emoji} {config.label}
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataProxima">Prazo</Label>
                <Input
                  id="dataProxima"
                  type="date"
                  value={dataProxima}
                  onChange={(event) => setDataProxima(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tituloProxima">Proxima acao</Label>
              <Input
                id="tituloProxima"
                value={tituloProxima}
                onChange={(event) => setTituloProxima(event.target.value)}
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
              <p className="text-xs text-[#667085]">
                Sugestao: {tipoProximaConfig.emoji} {tipoProximaConfig.label} em{" "}
                {dataProxima
                  ? format(new Date(`${dataProxima}T00:00:00`), "dd/MM/yyyy", {
                      locale: ptBR,
                    })
                  : "data indefinida"}
              </p>
            </div>
          </div>
        ) : null}

        {passo === "PEDIR_DATA" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              Cliente pediu retorno. Informe a data combinada.
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataRetorno">Data de retorno</Label>
              <Input
                id="dataRetorno"
                type="date"
                value={dataProxima}
                onChange={(event) => setDataProxima(event.target.value)}
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </div>
          </div>
        ) : null}

        {passo === "ENCERRAR_OPORTUNIDADE" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              O resultado indica perda ou falta de interesse. Deseja encerrar esta oportunidade como perdida?
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {passo === "RESULTADO" ? (
            <>
              <Button type="button" variant="outline" onClick={onFechar} className="rounded-2xl">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmarResultado}
                disabled={!podeAvancar || isSaving}
                className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Proximo
              </Button>
            </>
          ) : null}

          {passo === "PROXIMA_ACAO" ? (
            <>
              <Button type="button" variant="outline" onClick={() => salvarConclusao(null)} className="rounded-2xl">
                Cancelar proxima acao
              </Button>
              <Button
                type="button"
                onClick={() => salvarConclusao(proximaPayload)}
                disabled={isSaving || !proximaPayload}
                className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirmar
              </Button>
            </>
          ) : null}

          {passo === "PEDIR_DATA" ? (
            <>
              <Button type="button" variant="outline" onClick={() => salvarConclusao(null)} className="rounded-2xl">
                Sem proxima acao
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (proximaPayload) {
                    salvarConclusao({
                      ...proximaPayload,
                      dataVencimento: dataProxima,
                    });
                  }
                }}
                disabled={isSaving || !dataProxima || !proximaPayload}
                className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Criar tarefa
              </Button>
            </>
          ) : null}

          {passo === "ENCERRAR_OPORTUNIDADE" ? (
            <>
              <Button type="button" variant="outline" onClick={() => salvarConclusao(null)} className="rounded-2xl">
                Nao, manter aberta
              </Button>
              <Button
                type="button"
                onClick={() => salvarConclusao(null, true)}
                disabled={isSaving}
                className="rounded-2xl bg-red-600 text-white hover:bg-red-700"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Sim, encerrar
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
