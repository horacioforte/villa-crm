"use client";
// ARQUIVO: components/inteligencia/CampanhasClient.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Fluxo de 4 passos para disparo de campanha de e-mail outbound do João.

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mail,
  Send,
  FileText,
  Building2,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

type Dest = {
  nome: string;
  email: string;
  empresa: string;
  cidade?: string;
  estado?: string;
  cargo?: string;
  segmento?: string;
  observacoes?: string;
};

type StatusLine = {
  email: string;
  empresa: string;
  status: string;
  detalhe?: string;
};

const TIPOS = [
  {
    value: "PRE_MOLDADO",
    label: "Pré-moldados",
    desc: "Betoneiras e autobombas seminovas disponíveis para venda",
    icon: Building2,
  },
  {
    value: "OBRA",
    label: "Obras ativas",
    desc: "Prospecção de construtoras com projetos em andamento",
    icon: ClipboardList,
  },
  {
    value: "GENERICO",
    label: "Genérico",
    desc: "Apresentação geral da Villa Empreendimentos",
    icon: FileText,
  },
];

const STEPS = ["Tipo", "Destinatários", "Pré-visualizar", "Resultado"];

export default function CampanhasClient() {
  const [step, setStep] = useState(0);
  const [tipo, setTipo] = useState("PRE_MOLDADO");
  const [text, setText] = useState("");
  const [destinatarios, setDestinatarios] = useState<Dest[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusLines, setStatusLines] = useState<StatusLine[]>([]);

  function parseLista() {
    const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    const parsed: Dest[] = rows
      .map((r) => {
        const parts = r.split(",").map((p) => p.trim());
        return {
          nome: parts[0] ?? "-",
          email: parts[1] ?? "",
          empresa: parts[2] ?? "",
          cidade: parts[3],
          cargo: parts[4],
        };
      })
      .filter((d) => d.email && d.nome);
    return parsed;
  }

  async function irParaPreview() {
    const parsed = parseLista();
    if (parsed.length === 0) {
      toast.error("Cole pelo menos um destinatário antes de continuar.");
      return;
    }
    setDestinatarios(parsed);
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/inteligencia/campanhas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, destinatario: parsed[0] }),
      });
      const data = await res.json();
      setPreviewSubject(data.subject);
      setPreviewHtml(data.html);
      setStep(2);
    } catch {
      toast.error("Erro ao gerar pré-visualização.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function disparar() {
    setSending(true);
    setStatusLines([]);
    setStep(3);

    try {
      const res = await fetch("/api/inteligencia/campanhas/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, destinatarios }),
      });

      if (!res.body) throw new Error("Resposta sem stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (!parsed.finished) {
              setStatusLines((prev) => [...prev, parsed]);
            }
          } catch {
            // linha inválida, ignorar
          }
        }
      }
    } catch {
      toast.error("Erro durante o disparo.");
    } finally {
      setSending(false);
    }
  }

  function reiniciar() {
    setStep(0);
    setText("");
    setDestinatarios([]);
    setPreviewHtml(null);
    setPreviewSubject(null);
    setStatusLines([]);
  }

  const enviados = statusLines.filter((s) => s.status === "enviado").length;
  const erros = statusLines.filter((s) => s.status !== "enviado").length;

  return (
    <div className="space-y-6">
      {/* Steps */}
      <div className="flex rounded-2xl border border-[#D7DEEA] overflow-hidden">
        {STEPS.map((label, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 flex items-center gap-2 px-4 py-3 text-sm font-semibold border-r border-[#D7DEEA] last:border-r-0 transition-colors",
              i === step
                ? "bg-[#1A2E5A] text-white"
                : i < step
                  ? "bg-[#E8EEFB] text-[#1E4FAB]"
                  : "bg-white text-[#98A2B3]",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                i === step
                  ? "border-white bg-white text-[#1A2E5A]"
                  : i < step
                    ? "border-[#1E4FAB] bg-[#1E4FAB] text-white"
                    : "border-current",
              )}
            >
              {i < step ? <CheckCircle2 className="size-3" /> : i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>

      {/* Passo 1 — Tipo */}
      {step === 0 && (
        <div className="rounded-3xl border border-[#D7DEEA] bg-white p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[#1A2E5A]">Tipo de campanha</h2>
            <p className="text-sm text-[#667085] mt-1">
              O João vai personalizar o e-mail conforme o perfil do destinatário.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all",
                  tipo === t.value
                    ? "border-[#1A2E5A] bg-[#1A2E5A] text-white"
                    : "border-[#D7DEEA] bg-[#F4F6FA] text-[#1A2E5A] hover:border-[#1E4FAB] hover:bg-[#E8EEFB]",
                )}
              >
                <t.icon
                  className={cn(
                    "size-5",
                    tipo === t.value ? "text-white" : "text-[#1E4FAB]",
                  )}
                />
                <span className="text-sm font-semibold">{t.label}</span>
                <span
                  className={cn(
                    "text-xs leading-relaxed",
                    tipo === t.value ? "text-[#a8bbdd]" : "text-[#667085]",
                  )}
                >
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1A2E5A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FAB] transition-colors"
            >
              Próximo <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Passo 2 — Destinatários */}
      {step === 1 && (
        <div className="rounded-3xl border border-[#D7DEEA] bg-white p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#1A2E5A]">Destinatários</h2>
            <p className="text-sm text-[#667085] mt-1">
              Cole a lista no formato: nome, e-mail, empresa — uma por linha. Até 200 por disparo.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#667085] uppercase tracking-wide">
              Lista de contatos
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Carlos Melo, carlos@construtorasol.com.br, Construtora Sol\nAmanda Faria, amanda@pmc.eng.br, PM Construções\nRafael Souza, rafael@concrpb.com.br, ConcretoPB"}
              className="h-36 w-full rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-3 font-mono text-sm text-[#1A2E5A] placeholder-[#98A2B3] focus:border-[#1E4FAB] focus:outline-none resize-none"
            />
            <p className="mt-1.5 text-xs text-[#98A2B3]">
              Formato: nome, e-mail, empresa &nbsp;·&nbsp; cidade e cargo são opcionais (colunas 4 e 5)
            </p>
          </div>
          {text.trim() && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8EEFB] px-3 py-1 text-xs font-semibold text-[#1E4FAB]">
              <Mail className="size-3" />
              {parseLista().length} destinatário{parseLista().length !== 1 ? "s" : ""}
            </div>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D7DEEA] bg-white px-5 py-2.5 text-sm font-semibold text-[#1A2E5A] hover:bg-[#F4F6FA] transition-colors"
            >
              <ArrowLeft className="size-4" /> Voltar
            </button>
            <button
              onClick={irParaPreview}
              disabled={loadingPreview}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1A2E5A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FAB] transition-colors disabled:opacity-60"
            >
              {loadingPreview ? "Gerando preview..." : <>Pré-visualizar <ArrowRight className="size-4" /></>}
            </button>
          </div>
        </div>
      )}

      {/* Passo 3 — Preview */}
      {step === 2 && (
        <div className="rounded-3xl border border-[#D7DEEA] bg-white p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#1A2E5A]">Pré-visualização</h2>
            <p className="text-sm text-[#667085] mt-1">
              Assim o e-mail chegará para cada destinatário.
            </p>
          </div>
          {/* Metadados */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-1.5 text-xs text-[#667085]">
              <Mail className="size-3 text-[#1E4FAB]" />
              De: <strong className="text-[#1A2E5A]">joao.comercial@villaempreendimentos.com.br</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-1.5 text-xs text-[#667085]">
              Para: <strong className="text-[#1A2E5A]">{destinatarios.length} destinatário{destinatarios.length !== 1 ? "s" : ""}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-3 py-1.5 text-xs text-[#667085]">
              Assunto: <strong className="text-[#1A2E5A]">{previewSubject}</strong>
            </span>
          </div>
          {/* Preview do HTML */}
          {previewHtml && (
            <div className="overflow-hidden rounded-2xl border border-[#D7DEEA]">
              <div className="bg-[#1A2E5A] px-5 py-3">
                <p className="text-sm font-semibold text-white">Villa Empreendimentos</p>
                <p className="text-xs text-[#a8bbdd]">Soluções em Bombeamento de Concreto</p>
              </div>
              <iframe
                srcDoc={previewHtml}
                className="h-64 w-full border-0 bg-white"
                title="Preview do e-mail"
                sandbox="allow-same-origin"
              />
            </div>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#D7DEEA] bg-white px-5 py-2.5 text-sm font-semibold text-[#1A2E5A] hover:bg-[#F4F6FA] transition-colors"
            >
              <ArrowLeft className="size-4" /> Voltar
            </button>
            <button
              onClick={disparar}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#1A2E5A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FAB] transition-colors"
            >
              <Send className="size-4" /> Disparar campanha
            </button>
          </div>
        </div>
      )}

      {/* Passo 4 — Resultado */}
      {step === 3 && (
        <div className="rounded-3xl border border-[#D7DEEA] bg-white p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-[#1A2E5A]">
              {sending ? "Disparando..." : "Campanha concluída"}
            </h2>
            <p className="text-sm text-[#667085] mt-1">
              {sending
                ? "Enviando e-mails em tempo real — aguarde."
                : "O João finalizou o disparo."}
            </p>
          </div>
          {/* Cards de métricas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] p-4 text-center">
              <p className="text-2xl font-semibold text-[#1A2E5A]">{destinatarios.length}</p>
              <p className="text-xs text-[#667085] mt-1">total</p>
            </div>
            <div className="rounded-2xl border border-[#D7DEEA] bg-[#E1F5EE] p-4 text-center">
              <p className="text-2xl font-semibold text-[#0F6E56]">{enviados}</p>
              <p className="text-xs text-[#0F6E56] mt-1">enviados</p>
            </div>
            <div className="rounded-2xl border border-[#D7DEEA] bg-[#FCEBEB] p-4 text-center">
              <p className="text-2xl font-semibold text-[#A32D2D]">{erros}</p>
              <p className="text-xs text-[#A32D2D] mt-1">erros</p>
            </div>
          </div>
          {/* Lista em tempo real */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {statusLines.length === 0 && sending && (
              <p className="text-sm text-[#98A2B3] text-center py-4">Aguardando respostas...</p>
            )}
            {statusLines.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-2.5"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    s.status === "enviado" ? "bg-[#1D9E75]" : "bg-[#E24B4A]",
                  )}
                />
                <span className="text-sm font-semibold text-[#1A2E5A] min-w-[140px]">{s.empresa || "—"}</span>
                <span className="text-xs text-[#667085] flex-1 truncate">{s.email}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    s.status === "enviado"
                      ? "bg-[#E1F5EE] text-[#085041]"
                      : "bg-[#FCEBEB] text-[#791F1F]",
                  )}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
          {!sending && (
            <div className="flex justify-end">
              <button
                onClick={reiniciar}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#1A2E5A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E4FAB] transition-colors"
              >
                Nova campanha
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
