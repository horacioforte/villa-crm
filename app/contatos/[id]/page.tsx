"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
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
import { contatoSchema, type ContatoInput } from "@/lib/validations/contato";

type EmpresaOption = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
};

type ContatoDetalhe = {
  id: string;
  nome: string;
  empresaId: string;
  cargo: string | null;
  tipoCargo: string | null;
  whatsapp: string | null;
  email: string | null;
  influenciaDecisao:
    | "DECISOR"
    | "INFLUENCIADOR"
    | "TECNICO"
    | "OPERACIONAL"
    | "BLOQUEADOR";
  nivelRelacionamento: "FRIO" | "NEUTRO" | "BOM" | "EXCELENTE";
  aniversario: string | null;
};

const initialForm: ContatoInput = {
  nome: "",
  empresaId: "",
  cargo: "",
  tipoCargo: "",
  whatsapp: "",
  email: "",
  influenciaDecisao: "INFLUENCIADOR",
  nivelRelacionamento: "NEUTRO",
  aniversario: "",
};

const tipoCargoOptions = [
  "Diretoria",
  "Engenharia",
  "Compras",
  "Operacao",
  "Financeiro",
  "Administrativo",
  "Outro",
];

const influenciaOptions = [
  { value: "DECISOR", label: "Decisor" },
  { value: "INFLUENCIADOR", label: "Influenciador" },
  { value: "TECNICO", label: "Tecnico" },
  { value: "OPERACIONAL", label: "Operacional" },
  { value: "BLOQUEADOR", label: "Bloqueador" },
] as const;

const relacionamentoOptions = [
  { value: "FRIO", label: "Frio" },
  { value: "NEUTRO", label: "Neutro" },
  { value: "BOM", label: "Bom" },
  { value: "EXCELENTE", label: "Excelente" },
] as const;

type FieldErrors = Partial<Record<keyof ContatoInput, string>>;

function formatDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

export default function ContatoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<ContatoInput>(initialForm);
  const [contato, setContato] = useState<ContatoDetalhe | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [contatoResponse, empresasResponse] = await Promise.all([
          fetch(`/api/contatos/${params.id}`),
          fetch("/api/empresas"),
        ]);

        if (!contatoResponse.ok) {
          throw new Error("Falha ao carregar contato.");
        }

        if (!empresasResponse.ok) {
          throw new Error("Falha ao carregar empresas.");
        }

        const [contatoData, empresasData]: [ContatoDetalhe, EmpresaOption[]] =
          await Promise.all([contatoResponse.json(), empresasResponse.json()]);

        setContato(contatoData);
        setEmpresas(empresasData);
        setForm({
          nome: contatoData.nome ?? "",
          empresaId: contatoData.empresaId ?? "",
          cargo: contatoData.cargo ?? "",
          tipoCargo: contatoData.tipoCargo ?? "",
          whatsapp: contatoData.whatsapp ?? "",
          email: contatoData.email ?? "",
          influenciaDecisao: contatoData.influenciaDecisao,
          nivelRelacionamento: contatoData.nivelRelacionamento,
          aniversario: formatDateInput(contatoData.aniversario),
        });
      } catch {
        toast.error("Nao foi possivel carregar o contato.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [params.id]);

  function updateField(field: keyof ContatoInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const data = contatoSchema.parse(form);
      const response = await fetch(`/api/contatos/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao salvar contato.");
      }

      const savedContato: ContatoDetalhe = await response.json();
      setContato(savedContato);
      toast.success("Contato atualizado com sucesso.");
      router.push("/contatos");
      router.refresh();
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldErrors: FieldErrors = {};

        for (const issue of error.issues) {
          const field = issue.path[0] as keyof ContatoInput | undefined;

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
            : "Nao foi possivel salvar o contato.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageNavigation currentPage={contato?.nome ?? "Contato"} currentHref="/contatos" />
        <Button
          variant="ghost"
          render={<Link href="/contatos" />}
          className="mb-6 text-[#1A2E5A] hover:bg-[#E8EEFB]"
        >
          <ArrowLeft className="size-4" />
          Voltar para contatos
        </Button>

        <Card className="rounded-[2rem] border-[#D7DEEA] bg-white shadow-xl shadow-[#1A2E5A]/10">
          <CardHeader className="border-b border-[#D7DEEA] p-8">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-[#1A2E5A] p-4 text-white">
                <UserRound className="size-7" />
              </div>
              <div>
                <CardDescription className="font-semibold uppercase tracking-[0.18em] text-[#1E4FAB]">
                  Cadastro
                </CardDescription>
                <CardTitle className="mt-1 text-3xl font-bold text-[#1A2E5A]">
                  {isLoading ? "Carregando contato..." : "Editar contato"}
                </CardTitle>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-[#667085]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando cadastro...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
                <Field label="Nome" error={errors.nome}>
                  <Input
                    value={form.nome}
                    onChange={(event) => updateField("nome", event.target.value)}
                    placeholder="Maria Oliveira"
                    className="h-11 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>

                <Field label="Empresa" error={errors.empresaId}>
                  <Select
                    value={form.empresaId}
                    onValueChange={(value) =>
                      updateField("empresaId", value ?? "")
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

                <Field label="Cargo" error={errors.cargo}>
                  <Input
                    value={form.cargo ?? ""}
                    onChange={(event) => updateField("cargo", event.target.value)}
                    placeholder="Gerente de obras"
                    className="h-11 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>

                <Field label="Tipo cargo" error={errors.tipoCargo}>
                  <Select
                    value={form.tipoCargo ?? ""}
                    onValueChange={(value) =>
                      updateField("tipoCargo", value ?? "")
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoCargoOptions.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="WhatsApp" error={errors.whatsapp}>
                  <Input
                    value={form.whatsapp ?? ""}
                    onChange={(event) =>
                      updateField("whatsapp", event.target.value)
                    }
                    placeholder="(11) 99999-9999"
                    className="h-11 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>

                <Field label="Email" error={errors.email}>
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="contato@empresa.com.br"
                    className="h-11 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>

                <Field
                  label="Influencia na decisao"
                  error={errors.influenciaDecisao}
                >
                  <Select
                    value={form.influenciaDecisao ?? "INFLUENCIADOR"}
                    onValueChange={(value) =>
                      updateField("influenciaDecisao", value ?? "")
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione a influencia" />
                    </SelectTrigger>
                    <SelectContent>
                      {influenciaOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field
                  label="Nivel relacionamento"
                  error={errors.nivelRelacionamento}
                >
                  <Select
                    value={form.nivelRelacionamento ?? "NEUTRO"}
                    onValueChange={(value) =>
                      updateField("nivelRelacionamento", value ?? "")
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl bg-[#F4F6FA]">
                      <SelectValue placeholder="Selecione o nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      {relacionamentoOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Aniversario" error={errors.aniversario}>
                  <Input
                    type="date"
                    value={String(form.aniversario ?? "")}
                    onChange={(event) =>
                      updateField("aniversario", event.target.value)
                    }
                    className="h-11 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>

                <div className="flex flex-col-reverse gap-3 pt-2 md:col-span-2 md:flex-row md:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    render={<Link href="/contatos" />}
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
                      "Salvar contato"
                    )}
                  </Button>
                </div>
              </form>
            )}
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
