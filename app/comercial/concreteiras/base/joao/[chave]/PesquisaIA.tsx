"use client";

// ARQUIVO: app/comercial/concreteiras/base/joao/[chave]/PesquisaIA.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Botão "Pesquisar com IA" — só aparece se o módulo estiver ligado (ver page.tsx, que só
// renderiza este componente quando pesquisaIaAtiva() é true) e só para grupos B/C.
// NUNCA grava pessoa/contato sozinho: mostra o resultado para revisão e oferece o JSON pronto
// para `joao-enriquecer.ts --importar-web` (mesmo fluxo manual de hoje, revisado por humano).

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { EntradaImportarWeb, RejeicaoPesquisaIA } from "@/lib/base-nacional/joao/pesquisa-ia";

type Resposta = { ok: true; doCache: boolean; provedor: string; entradaImportarWeb: EntradaImportarWeb; rejeitados: RejeicaoPesquisaIA[] } | { ok: false; erros: string[] };

export function PesquisaIA(props: { chave: string }) {
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<Resposta | null>(null);

  async function pesquisar() {
    setCarregando(true);
    setResultado(null);
    try {
      const r = await fetch(`/api/base-nacional/joao/${encodeURIComponent(props.chave)}/pesquisa-ia`, { method: "POST" });
      const j = (await r.json().catch(() => ({ ok: false, erros: ["Resposta inválida."] }))) as Resposta;
      setResultado(j);
    } catch {
      setResultado({ ok: false, erros: ["Falha de conexão."] });
    }
    setCarregando(false);
  }

  function baixarJson() {
    if (!resultado?.ok) return;
    const blob = new Blob([JSON.stringify([resultado.entradaImportarWeb], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pesquisa-ia-${props.chave}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700"><Sparkles className="h-3.5 w-3.5" /> Pesquisar com IA</p>
      <p className="text-[11px] text-slate-500">Busca na web quem cuida de compras, frota, manutenção ou operações. Nada é gravado automaticamente — o resultado fica aqui para você revisar.</p>
      <button type="button" disabled={carregando} onClick={() => void pesquisar()} className="w-full rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50">
        {carregando && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />} Pesquisar com IA
      </button>
      {resultado && !resultado.ok && <ul className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">{resultado.erros.map(e => <li key={e}>• {e}</li>)}</ul>}
      {resultado?.ok && (
        <div className="space-y-1.5 rounded-md bg-white p-2 text-[11px]">
          <p className="text-slate-600">{resultado.doCache ? "Já pesquisado antes (resultado do cache)." : `Pesquisado agora via ${resultado.provedor}.`} {resultado.entradaImportarWeb.achados.length} achado(s) · {resultado.rejeitados.length} descartado(s) na validação.</p>
          {resultado.entradaImportarWeb.achados.map((a, i) => (
            <div key={i} className="rounded border border-slate-100 p-1.5">
              <p className="font-medium text-slate-800">{a.nome} — {a.cargo || "cargo não informado"}</p>
              <p className="text-slate-500">confiança {a.confianca.toLowerCase()} · <a href={a.fonteUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">fonte</a></p>
            </div>
          ))}
          {resultado.entradaImportarWeb.achados.length > 0 && (
            <button type="button" onClick={baixarJson} className="w-full rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-violet-700">
              Baixar JSON para revisão (--importar-web)
            </button>
          )}
          <p className="text-[10px] text-slate-400">Nenhuma pessoa foi gravada. Revise e rode joao-enriquecer.ts --importar-web para confirmar.</p>
        </div>
      )}
    </div>
  );
}
