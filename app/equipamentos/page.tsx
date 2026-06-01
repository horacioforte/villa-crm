"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { Loader2, Pencil, Plus, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageNavigation } from "@/components/layout/PageNavigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  equipamentoSchema,
  statusEquipamentoValues,
  tipoEquipamentoValues,
} from "@/lib/validations/equipamento";

type TipoEquipamento = (typeof tipoEquipamentoValues)[number];
type StatusEquipamento = (typeof statusEquipamentoValues)[number];

type EquipamentoFormValues = {
  codigo: string;
  nome: string;
  tipo: TipoEquipamento;
  status: StatusEquipamento;
  marca: string;
  modelo: string;
  ano: string;
  numeroSerie: string;
  valorM3: string;
  volumeMinimoM3: string;
  valorVenda: string;
  observacoes: string;
};

type EquipamentoRow = {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoEquipamento;
  status: StatusEquipamento;
  codigoInterno: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  numeroSerie: string | null;
  valorLocacao: string | null;
  valorM3: number | null;
  volumeMinimoM3: number | null;
  valorVenda: string | null;
  observacoes: string | null;
};

const defaultValues: EquipamentoFormValues = {
  codigo: "",
  nome: "",
  tipo: "BOMBA_CONCRETO",
  status: "DISPONIVEL",
  marca: "",
  modelo: "",
  ano: "",
  numeroSerie: "",
  valorM3: "",
  volumeMinimoM3: "",
  valorVenda: "",
  observacoes: "",
};

const tipoConfig: Record<TipoEquipamento, { label: string; className: string }> = {
  BOMBA_CONCRETO: {
    label: "Bomba de concreto",
    className: "bg-[#E8EEFB] text-[#1A2E5A]",
  },
  BETONEIRA: {
    label: "Betoneira",
    className: "bg-blue-100 text-blue-700",
  },
  OUTRO: {
    label: "Outro",
    className: "bg-slate-100 text-slate-700",
  },
};

const statusConfig: Record<
  StatusEquipamento,
  { label: string; className: string }
> = {
  DISPONIVEL: {
    label: "Disponivel",
    className: "bg-emerald-100 text-emerald-700",
  },
  LOCADO: {
    label: "Locado",
    className: "bg-blue-100 text-blue-700",
  },
  MANUTENCAO: {
    label: "Manutencao",
    className: "bg-amber-100 text-amber-800",
  },
  VENDIDO: {
    label: "Vendido",
    className: "bg-purple-100 text-purple-700",
  },
  INATIVO: {
    label: "Inativo",
    className: "bg-slate-100 text-slate-700",
  },
};

const tipoItems = tipoEquipamentoValues.map((tipo) => ({
  label: tipoConfig[tipo].label,
  value: tipo,
}));

const statusItems = statusEquipamentoValues.map((status) => ({
  label: statusConfig[status].label,
  value: status,
}));

function getFormValues(equipamento?: EquipamentoRow | null): EquipamentoFormValues {
  if (!equipamento) {
    return defaultValues;
  }

  return {
    codigo: equipamento.codigo,
    nome: equipamento.nome,
    tipo: equipamento.tipo,
    status: equipamento.status,
    marca: equipamento.marca ?? "",
    modelo: equipamento.modelo ?? "",
    ano: equipamento.ano ? String(equipamento.ano) : "",
    numeroSerie: equipamento.numeroSerie ?? "",
    valorM3: equipamento.valorM3 ? String(equipamento.valorM3) : "",
    volumeMinimoM3: equipamento.volumeMinimoM3
      ? String(equipamento.volumeMinimoM3)
      : "",
    valorVenda: equipamento.valorVenda ?? "",
    observacoes: equipamento.observacoes ?? "",
  };
}

function formatCurrency(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatMoneyNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function parseOptionalNumber(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchEquipamentos() {
  const response = await fetch("/api/equipamentos?scope=cadastro");

  if (!response.ok) {
    throw new Error("Falha ao carregar equipamentos.");
  }

  return response.json() as Promise<EquipamentoRow[]>;
}

export default function EquipamentosPage() {
  const [equipamentos, setEquipamentos] = useState<EquipamentoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEquipamento, setEditingEquipamento] =
    useState<EquipamentoRow | null>(null);

  const form = useForm<EquipamentoFormValues>({
    resolver: zodResolver(equipamentoSchema) as unknown as Resolver<EquipamentoFormValues>,
    defaultValues,
  });
  const valorM3Preview = parseOptionalNumber(form.watch("valorM3"));
  const volumeMinimoM3Preview = parseOptionalNumber(
    form.watch("volumeMinimoM3"),
  );
  const valorReferenciaLocacao =
    valorM3Preview && volumeMinimoM3Preview
      ? valorM3Preview * volumeMinimoM3Preview
      : null;

  const loadEquipamentos = useCallback(async () => {
    setIsLoading(true);

    try {
      setEquipamentos(await fetchEquipamentos());
    } catch {
      toast.error("Nao foi possivel carregar os equipamentos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadInitialEquipamentos() {
      try {
        setEquipamentos(await fetchEquipamentos());
      } catch {
        toast.error("Nao foi possivel carregar os equipamentos.");
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialEquipamentos();
  }, []);

  const totalPorTipo = useMemo(
    () =>
      equipamentos.reduce(
        (total, equipamento) => ({
          ...total,
          [equipamento.tipo]: total[equipamento.tipo] + 1,
        }),
        {
          BOMBA_CONCRETO: 0,
          BETONEIRA: 0,
          OUTRO: 0,
        },
      ),
    [equipamentos],
  );

  const totalPorStatus = useMemo(
    () =>
      equipamentos.reduce(
        (total, equipamento) => ({
          ...total,
          [equipamento.status]: total[equipamento.status] + 1,
        }),
        {
          DISPONIVEL: 0,
          LOCADO: 0,
          MANUTENCAO: 0,
          VENDIDO: 0,
          INATIVO: 0,
        },
      ),
    [equipamentos],
  );

  function openCreateDialog() {
    setEditingEquipamento(null);
    form.reset(defaultValues);
    setIsDialogOpen(true);
  }

  function openEditDialog(equipamento: EquipamentoRow) {
    setEditingEquipamento(equipamento);
    form.reset(getFormValues(equipamento));
    setIsDialogOpen(true);
  }

  async function handleSubmit(values: EquipamentoFormValues) {
    setIsSubmitting(true);

    try {
      const response = await fetch(
        editingEquipamento
          ? `/api/equipamentos/${editingEquipamento.id}`
          : "/api/equipamentos",
        {
          method: editingEquipamento ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao salvar equipamento.");
      }

      toast.success(
        editingEquipamento
          ? "Equipamento atualizado com sucesso."
          : "Equipamento cadastrado com sucesso.",
      );
      setIsDialogOpen(false);
      await loadEquipamentos();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar o equipamento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(equipamento: EquipamentoRow) {
    if (equipamento.status === "INATIVO") {
      return;
    }

    try {
      const response = await fetch(`/api/equipamentos/${equipamento.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao desativar equipamento.");
      }

      toast.success("Equipamento desativado com sucesso.");
      await loadEquipamentos();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel desativar o equipamento.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation
          currentPage="Equipamentos"
          currentHref="/equipamentos"
        />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Equipamentos
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Cadastre e acompanhe bombas de concreto, betoneiras e outros
              equipamentos usados nas oportunidades comerciais.
            </p>
          </div>
          <Button
            type="button"
            onClick={openCreateDialog}
            className="h-11 rounded-2xl bg-[#1E4FAB] px-5 text-white hover:bg-[#1A2E5A]"
          >
            <Plus className="size-4" />
            Novo equipamento
          </Button>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Total cadastrado</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {equipamentos.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Disponiveis</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {totalPorStatus.DISPONIVEL}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Bombas de concreto</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {totalPorTipo.BOMBA_CONCRETO}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardDescription>Betoneiras</CardDescription>
              <CardTitle className="text-3xl font-bold text-[#1A2E5A]">
                {totalPorTipo.BETONEIRA}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card className="mt-8 rounded-3xl border-[#D7DEEA] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#1A2E5A]">
              Equipamentos cadastrados
            </CardTitle>
            <CardDescription>
              Lista completa do cadastro de equipamentos da Villa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-[#667085]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando equipamentos...
              </div>
            ) : equipamentos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#D7DEEA] py-14 text-center">
                <Truck className="size-10 text-[#1E4FAB]" />
                <p className="mt-3 font-semibold text-[#1A2E5A]">
                  Nenhum equipamento cadastrado
                </p>
                <p className="mt-1 text-sm text-[#667085]">
                  Clique em Novo equipamento para cadastrar o primeiro item.
                </p>
                <Button
                  type="button"
                  onClick={openCreateDialog}
                  className="mt-5 h-10 rounded-2xl bg-[#1E4FAB] px-4 text-white hover:bg-[#1A2E5A]"
                >
                  <Plus className="size-4" />
                  Novo equipamento
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codigo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Marca/modelo</TableHead>
                      <TableHead>Locacao</TableHead>
                      <TableHead>Preco/m³</TableHead>
                      <TableHead>Vol. minimo</TableHead>
                      <TableHead>Venda</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipamentos.map((equipamento) => (
                      <TableRow key={equipamento.id}>
                        <TableCell className="font-semibold text-[#1A2E5A]">
                          {equipamento.codigoInterno}
                        </TableCell>
                        <TableCell>{equipamento.nome}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={tipoConfig[equipamento.tipo].className}
                          >
                            {tipoConfig[equipamento.tipo].label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={statusConfig[equipamento.status].className}
                          >
                            {statusConfig[equipamento.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[#667085]">
                          {[equipamento.marca, equipamento.modelo]
                            .filter(Boolean)
                            .join(" / ") || "-"}
                        </TableCell>
                        <TableCell>
                          {equipamento.valorM3 && equipamento.volumeMinimoM3
                            ? formatMoneyNumber(
                                equipamento.valorM3 * equipamento.volumeMinimoM3,
                              )
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {equipamento.valorM3
                            ? formatMoneyNumber(equipamento.valorM3)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {equipamento.volumeMinimoM3
                            ? `${formatVolume(equipamento.volumeMinimoM3)} m³`
                            : "-"}
                        </TableCell>
                        <TableCell>{formatCurrency(equipamento.valorVenda)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(equipamento)}
                              className="rounded-xl"
                            >
                              <Pencil className="size-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeactivate(equipamento)}
                              disabled={equipamento.status === "INATIVO"}
                              className="rounded-xl"
                            >
                              Desativar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingEquipamento(null);
            form.reset(defaultValues);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#1A2E5A]">
              {editingEquipamento ? "Editar equipamento" : "Novo equipamento"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados essenciais para usar o equipamento no CRM.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-5 md:grid-cols-2"
          >
            <Field label="Codigo" error={form.formState.errors.codigo?.message}>
              <Input
                {...form.register("codigo")}
                placeholder="EQ-001"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field label="Nome" error={form.formState.errors.nome?.message}>
              <Input
                {...form.register("nome")}
                placeholder="Bomba de concreto 36m"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field label="Tipo" error={form.formState.errors.tipo?.message}>
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
                      {tipoEquipamentoValues.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipoConfig[tipo].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Status" error={form.formState.errors.status?.message}>
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
                      {statusEquipamentoValues.map((status) => (
                        <SelectItem key={status} value={status}>
                          {statusConfig[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Marca">
              <Input
                {...form.register("marca")}
                placeholder="Schwing"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field label="Modelo">
              <Input
                {...form.register("modelo")}
                placeholder="SP 500"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field label="Ano" error={form.formState.errors.ano?.message}>
              <Input
                type="number"
                {...form.register("ano")}
                placeholder="2024"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field label="Numero de serie">
              <Input
                {...form.register("numeroSerie")}
                placeholder="Serie ou chassi"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <div className="border-t border-[#D7DEEA] pt-4 md:col-span-2">
              <p className="mb-3 text-sm font-medium text-[#1A2E5A]">
                Precificacao por volume
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Valor por m³ (R$)"
                  error={form.formState.errors.valorM3?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("valorM3")}
                    placeholder="55,00"
                    className="h-11 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>

                <Field
                  label="Volume minimo (m³)"
                  error={form.formState.errors.volumeMinimoM3?.message}
                >
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    {...form.register("volumeMinimoM3")}
                    placeholder="1500"
                    className="h-11 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>
              </div>

              {valorM3Preview && volumeMinimoM3Preview && valorReferenciaLocacao ? (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[#F4F6FA] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[#667085]">
                    {formatVolume(volumeMinimoM3Preview)} m³ ×{" "}
                    {formatMoneyNumber(valorM3Preview)}
                  </span>
                  <span className="font-semibold text-[#1A2E5A]">
                    = {formatMoneyNumber(valorReferenciaLocacao)}
                  </span>
                </div>
              ) : null}
            </div>

            <Field
              label="Valor de venda"
              error={form.formState.errors.valorVenda?.message}
            >
              <Input
                type="number"
                step="0.01"
                {...form.register("valorVenda")}
                placeholder="250000"
                className="h-11 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <Field
              label="Observacoes"
              error={form.formState.errors.observacoes?.message}
              className="md:col-span-2"
            >
              <Textarea
                {...form.register("observacoes")}
                placeholder="Detalhes operacionais, manutencao ou disponibilidade."
                className="min-h-24 rounded-2xl bg-[#F4F6FA]"
              />
            </Field>

            <DialogFooter className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
                className="h-10 rounded-2xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 rounded-2xl bg-[#1E4FAB] px-5 text-white hover:bg-[#1A2E5A]"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {editingEquipamento ? "Salvar alteracoes" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
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
      <Label className="mb-2 text-[#1A2E5A]">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
