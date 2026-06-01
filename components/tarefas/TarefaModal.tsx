"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type {
  PrioridadeTarefa,
  TipoAtividade,
} from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
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
import {
  PRIORIDADE_CONFIG,
  TIPO_CONFIG,
  TIPOS_RAPIDOS,
} from "@/components/tarefas/tarefa-config";
import { cn } from "@/lib/utils";

const NONE_VALUE = "__none__";

type Option = {
  id: string;
  label: string;
  empresaId?: string | null;
  oportunidadeId?: string | null;
};

type TarefaContexto = {
  oportunidadeId?: string | null;
  oportunidadeNome?: string | null;
  empresaId?: string | null;
  empresaNome?: string | null;
  pessoaId?: string | null;
  pessoaNome?: string | null;
  obraId?: string | null;
  obraNome?: string | null;
  propostaId?: string | null;
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
  resultado: string | null;
  resultadoCodigo: string | null;
  oportunidadeId: string | null;
  empresaId: string | null;
  pessoaId: string | null;
  obraId: string | null;
  propostaId: string | null;
  responsavelId: string | null;
  empresa?: { razaoSocial: string; nomeFantasia: string | null } | null;
  obra?: { nome: string } | null;
  oportunidade?: { titulo: string } | null;
  pessoa?: { nome: string } | null;
};

type TarefaModalProps = {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: () => void;
  tarefa?: TarefaModalData | null;
  contexto?: TarefaContexto;
  oportunidadeId?: string | null;
};

type FormState = {
  tipo: TipoAtividade;
  prioridade: PrioridadeTarefa;
  dataVencimento: string;
  horaVencimento: string;
  proximaAcao: string;
  responsavelId: string;
  oportunidadeId: string;
  empresaId: string;
  pessoaId: string;
  obraId: string;
  propostaId: string;
  observacoes: string;
};

function todayInput() {
  return toLocalDateInput(new Date());
}

function toDateInput(value: string | Date) {
  return toLocalDateInput(new Date(value));
}

function toLocalDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toSelectValue(value?: string | null) {
  return value ?? NONE_VALUE;
}

function normalizeRelation(value: string) {
  return value === NONE_VALUE ? null : value;
}

function proximaAcaoPlaceholder(tipo: TipoAtividade): string {
  const map: Partial<Record<TipoAtividade, string>> = {
    LIGACAO: "Ex: Ligar para Joao e confirmar necessidade de bomba",
    WHATSAPP: "Ex: Enviar catalogo de betoneiras por WhatsApp",
    REUNIAO: "Ex: Reuniao para apresentar condicoes de locacao",
    VISITA: "Ex: Visitar obra da Construtora Almeida",
    VISTORIA: "Ex: Vistoria de entrega na obra Maraba",
    RETORNO_CLIENTE: "Ex: Cobrar retorno da proposta enviada",
    COBRANCA: "Ex: Cobrar pagamento em aberto",
    PROPOSTA: "Ex: Enviar proposta de locacao de bomba lanca",
    CONTRATO: "Ex: Enviar contrato para assinatura",
    OUTRO: "Descreva a proxima acao...",
  };

  return map[tipo] ?? "Descreva a proxima acao...";
}

function getDefaultState(contexto?: TarefaContexto): FormState {
  return {
    tipo: "LIGACAO",
    prioridade: "MEDIA",
    dataVencimento: todayInput(),
    horaVencimento: "",
    proximaAcao: "",
    responsavelId: NONE_VALUE,
    oportunidadeId: toSelectValue(contexto?.oportunidadeId),
    empresaId: toSelectValue(contexto?.empresaId),
    pessoaId: toSelectValue(contexto?.pessoaId),
    obraId: toSelectValue(contexto?.obraId),
    propostaId: toSelectValue(contexto?.propostaId),
    observacoes: "",
  };
}

export function TarefaModal({
  aberto,
  onFechar,
  onSalvar,
  tarefa,
  contexto,
  oportunidadeId,
}: TarefaModalProps) {
  const contextoEfetivo = useMemo<TarefaContexto>(
    () => ({
      ...contexto,
      oportunidadeId: contexto?.oportunidadeId ?? oportunidadeId ?? null,
    }),
    [contexto, oportunidadeId],
  );
  const [form, setForm] = useState<FormState>(() =>
    getDefaultState(contextoEfetivo),
  );
  const [usuarios, setUsuarios] = useState<Option[]>([]);
  const [empresas, setEmpresas] = useState<Option[]>([]);
  const [oportunidades, setOportunidades] = useState<Option[]>([]);
  const [obras, setObras] = useState<Option[]>([]);
  const [pessoas, setPessoas] = useState<Option[]>([]);
  const [propostas, setPropostas] = useState<Option[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modoAvancado, setModoAvancado] = useState(false);
  const [delegando, setDelegando] = useState(false);

  const isEditing = Boolean(tarefa?.id);
  const hasContextoOportunidade = Boolean(contextoEfetivo.oportunidadeId);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    const nextForm = tarefa
      ? {
          tipo: tarefa.tipo,
          prioridade: tarefa.prioridade,
          dataVencimento: toDateInput(tarefa.dataVencimento),
          horaVencimento: tarefa.horaVencimento ?? "",
          proximaAcao: tarefa.titulo,
          responsavelId: tarefa.responsavelId ?? NONE_VALUE,
          oportunidadeId: toSelectValue(
            tarefa.oportunidadeId ?? contextoEfetivo.oportunidadeId,
          ),
          empresaId: toSelectValue(tarefa.empresaId ?? contextoEfetivo.empresaId),
          pessoaId: toSelectValue(tarefa.pessoaId ?? contextoEfetivo.pessoaId),
          obraId: toSelectValue(tarefa.obraId ?? contextoEfetivo.obraId),
          propostaId: toSelectValue(tarefa.propostaId ?? contextoEfetivo.propostaId),
          observacoes: tarefa.observacoes ?? tarefa.descricao ?? "",
        }
      : getDefaultState(contextoEfetivo);

    queueMicrotask(() => {
      setForm(nextForm);
      setModoAvancado(Boolean(tarefa));
      setDelegando(Boolean(tarefa?.responsavelId));
    });
  }, [aberto, contextoEfetivo, tarefa]);

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

  const responsavelSelecionado = usuarios.find(
    (usuario) => usuario.id === form.responsavelId,
  );
  const empresaSelecionada = empresas.find((empresa) => empresa.id === form.empresaId);
  const obraSelecionada = obras.find((obra) => obra.id === form.obraId);
  const oportunidadeSelecionada = oportunidades.find(
    (oportunidade) => oportunidade.id === form.oportunidadeId,
  );
  const pessoaSelecionada = pessoas.find((pessoa) => pessoa.id === form.pessoaId);
  const contextoResumo = [
    {
      icon: "🏢",
      label:
        contextoEfetivo.empresaNome ??
        tarefa?.empresa?.nomeFantasia ??
        tarefa?.empresa?.razaoSocial ??
        empresaSelecionada?.label,
    },
    {
      icon: "🏗️",
      label: contextoEfetivo.obraNome ?? tarefa?.obra?.nome ?? obraSelecionada?.label,
    },
    {
      icon: "💼",
      label:
        contextoEfetivo.oportunidadeNome ??
        tarefa?.oportunidade?.titulo ??
        oportunidadeSelecionada?.label,
    },
    {
      icon: "👤",
      label: contextoEfetivo.pessoaNome ?? tarefa?.pessoa?.nome ?? pessoaSelecionada?.label,
    },
  ].filter((item) => item.label);

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

    if (!form.proximaAcao.trim()) {
      toast.error("Informe a proxima acao.");
      return;
    }

    if (!hasContextoOportunidade && form.empresaId === NONE_VALUE) {
      toast.error("Selecione a empresa da tarefa.");
      return;
    }

    setIsSubmitting(true);

    try {
      const proximaAcao = form.proximaAcao.trim();
      const payload = {
        titulo: proximaAcao,
        descricao: proximaAcao,
        tipo: form.tipo,
        prioridade: form.prioridade,
        dataVencimento: form.dataVencimento,
        horaVencimento: form.horaVencimento || null,
        responsavelId: normalizeRelation(form.responsavelId),
        oportunidadeId: normalizeRelation(form.oportunidadeId),
        empresaId: normalizeRelation(form.empresaId),
        pessoaId: normalizeRelation(form.pessoaId),
        obraId: normalizeRelation(form.obraId),
        propostaId: normalizeRelation(form.propostaId),
        observacoes: form.observacoes || null,
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
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl text-[#1A2E5A]">
            {isEditing ? "Editar tarefa" : "Nova tarefa"}
          </DialogTitle>
          <DialogDescription>
            Crie a proxima acao comercial em poucos segundos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {hasContextoOportunidade && contextoResumo.length > 0 ? (
            <section className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                Contexto comercial
              </p>
              <div className="flex flex-wrap gap-2">
                {contextoResumo.map((item) => (
                  <span
                    key={`${item.icon}-${item.label}`}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1A2E5A]"
                  >
                    {item.icon} {item.label}
                  </span>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
                Contexto comercial
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <AdvancedSelect
                  label="Empresa*"
                  value={form.empresaId}
                  placeholder="Selecione a empresa"
                  options={empresas}
                  onChange={(value) => update("empresaId", value)}
                />
                <AdvancedSelect
                  label="Obra"
                  value={form.obraId}
                  placeholder="Sem obra"
                  options={obraOptions}
                  onChange={(value) => update("obraId", value)}
                />
                <AdvancedSelect
                  label="Oportunidade"
                  value={form.oportunidadeId}
                  placeholder="Sem oportunidade"
                  options={oportunidades}
                  onChange={handleOportunidadeChange}
                />
              </div>
            </section>
          )}

          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_RAPIDOS.map((tipo) => {
                const config = TIPO_CONFIG[tipo];
                const ativo = form.tipo === tipo;

                if (!config) {
                  return null;
                }

                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => update("tipo", tipo)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-sm transition-colors",
                      ativo
                        ? "border-[#1E4FAB] bg-[#1E4FAB] text-white"
                        : "border-[#D7DEEA] bg-white text-[#667085] hover:border-[#1E4FAB] hover:text-[#1E4FAB]",
                    )}
                  >
                    <span>{config.emoji}</span>
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proximaAcao">Proxima acao*</Label>
            <Textarea
              id="proximaAcao"
              value={form.proximaAcao}
              onChange={(event) => update("proximaAcao", event.target.value)}
              placeholder={proximaAcaoPlaceholder(form.tipo)}
              rows={2}
              className="resize-none rounded-2xl bg-[#F4F6FA]"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dataVencimento">Data*</Label>
              <Input
                id="dataVencimento"
                type="date"
                value={form.dataVencimento}
                onChange={(event) => update("dataVencimento", event.target.value)}
                className="h-11 rounded-2xl bg-[#F4F6FA]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horaVencimento">Hora opcional</Label>
              <Input
                id="horaVencimento"
                type="time"
                value={form.horaVencimento}
                onChange={(event) => update("horaVencimento", event.target.value)}
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-3">
            {!delegando ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-[#667085]">
                  Responsavel: <b>voce mesmo</b>
                </span>
                <button
                  type="button"
                  onClick={() => setDelegando(true)}
                  className="text-left text-xs font-semibold text-[#1E4FAB] hover:underline sm:text-right"
                >
                  Delegar para outra pessoa
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Responsavel</Label>
                <Select
                  value={form.responsavelId}
                  onValueChange={(value) =>
                    update("responsavelId", value ?? NONE_VALUE)
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-white">
                    <SelectValue placeholder="Usuario logado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Eu mesmo</SelectItem>
                    {usuarios.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        {usuario.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {responsavelSelecionado ? (
                  <p className="text-xs text-[#667085]">
                    Delegada para {responsavelSelecionado.label}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {modoAvancado ? (
            <div className="space-y-3 border-t border-[#D7DEEA] pt-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(value) =>
                    update("prioridade", (value ?? "MEDIA") as PrioridadeTarefa)
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
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

              <div className="grid gap-3 sm:grid-cols-2">
                {!contextoEfetivo.oportunidadeId ? (
                  <AdvancedSelect
                    label="Oportunidade"
                    value={form.oportunidadeId}
                    placeholder="Sem oportunidade"
                    options={oportunidades}
                    onChange={handleOportunidadeChange}
                  />
                ) : null}
                {!contextoEfetivo.empresaId ? (
                  !hasContextoOportunidade ? null : (
                    <AdvancedSelect
                      label="Empresa"
                      value={form.empresaId}
                      placeholder="Sem empresa"
                      options={empresas}
                      onChange={(value) => update("empresaId", value)}
                    />
                  )
                ) : null}
                {!contextoEfetivo.obraId ? (
                  !hasContextoOportunidade ? null : (
                    <AdvancedSelect
                      label="Obra"
                      value={form.obraId}
                      placeholder="Sem obra"
                      options={obraOptions}
                      onChange={(value) => update("obraId", value)}
                    />
                  )
                ) : null}
                {!contextoEfetivo.pessoaId ? (
                  <AdvancedSelect
                    label="Contato"
                    value={form.pessoaId}
                    placeholder="Sem contato"
                    options={pessoas}
                    onChange={(value) => update("pessoaId", value)}
                  />
                ) : null}
                {!contextoEfetivo.propostaId ? (
                  <AdvancedSelect
                    label="Proposta"
                    value={form.propostaId}
                    placeholder="Sem proposta"
                    options={propostas}
                    onChange={(value) => update("propostaId", value)}
                  />
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observacoes internas</Label>
                <Textarea
                  id="observacoes"
                  value={form.observacoes}
                  onChange={(event) => update("observacoes", event.target.value)}
                  rows={2}
                  className="resize-none rounded-2xl bg-[#F4F6FA]"
                  placeholder="Notas internas opcionais"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <button
              type="button"
              onClick={() => setModoAvancado((current) => !current)}
              className="text-sm font-semibold text-[#667085] underline-offset-2 hover:text-[#1E4FAB] hover:underline"
            >
              {modoAvancado ? "Menos opcoes" : "+ Mais opcoes"}
            </button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onFechar}
                className="rounded-2xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
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
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdvancedSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const comboboxOptions = options.map((option) => ({
    value: option.id,
    label: option.label,
  }));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Combobox
        value={value}
        options={comboboxOptions}
        onChange={(nextValue) => onChange(nextValue || NONE_VALUE)}
        placeholder={placeholder}
        searchPlaceholder={`Buscar ${label.toLowerCase()}...`}
        emptyMessage={`Nenhum resultado encontrado.`}
      />
    </div>
  );
}
