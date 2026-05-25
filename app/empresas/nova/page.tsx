"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ZodError } from "zod";

import { Button } from "@/components/ui/button";
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
import {
  empresaSchema,
  type EmpresaInput,
} from "@/lib/validations/empresa";

const segmentos = [
  "Construcao civil",
  "Incorporadora",
  "Concreteira",
  "Construtora",
  "Locadora",
  "Industria",
  "Outro",
];

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

const initialForm: EmpresaInput = {
  nomeFantasia: "",
  razaoSocial: "",
  cnpj: "",
  segmento: "",
  cidade: "",
  estado: "",
  responsavel: "",
};

type FieldErrors = Partial<Record<keyof EmpresaInput, string>>;

export default function NovaEmpresaPage() {
  const router = useRouter();
  const [form, setForm] = useState<EmpresaInput>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof EmpresaInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const data = empresaSchema.parse(form);
      const response = await fetch("/api/empresas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao cadastrar empresa.");
      }

      toast.success("Empresa cadastrada com sucesso.");
      router.push("/empresas");
      router.refresh();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: FieldErrors = {};

        for (const issue of error.issues) {
          const field = issue.path[0] as keyof EmpresaInput | undefined;

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
            : "Nao foi possivel cadastrar a empresa.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Button
          variant="ghost"
          render={<Link href="/empresas" />}
          className="mb-6 text-[#1A2E5A] hover:bg-[#E8EEFB]"
        >
          <ArrowLeft className="size-4" />
          Voltar para empresas
        </Button>

        <Card className="rounded-[2rem] border-[#D7DEEA] bg-white shadow-xl shadow-[#1A2E5A]/10">
          <CardHeader className="border-b border-[#D7DEEA] p-8">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-[#1A2E5A] p-4 text-white">
                <Building2 className="size-7" />
              </div>
              <div>
                <CardDescription className="font-semibold uppercase tracking-[0.18em] text-[#1E4FAB]">
                  Cadastro
                </CardDescription>
                <CardTitle className="mt-1 text-3xl font-bold text-[#1A2E5A]">
                  Nova empresa
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
              <Field label="Nome fantasia" error={errors.nomeFantasia}>
                <Input
                  value={form.nomeFantasia}
                  onChange={(event) =>
                    updateField("nomeFantasia", event.target.value)
                  }
                  placeholder="Villa Obras"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <Field label="Razao social" error={errors.razaoSocial}>
                <Input
                  value={form.razaoSocial}
                  onChange={(event) =>
                    updateField("razaoSocial", event.target.value)
                  }
                  placeholder="Villa Obras Ltda"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <Field label="CNPJ" error={errors.cnpj}>
                <Input
                  value={form.cnpj ?? ""}
                  onChange={(event) => updateField("cnpj", event.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <Field label="Segmento" error={errors.segmento}>
                <Select
                  value={form.segmento}
                  onValueChange={(value) =>
                    updateField("segmento", value ?? "")
                  }
                >
                  <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentos.map((segmento) => (
                      <SelectItem key={segmento} value={segmento}>
                        {segmento}
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
                  value={form.estado}
                  onValueChange={(value) => updateField("estado", value ?? "")}
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

              <Field
                label="Responsavel comercial"
                error={errors.responsavel}
                className="md:col-span-2"
              >
                <Input
                  value={form.responsavel}
                  onChange={(event) =>
                    updateField("responsavel", event.target.value)
                  }
                  placeholder="Nome do responsavel"
                  className="h-11 rounded-2xl bg-[#F4F6FA]"
                />
              </Field>

              <div className="flex flex-col-reverse gap-3 pt-2 md:col-span-2 md:flex-row md:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  render={<Link href="/empresas" />}
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
                    "Cadastrar empresa"
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
