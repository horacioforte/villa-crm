"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, HardHat, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ZodError } from "zod";

import { Button } from "@/components/ui/button";
import { PageNavigation } from "@/components/layout/PageNavigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { obraSchema, type ObraInput } from "@/lib/validations/obra";

type EmpresaOption = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
};

const initialForm: ObraInput = {
  nome: "",
  empresaId: "",
  cidade: "",
  estado: "",
  volumeEstimado: "",
  dataInicio: "",
  dataTermino: "",
  status: "PLANEJADA",
};

const estados = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const statusOptions = [
  { value: "PLANEJADA", label: "Planejada" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDA", label: "Concluida" },
  { value: "CANCELADA", label: "Cancelada" },
] as const;

type FieldErrors = Partial<Record<keyof ObraInput, string>>;

export default function NovaObraPage() {
  const router = useRouter();
  const [form, setForm] = useState<ObraInput>(initialForm);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const empresaItems = useMemo(
    () =>
      empresas.map((empresa) => ({
        value: empresa.id,
        label: empresa.nomeFantasia ?? empresa.razaoSocial,
      })),
    [empresas],
  );
  const estadoItems = useMemo(
    () => estados.map((estado) => ({ value: estado, label: estado })),
    [],
  );

  useEffect(() => {
    async function loadEmpresas() {
      try {
        const response = await fetch("/api/empresas");

        if (!response.ok) {
          throw new Error("Falha ao carregar empresas.");
        }

        setEmpresas(await response.json());
      } catch {
        toast.error("Nao foi possivel carregar as empresas ativas.");
      }
    }

    loadEmpresas();
  }, []);

  function updateField(field: keyof ObraInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      obraSchema.parse(form);
      const response = await fetch("/api/obras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao cadastrar obra.");
      }

      toast.success("Obra cadastrada com sucesso.");
      router.push("/obras");
      router.refresh();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: FieldErrors = {};

        for (const issue of error.issues) {
          const field = issue.path[0] as keyof ObraInput | undefined;

          if (field && !fieldErrors[field]) {
            fieldErrors[field] = issue.message;
          }
        }

        setErrors(fieldErrors);
        toast.error("Revise os campos obrigatorios.");
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Nao foi possivel cadastrar a obra.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageNavigation currentPage="Nova obra" currentHref="/obras" />
        <Button
          variant="ghost"
          render={<Link href="/obras" />}
          className="mb-6 text-[#1A2E5A] hover:bg-[#E8EEFB]"
        >
          <ArrowLeft className="size-4" />
          Voltar para obras
        </Button>

        <Card className="rounded-[2rem] border-[#D7DEEA] bg-white shadow-xl shadow-[#1A2E5A]/10">
          <CardHeader className="border-b border-[#D7DEEA] p-8">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-[#1A2E5A] p-4 text-white">
                <HardHat className="size-7" />
              </div>
              <div>
                <CardDescription className="font-semibold uppercase tracking-[0.18em] text-[#1E4FAB]">
                  Cadastro
                </CardDescription>
                <CardTitle className="mt-1 text-3xl font-bold text-[#1A2E5A]">
                  Nova obra
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
              <Field label="Nome da obra" error={errors.nome}>
                <Input
                  value={form.nome}
                  onChange={(event) => updateField("nome", event.target.value)}
                  placeholder="Residencial Jardim Villa"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <Field label="Empresa vinculada" error={errors.empresaId}>
                <Select
                  items={empresaItems}
                  value={form.empresaId}
                  onValueChange={(value) =>
                    updateField("empresaId", String(value ?? ""))
                  }
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
              </Field>

              <Field label="Cidade" error={errors.cidade}>
                <Input
                  value={form.cidade}
                  onChange={(event) =>
                    updateField("cidade", event.target.value)
                  }
                  placeholder="Sao Paulo"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <Field label="Estado" error={errors.estado}>
                <Select
                  items={estadoItems}
                  value={form.estado}
                  onValueChange={(value) =>
                    updateField("estado", String(value ?? ""))
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {estados.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Volume estimado (m3)" error={errors.volumeEstimado}>
                <Input
                  value={form.volumeEstimado ?? ""}
                  onChange={(event) =>
                    updateField("volumeEstimado", event.target.value)
                  }
                  placeholder="250"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <Field label="Status" error={errors.status}>
                <Select
                  items={statusOptions}
                  value={form.status}
                  onValueChange={(value) =>
                    updateField("status", String(value ?? ""))
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Data inicio" error={errors.dataInicio}>
                <Input
                  type="date"
                  value={form.dataInicio ?? ""}
                  onChange={(event) =>
                    updateField("dataInicio", event.target.value)
                  }
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <Field label="Data fim" error={errors.dataTermino}>
                <Input
                  type="date"
                  value={form.dataTermino ?? ""}
                  onChange={(event) =>
                    updateField("dataTermino", event.target.value)
                  }
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <div className="flex flex-col-reverse gap-3 pt-2 md:col-span-2 md:flex-row md:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  render={<Link href="/obras" />}
                  className="h-11 rounded-2xl border-[#D7DEEA]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 rounded-2xl bg-[#1A2E5A] px-6 text-white hover:bg-[#1E4FAB]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Cadastrar obra"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
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
    <label className={className}>
      <span className="text-sm font-semibold text-[#1A2E5A]">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </label>
  );
}
