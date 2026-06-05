"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Loader2, Send, Truck } from "lucide-react";

type FormState = {
  nome: string;
  telefone: string;
  tipoNecessidade: string;
  cidadeObra: string;
  prazo: string;
  volumeEstimado: string;
  email: string;
  empresa: string;
  mensagem: string;
};

const initialState: FormState = {
  nome: "",
  telefone: "",
  tipoNecessidade: "",
  cidadeObra: "",
  prazo: "",
  volumeEstimado: "",
  email: "",
  empresa: "",
  mensagem: "",
};

const tiposNecessidade = [
  "Bomba de concreto",
  "Betoneira",
  "Central de concreto",
  "Telebelt",
  "Não sei ainda",
];

const prazos = [
  "Imediato (preciso agora)",
  "Até 30 dias",
  "30 a 60 dias",
  "Mais de 60 dias",
];

export default function ContatoPublicoPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"success" | "error" | null>(null);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.tipoNecessidade || !form.prazo) {
      setStatus("error");
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/webhook/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          telefone: form.telefone,
          tipoNecessidade: form.tipoNecessidade,
          cidadeObra: form.cidadeObra,
          prazo: form.prazo,
          volumeEstimado: form.volumeEstimado || undefined,
          email: form.email || undefined,
          empresa: form.empresa || undefined,
          mensagem: form.mensagem || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao enviar formulário.");
      }

      setForm(initialState);
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F6FA] text-[#1A2E5A]">
      <section className="mx-auto grid min-h-screen max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="rounded-[2rem] bg-[#1A2E5A] p-8 text-white shadow-xl shadow-[#1A2E5A]/20">
          <div className="inline-flex rounded-2xl bg-white p-3 text-[#1A2E5A]">
            <Truck className="size-7" />
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
            Villa Empreendimentos
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            Fale com a equipe comercial da Villa
          </h1>
          <p className="mt-5 text-base leading-7 text-white/75">
            Conte sua necessidade de obra, bomba, betoneira ou central. Nossa
            equipe recebe o contato direto no CRM e retorna em até 2 horas.
          </p>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-5">
            <p className="font-semibold">Atendimento comercial</p>
            <p className="mt-2 text-sm text-white/70">
              Informe telefone ou WhatsApp para agilizar o retorno.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] border border-[#D7DEEA] bg-white p-6 shadow-xl shadow-[#1A2E5A]/10 sm:p-8"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Formulário de contato
            </p>
            <h2 className="mt-3 text-3xl font-bold">Envie sua mensagem</h2>
            <p className="mt-2 text-sm leading-6 text-[#667085]">
              Os campos principais são obrigatórios para que a Maria registre o
              lead e acione o comercial.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" required>
              <input
                required
                value={form.nome}
                onChange={(event) => updateField("nome", event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 outline-none focus:border-[#1E4FAB]"
                placeholder="Seu nome"
              />
            </Field>

            <Field label="Telefone / WhatsApp" required>
              <input
                required
                value={form.telefone}
                onChange={(event) => updateField("telefone", event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 outline-none focus:border-[#1E4FAB]"
                placeholder="(81) 99999-9999"
              />
            </Field>

            <Field label="Tipo de necessidade" required className="sm:col-span-2">
              <ButtonSelector
                options={tiposNecessidade}
                value={form.tipoNecessidade}
                onChange={(value) => updateField("tipoNecessidade", value)}
              />
            </Field>

            <Field label="Cidade da obra" required>
              <input
                required
                value={form.cidadeObra}
                onChange={(event) =>
                  updateField("cidadeObra", event.target.value)
                }
                className="h-12 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 outline-none focus:border-[#1E4FAB]"
                placeholder="Ex.: Recife, PE"
              />
            </Field>

            <Field label="Prazo" required className="sm:col-span-2">
              <ButtonSelector
                options={prazos}
                value={form.prazo}
                onChange={(value) => updateField("prazo", value)}
              />
            </Field>

            <Field label="Volume estimado">
              <input
                value={form.volumeEstimado}
                onChange={(event) =>
                  updateField("volumeEstimado", event.target.value)
                }
                className="h-12 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 outline-none focus:border-[#1E4FAB]"
                placeholder="Ex.: 500 m³/mês"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 outline-none focus:border-[#1E4FAB]"
                placeholder="seu@email.com"
              />
            </Field>

            <Field label="Empresa">
              <input
                value={form.empresa}
                onChange={(event) => updateField("empresa", event.target.value)}
                className="h-12 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 outline-none focus:border-[#1E4FAB]"
                placeholder="Nome da empresa"
              />
            </Field>

            <Field label="Mensagem adicional" className="sm:col-span-2">
              <textarea
                value={form.mensagem}
                onChange={(event) => updateField("mensagem", event.target.value)}
                className="min-h-24 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-3 outline-none focus:border-[#1E4FAB]"
                placeholder="Detalhes adicionais sobre a obra, acesso ou operação..."
              />
            </Field>
          </div>

          {status === "success" ? (
            <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              Mensagem enviada! Retornaremos em até 2 horas.
            </p>
          ) : null}

          {status === "error" ? (
            <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
              Ocorreu um erro. Tente novamente ou ligue diretamente.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#1E4FAB] px-5 font-semibold text-white transition hover:bg-[#1A2E5A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Enviar mensagem
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}

function ButtonSelector({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
              isSelected
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-[#D7DEEA] bg-white text-[#1A2E5A] hover:bg-[#F4F6FA]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-2 block text-sm font-semibold text-[#1A2E5A]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
