"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { TipoAtividade } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { NovaEmpresaInline } from "@/components/kanban/inline/NovaEmpresaInline";
import { NovaObraInline } from "@/components/kanban/inline/NovaObraInline";
import { NovoContatoInline } from "@/components/kanban/inline/NovoContatoInline";
import { Combobox } from "@/components/ui/combobox";
import { TIPO_CONFIG } from "@/components/tarefas/tarefa-config";
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
  canalOrigemValues,
  faixaPotencialValues,
  oportunidadeSchema,
  tipoServicoValues,
  statusOportunidadeValues,
  tipoOperacaoValues,
} from "@/lib/validations/oportunidade";
import { cn } from "@/lib/utils";

type StatusOportunidade = (typeof statusOportunidadeValues)[number];
type TipoOperacao = (typeof tipoOperacaoValues)[number];
type TipoServico = (typeof tipoServicoValues)[number];
type FaixaPotencial = (typeof faixaPotencialValues)[number];
type CanalOrigem = (typeof canalOrigemValues)[number];

type OportunidadeFormValues = {
  titulo: string;
  empresaId: string;
  status: StatusOportunidade;
  tipo: TipoOperacao;
  tipoServico: TipoServico | null;
  faixaPotencial: FaixaPotencial | null;
  canalOrigem: CanalOrigem | null;
  potencialOportunidade: string;
  valorContrato: string;
  equipamentoId: string;
  obraId: string;
  pessoaId: string;
  responsavelId: string;
  descricao: string;
  motivoPerda: string;
};

type EmpresaOption = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
};

type EquipamentoOption = {
  id: string;
  nome: string;
  tipo: string;
  codigoInterno: string;
};

type ObraOption = {
  id: string;
  nome: string;
};

type PessoaOption = {
  id: string;
  nome: string;
};

type OportunidadeSalva = {
  id: string;
  titulo: string;
  empresaId?: string | null;
  pessoaId?: string | null;
  obraId?: string | null;
  tipo: TipoOperacao;
  status: StatusOportunidade;
  tipoServico?: TipoServico | null;
  potencialOportunidade: string | number | null;
  faixaPotencial?: FaixaPotencial | null;
  valorContrato: string | number | null;
  canalOrigem?: CanalOrigem | null;
  temperatura?: "FRIA" | "MEDIA" | "QUENTE" | null;
  temperaturaMotivo?: string | null;
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
};

type PassoModal = "dados" | "proxima_acao";

export type OportunidadePrefill = {
  empresaId?: string | null;
  pessoaId?: string | null;
  obraId?: string | null;
  titulo?: string | null;
  canalOrigem?: CanalOrigem | null;
  usarTarefaExistenteComoPrimeiraAcao?: boolean;
};

type OportunidadeModalProps = {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (op: OportunidadeSalva) => void;
  statusInicial: StatusOportunidade;
  oportunidadeId?: string | null;
  prefill?: OportunidadePrefill;
};

const NONE_VALUE = "__none__";

const statusLabels: Record<StatusOportunidade, string> = {
  NOVA: "Nova",
  PRE_QUALIFICADA: "Pré-qualificada",
  EM_ATENDIMENTO: "Em Atendimento",
  PROPOSTA_ENVIADA: "Proposta Enviada",
  NEGOCIACAO: "Negociação",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
};

const tipoLabels: Record<TipoOperacao, string> = {
  LOCACAO: "Locacao",
  EQUIPAMENTO_USADO: "Equipamento usado",
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

const faixaPotencialLabels: Record<FaixaPotencial, string> = {
  ATE_100_MIL: "Ate R$ 100 mil",
  DE_100_A_500_MIL: "R$ 100 mil - R$ 500 mil",
  DE_500_MIL_A_2_MILHOES: "R$ 500 mil - R$ 2 milhoes",
  ACIMA_DE_2_MILHOES: "Acima de R$ 2 milhoes",
};

const canalOrigemLabels: Record<CanalOrigem, string> = {
  INDICACAO: "Indicacao",
  CLIENTE_ATUAL: "Cliente atual",
  GOOGLE: "Google",
  LINKEDIN: "LinkedIn",
  SITE: "Site",
  VISITA_COMERCIAL: "Visita comercial",
  OBRA_MAPEADA: "Obra mapeada",
  MARKETPLACE: "Marketplace",
  OLX: "OLX",
  EVENTO: "Evento",
  OUTROS: "Outros",
};

const statusItems = statusOportunidadeValues.map((status) => ({
  label: statusLabels[status],
  value: status,
}));

const tipoItems = tipoOperacaoValues.map((tipo) => ({
  label: tipoLabels[tipo],
  value: tipo,
}));

function todayInput() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultValues(
  statusInicial: StatusOportunidade,
  prefill?: OportunidadePrefill,
): OportunidadeFormValues {
  return {
    titulo: prefill?.titulo ?? "",
    empresaId: prefill?.empresaId ?? "",
    status: statusInicial,
    tipo: "LOCACAO",
    tipoServico: null,
    faixaPotencial: null,
    canalOrigem: prefill?.canalOrigem ?? null,
    potencialOportunidade: "",
    valorContrato: "",
    equipamentoId: NONE_VALUE,
    obraId: prefill?.obraId ?? "",
    pessoaId: prefill?.pessoaId ?? NONE_VALUE,
    responsavelId: NONE_VALUE,
    descricao: "",
    motivoPerda: "",
  };
}

export function OportunidadeModal({
  aberto,
  onFechar,
  onSalvar,
  statusInicial,
  oportunidadeId,
  prefill,
}: OportunidadeModalProps) {
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [obras, setObras] = useState<ObraOption[]>([]);
  const [pessoas, setPessoas] = useState<PessoaOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [novaEmpresaOpen, setNovaEmpresaOpen] = useState(false);
  const [novaObraOpen, setNovaObraOpen] = useState(false);
  const [novoContatoOpen, setNovoContatoOpen] = useState(false);
  const [tarefaTipo, setTarefaTipo] = useState<TipoAtividade>("LIGACAO");
  const [tarefaProximaAcao, setTarefaProximaAcao] = useState("");
  const [tarefaData, setTarefaData] = useState(todayInput());
  const [passo, setPasso] = useState<PassoModal>("dados");
  const [oportunidadeCriada, setOportunidadeCriada] =
    useState<OportunidadeSalva | null>(null);
  const [acaoHora, setAcaoHora] = useState("09:00");
  const [acaoObservacao, setAcaoObservacao] = useState("");

  const form = useForm<OportunidadeFormValues>({
    resolver: zodResolver(oportunidadeSchema) as unknown as Resolver<OportunidadeFormValues>,
    defaultValues: getDefaultValues(statusInicial, prefill),
  });

  const isEditing = Boolean(oportunidadeId);
  const deveSugerirProximaAcao =
    !isEditing && !prefill?.usarTarefaExistenteComoPrimeiraAcao;
  const statusAtual = useWatch({
    control: form.control,
    name: "status",
  });
  const watchedTipo = useWatch({
    control: form.control,
    name: "tipo",
  });
  const watchedEmpresaId = useWatch({
    control: form.control,
    name: "empresaId",
  });

  const empresaItems = useMemo(
    () =>
      empresas.map((empresa) => ({
        label: empresa.nomeFantasia ?? empresa.razaoSocial,
        value: empresa.id,
      })),
    [empresas],
  );

  const equipamentoItems = useMemo(
    () => [
      {
        label: "Sem equipamento vinculado",
        value: NONE_VALUE,
      },
      ...equipamentos.map((equipamento) => ({
        label: `${equipamento.nome} - ${equipamento.codigoInterno}`,
        value: equipamento.id,
      })),
    ],
    [equipamentos],
  );

  const obraItems = useMemo(
    () =>
      obras.map((obra) => ({
        label: obra.nome,
        value: obra.id,
      })),
    [obras],
  );

  const pessoaItems = useMemo(
    () => [
      {
        label: "Sem contato vinculado",
        value: NONE_VALUE,
      },
      ...pessoas.map((pessoa) => ({
        label: pessoa.nome,
        value: pessoa.id,
      })),
    ],
    [pessoas],
  );

  useEffect(() => {
    if (!aberto) {
      return;
    }

    async function loadData() {
      setIsLoading(true);

      try {
        const [
          empresasResponse,
          equipamentosResponse,
          obrasResponse,
          pessoasResponse,
        ] = await Promise.all([
          fetch("/api/empresas"),
          fetch("/api/equipamentos"),
          fetch("/api/obras"),
          fetch("/api/contatos"),
        ]);

        if (
          !empresasResponse.ok ||
          !equipamentosResponse.ok ||
          !obrasResponse.ok ||
          !pessoasResponse.ok
        ) {
          throw new Error("Falha ao carregar dados do formulario.");
        }

        const [empresasData, equipamentosData, obrasData, pessoasData] =
          await Promise.all([
            empresasResponse.json(),
            equipamentosResponse.json(),
            obrasResponse.json(),
            pessoasResponse.json(),
          ]);

        setEmpresas(empresasData);
        setEquipamentos(equipamentosData);
        setObras(obrasData);
        setPessoas(pessoasData);

        if (oportunidadeId) {
          const oportunidadeResponse = await fetch(
            `/api/oportunidades/${oportunidadeId}`,
          );

          if (!oportunidadeResponse.ok) {
            throw new Error("Falha ao carregar oportunidade.");
          }

          const oportunidade = await oportunidadeResponse.json();

          form.reset({
            titulo: oportunidade.titulo ?? "",
            empresaId: oportunidade.empresaId,
            status: oportunidade.status,
            tipo: oportunidade.tipo,
            tipoServico: oportunidade.tipoServico ?? null,
            faixaPotencial: oportunidade.faixaPotencial ?? null,
            canalOrigem: oportunidade.canalOrigem ?? null,
            potencialOportunidade: oportunidade.potencialOportunidade
              ? String(oportunidade.potencialOportunidade)
              : "",
            valorContrato: oportunidade.valorContrato
              ? String(oportunidade.valorContrato)
              : "",
            equipamentoId: oportunidade.equipamentoId ?? NONE_VALUE,
            obraId: oportunidade.obraId ?? "",
            pessoaId: oportunidade.pessoaId ?? NONE_VALUE,
            responsavelId: oportunidade.responsavelId ?? NONE_VALUE,
            descricao: oportunidade.descricao ?? "",
            motivoPerda: oportunidade.motivoPerda ?? "",
          });
        } else {
          form.reset(getDefaultValues(statusInicial, prefill));
          setPasso("dados");
          setOportunidadeCriada(null);
          setTarefaTipo("LIGACAO");
          setTarefaProximaAcao("");
          setTarefaData(todayInput());
          setAcaoHora("09:00");
          setAcaoObservacao("");
        }
      } catch {
        toast.error("Nao foi possivel carregar os dados do formulario.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [aberto, form, oportunidadeId, prefill, statusInicial]);

  async function handleSubmit(values: OportunidadeFormValues) {
    if (!isEditing) {
      if (!values.titulo.trim()) {
        toast.error("Informe o titulo da oportunidade.");
        return;
      }

      if (!values.empresaId) {
        toast.error("Selecione a empresa.");
        return;
      }

      if (!values.canalOrigem) {
        toast.error("Informe como o cliente chegou ate nos.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = isEditing
        ? values
        : {
            titulo: values.titulo.trim(),
            empresaId: values.empresaId,
            canalOrigem: values.canalOrigem,
            tipo: values.tipo,
            status: values.status,
            pessoaId: null,
            obraId: null,
            equipamentoId: null,
            potencialOportunidade: values.potencialOportunidade || null,
            faixaPotencial: null,
            tipoServico: null,
            descricao: null,
            responsavelId: null,
            valorContrato: null,
            motivoPerda: null,
          };
      const response = await fetch(
        oportunidadeId
          ? `/api/oportunidades/${oportunidadeId}`
          : "/api/oportunidades",
        {
          method: oportunidadeId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao salvar oportunidade.");
      }

      const oportunidade = await response.json();

      toast.success(
        isEditing
          ? "Oportunidade atualizada com sucesso."
          : "Oportunidade criada com sucesso.",
      );
      onSalvar(oportunidade);
      if (isEditing || !deveSugerirProximaAcao) {
        onFechar();
        return;
      }

      setOportunidadeCriada(oportunidade);
      setPasso("proxima_acao");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar a oportunidade.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSalvarAcao() {
    if (!oportunidadeCriada) {
      return;
    }

    if (!tarefaTipo || !tarefaData) {
      toast.error("Defina o tipo e a data da proxima acao.");
      return;
    }

    const config = TIPO_CONFIG[tarefaTipo];
    const tituloTarefa = `${config?.label ?? "Tarefa"} - ${oportunidadeCriada.titulo}`;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/oportunidades/${oportunidadeCriada.id}/tarefas`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            titulo: tituloTarefa,
            descricao: acaoObservacao || null,
            tipo: tarefaTipo,
            prioridade: "MEDIA",
            dataVencimento: tarefaData,
            horaVencimento: acaoHora || null,
            observacoes: acaoObservacao || null,
          }),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao salvar proxima acao.");
      }

      toast.success("Proxima acao agendada!");
      onSalvar({
        ...oportunidadeCriada,
        tarefas: [{ status: "PENDENTE" }],
      });
      onFechar();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar a proxima acao.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Dialog
        open={aberto}
        onOpenChange={(open) => {
          if (!open) {
            onFechar();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
            {isEditing
              ? "Editar oportunidade"
              : passo === "proxima_acao"
                ? "Qual e o proximo passo?"
                : "Nova oportunidade"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Preencha os dados comerciais para atualizar o pipeline da Villa."
              : passo === "proxima_acao"
                ? "A oportunidade foi criada. Agende a proxima acao para manter o follow-up em dia."
                : "Preencha o essencial agora. Os demais dados podem ser adicionados depois no detalhe da oportunidade."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando formulario...
          </div>
        ) : !isEditing && passo === "proxima_acao" && oportunidadeCriada ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-[#E8EEFB] p-4 text-sm font-semibold text-[#1A2E5A]">
              Oportunidade criada! Defina agora o proximo passo.
            </div>

            <div>
              <Label className="text-[#1A2E5A]">Tipo de atividade *</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    "LIGACAO",
                    "WHATSAPP",
                    "EMAIL",
                    "VISITA",
                    "PROPOSTA",
                    "OUTRO",
                  ] as TipoAtividade[]
                ).map((tipo) => {
                  const config = TIPO_CONFIG[tipo];
                  const ativo = tarefaTipo === tipo;

                  return (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setTarefaTipo(tipo)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-sm font-medium transition-colors",
                        ativo
                          ? "border-[#1E4FAB] bg-[#E8EEFB] text-[#1A2E5A]"
                          : "border-[#D7DEEA] bg-white text-[#667085] hover:border-[#1E4FAB]",
                      )}
                    >
                      <span className="text-xl">{config?.emoji ?? "•"}</span>
                      {config?.label ?? tipo}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data">
                <Input
                  type="date"
                  value={tarefaData}
                  min={todayInput()}
                  onChange={(event) => setTarefaData(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
              <Field label="Hora">
                <Input
                  type="time"
                  value={acaoHora}
                  onChange={(event) => setAcaoHora(event.target.value)}
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
            </div>

            <Field label="Observacao (opcional)">
              <Input
                value={acaoObservacao}
                onChange={(event) => setAcaoObservacao(event.target.value)}
                placeholder="Ex: Confirmar disponibilidade de bomba lanca 36m"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={onFechar}
                className="rounded-2xl text-[#667085] underline"
              >
                Pular por agora
              </Button>
              <Button
                type="button"
                disabled={isSubmitting || !tarefaTipo || !tarefaData}
                onClick={handleSalvarAcao}
                className="h-11 rounded-2xl bg-[#1E4FAB] px-6 text-white hover:bg-[#1A2E5A]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar e concluir"
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-5 md:grid-cols-2"
          >
            <Field label="Titulo *" error={form.formState.errors.titulo?.message}>
              <Input
                {...form.register("titulo")}
                placeholder="Locacao de bomba para obra residencial"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field
              label="Empresa *"
              error={form.formState.errors.empresaId?.message}
            >
              <div className="space-y-2">
                <Controller
                  control={form.control}
                  name="empresaId"
                  render={({ field }) => (
                    <Combobox
                      options={empresaItems}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Selecione a empresa"
                      searchPlaceholder="Buscar empresa..."
                      emptyMessage="Nenhuma empresa encontrada."
                    />
                  )}
                />
                <button
                  type="button"
                  onClick={() => setNovaEmpresaOpen(true)}
                  className="text-xs font-semibold text-[#1E4FAB] hover:underline"
                >
                  + Nova empresa
                </button>
              </div>
            </Field>

            <Field label="Status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select
                    items={statusItems}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(isEditing
                        ? statusOportunidadeValues
                        : (["NOVA", "EM_ATENDIMENTO"] as StatusOportunidade[])
                      ).map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabels[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Como chegou ate nos *">
              <Controller
                control={form.control}
                name="canalOrigem"
                render={({ field }) => (
                  <Select
                    items={canalOrigemValues.map((canal) => ({
                      label: canalOrigemLabels[canal],
                      value: canal,
                    }))}
                    value={field.value ?? NONE_VALUE}
                    onValueChange={(value) => {
                      const nextValue = value === NONE_VALUE ? null : value;
                      field.onChange(nextValue);

                      if (nextValue === "CLIENTE_ATUAL") {
                        form.setValue("status", "EM_ATENDIMENTO");
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione o canal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Nao informado</SelectItem>
                      {canalOrigemValues.map((canal) => (
                        <SelectItem key={canal} value={canal}>
                          {canalOrigemLabels[canal]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Tipo">
              <Controller
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <Select
                    items={tipoItems}
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);

                      if (value === "EQUIPAMENTO_USADO") {
                        form.setValue("tipoServico", null);
                        form.setValue("obraId", NONE_VALUE);
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoOperacaoValues.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipoLabels[tipo]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {!isEditing ? (
              <Field label="Valor da oportunidade">
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("potencialOportunidade")}
                  placeholder="Opcional. Ex: 15000"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
            ) : null}

            {isEditing ? (
              <>
            {watchedTipo === "LOCACAO" ? (
              <Field label="Tipo de servico">
                <Controller
                  control={form.control}
                  name="tipoServico"
                  render={({ field }) => (
                    <Select
                      items={tipoServicoValues.map((tipoServico) => ({
                        label: tipoServicoLabels[tipoServico],
                        value: tipoServico,
                      }))}
                      value={field.value ?? NONE_VALUE}
                      onValueChange={(value) =>
                        field.onChange(value === NONE_VALUE ? null : value)
                      }
                    >
                      <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                        <SelectValue placeholder="Selecione o servico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Nao especificado</SelectItem>
                        {tipoServicoValues.map((tipoServico) => (
                          <SelectItem key={tipoServico} value={tipoServico}>
                            {tipoServicoLabels[tipoServico]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            ) : null}

            <Field label="Potencial da oportunidade">
              <Input
                type="number"
                step="0.01"
                {...form.register("potencialOportunidade")}
                placeholder="Ex: 15000 (estimativa inicial, pode deixar em branco)"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field label="Faixa de potencial">
              <Controller
                control={form.control}
                name="faixaPotencial"
                render={({ field }) => (
                  <Select
                    items={faixaPotencialValues.map((faixa) => ({
                      label: faixaPotencialLabels[faixa],
                      value: faixa,
                    }))}
                    value={field.value ?? NONE_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === NONE_VALUE ? null : value)
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione a faixa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Nao definida</SelectItem>
                      {faixaPotencialValues.map((faixa) => (
                        <SelectItem key={faixa} value={faixa}>
                          {faixaPotencialLabels[faixa]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {isEditing && statusAtual === "GANHA" ? (
              <Field label="Valor do contrato">
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("valorContrato")}
                  placeholder="Valor confirmado do contrato"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
            ) : null}

            <Field label="Equipamento">
              <Controller
                control={form.control}
                name="equipamentoId"
                render={({ field }) => (
                  <Select
                    items={equipamentoItems}
                    value={field.value}
                    onValueChange={(value) =>
                      field.onChange(value ?? NONE_VALUE)
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione o equipamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>
                        Sem equipamento vinculado
                      </SelectItem>
                      {equipamentos.map((equipamento) => (
                        <SelectItem key={equipamento.id} value={equipamento.id}>
                          {equipamento.nome} - {equipamento.codigoInterno}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {watchedTipo === "LOCACAO" ? (
              <Field label="Obra" error={form.formState.errors.obraId?.message}>
                <div className="space-y-2">
                  <Controller
                    control={form.control}
                    name="obraId"
                    render={({ field }) => (
                      <Combobox
                        options={obraItems}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Selecione a obra"
                        searchPlaceholder="Buscar obra..."
                        emptyMessage="Nenhuma obra encontrada."
                      />
                    )}
                  />
                  <button
                    type="button"
                    disabled={!watchedEmpresaId}
                    onClick={() => setNovaObraOpen(true)}
                    title={!watchedEmpresaId ? "Selecione uma empresa primeiro" : ""}
                    className="text-xs font-semibold text-[#1E4FAB] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    + Nova obra
                  </button>
                </div>
              </Field>
            ) : null}

            <Field label="Pessoa/contato">
              <div className="space-y-2">
                <Controller
                  control={form.control}
                  name="pessoaId"
                  render={({ field }) => (
                    <Combobox
                      options={pessoaItems}
                      value={field.value ?? NONE_VALUE}
                      onChange={(value) => field.onChange(value || NONE_VALUE)}
                      placeholder="Selecione o contato"
                      searchPlaceholder="Buscar contato..."
                      emptyMessage="Nenhum contato encontrado."
                    />
                  )}
                />
                <button
                  type="button"
                  disabled={!watchedEmpresaId}
                  onClick={() => setNovoContatoOpen(true)}
                  title={!watchedEmpresaId ? "Selecione uma empresa primeiro" : ""}
                  className="text-xs font-semibold text-[#1E4FAB] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + Novo contato
                </button>
              </div>
            </Field>

            {statusAtual === "PERDIDA" ? (
              <Field
                label="Motivo da perda"
                error={form.formState.errors.motivoPerda?.message}
                className="md:col-span-2"
              >
                <Textarea
                  {...form.register("motivoPerda")}
                  placeholder="Explique por que a oportunidade foi perdida."
                  className="min-h-24 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>
            ) : null}

            <Field label="Descricao" className="md:col-span-2">
              <Textarea
                {...form.register("descricao")}
                placeholder="Observacoes comerciais, detalhes da obra ou necessidades do cliente."
                className="min-h-28 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

              </>
            ) : null}

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={onFechar}
                className="h-11 rounded-2xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 rounded-2xl bg-[#1E4FAB] px-6 text-white hover:bg-[#1A2E5A]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  isEditing ? "Salvar" : "Criar oportunidade"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
        </DialogContent>
      </Dialog>

      <NovaEmpresaInline
        open={novaEmpresaOpen}
        onOpenChange={setNovaEmpresaOpen}
        onCriada={(empresa) => {
          setEmpresas((prev) => [empresa, ...prev]);
          form.setValue("empresaId", empresa.id, { shouldValidate: true });
          setNovaEmpresaOpen(false);
        }}
      />

      <NovaObraInline
        open={novaObraOpen}
        onOpenChange={setNovaObraOpen}
        empresaId={watchedEmpresaId ?? ""}
        onCriada={(obra) => {
          setObras((prev) => [obra, ...prev]);
          form.setValue("obraId", obra.id, { shouldValidate: true });
          setNovaObraOpen(false);
        }}
      />

      <NovoContatoInline
        open={novoContatoOpen}
        onOpenChange={setNovoContatoOpen}
        empresaId={watchedEmpresaId ?? ""}
        onCriada={(contato) => {
          setPessoas((prev) => [contato, ...prev]);
          form.setValue("pessoaId", contato.id, { shouldValidate: true });
          setNovoContatoOpen(false);
        }}
      />
    </>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-[#1A2E5A]">{label}</Label>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
