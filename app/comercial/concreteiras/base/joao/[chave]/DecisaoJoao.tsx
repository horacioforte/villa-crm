"use client";

// ARQUIVO: app/comercial/concreteiras/base/joao/[chave]/DecisaoJoao.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Decisão humana da fila comercial do João. Grava só pela rota /api/base-nacional/joao/[chave] (transação + histórico).
// "Aprovado para abordagem" é apenas um registro: não envia mensagem nem inicia contato.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DECISAO_COMERCIAL_LABEL, DECISOES_COMERCIAIS, type DecisaoComercial } from "@/lib/base-nacional/joao/fila-comercial-rotulos";
import { cn } from "@/lib/utils";

export function DecisaoJoao(props: { chave: string; query: string; decisaoAtual: string | null; observacaoAtual: string | null; contatos: Array<{ id: string; rotulo: string }> }) {
  const router = useRouter();
  const [decisao, setDecisao] = useState<DecisaoComercial | "">((props.decisaoAtual as DecisaoComercial) ?? "");
  const [obs, setObs] = useState(props.observacaoAtual ?? "");
  const [invalidos, setInvalidos] = useState<string[]>([]);
  const [erros, setErros] = useState<string[]>([]);
  const [ok, setOk] = useState(false);
  const [gravando, setGravando] = useState(false);

  async function gravar() {
    setErros([]); setOk(false); setGravando(true);
    try {
      const r = await fetch(`/api/base-nacional/joao/${encodeURIComponent(props.chave)}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao, observacao: obs, contatosInvalidos: invalidos }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erros?: string[] };
      if (!r.ok || !j.ok) setErros(j.erros?.length ? j.erros : ["Não foi possível gravar."]);
      else { setOk(true); setInvalidos([]); router.refresh(); }
    } catch { setErros(["Falha de conexão. Nada foi gravado."]); }
    setGravando(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Decisão</p>
      <fieldset className="grid gap-1.5">
        {DECISOES_COMERCIAIS.map(d => (
          <label key={d} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs", decisao === d ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700")}>
            <input type="radio" name="decisao" value={d} checked={decisao === d} onChange={() => setDecisao(d)} className="h-4 w-4" />
            {DECISAO_COMERCIAL_LABEL[d]}
          </label>
        ))}
      </fieldset>
      {decisao === "CONTATO_INVALIDO" && props.contatos.length > 0 && (
        <div className="space-y-1 rounded-md bg-slate-50 p-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Marcar como inválido (fica preservado no histórico)</p>
          {props.contatos.map(c => (
            <label key={c.id} className="flex items-center gap-1.5 text-[11px] text-slate-700">
              <input type="checkbox" className="h-3.5 w-3.5" checked={invalidos.includes(c.id)} onChange={e => setInvalidos(v => e.target.checked ? [...v, c.id] : v.filter(x => x !== c.id))} />
              {c.rotulo}
            </label>
          ))}
        </div>
      )}
      <label className="block"><span className="mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400">Observação{decisao && decisao !== "APROVADO_ABORDAGEM" ? " *" : ""}</span>
        <textarea rows={3} value={obs} onChange={e => setObs(e.target.value)} className="w-full rounded-md border border-slate-200 px-2 py-2 text-xs" placeholder="O que você viu, o que falta ou por que adiar." />
      </label>
      {erros.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">{erros.map(e => <li key={e}>• {e}</li>)}</ul>}
      {ok && <p className="rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-700">Gravado com responsável, data e histórico. Nenhuma mensagem foi enviada.</p>}
      <button type="button" disabled={!decisao || gravando} onClick={() => void gravar()} className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:text-xs">
        {gravando && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />} Gravar decisão
      </button>
      <p className="text-[10px] text-slate-400">A decisão não envia mensagem, não liga e não inicia abordagem.</p>
    </div>
  );
}
