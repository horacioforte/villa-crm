"use client";

// ARQUIVO: app/inteligencia/minhas-solicitacoes/NovasSolicitacoesButton.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Botão + modal de formulário para solicitar nova investigação ao João Hunter IA.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Loader2 } from "lucide-react";

const SEGMENTOS = [
  "Celulose", "Saneamento", "Energia", "Rodovias", "Ferrovias", "Portos",
  "Aeroportos", "Mineração", "Óleo e Gás", "Data Centers", "Siderurgia",
  "Agronegócio", "Imóveis", "Logística", "Industrial", "Outro",
];

const PRIORIDADES = [
  { value: "ALTA",  label: "Alta",  cor: "bg-red-100 text-red-700 border-red-200" },
  { value: "MEDIA", label: "Média", cor: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "BAIXA", label: "Baixa", cor: "bg-slate-100 text-slate-600 border-slate-200" },
];

export function NovasSolicitacoesButton() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    titulo:       "",
    cidade:       "",
    estado:       "",
    segmento:     "",
    clienteFinal: "",
    resumo:       "",
    missaoInicial:"",
    prioridade:   "MEDIA",
  });

  function atualizar(campo: keyof typeof form, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }));
    setErro("");
  }

  async function salvar() {
    if (!form.titulo.trim()) { setErro("Informe o nome da obra ou empresa."); return; }
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/inteligencia/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Erro ao criar solicitação.");
      }
      setAberto(false);
      setForm({ titulo:"", cidade:"", estado:"", segmento:"", clienteFinal:"", resumo:"", missaoInicial:"", prioridade:"MEDIA" });
      router.refresh();
    } catch (e: any) {
      setErro(e.message ?? "Erro desconhecido.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Pedir nova investigação
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Pedir nova investigação ao João</h2>
                <p className="text-xs text-slate-400 mt-0.5">João vai investigar e trazer decisores, obras e oportunidades</p>
              </div>
              <button onClick={() => setAberto(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {/* Titulo */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Nome da obra ou empresa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Marquise Construções — Galpão Logístico em Suape/PE"
                  value={form.titulo}
                  onChange={e => atualizar("titulo", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Cidade + Estado */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Cidade</label>
                  <input
                    type="text"
                    placeholder="Ex: Recife"
                    value={form.cidade}
                    onChange={e => atualizar("cidade", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Estado</label>
                  <input
                    type="text"
                    placeholder="PE"
                    maxLength={2}
                    value={form.estado}
                    onChange={e => atualizar("estado", e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent uppercase"
                  />
                </div>
              </div>

              {/* Segmento */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Segmento</label>
                <select
                  value={form.segmento}
                  onChange={e => atualizar("segmento", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Selecionar segmento...</option>
                  {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Contratante */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Contratante / Cliente final</label>
                <input
                  type="text"
                  placeholder="Ex: Petrobras, CBMM, Aegea..."
                  value={form.clienteFinal}
                  onChange={e => atualizar("clienteFinal", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* O que já sei */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">O que você já sabe</label>
                <textarea
                  rows={2}
                  placeholder="Contexto que você já tem sobre essa obra ou empresa..."
                  value={form.resumo}
                  onChange={e => atualizar("resumo", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* O que João deve descobrir */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">O que João deve descobrir primeiro</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Quem é o diretor de obras? Quando começa a fundação? Qual construtora foi contratada?"
                  value={form.missaoInicial}
                  onChange={e => atualizar("missaoInicial", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Prioridade */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Prioridade</label>
                <div className="flex gap-2">
                  {PRIORIDADES.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => atualizar("prioridade", p.value)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        form.prioridade === p.value
                          ? p.cor + " ring-2 ring-offset-1 ring-indigo-400"
                          : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Erro */}
              {erro && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setAberto(false)}
                disabled={salvando}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando || !form.titulo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                {salvando ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando...</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> Solicitar ao João</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
