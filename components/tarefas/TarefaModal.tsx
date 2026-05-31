"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type {
  PrioridadeTarefa,
  TipoAtividade,
} from "@/app/generated/prisma/client";
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
import { PRIORIDADE_CONFIG, TIPO_CONFIG } from "@/components/tarefas/tarefa-config";

const NONE_VALUE = "__none__";

type Option = {
  id: string;
  label: string;
  empresaId?: string | null;
  oportunidadeId?: string | null;
};

export type TarefaModalData = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: TipoAtividade;
  prioridade: PrioridadeTarefa;
  dataVencimento: string | Date;
  horaVencimento: string | null;
  observacoes: string | null;
  oportunidadeId: string | null;
  empresaId: string | null;
  pessoaId: string | null;
  obraId: string | null;
  propostaId: string | null;
  responsavelId: string | null;
};

type TarefaModalProps = {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: () => void;
  tarefa?: TarefaModalData | null;
  oportunidadeId?: string | null;
};

type FormState = {
  titulo: string;
  tipo: TipoAtividade;
  prioridade: PrioridadeTarefa;
  dataVencimento: string;
  horaVencimento: string;
  responsavelId: string;
  oportunidadeId: string;
  empresaId: string;
  pessoaId: string;
  obraId: string;
  propostaId: string;
  descricao: string;
  observacoes: string;
};

const hoje = new Date().toISOString().slice(0, 10);

function toDateInput(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function getDefaultState(oportunidadeId?: string | null): FormState {
  return {
    titulo: "",
    tipo: "LIGACAO",
    prioridade: "MEDIA",
    dataVencimento: hoje,
    horaVencimento: "",
    responsavelId: NONE_VALUE,
    oportunidadeId: oportunidadeId ?? NONE_VALUE,
    empresaId: NONE_VALUE,
    pessoaId: NONE_VALUE,
    obraId: NONE_VALUE,
    propostaId: NONE_VALUE,
    descricao: "",
    observacoes: "",
  };
}

function normalizeRelation(value: string) {
  return value === NONE_VALUE ? null : value;
}

export function TarefaModal({
  aberto,
  onFechar,
  onSalvar,
  tarefa,
  oportunidadeId,
}: TarefaModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    getDefaultState(oportunidadeId),
  );
  const [usuarios, setUsuarios] = useState<Option[]>([]);
  const [empresas, setEmpresas] = useState<Option[]>([]);
  const [oportunidades, setOportunidades] = useState<Option[]>([]);
  const [obras, setObras] = useState<Option[]>([]);
  const [pessoas, setPessoas] = useState<Option[]>([]);
  const [propostas, setPropostas] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(tarefa?.id);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    const nextForm = tarefa
      ? {
          titulo: tarefa.titulo,
          tipo: tarefa.tipo,
          prioridade: tarefa.prioridade,
          dataVencimento: toDateInput(tarefa.dataVencimento),
          horaVencimento: tarefa.horaVencimento ?? "",
          responsavelId: tarefa.responsavelId ?? NONE_VALUE,
          oportunidadeId: tarefa.oportunidadeId ?? oportunidadeId ?? NONE_VALUE,
          empresaId: tarefa.empresaId ?? NONE_VALUE,
          pessoaId: tarefa.pessoaId ?? NONE_VALUE,
          obraId: tarefa.obraId ?? NONE_VALUE,
          propostaId: tarefa.propostaId ?? NONE_VALUE,
          descricao: tarefa.descricao ?? "",
          observacoes: tarefa.observacoes ?? "",
        }
      : getDefaultState(oportunidadeId);

    queueMicrotask(() => setForm(nextForm));
  }, [aberto, oportunidadeId, tarefa]);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    async function loadOptions() {
      setIsLoading(true);

      try {
        const [usuariosRes, empresasRes, oportunidadesRes, obrasRes] =
          await Promise.all([
            fetch("/api/usuarios"),
            fetch("/api/empresas"),
            fetch("/api/oportunidades"),
            fetch("/api/obras"),
          ]);

        if (
          !usuariosRes.ok ||
          !empresasRes.ok ||
          !oportunidadesRes.ok ||
          !obrasRes.ok
        ) {
          throw new Error("Falha ao carregar dados do formulario.");
        }

        const [usuariosData, empresasData, oportunidadesData, obrasData] =
          await Promise.all([
            usuariosRes.json(),
            empresasRes.json(),
            oportunidadesRes.json(),
            obrasRes.json(),
          ]);

        setUsuarios(
          usuariosData.map((usuario: { id: string; nome: string }) => ({
            id: usuario.id,
            label: usuario.nome,
          })),
        );
        setEmpresas(
          empresasData.map(
            (empresa: {
              id: string;
              razaoSocial: string;
              nomeFantasia: string | null;
            }) => ({
              id: empresa.id,
              label: empresa.nomeFantasia ?? empresa.razaoSocial,
            }),
          ),
        );
        setOportunidades(
          oportunidadesData.map(
            (oportunidade: {
              id: string;
              titulo: string;
              empresa?: { id: string } | null;
            }) => ({
              id: oportunidade.id,
              label: oportunidade.titulo,
              empresaId: oportunidade.empresa?.id,
            }),
          ),
        );
        setObras(
          obrasData.map(
            (obra: { id: string; nome: string; empresaId?: string | null }) => ({
              id: obra.id,
              label: obra.nome,
              empresaId: obra.empresaId,
            }),
          ),
        );
      } catch {
        toast.error("Nao foi possivel carregar as opcoes da tarefa.");
      } finally {
        setIsLoading(false);
      }
    }

    loadOptions();
  }, [aberto]);

  useEffect(() => {
    async function loadRelatedOptions() {
      if (form.empresaId === NONE_VALUE) {
        setPessoas([]);
      } else {
        const response = await fetch(`/api/contatos?empresaId=${form.empresaId}`);

        if (response.ok) {
          const data = await response.json();
          setPessoas(
            data.map((pessoa: { id: string; nome: string }) => ({
              id: pessoa.id,
              label: pessoa.nome,
            })),
          );
        }
      }

      if (form.oportunidadeId === NONE_VALUE) {
        setPropostas([]);
        return;
      }

      const response = await fetch(
        `/api/oportunidades/${form.oportunidadeId}/propostas`,
      );

      if (response.ok) {
        const data = await response.json();
        setPropostas(
          data.map(
            (proposta: {
              id: string;
              numeroProposta: string;
              versao: number;
            }) => ({
              id: proposta.id,
              label: `${proposta.numeroProposta} v${proposta.versao}`,
            }),
          ),
        );
      }
    }

    if (aberto) {
      loadRelatedOptions();
    }
  }, [aberto, form.empresaId, form.oportunidadeId]);

  const obraOptions = useMemo(() => {
    if (form.empresaId === NONE_VALUE) {
      return obras;
    }

    return obras.filter((obra) => !obra.empresaId || obra.empresaId === form.empresaId);
  }, [form.empresaId, obras]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleOportunidadeChange(value: string) {
    const oportunidade = oportunidades.find((item) => item.id === value);

    setForm((current) => ({
      ...current,
      oportunidadeId: value,
      empresaId: oportunidade?.empresaId ?? current.empresaId,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        titulo: form.titulo,
        tipo: form.tipo,
        prioridade: form.prioridade,
        dataVencimento: form.dataVencimento,
        horaVencimento: form.horaVencimento,
        responsavelId: normalizeRelation(form.responsavelId),
        oportunidadeId: normalizeRelation(form.oportunidadeId),
        empresaId: normalizeRelation(form.empresaId),
        pessoaId: normalizeRelation(form.pessoaId),
        obraId: normalizeRelation(form.obraId),
        propostaId: normalizeRelation(form.propostaId),
        descricao: form.descricao,
        observacoes: form.observacoes,
      };

      const url = isEditing ? `/api/tarefas/${tarefa?.id}` : "/api/tarefas";
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Falha ao salvar tarefa.");
      }

      toast.success(isEditing ? "Tarefa atualizada." : "Tarefa criada.");
      onSalvar();
      onFechar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar a tarefa.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-[#1A2E5A]">
            {isEditing ? "Editar tarefa" : "Nova tarefa"}
          </DialogTitle>
          <DialogDescription>
            Defina a proxima acao comercial com responsavel, prazo e contexto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="titulo">Titulo*</Label>
              <Input
                id="titulo"
                value={form.titulo}
                onChange={(event) => update("titulo", event.target.value)}
                placeholder="Ligar para cliente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo*</Label>
              <Select
                value={form.tipo}
                onValueChange={(value) =>
                  update("tipo", (value ?? "LIGACAO") as TipoAtividade)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.emoji} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade*</Label>
              <Select
                value={form.prioridade}
                onValueChange={(value) =>
                  update("prioridade", (value ?? "MEDIA") as PrioridadeTarefa)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDADE_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataVencimento">Data de vencimento*</Label>
              <Input
                id="dataVencimento"
                type="date"
                value={form.dataVencimento}
                onChange={(event) =>
                  update("dataVencimento", event.target.value)
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="horaVencimento">Hora</Label>
              <Input
                id="horaVencimento"
                type="time"
                value={form.horaVencimento}
                onChange={(event) =>
                  update("horaVencimento", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Responsavel</Label>
              <Select
                value={form.responsavelId}
                onValueChange={(value) =>
                  update("responsavelId", value ?? NONE_VALUE)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Usuario logado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Usuario logado</SelectItem>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      {usuario.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Oportunidade</Label>
              <Select
                value={form.oportunidadeId}
                onValueChange={(value) =>
                  handleOportunidadeChange(value ?? NONE_VALUE)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem oportunidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem oportunidade</SelectItem>
                  {oportunidades.map((oportunidade) => (
                    <SelectItem key={oportunidade.id} value={oportunidade.id}>
                      {oportunidade.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select
                value={form.empresaId}
                onValueChange={(value) => update("empresaId", value ?? NONE_VALUE)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem empresa</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Obra</Label>
              <Select
                value={form.obraId}
                onValueChange={(value) => update("obraId", value ?? NONE_VALUE)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem obra</SelectItem>
                  {obraOptions.map((obra) => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Contato</Label>
              <Select
                value={form.pessoaId}
                onValueChange={(value) => update("pessoaId", value ?? NONE_VALUE)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem contato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem contato</SelectItem>
                  {pessoas.map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Proposta</Label>
              <Select
                value={form.propostaId}
                onValueChange={(value) =>
                  update("propostaId", value ?? NONE_VALUE)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem proposta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sem proposta</SelectItem>
                  {propostas.map((proposta) => (
                    <SelectItem key={proposta.id} value={proposta.id}>
                      {proposta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descricao">Descricao</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(event) => update("descricao", event.target.value)}
                placeholder="Contexto da acao"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea
                id="observacoes"
                value={form.observacoes}
                onChange={(event) => update("observacoes", event.target.value)}
                placeholder="Notas internas"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar tarefa"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
