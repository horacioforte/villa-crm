"use client";
// ARQUIVO: app/diagnostico-bomba-68m/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Landing Page exclusiva — Bomba Lança 68 m.
// Separada 100% da Central de Concreto. Não altera nenhum arquivo existente.

import { useEffect, useMemo, useRef, useState } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Option = { v: string; s: number; icon: string; label: string; desc: string };
type Question = { id: number; title: string; sub: string; note?: string; opts: Option[] };
type Answers = Record<number, Option>;
type Profile = "verde" | "laranja" | "azul";
type SubmitState = "idle" | "loading" | "success" | "error" | "unavailable";

type UtmData = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referrer: string;
  landing_page: string;
  converted_at: string;
};

// ─── Perguntas ────────────────────────────────────────────────────────────────

const QUESTIONS: Question[] = [
  {
    id: 1,
    title: "Qual é o tipo da obra?",
    sub: "O tipo da obra nos ajuda a entender o contexto e o nível de exigência da concretagem.",
    opts: [
      { v: "a", s: 15, icon: "🏢", label: "Edifício residencial ou comercial", desc: "Condomínios, torres, centros comerciais" },
      { v: "b", s: 20, icon: "🛣️", label: "Infraestrutura", desc: "Rodovias, metrô, barragens, túneis" },
      { v: "c", s: 15, icon: "🏭", label: "Indústria", desc: "Fábricas, galpões, centros logísticos" },
      { v: "d", s: 15, icon: "💻", label: "Data center", desc: "Infraestrutura de tecnologia" },
      { v: "e", s: 20, icon: "🌉", label: "Ponte ou viaduto", desc: "Estruturas de grande alcance e altura" },
      { v: "f", s: 20, icon: "⚓", label: "Porto ou aeroporto", desc: "Obras de grande porte e logística complexa" },
      { v: "g", s: 15, icon: "💧", label: "Saneamento", desc: "ETA, ETE, adutoras, reservatórios" },
      { v: "h", s: 5,  icon: "🔧", label: "Outra", desc: "Outro tipo de obra" },
    ],
  },
  {
    id: 2,
    title: "Em qual fase está a obra?",
    sub: "A fase indica a urgência e a janela de tempo disponível para mobilização.",
    opts: [
      { v: "a", s: 5,  icon: "📐", label: "Planejamento", desc: "Projeto ainda em fase de estudos" },
      { v: "b", s: 10, icon: "🏗️", label: "Mobilização", desc: "Obra se preparando para iniciar" },
      { v: "c", s: 15, icon: "⛏️", label: "Fundação", desc: "Estacas, blocos e radiers" },
      { v: "d", s: 20, icon: "🏛️", label: "Estrutura", desc: "Pilares, vigas e lajes em andamento" },
      { v: "e", s: 25, icon: "🚀", label: "Concretagem em andamento", desc: "Bombeamento ativo — necessidade imediata" },
      { v: "f", s: 5,  icon: "📋", label: "Outra", desc: "Fase não listada acima" },
    ],
  },
  {
    id: 3,
    title: "Quando sua obra precisará da bomba?",
    sub: "Isso define a urgência do atendimento e a disponibilidade de mobilização.",
    opts: [
      { v: "a", s: 30, icon: "⚡", label: "Imediato", desc: "Precisamos agora ou em dias" },
      { v: "b", s: 25, icon: "📅", label: "Até 30 dias", desc: "Urgência alta — mobilização rápida" },
      { v: "c", s: 15, icon: "🗓️", label: "30 a 90 dias", desc: "Prazo adequado para planejamento" },
      { v: "d", s: 5,  icon: "📆", label: "3 a 6 meses", desc: "Planejamento com antecedência" },
      { v: "e", s: 2,  icon: "🔭", label: "Acima de 6 meses", desc: "Projeto em fase inicial" },
      { v: "f", s: 0,  icon: "💡", label: "Ainda em planejamento", desc: "Prazo ainda indefinido" },
    ],
  },
  {
    id: 4,
    title: "Qual é o principal desafio de bombeamento na sua obra?",
    sub: "Identificar o desafio central nos permite dimensionar a solução correta.",
    opts: [
      { v: "a", s: 25, icon: "⬆️", label: "Grande altura", desc: "Concretagem em andares elevados" },
      { v: "b", s: 25, icon: "↔️", label: "Grande distância horizontal", desc: "Longa extensão de lança ou mangueira" },
      { v: "c", s: 20, icon: "🚧", label: "Dificuldade de acesso", desc: "Espaço restrito para posicionar equipamento" },
      { v: "d", s: 20, icon: "⚠️", label: "Obstáculos e interferências", desc: "Redes, estruturas ou obstáculos no trajeto" },
      { v: "e", s: 15, icon: "⏱️", label: "Alta produtividade necessária", desc: "Ritmo de concretagem muito acelerado" },
      { v: "f", s: 25, icon: "❌", label: "Equipamento atual não alcança", desc: "A bomba atual não tem o alcance suficiente" },
      { v: "g", s: 5,  icon: "📝", label: "Outro desafio", desc: "Situação não listada acima" },
    ],
  },
  {
    id: 5,
    title: "Qual alcance aproximado a obra necessita?",
    sub: "A Bomba Lança 68 m oferece alcance de até 68 metros. Se não souber, selecione a última opção.",
    opts: [
      { v: "a", s: 0,  icon: "📏", label: "Menos de 30 metros", desc: "Alcance convencional — outras bombas atendem" },
      { v: "b", s: 5,  icon: "📐", label: "30 a 45 metros", desc: "Alcance médio" },
      { v: "c", s: 15, icon: "🏗️", label: "45 a 60 metros", desc: "Alcance elevado — faixa de atuação da 68 m" },
      { v: "d", s: 25, icon: "🚀", label: "Acima de 60 metros", desc: "Alto alcance — perfil ideal para a 68 m" },
      { v: "e", s: 10, icon: "❓", label: "Não sei informar", desc: "Ainda precisamos levantar esse dado" },
    ],
  },
  {
    id: 6,
    title: "Qual o volume aproximado de concreto previsto ou restante?",
    sub: "O volume total ajuda a entender a viabilidade e o porte da operação.",
    opts: [
      { v: "a", s: 0,  icon: "📉", label: "Menos de 500 m³", desc: "Volume pequeno" },
      { v: "b", s: 10, icon: "📊", label: "500 a 2.000 m³", desc: "Volume médio" },
      { v: "c", s: 20, icon: "📈", label: "2.000 a 8.000 m³", desc: "Volume significativo" },
      { v: "d", s: 25, icon: "🏭", label: "Acima de 8.000 m³", desc: "Grande volume — alto potencial" },
    ],
  },
];

const SCORE_MAX = 150; // soma dos scores máximos possíveis

// ─── Classificação ────────────────────────────────────────────────────────────

function getProfile(normalizedScore: number): Profile {
  if (normalizedScore >= 75) return "verde";
  if (normalizedScore >= 45) return "laranja";
  return "azul";
}

function getClassificacao(profile: Profile) {
  return { verde: "Alto potencial", laranja: "Médio potencial", azul: "Baixo potencial" }[profile];
}

function getTemperatura(profile: Profile): "QUENTE" | "MEDIA" | "FRIA" {
  return ({ verde: "QUENTE", laranja: "MEDIA", azul: "FRIA" } as const)[profile];
}

const resultConfig = {
  verde: {
    badge: "✅ Alto potencial identificado",
    badgeClass: "bg-green-700",
    title: "Diagnóstico recebido.",
    subtitle:
      "Pelas informações fornecidas, sua obra tem perfil para avaliação da Bomba Lança 68 m da Villa. Nossa equipe analisará os dados e entrará em contato em breve.",
    aviso:
      "Você receberá uma avaliação técnica por WhatsApp. Nenhuma solução será confirmada antes da análise da nossa equipe de engenharia.",
  },
  laranja: {
    badge: "📋 Diagnóstico recebido",
    badgeClass: "bg-orange-700",
    title: "Diagnóstico recebido.",
    subtitle:
      "Nossa equipe técnica analisará as informações e entrará em contato para entender melhor as características da sua obra.",
    aviso:
      "Você receberá um retorno por WhatsApp com a avaliação e as soluções mais adequadas ao seu caso.",
  },
  azul: {
    badge: "📩 Diagnóstico recebido",
    badgeClass: "bg-[#0b487f]",
    title: "Diagnóstico recebido.",
    subtitle:
      "Recebemos suas informações. Nossa equipe entrará em contato para avaliar as opções mais indicadas para a sua obra.",
    aviso:
      "Você receberá um retorno por WhatsApp com orientações sobre o equipamento mais adequado.",
  },
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DiagnosticoBomba68mPage() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    nome: "",
    empresa: "",
    cargo: "",
    telefone: "",
    email: "",
    nome_obra: "",
    cidade: "",
    uf: "",
  });
  const [observacao, setObservacao] = useState("");
  const [utms, setUtms] = useState<UtmData>({
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_content: "",
    utm_term: "",
    referrer: "",
    landing_page: "",
    converted_at: "",
  });

  const TOTAL_STEPS = QUESTIONS.length + 2; // 6 perguntas + identificação + observação
  const observacaoRef = useRef<HTMLTextAreaElement>(null);

  // ── Captura de UTMs ──────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtms({
      utm_source: params.get("utm_source") ?? "",
      utm_medium: params.get("utm_medium") ?? "",
      utm_campaign: params.get("utm_campaign") ?? "",
      utm_content: params.get("utm_content") ?? "",
      utm_term: params.get("utm_term") ?? "",
      referrer: document.referrer ?? "",
      landing_page: window.location.href,
      converted_at: new Date().toISOString(),
    });
  }, []);

  // ── Score e perfil ───────────────────────────────────────────────────────────
  const rawScore = useMemo(
    () => Object.values(answers).reduce((total, a) => total + a.s, 0),
    [answers]
  );
  const normalizedScore = Math.min(100, Math.round((rawScore / SCORE_MAX) * 100));
  const profile = getProfile(normalizedScore);
  const result = resultConfig[profile];

  const progress =
    submitState === "success"
      ? 100
      : Math.round(((step - 1) / TOTAL_STEPS) * 100);

  const currentQuestion = QUESTIONS.find((q) => q.id === step);

  // ── Navegação ────────────────────────────────────────────────────────────────
  function pick(questionId: number, option: Option) {
    setAnswers((cur) => ({ ...cur, [questionId]: option }));
  }

  function next() {
    if (step <= QUESTIONS.length && !answers[step]) return;
    setStep((cur) => Math.min(cur + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((cur) => Math.max(cur - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function submit() {
    if (!form.nome.trim() || !form.empresa.trim() || !form.telefone.trim() || !form.cidade.trim()) {
      setErrorMsg("Preencha Nome, Empresa, WhatsApp e Cidade.");
      return;
    }
    setErrorMsg("");
    setSubmitState("loading");

    const payload = {
      // Dados pessoais
      nome: form.nome.trim(),
      empresa: form.empresa.trim(),
      cargo: form.cargo.trim() || undefined,
      telefone: form.telefone.trim(),
      email: form.email.trim() || undefined,
      nome_obra: form.nome_obra.trim() || undefined,
      cidade: form.cidade.trim(),
      uf: form.uf.trim() || undefined,
      // Respostas
      tipo_obra: answers[1]?.label,
      fase_obra: answers[2]?.label,
      prazo: answers[3]?.label,
      desafio: answers[4]?.label,
      alcance: answers[5]?.label,
      volume: answers[6]?.label,
      observacao: observacao.trim() || undefined,
      // Qualificação
      score: normalizedScore,
      temperatura: getTemperatura(profile),
      classificacao: getClassificacao(profile),
      // UTMs
      ...utms,
    };

    try {
      const res = await fetch("/api/contato-bomba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({ success: true }));
        if (data.success) {
          setSubmitState("success");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message ?? "Verifique os dados e tente novamente.");
        setSubmitState("idle");
        return;
      }

      if (res.status >= 500) {
        setSubmitState("error");
        return;
      }

      setSubmitState("error");
    } catch {
      setSubmitState("unavailable");
    }
  }

  function openWhatsapp() {
    const linhas = [
      "Olá! Enviei o diagnóstico de Bomba Lança 68 m no site da Villa.",
      answers[2]?.label ? `• Fase da obra: ${answers[2].label}` : null,
      answers[3]?.label ? `• Prazo: ${answers[3].label}` : null,
      answers[4]?.label ? `• Desafio: ${answers[4].label}` : null,
      answers[5]?.label ? `• Alcance estimado: ${answers[5].label}` : null,
      "",
      "Aguardo o retorno!",
    ];
    const msg = linhas.filter(Boolean).join("\n");
    window.open(
      `https://api.whatsapp.com/send?phone=5581989060896&text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#f8fafc] font-sans text-slate-800">
      {/* Nav */}
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

      {/* Barra de progresso (sticky) */}
      {started && submitState !== "success" && (
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0b487f]">Diagnóstico — Bomba Lança 68 m</span>
            <span className="font-medium text-slate-400">
              {step <= QUESTIONS.length
                ? `Pergunta ${step} de ${QUESTIONS.length}`
                : step === TOTAL_STEPS - 1
                  ? "Seus dados"
                  : "Observação"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0b487f] to-[#7ab8f5] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((dot) => (
              <span
                key={dot}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  dot < step ? "bg-[#0b487f]" : dot === step ? "bg-[#7ab8f5]" : "bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hero */}
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
            <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Será que essa bomba de{" "}
              <span className="text-[#7ab8f5]">68 metros</span>{" "}
              não cabe na sua obra?
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-base text-white/80 sm:text-lg">
              Descubra em 2 minutos se a Bomba Lança 68 m da Villa pode aumentar a
              produtividade e resolver concretagens de grande alcance na sua obra.
            </p>

            {/* Cards de benefícios */}
            <div className="mb-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: "📏", title: "68 m de alcance", desc: "A maior bomba lança da Villa" },
                { icon: "⚡", title: "Resultado em 2 min", desc: "Diagnóstico rápido e objetivo" },
                { icon: "🤝", title: "Sem compromisso", desc: "Gratuito e sem obrigação" },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-left backdrop-blur"
                >
                  <div className="mb-1 text-2xl">{card.icon}</div>
                  <p className="font-bold text-white">{card.title}</p>
                  <p className="text-sm text-white/70">{card.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStarted(true)}
              className="inline-flex items-center gap-3 rounded-2xl bg-[#f57c00] px-8 py-4 text-lg font-bold text-white shadow-xl transition hover:bg-[#e65100] hover:shadow-2xl active:scale-95"
            >
              Iniciar diagnóstico gratuito
              <span className="text-xl">→</span>
            </button>
            <p className="mt-4 text-sm text-white/50">
              Seus dados são tratados com segurança e não serão compartilhados com terceiros.
            </p>
          </div>
        </section>
      ) : null}

      {/* Fluxo de perguntas */}
      {started && submitState !== "success" && (
        <div className="mx-auto max-w-2xl px-4 py-10">
          {/* Perguntas 1–6 */}
          {step <= QUESTIONS.length && currentQuestion && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {currentQuestion.note && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {currentQuestion.note}
                </div>
              )}
              <h2 className="mb-1 text-xl font-bold text-[#0b487f] sm:text-2xl">
                {currentQuestion.title}
              </h2>
              <p className="mb-6 text-sm text-slate-500">{currentQuestion.sub}</p>

              <div className="flex flex-col gap-3">
                {currentQuestion.opts.map((opt) => {
                  const selected = answers[currentQuestion.id]?.v === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => {
                        pick(currentQuestion.id, opt);
                        // Stale closure fix: avança diretamente sem passar por next()
                        // (que leria answers ainda vazio da render anterior)
                        setTimeout(() => {
                          setStep((cur) => Math.min(cur + 1, TOTAL_STEPS));
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }, 200);
                      }}
                      className={`flex items-start gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all active:scale-[0.98] ${
                        selected
                          ? "border-[#0b487f] bg-[#e8f2fc]"
                          : "border-slate-200 bg-white hover:border-[#7ab8f5] hover:bg-[#f0f7ff]"
                      }`}
                    >
                      <span className="mt-0.5 text-2xl">{opt.icon}</span>
                      <div>
                        <p className="font-semibold text-slate-800">{opt.label}</p>
                        <p className="text-sm text-slate-500">{opt.desc}</p>
                      </div>
                      {selected && (
                        <span className="ml-auto mt-1 flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-[#0b487f] text-[11px] text-white">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {step > 1 && (
                <button
                  onClick={back}
                  className="mt-6 text-sm text-slate-400 transition hover:text-[#0b487f]"
                >
                  ← Voltar
                </button>
              )}
            </div>
          )}

          {/* Etapa de identificação (step = 7) */}
          {step === QUESTIONS.length + 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="mb-1 text-xl font-bold text-[#0b487f] sm:text-2xl">
                Quase lá! Precisamos de algumas informações.
              </h2>
              <p className="mb-6 text-sm text-slate-500">
                Seus dados são usados exclusivamente para contato e não serão compartilhados.
              </p>

              <div className="flex flex-col gap-4">
                {/* Nome + Empresa */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Nome <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Seu nome completo"
                      value={form.nome}
                      onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Empresa <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="organization"
                      placeholder="Nome da construtora / empresa"
                      value={form.empresa}
                      onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                    />
                  </div>
                </div>

                {/* Cargo */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Cargo</label>
                  <input
                    type="text"
                    placeholder="Ex: Engenheiro, Gerente de obra, Diretor"
                    value={form.cargo}
                    onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                  />
                </div>

                {/* WhatsApp + Email */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      placeholder="(XX) 9XXXX-XXXX"
                      value={form.telefone}
                      onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">E-mail</label>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com (opcional)"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                    />
                  </div>
                </div>

                {/* Nome da obra */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Nome da obra
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Hospital Regional Y, Condomínio X, Viaduto Z"
                    value={form.nome_obra}
                    onChange={(e) => setForm((f) => ({ ...f, nome_obra: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                  />
                </div>

                {/* Cidade + UF */}
                <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Cidade <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Cidade da obra"
                      value={form.cidade}
                      onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="PE"
                      value={form.uf}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))
                      }
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
                    />
                  </div>
                </div>

                {/* LGPD */}
                <p className="text-xs text-slate-400">
                  Ao continuar, você concorda que a Villa Empreendimentos poderá entrar em contato
                  via WhatsApp ou e-mail com base nas informações fornecidas, conforme nossa{" "}
                  <a
                    href="https://villaempreendimentos.com.br/privacidade"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-[#0b487f]"
                  >
                    Política de Privacidade
                  </a>
                  .
                </p>

                {errorMsg && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    ⚠️ {errorMsg}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={back}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    ← Voltar
                  </button>
                  <button
                    onClick={next}
                    disabled={!form.nome || !form.empresa || !form.telefone || !form.cidade}
                    className="flex-1 rounded-xl bg-[#0b487f] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#093a66] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continuar →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Etapa de observação (step = 8 = TOTAL_STEPS) */}
          {step === TOTAL_STEPS && submitState === "idle" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="mb-1 text-xl font-bold text-[#0b487f] sm:text-2xl">
                Mais algum detalhe? (opcional)
              </h2>
              <p className="mb-6 text-sm text-slate-500">
                Descreva brevemente onde está o ponto mais difícil da concretagem — isso ajuda
                nossa equipe a entender melhor a operação antes de entrar em contato.
              </p>

              <textarea
                ref={observacaoRef}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={600}
                rows={4}
                placeholder="Ex: A laje do 18º andar fica a aproximadamente 60 m de altura e há uma estrutura de aço no caminho da bomba..."
                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm transition focus:border-[#0b487f] focus:outline-none focus:ring-2 focus:ring-[#0b487f]/20"
              />
              <p className="mt-1 text-right text-xs text-slate-400">{observacao.length}/600</p>

              {errorMsg && (
                <p className="mt-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  ⚠️ {errorMsg}
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  onClick={back}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  ← Voltar
                </button>
                <button
                  onClick={submit}
                  className="flex-1 rounded-xl bg-[#f57c00] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[#e65100] active:scale-95"
                >
                  Enviar diagnóstico →
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {submitState === "loading" && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="size-10 animate-spin rounded-full border-4 border-[#7ab8f5] border-t-[#0b487f]" />
              <p className="font-semibold text-[#0b487f]">Enviando diagnóstico...</p>
            </div>
          )}

          {/* Erro genérico */}
          {(submitState === "error" || submitState === "unavailable") && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
              <p className="mb-2 text-2xl">⚠️</p>
              <p className="mb-1 font-bold text-red-800">
                {submitState === "unavailable"
                  ? "Serviço temporariamente indisponível"
                  : "Erro ao enviar diagnóstico"}
              </p>
              <p className="mb-4 text-sm text-red-700">
                Não conseguimos processar seu diagnóstico agora. Tente novamente ou fale direto
                pelo WhatsApp.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => setSubmitState("idle")}
                  className="rounded-xl bg-red-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-800"
                >
                  Tentar novamente
                </button>
                <button
                  onClick={openWhatsapp}
                  className="rounded-xl border border-red-300 px-6 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                >
                  💬 Falar no WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tela de sucesso */}
      {submitState === "success" && (
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className={`mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold text-white ${result.badgeClass}`}>
            {result.badge}
          </div>
          <h2 className="mb-3 text-2xl font-extrabold text-[#0b487f] sm:text-3xl">
            {result.title}
          </h2>
          <p className="mb-4 text-base text-slate-700">{result.subtitle}</p>
          <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            ℹ️ {result.aviso}
          </div>

          {/* Resumo do diagnóstico */}
          <div className="mb-8 rounded-2xl border border-[#d6e8f7] bg-[#f0f7ff] p-5">
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-[#0b487f]">
              Resumo do seu diagnóstico
            </p>
            <div className="flex flex-col gap-1.5 text-sm text-slate-700">
              {[
                answers[1] && { label: "Tipo de obra", value: answers[1].label },
                answers[2] && { label: "Fase", value: answers[2].label },
                answers[3] && { label: "Prazo", value: answers[3].label },
                answers[4] && { label: "Desafio principal", value: answers[4].label },
                answers[5] && { label: "Alcance estimado", value: answers[5].label },
                answers[6] && { label: "Volume previsto", value: answers[6].label },
              ]
                .filter(Boolean)
                .map((item) => (
                  <div key={item!.label} className="flex gap-2">
                    <span className="min-w-[140px] font-semibold text-slate-500">{item!.label}:</span>
                    <span>{item!.value}</span>
                  </div>
                ))}
            </div>
          </div>

          <button
            onClick={openWhatsapp}
            className="w-full rounded-2xl bg-[#25D366] px-6 py-4 text-base font-bold text-white shadow-lg transition hover:bg-[#1ebe5d] active:scale-95"
          >
            💬 Confirmar pelo WhatsApp
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">
            Opcional — caso queira confirmar o recebimento ou tirar uma dúvida rápida.
          </p>
        </div>
      )}

      {/* Rodapé */}
      <footer className="mt-16 border-t border-slate-200 bg-[#00304c] px-6 py-10 text-center text-white/60">
        <p className="mb-1 text-sm font-semibold text-white/80">Villa Empreendimentos</p>
        <p className="text-xs">
          Desde 2007 · Recife · São Paulo · Belo Horizonte
        </p>
        <p className="mt-4 text-xs text-white/40">
          © {new Date().getFullYear()} Villa Empreendimentos. Todos os direitos reservados.
        </p>
      </footer>
    </main>
  );
}
