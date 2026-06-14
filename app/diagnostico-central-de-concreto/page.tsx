"use client";

import { useMemo, useState } from "react";

type Option = {
  v: string;
  s: number;
  icon: string;
  label: string;
  desc: string;
};

type Question = {
  id: number;
  title: string;
  sub: string;
  note?: string;
  opts: Option[];
};

type Answers = Record<number, Option>;
type Profile = "verde" | "laranja" | "azul";

const QUESTIONS: Question[] = [
  {
    id: 1,
    title: "Qual o volume total estimado de concreto da obra?",
    sub: "Considere o volume total do projeto, do início ao fim.",
    opts: [
      { v: "a", s: 0, icon: "🏠", label: "Menos de 5.000 m³", desc: "Obras de pequeno porte" },
      { v: "b", s: 10, icon: "🏗️", label: "Entre 5.000 e 15.000 m³", desc: "Médio porte — edifícios, galpões" },
      { v: "c", s: 25, icon: "🏢", label: "Entre 15.000 e 30.000 m³", desc: "Grande porte — empreendimentos, indústria" },
      { v: "d", s: 35, icon: "🏭", label: "Acima de 30.000 m³", desc: "Mega obras, infraestrutura" },
    ],
  },
  {
    id: 2,
    title: "Qual será o consumo médio mensal de concreto?",
    sub: "Estime o volume médio por mês durante o período de obras.",
    opts: [
      { v: "a", s: 0, icon: "📉", label: "Menos de 500 m³/mês", desc: "Volume baixo para central exclusiva" },
      { v: "b", s: 5, icon: "📊", label: "Entre 500 e 1.500 m³/mês", desc: "Volume em análise de viabilidade" },
      { v: "c", s: 20, icon: "📈", label: "Entre 1.500 e 3.000 m³/mês", desc: "Volume adequado para central própria" },
      { v: "d", s: 25, icon: "🚀", label: "Acima de 3.000 m³/mês", desc: "Alto volume — excelente perfil" },
    ],
  },
  {
    id: 3,
    title: "Qual o prazo previsto para início do fornecimento?",
    sub: "Quando você precisa que a central esteja operando?",
    note: "⚠️ A implantação de uma central exclusiva exige pelo menos 30 dias de preparação.",
    opts: [
      { v: "a", s: 0, icon: "⚠️", label: "Menos de 30 dias", desc: "Prazo abaixo do mínimo para implantação" },
      { v: "b", s: 20, icon: "⚡", label: "Entre 30 e 60 dias", desc: "Prazo justo — mobilização imediata" },
      { v: "c", s: 15, icon: "📅", label: "Entre 60 e 120 dias", desc: "Prazo confortável para planejamento" },
      { v: "d", s: 5, icon: "🔭", label: "Acima de 120 dias", desc: "Projeto em fase de planejamento" },
    ],
  },
  {
    id: 4,
    title: "Qual o tipo da obra?",
    sub: "O tipo influencia no dimensionamento e na solução ideal.",
    opts: [
      { v: "a", s: 10, icon: "🏘️", label: "Residencial", desc: "Condomínios, edifícios, habitações" },
      { v: "b", s: 15, icon: "🏭", label: "Industrial", desc: "Fábricas, galpões, centros logísticos" },
      { v: "c", s: 20, icon: "🛣️", label: "Infraestrutura", desc: "Rodovias, pontes, barragens, metrô" },
      { v: "d", s: 15, icon: "⬛", label: "Piso industrial / logístico", desc: "Pisos de alto desempenho, armazéns" },
    ],
  },
  {
    id: 5,
    title: "Você é responsável pela decisão sobre o fornecimento de concreto?",
    sub: "Isso nos ajuda a direcionar o atendimento corretamente.",
    opts: [
      { v: "a", s: 0, icon: "👤", label: "Não", desc: "Não participo diretamente desta decisão" },
      { v: "b", s: 10, icon: "🤝", label: "Influencio parcialmente", desc: "Participo mas não decido sozinho" },
      { v: "c", s: 20, icon: "✅", label: "Sim, sou o responsável", desc: "Tenho autonomia na decisão de fornecimento" },
    ],
  },
];

function getProfile(score: number): Profile {
  if (score >= 70) return "verde";
  if (score >= 40) return "laranja";
  return "azul";
}

function getProfileTemperature(profile: Profile) {
  return {
    verde: "QUENTE",
    laranja: "MEDIA",
    azul: "FRIA",
  }[profile];
}

const resultConfig = {
  verde: {
    className: "bg-[#2e7d32]",
    icon: "✅",
    title: "suas respostas indicam um perfil promissor!",
    subtitle:
      "Nossa equipe vai analisar seu diagnóstico e entrar em contato em até 2 horas informando se sua obra tem perfil para uma central exclusiva.",
    aviso:
      "Você receberá uma avaliação completa por WhatsApp, confirmando se sua obra cabe ou não em uma central própria — e qual a solução mais indicada.",
  },
  laranja: {
    className: "bg-[#e65100]",
    icon: "📋",
    title: "recebemos seu diagnóstico!",
    subtitle:
      "Nossa equipe técnica vai analisar suas respostas e entrar em contato informando se há viabilidade para uma central exclusiva na sua obra.",
    aviso:
      "Você receberá uma avaliação por WhatsApp, confirmando se sua obra cabe ou não em uma central própria — e qual a alternativa mais adequada ao seu caso.",
  },
  azul: {
    className: "bg-[#0b487f]",
    icon: "📩",
    title: "recebemos seu diagnóstico!",
    subtitle:
      "Nossa equipe vai analisar suas respostas e entrar em contato com a avaliação e as soluções mais indicadas para o porte da sua obra.",
    aviso:
      "Você receberá um retorno por WhatsApp informando se uma central exclusiva cabe no seu projeto — ou qual equipamento é mais adequado para você.",
  },
};

export default function DiagnosticoCentralDeConcretoPage() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    empresa: "",
    telefone: "",
    email: "",
    cidade: "",
    cargo: "",
  });

  const score = useMemo(
    () => Object.values(answers).reduce((total, answer) => total + answer.s, 0),
    [answers],
  );
  const profile = getProfile(score);
  const progress = submitted ? 100 : Math.round(((step - 1) / 6) * 100);
  const currentQuestion = QUESTIONS.find((question) => question.id === step);

  function pick(questionId: number, option: Option) {
    setAnswers((current) => ({
      ...current,
      [questionId]: option,
    }));
  }

  function next() {
    if (step <= QUESTIONS.length && !answers[step]) return;
    setStep((current) => Math.min(current + 1, 6));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((current) => Math.max(current - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!form.nome || !form.empresa || !form.telefone || !form.cidade) {
      alert("Preencha Nome, Empresa, WhatsApp e Cidade da obra.");
      return;
    }

    setIsSubmitting(true);

    try {
      await fetch("https://villa-crm.vercel.app/api/contato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          empresa: form.empresa,
          telefone: form.telefone,
          email: form.email,
          cidade: form.cidade,
          cargo: form.cargo,
          canal: "LANDING_CENTRAL",
          temperatura: getProfileTemperature(profile),
          score,
          volume_total: answers[1]?.label || "",
          volume_mensal: answers[2]?.label || "",
          prazo: answers[3]?.label || "",
          tipo_obra: answers[4]?.label || "",
          decisor: answers[5]?.label || "",
          mensagem: [
            "Diagnóstico Central de Concreto",
            `• Volume total: ${answers[1]?.label}`,
            `• Volume mensal: ${answers[2]?.label}`,
            `• Prazo: ${answers[3]?.label}`,
            `• Tipo: ${answers[4]?.label}`,
            `• Decisor: ${answers[5]?.label}`,
            `• Score interno: ${score}/100 | Perfil: ${getProfileTemperature(profile)}`,
          ].join("\n"),
          origem: "landing-central-concreto",
        }),
        mode: "no-cors",
      });
    } catch (error) {
      console.warn("Webhook:", error);
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setIsSubmitting(false);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function openWhatsapp() {
    const msg = [
      "Olá! Enviei o diagnóstico de Central de Concreto no site da Villa.",
      `• Volume: ${answers[1]?.label}`,
      `• Mensal: ${answers[2]?.label}`,
      `• Prazo: ${answers[3]?.label}`,
      `• Tipo: ${answers[4]?.label}`,
      "",
      "Aguardo o retorno da avaliação!",
    ].join("\n");

    window.open(
      `https://api.whatsapp.com/send?phone=5581985595931&text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const result = resultConfig[profile];

  return (
    <main className="min-h-screen bg-[#f8fafc] font-sans text-slate-800">
      <nav className="flex items-center justify-between border-b border-white/5 bg-[#00304c] px-6 py-3.5">
        <a
          href="https://villaempreendimentos.com.br"
          target="_blank"
          rel="noreferrer"
          className="text-lg font-bold text-white transition hover:opacity-80"
        >
          Villa <span className="text-[#7ab8f5]">Empreendimentos</span>
        </a>
        <a
          href="tel:+558133251144"
          className="flex items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-white/10">📞</span>
          (81) 3325-1144
        </a>
      </nav>

      {started ? (
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0b487f]">
              Diagnóstico — Central de Concreto
            </span>
            <span className="font-medium text-slate-400">
              {submitted ? "Diagnóstico enviado ✓" : step <= 5 ? `Pergunta ${step} de 5` : "Seus dados"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0b487f] to-[#7ab8f5] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {!submitted ? (
            <div className="mt-3 flex justify-between gap-1">
              {[1, 2, 3, 4, 5, 6].map((dot) => (
                <span
                  key={dot}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    dot < step
                      ? "bg-[#0b487f]"
                      : dot === step
                        ? "bg-[#7ab8f5]"
                        : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!started ? (
        <section className="relative overflow-hidden bg-gradient-to-b from-[#00304c] to-[#0b487f] px-6 py-20 text-center text-white">
          <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:40px_40px]" />
          <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-[#7ab8f5]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 size-96 rounded-full bg-[#f57c00]/10 blur-3xl" />
          <div className="relative mx-auto max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/90 shadow-sm">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#f57c00] text-[10px]">✦</span>
              Diagnóstico gratuito · menos de 2 minutos
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight md:text-6xl">
              Será que sua obra não cabe uma{" "}
              <span className="bg-gradient-to-r from-[#7ab8f5] to-[#a9d4ff] bg-clip-text text-transparent">
                central de concreto própria?
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/80">
              Descubra se a implantação de uma central exclusiva pode reduzir custos,
              aumentar a produtividade e garantir o abastecimento da sua obra.
            </p>
            <button
              type="button"
              onClick={() => {
                setStarted(true);
                setStep(1);
              }}
              className="group mt-10 inline-flex items-center gap-2 rounded-full bg-[#f57c00] px-10 py-4 text-lg font-extrabold text-white shadow-[0_8px_30px_rgba(245,124,0,.45)] transition hover:-translate-y-0.5 hover:bg-[#e65100] hover:shadow-[0_12px_36px_rgba(245,124,0,.55)]"
            >
              Iniciar diagnóstico
              <span className="transition group-hover:translate-x-1">→</span>
            </button>
            <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
                <span className="text-base">🇧🇷</span> Atendimento em todo o Brasil
              </span>
              <span className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
                <span className="text-base">⏱️</span> Resposta em até 2 horas
              </span>
              <span className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
                <span className="text-base">⭐</span> +20 anos de experiência
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {started && !submitted && !isSubmitting ? (
        <section className="mx-auto max-w-2xl px-5 py-8">
          {currentQuestion ? (
            <div className="rounded-2xl bg-white p-7 shadow-[0_8px_30px_rgba(11,72,127,.08)] ring-1 ring-slate-100">
              <span className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#0b487f] to-[#1a6bb8] text-xs font-bold text-white shadow-sm">
                {currentQuestion.id}
              </span>
              <h2 className="text-xl font-extrabold text-slate-800">
                {currentQuestion.title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{currentQuestion.sub}</p>
              <div className="mt-6 space-y-2.5">
                {currentQuestion.opts.map((option) => {
                  const selected = answers[currentQuestion.id]?.v === option.v;

                  return (
                    <button
                      key={option.v}
                      type="button"
                      onClick={() => pick(currentQuestion.id, option)}
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-150 ${
                        selected
                          ? "border-[#0b487f] bg-[#e8f1fa] shadow-[0_4px_16px_rgba(11,72,127,.12)]"
                          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#7ab8f5] hover:bg-[#f3f8fd] hover:shadow-sm"
                      }`}
                    >
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xl transition-colors ${
                          selected ? "bg-[#0b487f]/10" : "bg-slate-100"
                        }`}
                      >
                        {option.icon}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-slate-800">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{option.desc}</span>
                      </span>
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          selected ? "border-[#0b487f] bg-[#0b487f]" : "border-slate-300"
                        }`}
                      >
                        {selected ? <span className="text-xs text-white">✓</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              {currentQuestion.note ? (
                <div className="mt-4 flex gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-700">
                  <span>⚠️</span>
                  <span>{currentQuestion.note.replace("⚠️ ", "")}</span>
                </div>
              ) : null}
              <div className="mt-6 flex gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={back}
                    className="rounded-lg border-2 border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-800"
                  >
                    ← Voltar
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={next}
                  disabled={!answers[step]}
                  className="flex-1 rounded-lg bg-[#0b487f] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#093a66] hover:shadow-md disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-35 disabled:shadow-none"
                >
                  Próximo →
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-7 shadow-[0_8px_30px_rgba(11,72,127,.08)] ring-1 ring-slate-100">
              <span className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                ✓
              </span>
              <h2 className="text-xl font-extrabold text-slate-800">
                Preencha seus dados para receber o diagnóstico
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Nossa equipe vai analisar suas respostas e entrar em contato informando se
                sua obra tem perfil para uma central exclusiva.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  ["nome", "Nome *", "Seu nome completo"],
                  ["empresa", "Empresa *", "Nome da empresa"],
                  ["telefone", "WhatsApp *", "(81) 99999-9999"],
                  ["email", "E-mail", "seu@email.com"],
                  ["cidade", "Cidade da obra *", "Ex: Recife - PE"],
                  ["cargo", "Cargo", "Ex: Engenheiro, Diretor"],
                ].map(([field, label, placeholder]) => (
                  <label key={field} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-500">{label}</span>
                    <input
                      value={form[field as keyof typeof form]}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      placeholder={placeholder}
                      className="rounded-lg border-2 border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-[#0b487f] focus:ring-4 focus:ring-[#0b487f]/10"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={back}
                  className="rounded-lg border-2 border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-800"
                >
                  ← Voltar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  className="flex-1 rounded-lg bg-[#0b487f] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#093a66] hover:shadow-md"
                >
                  Enviar diagnóstico →
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {isSubmitting ? (
        <section className="px-5 py-20 text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#0b487f]" />
          <p className="font-bold text-[#0b487f]">Analisando suas respostas...</p>
          <p className="mt-1 text-sm text-slate-400">
            Nossa equipe receberá seu diagnóstico em instantes
          </p>
        </section>
      ) : null}

      {submitted ? (
        <section className="mx-auto max-w-2xl px-5 py-8">
          <div className={`rounded-2xl p-8 text-center text-white shadow-[0_8px_30px_rgba(0,0,0,.12)] ${result.className}`}>
            <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-white/15 text-4xl">
              {result.icon}
            </div>
            <div className="mb-3 inline-block rounded-full bg-white/20 px-4 py-1 text-xs font-bold uppercase tracking-wider">
              Diagnóstico recebido
            </div>
            <h2 className="text-2xl font-extrabold">
              {form.nome}, {result.title}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 opacity-90">{result.subtitle}</p>
          </div>
          <div className="mt-4 rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(11,72,127,.08)] ring-1 ring-slate-100">
            <div className="mb-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium leading-6 text-green-900">
              <span>📩</span>
              <span>{result.aviso}</span>
            </div>
            <div className="mb-5 grid gap-2 sm:grid-cols-2">
              {[
                ["Volume total", answers[1]?.label],
                ["Volume mensal", answers[2]?.label],
                ["Prazo", answers[3]?.label],
                ["Tipo de obra", answers[4]?.label],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{value ?? "—"}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={openWhatsapp}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] p-4 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1ebe5b] hover:shadow-md"
            >
              💬 Prefere falar agora?
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-slate-400">
              🔒 Seus dados estão protegidos. Não compartilhamos com terceiros.
            </p>
          </div>
        </section>
      ) : null}

      <a
        href="https://api.whatsapp.com/send?phone=5581973291004&text=Ol%C3%A1%2C%20vim%20pelo%20site%20e%20quero%20falar%20com%20a%20equipe%20Villa%20sobre%20Central%20de%20Concreto."
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-4 text-sm font-bold text-white shadow-[0_4px_20px_rgba(37,211,102,.45)] ring-4 ring-[#25d366]/20 transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(37,211,102,.55)]"
      >
        💬 <span className="hidden sm:inline">Falar com a gente</span>
      </a>
    </main>
  );
}
