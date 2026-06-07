"use client";

import { useMemo, useState } from "react";
import { Bot, Clipboard, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { gerarPromptCompleto } from "@/lib/agentes";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type AgenteConfigView = {
  id: string;
  agente: "MARIA" | "JOAO";
  nome: string;
  descricao: string;
  personalidade: string;
  regrasQuente: string;
  regrasMedia: string;
  regrasFria: string;
  ignorar: string;
  exemplosLead: string;
  exemplosNaoLead: string;
  historicoErros: string;
  promptCompleto: string;
  ativo: boolean;
  atualizadoEm: string;
  atualizadoPor: string | null;
};

type AgentesClientProps = {
  initialConfigs: AgenteConfigView[];
};

type EditableAgenteConfig = Omit<
  AgenteConfigView,
  "id" | "agente" | "nome" | "promptCompleto" | "atualizadoEm" | "atualizadoPor"
>;

const agenteOrder: Array<AgenteConfigView["agente"]> = ["MARIA", "JOAO"];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildCorrectionEntry(text: string) {
  return [
    `### ${new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date())}`,
    text.trim(),
  ].join("\n");
}

function toEditable(config: AgenteConfigView): EditableAgenteConfig {
  return {
    descricao: config.descricao,
    personalidade: config.personalidade,
    regrasQuente: config.regrasQuente,
    regrasMedia: config.regrasMedia,
    regrasFria: config.regrasFria,
    ignorar: config.ignorar,
    exemplosLead: config.exemplosLead,
    exemplosNaoLead: config.exemplosNaoLead,
    historicoErros: config.historicoErros,
    ativo: config.ativo,
  };
}

export function AgentesClient({ initialConfigs }: AgentesClientProps) {
  const initialByAgente = useMemo(
    () =>
      Object.fromEntries(
        initialConfigs.map((config) => [config.agente, config]),
      ) as Record<AgenteConfigView["agente"], AgenteConfigView>,
    [initialConfigs],
  );
  const [activeAgente, setActiveAgente] =
    useState<AgenteConfigView["agente"]>("MARIA");
  const [configs, setConfigs] = useState(initialByAgente);
  const [forms, setForms] = useState(() => ({
    MARIA: toEditable(initialByAgente.MARIA),
    JOAO: toEditable(initialByAgente.JOAO),
  }));
  const [correctionDrafts, setCorrectionDrafts] = useState({
    MARIA: "",
    JOAO: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const config = configs[activeAgente];
  const form = forms[activeAgente];
  const correctionDraft = correctionDrafts[activeAgente];
  const promptCompleto = gerarPromptCompleto({
    nome: config.nome,
    descricao: form.descricao,
    personalidade: form.personalidade,
    regrasQuente: form.regrasQuente,
    regrasMedia: form.regrasMedia,
    regrasFria: form.regrasFria,
    ignorar: form.ignorar,
    exemplosLead: form.exemplosLead,
    exemplosNaoLead: form.exemplosNaoLead,
    historicoErros: form.historicoErros,
  });

  function updateField<K extends keyof EditableAgenteConfig>(
    field: K,
    value: EditableAgenteConfig[K],
  ) {
    setForms((current) => ({
      ...current,
      [activeAgente]: {
        ...current[activeAgente],
        [field]: value,
      },
    }));
  }

  function appendCorrection() {
    if (!correctionDraft.trim()) {
      toast.error("Escreva a correcao antes de adicionar ao historico.");
      return;
    }

    const nextHistorico = [form.historicoErros, buildCorrectionEntry(correctionDraft)]
      .filter(Boolean)
      .join("\n\n");

    updateField("historicoErros", nextHistorico);
    setCorrectionDrafts((current) => ({
      ...current,
      [activeAgente]: "",
    }));
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptCompleto);
      toast.success("Prompt copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o prompt.");
    }
  }

  async function saveConfig() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/agentes/${activeAgente}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Falha ao atualizar agente.");
      }

      const updatedConfig = (await response.json()) as AgenteConfigView;
      const normalizedConfig = {
        ...updatedConfig,
        agente: updatedConfig.agente as AgenteConfigView["agente"],
      };

      setConfigs((current) => ({
        ...current,
        [activeAgente]: normalizedConfig,
      }));
      setForms((current) => ({
        ...current,
        [activeAgente]: toEditable(normalizedConfig),
      }));
      toast.success(`Cerebro da ${config.nome} atualizado.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar o agente.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Agentes" currentHref="/admin/agentes" />

        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Administracao
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
              Cerebro dos Agentes
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Configure o comportamento e criterios de cada agente de IA da
              Villa.
            </p>
          </div>
          <Badge
            className={
              config.ativo
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-700"
            }
          >
            {config.ativo ? "Ativo" : "Inativo"}
          </Badge>
        </header>

        <section className="mt-8 flex flex-wrap gap-3" role="tablist">
          {agenteOrder.map((agente) => {
            const item = configs[agente];
            const isActive = activeAgente === agente;

            return (
              <button
                key={agente}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveAgente(agente)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                  isActive
                    ? "border-[#1A2E5A] bg-[#1A2E5A] text-white"
                    : "border-[#D7DEEA] bg-white text-[#1A2E5A] hover:bg-[#E8EEFB]"
                }`}
              >
                <Bot className="size-4" />
                {item.nome}
              </button>
            );
          })}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Card className="rounded-3xl border-[#D7DEEA] bg-white">
              <CardHeader>
                <CardTitle className="text-xl text-[#1A2E5A]">
                  Identidade
                </CardTitle>
                <CardDescription>
                  Dados basicos e status operacional do agente.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Nome do agente">
                  <Input value={config.nome} readOnly className="h-11 bg-[#F4F6FA]" />
                </Field>
                <Field label="Status">
                  <button
                    type="button"
                    onClick={() => updateField("ativo", !form.ativo)}
                    className={`h-11 rounded-2xl border px-4 text-left text-sm font-semibold transition ${
                      form.ativo
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-zinc-300 bg-zinc-50 text-zinc-700"
                    }`}
                  >
                    {form.ativo ? "Ativo" : "Inativo"}
                  </button>
                </Field>
                <Field label="Descricao" className="md:col-span-2">
                  <Textarea
                    value={form.descricao}
                    onChange={(event) =>
                      updateField("descricao", event.target.value)
                    }
                    className="min-h-24 rounded-2xl"
                  />
                </Field>
              </CardContent>
            </Card>

            <FormSection
              title="Personalidade"
              description={`Como ${config.nome} se comporta e se comunica.`}
            >
              <Textarea
                value={form.personalidade}
                onChange={(event) =>
                  updateField("personalidade", event.target.value)
                }
                className="min-h-28 rounded-2xl"
              />
            </FormSection>

            <Card className="rounded-3xl border-[#D7DEEA] bg-white">
              <CardHeader>
                <CardTitle className="text-xl text-[#1A2E5A]">
                  Regras de Qualificacao
                </CardTitle>
                <CardDescription>
                  Use uma regra por linha para orientar a classificacao.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-3">
                <Field label="QUENTE">
                  <Textarea
                    value={form.regrasQuente}
                    onChange={(event) =>
                      updateField("regrasQuente", event.target.value)
                    }
                    className="min-h-36 rounded-2xl border-red-200 bg-red-50/40"
                  />
                </Field>
                <Field label="MEDIA">
                  <Textarea
                    value={form.regrasMedia}
                    onChange={(event) =>
                      updateField("regrasMedia", event.target.value)
                    }
                    className="min-h-36 rounded-2xl border-amber-200 bg-amber-50/40"
                  />
                </Field>
                <Field label="FRIA">
                  <Textarea
                    value={form.regrasFria}
                    onChange={(event) =>
                      updateField("regrasFria", event.target.value)
                    }
                    className="min-h-36 rounded-2xl border-blue-200 bg-blue-50/40"
                  />
                </Field>
              </CardContent>
            </Card>

            <FormSection
              title="O que ignorar"
              description={`Tipos de contato que ${config.nome} deve ignorar completamente.`}
            >
              <Textarea
                value={form.ignorar}
                onChange={(event) => updateField("ignorar", event.target.value)}
                className="min-h-28 rounded-2xl"
              />
            </FormSection>

            <Card className="rounded-3xl border-[#D7DEEA] bg-white">
              <CardHeader>
                <CardTitle className="text-xl text-[#1A2E5A]">
                  Exemplos
                </CardTitle>
                <CardDescription>
                  Exemplos ajudam o agente a separar leads reais de ruido.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <Field label="Exemplos de leads reais">
                  <Textarea
                    value={form.exemplosLead}
                    onChange={(event) =>
                      updateField("exemplosLead", event.target.value)
                    }
                    className="min-h-36 rounded-2xl"
                  />
                </Field>
                <Field label="Exemplos de nao-leads">
                  <Textarea
                    value={form.exemplosNaoLead}
                    onChange={(event) =>
                      updateField("exemplosNaoLead", event.target.value)
                    }
                    className="min-h-36 rounded-2xl"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-[#D7DEEA] bg-white">
              <CardHeader>
                <CardTitle className="text-xl text-[#1A2E5A]">
                  Historico de Correcoes
                </CardTitle>
                <CardDescription>
                  Registro manual append-only: adicione novas correcoes sem
                  apagar o historico anterior.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Historico atual">
                  <Textarea
                    value={form.historicoErros}
                    readOnly
                    placeholder="Nenhuma correcao registrada."
                    className="min-h-36 rounded-2xl bg-[#F4F6FA]"
                  />
                </Field>
                <Field label="Adicionar nova correcao">
                  <Textarea
                    value={correctionDraft}
                    onChange={(event) =>
                      setCorrectionDrafts((current) => ({
                        ...current,
                        [activeAgente]: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Maria classificou fornecedor como lead. Corrigir para ignorar fornecedores."
                    className="min-h-24 rounded-2xl"
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  onClick={appendCorrection}
                  className="rounded-2xl"
                >
                  Adicionar ao historico
                </Button>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="sticky top-6 rounded-3xl border-[#D7DEEA] bg-white">
              <CardHeader>
                <CardTitle className="text-xl text-[#1A2E5A]">
                  Prompt completo
                </CardTitle>
                <CardDescription>
                  Gerado automaticamente conforme os campos sao editados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={promptCompleto}
                  readOnly
                  className="min-h-[520px] rounded-2xl bg-[#F4F6FA] font-mono text-xs"
                />
                <div className="flex flex-col gap-2 text-xs text-[#667085]">
                  <span>Atualizado em: {formatDateTime(config.atualizadoEm)}</span>
                  <span>
                    Atualizado por: {config.atualizadoPor ?? "Nao registrado"}
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyPrompt}
                    className="flex-1 rounded-2xl"
                  >
                    <Clipboard className="size-4" />
                    Copiar prompt
                  </Button>
                  <Button
                    type="button"
                    onClick={saveConfig}
                    disabled={isSaving}
                    className="flex-1 rounded-2xl bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]"
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    Atualizar cerebro da {config.nome}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
        {label}
      </span>
      {children}
    </label>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-[#D7DEEA] bg-white">
      <CardHeader>
        <CardTitle className="text-xl text-[#1A2E5A]">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
