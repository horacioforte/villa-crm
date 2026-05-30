"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type Resolver, useForm, useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  oportunidadeSchema,
  statusOportunidadeValues,
  tipoOperacaoValues,
} from "@/lib/validations/oportunidade";

type StatusOportunidade = (typeof statusOportunidadeValues)[number];
type TipoOperacao = (typeof tipoOperacaoValues)[number];

type OportunidadeFormValues = {
  titulo: string;
  empresaId: string;
  status: StatusOportunidade;
  tipo: TipoOperacao;
  valor: string;
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
  tipo: TipoOperacao;
  status: StatusOportunidade;
  valor: string | number | null;
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
};

type OportunidadeModalProps = {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (op: OportunidadeSalva) => void;
  statusInicial: StatusOportunidade;
  oportunidadeId?: string | null;
};

const NONE_VALUE = "__none__";

const statusLabels: Record<StatusOportunidade, string> = {
  NOVA: "Nova",
  EM_ATENDIMENTO: "Em Atendimento",
  PROPOSTA_ENVIADA: "Proposta Enviada",
  NEGOCIACAO: "Negociacao",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
};

const tipoLabels: Record<TipoOperacao, string> = {
  LOCACAO: "Locacao",
  VENDA: "Venda",
};

const statusItems = statusOportunidadeValues.map((status) => ({
  label: statusLabels[status],
  value: status,
}));

const tipoItems = tipoOperacaoValues.map((tipo) => ({
  label: tipoLabels[tipo],
  value: tipo,
}));

function getDefaultValues(statusInicial: StatusOportunidade): OportunidadeFormValues {
  return {
    titulo: "",
    empresaId: "",
    status: statusInicial,
    tipo: "LOCACAO",
    valor: "",
    equipamentoId: NONE_VALUE,
    obraId: "",
    pessoaId: NONE_VALUE,
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
}: OportunidadeModalProps) {
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [obras, setObras] = useState<ObraOption[]>([]);
  const [pessoas, setPessoas] = useState<PessoaOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OportunidadeFormValues>({
    resolver: zodResolver(oportunidadeSchema) as unknown as Resolver<OportunidadeFormValues>,
    defaultValues: getDefaultValues(statusInicial),
  });

  const isEditing = Boolean(oportunidadeId);
  const statusAtual = useWatch({
    control: form.control,
    name: "status",
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
            valor: oportunidade.valor ? String(oportunidade.valor) : "",
            equipamentoId: oportunidade.equipamentoId ?? NONE_VALUE,
            obraId: oportunidade.obraId ?? "",
            pessoaId: oportunidade.pessoaId ?? NONE_VALUE,
            responsavelId: oportunidade.responsavelId ?? NONE_VALUE,
            descricao: oportunidade.descricao ?? "",
            motivoPerda: oportunidade.motivoPerda ?? "",
          });
        } else {
          form.reset(getDefaultValues(statusInicial));
        }
      } catch {
        toast.error("Nao foi possivel carregar os dados do formulario.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [aberto, form, oportunidadeId, statusInicial]);

  async function handleSubmit(values: OportunidadeFormValues) {
    setIsSubmitting(true);

    try {
      const response = await fetch(
        oportunidadeId
          ? `/api/oportunidades/${oportunidadeId}`
          : "/api/oportunidades",
        {
          method: oportunidadeId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
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
      onFechar();
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

  return (
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
            {isEditing ? "Editar oportunidade" : "Nova oportunidade"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados comerciais para atualizar o pipeline da Villa.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#667085]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Carregando formulario...
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-5 md:grid-cols-2"
          >
            <Field label="Titulo" error={form.formState.errors.titulo?.message}>
              <Input
                {...form.register("titulo")}
                placeholder="Locacao de bomba para obra residencial"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field
              label="Empresa"
              error={form.formState.errors.empresaId?.message}
            >
              <Controller
                control={form.control}
                name="empresaId"
                render={({ field }) => (
                  <Select
                    items={empresaItems}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map((empresa) => (
                        <SelectItem key={empresa.id} value={empresa.id}>
                          {empresa.nomeFantasia ?? empresa.razaoSocial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                      {statusOportunidadeValues.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusLabels[status]}
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
                    onValueChange={(value) => field.onChange(value)}
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

            <Field label="Valor" error={form.formState.errors.valor?.message}>
              <Input
                type="number"
                step="0.01"
                {...form.register("valor")}
                placeholder="15000"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

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

            <Field label="Obra" error={form.formState.errors.obraId?.message}>
              <Controller
                control={form.control}
                name="obraId"
                render={({ field }) => (
                  <Select
                    items={obraItems}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione a obra" />
                    </SelectTrigger>
                    <SelectContent>
                      {obras.map((obra) => (
                        <SelectItem key={obra.id} value={obra.id}>
                          {obra.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Pessoa/contato">
              <Controller
                control={form.control}
                name="pessoaId"
                render={({ field }) => (
                  <Select
                    items={pessoaItems}
                    value={field.value}
                    onValueChange={(value) =>
                      field.onChange(value ?? NONE_VALUE)
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione o contato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>
                        Sem contato vinculado
                      </SelectItem>
                      {pessoas.map((pessoa) => (
                        <SelectItem key={pessoa.id} value={pessoa.id}>
                          {pessoa.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                  "Salvar"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
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
