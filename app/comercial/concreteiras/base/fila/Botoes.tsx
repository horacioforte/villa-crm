"use client";

// ARQUIVO: app/comercial/concreteiras/base/fila/Botoes.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Botões da fila: começar/continuar revisão, executar robô (ADMIN, por lote) e imprimir.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Play, Printer } from "lucide-react";

const FILA = "/comercial/concreteiras/base/fila";

export function BotaoComecar({ query, rotulo = "Começar revisão" }: { query: string; rotulo?: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"livre" | "buscando" | "vazia" | "erro">("livre");
  async function ir() {
    setEstado("buscando");
    try {
      const r = await fetch("/api/base-nacional/fila/proxima", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const j = (await r.json()) as { id?: string | null };
      if (!r.ok) { setEstado("erro"); return; }
      if (!j.id) { setEstado("vazia"); return; }
      router.push(`${FILA}/${encodeURIComponent(j.id)}${query}`);
    } catch { setEstado("erro"); }
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={ir} disabled={estado === "buscando"}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {estado === "buscando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {rotulo}
      </button>
      {estado === "vazia" && <span className="mt-1 text-[11px] text-emerald-700">Nenhuma empresa livre nesta fila.</span>}
      {estado === "erro" && <span className="mt-1 text-[11px] text-red-600">Não foi possível buscar a próxima.</span>}
    </span>
  );
}

type Resumo = { processadas: number; restantesSemRobo: number; marcadasProvavel: number; filaHumana: number; dispensadas: number; paginasLidas: number; paginasBloqueadas: number; dominiosProprios: number };
export function PainelRobo({ ufPadrao }: { ufPadrao?: string }) {
  const router = useRouter();
  const [uf, setUf] = useState(ufPadrao ?? "PE");
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [total, setTotal] = useState<Resumo | null>(null);
  async function rodar(continuar: boolean) {
    setRodando(true); setMsg(null);
    let acumulado: Resumo = { processadas: 0, restantesSemRobo: 0, marcadasProvavel: 0, filaHumana: 0, dispensadas: 0, paginasLidas: 0, paginasBloqueadas: 0, dominiosProprios: 0 };
    try {
      for (let lote = 0; lote < (continuar ? 40 : 1); lote++) {
        const r = await fetch("/api/base-nacional/robo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uf, limite: 25 }) });
        const j = (await r.json()) as { ok?: boolean; erros?: string[]; resumo?: Resumo };
        if (!r.ok || !j.ok || !j.resumo) { setMsg(j.erros?.join(" ") ?? "O robô não respondeu."); break; }
        const s = j.resumo;
        acumulado = {
          processadas: acumulado.processadas + s.processadas, restantesSemRobo: s.restantesSemRobo, marcadasProvavel: acumulado.marcadasProvavel + s.marcadasProvavel,
          filaHumana: acumulado.filaHumana + s.filaHumana, dispensadas: acumulado.dispensadas + s.dispensadas, paginasLidas: acumulado.paginasLidas + s.paginasLidas,
          paginasBloqueadas: acumulado.paginasBloqueadas + s.paginasBloqueadas, dominiosProprios: acumulado.dominiosProprios + s.dominiosProprios,
        };
        setTotal({ ...acumulado });
        if (s.restantesSemRobo === 0 || s.processadas === 0) break;
      }
    } catch { setMsg("Falha de conexão. O que já foi processado continua salvo."); }
    setRodando(false);
    router.refresh();
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <p className="flex items-center gap-1.5 font-semibold"><Bot className="h-4 w-4" /> Robô gratuito (somente administrador)</p>
      <p className="mt-1 text-[11px] text-amber-800">Triagem, vínculos e leitura do site próprio (respeita robots.txt). Não usa Google, Maps, redes sociais nem serviço pago. Empresas já processadas não são repetidas.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={uf} onChange={e => setUf(e.target.value)} className="rounded-md border border-amber-300 bg-white px-2 py-1.5" aria-label="Estado do robô">
          <option value="PE">PE</option>
        </select>
        <button type="button" disabled={rodando} onClick={() => rodar(false)} className="rounded-md border border-amber-300 bg-white px-3 py-1.5 hover:bg-amber-100 disabled:opacity-50">Rodar 1 lote (25)</button>
        <button type="button" disabled={rodando} onClick={() => rodar(true)} className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50">
          {rodando ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : null} Rodar até terminar o estado
        </button>
      </div>
      {total && (
        <p className="mt-2 text-[11px]">Processadas {total.processadas} · faltam {total.restantesSemRobo} · prováveis pelo site {total.marcadasProvavel} · para a fila {total.filaHumana} · dispensadas {total.dispensadas} · sites próprios {total.dominiosProprios} (páginas lidas {total.paginasLidas}, bloqueadas/indisponíveis {total.paginasBloqueadas})</p>
      )}
      {msg && <p className="mt-2 text-[11px] text-red-700">{msg}</p>}
      <p className="mt-1 text-[10px] text-amber-700">Nesta etapa só Pernambuco está liberado. Brasil depende de autorização.</p>
    </div>
  );
}

export function BotaoImprimirFila({ query }: { query: string }) {
  const [estado, setEstado] = useState<"livre" | "registrando">("livre");
  return (
    <button type="button" disabled={estado === "registrando"} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white print:hidden"
      onClick={async () => {
        setEstado("registrando");
        try { await fetch("/api/base-nacional/fila/relatorio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) }); } catch { /* impressão segue */ }
        setEstado("livre");
        window.print();
      }}>
      <Printer className="h-3.5 w-3.5" /> {estado === "registrando" ? "Registrando…" : "Imprimir"}
    </button>
  );
}
