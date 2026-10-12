"use client";

// ARQUIVO: app/comercial/concreteiras/base/fila/[id]/Revisao.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Formulário de decisão da fila de verificação. Reserva a empresa ao abrir (impede dupla revisão),
// exige os campos conforme a decisão e permite avançar para a próxima sem voltar à lista.
// Grava só pela rota /api/base-nacional/fila/[id] (transação + histórico). Não envia mensagens.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SkipForward } from "lucide-react";
import { DECISOES, DECISAO_LABEL, EXIGENCIAS, FONTES_FILA, fontePorLink, type Decisao } from "@/lib/base-nacional/fila";
import { CONFIANCAS, CONFIANCA_LABEL, EQUIPAMENTOS, EQUIPAMENTO_LABEL, FONTE_LABEL, NIVEIS_POTENCIAL, NIVEL_LABEL, PRIORIDADES, PRIORIDADE_LABEL, TIPOS_ATIVIDADE, TIPO_ATIVIDADE_LABEL } from "@/lib/base-nacional/rotulos";
import { cn } from "@/lib/utils";

const FILA = "/comercial/concreteiras/base/fila";
const inp = "w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none sm:text-xs";
const rot = "mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400";
const hojeRecife = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());

export function Revisao(props: {
  candidataId: string; query: string; livreParaMim: boolean; ocupadaPor: string | null; potencialAtual: string;
  prioridadeAtual: string | null; observacaoAtual: string | null; statusAtual: string; equipamentosExistentes: string[];
}) {
  const router = useRouter();
  const [reserva, setReserva] = useState<"reservando" | "minha" | "ocupada">(props.livreParaMim ? "reservando" : "ocupada");
  const [ocupadaPor, setOcupadaPor] = useState(props.ocupadaPor);
  const [decisao, setDecisao] = useState<Decisao | "">("");
  const [url, setUrl] = useState("");
  const [fonte, setFonte] = useState<string>("");
  const [erros, setErros] = useState<string[]>([]);
  const [gravando, setGravando] = useState<"" | "gravar" | "proxima" | "pular">("");
  const [ok, setOk] = useState(false);
  const ex = decisao ? EXIGENCIAS[decisao] : null;
  const fonteSugerida = useMemo(() => fontePorLink(url), [url]);

  useEffect(() => {
    if (!props.livreParaMim) return;
    let ativo = true;
    fetch(`/api/base-nacional/fila/${encodeURIComponent(props.candidataId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reservar" }) })
      .then(async r => {
        if (!ativo) return;
        if (r.ok) setReserva("minha");
        else { const j = (await r.json().catch(() => ({}))) as { erros?: string[] }; setReserva("ocupada"); setOcupadaPor(j.erros?.[0] ?? "outra pessoa"); }
      })
      .catch(() => ativo && setReserva("ocupada"));
    return () => { ativo = false; };
  }, [props.candidataId, props.livreParaMim]);

  async function proxima(excetoId?: string) {
    const r = await fetch("/api/base-nacional/fila/proxima", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: props.query, excetoId }) });
    const j = (await r.json().catch(() => ({}))) as { id?: string | null };
    if (j.id) router.push(`${FILA}/${encodeURIComponent(j.id)}${props.query}`);
    else router.push(`${FILA}${props.query}`);
  }

  async function enviar(form: HTMLFormElement, depois: "gravar" | "proxima") {
    setErros([]); setOk(false); setGravando(depois);
    const fd = new FormData(form);
    const corpo: Record<string, unknown> = { acao: "decidir", equipamentos: fd.getAll("equipamentos").map(String) };
    for (const [k, v] of fd.entries()) if (k !== "equipamentos") corpo[k] = String(v);
    try {
      const r = await fetch(`/api/base-nacional/fila/${encodeURIComponent(props.candidataId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erros?: string[] };
      if (!r.ok || !j.ok) { setErros(j.erros?.length ? j.erros : ["Não foi possível gravar."]); setGravando(""); return; }
      setOk(true);
      if (depois === "proxima") await proxima(props.candidataId);
      else { router.refresh(); setGravando(""); }
    } catch {
      setErros(["Falha de conexão. Nada foi gravado."]); setGravando("");
    }
  }

  if (reserva === "ocupada") {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-semibold">Empresa reservada</p>
        <p>{ocupadaPor ?? "Outra pessoa"} — para evitar revisão em dobro, ela fica reservada por até 20 minutos.</p>
        <button type="button" onClick={() => { setGravando("pular"); void proxima(); }} className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-2 font-medium text-white">
          {gravando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SkipForward className="h-3.5 w-3.5" />} Ir para a próxima livre
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-3 rounded-xl border border-indigo-100 bg-white p-3 shadow-sm" onSubmit={e => { e.preventDefault(); void enviar(e.currentTarget, "proxima"); }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Decisão {reserva === "reservando" && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</p>

      <fieldset className="grid gap-1.5">
        <legend className={rot}>a) É concreteira?</legend>
        {DECISOES.map(d => (
          <label key={d} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs", decisao === d ? "border-indigo-400 bg-indigo-50 text-indigo-800" : "border-slate-200 text-slate-700")}>
            <input type="radio" name="decisao" value={d} checked={decisao === d} onChange={() => setDecisao(d)} className="h-4 w-4" />
            {DECISAO_LABEL[d]}
          </label>
        ))}
        {ex && <p className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-600">{ex.dica}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-1"><span className={rot}>Confiança{ex?.confianca ? " *" : ""}</span>
          <select name="confianca" className={inp} defaultValue="" required={Boolean(ex?.confianca)}>
            <option value="">—</option>{CONFIANCAS.map(c => <option key={c} value={c}>{CONFIANCA_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="col-span-1"><span className={rot}>Atividade</span>
          <select name="tipoAtividade" className={inp} defaultValue="">
            <option value="">Automática</option>{TIPOS_ATIVIDADE.map(t => <option key={t} value={t}>{TIPO_ATIVIDADE_LABEL[t]}</option>)}
          </select>
        </label>
      </div>
      <label className="block"><span className={rot}>Justificativa *</span>
        <textarea name="justificativa" rows={3} required minLength={10} className={inp} placeholder="O que você viu e onde procurou." />
      </label>
      <label className="block"><span className={rot}>Link da evidência{ex?.link ? " *" : ""}</span>
        <input name="url" type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} required={Boolean(ex?.link)} className={inp} placeholder="https://…" />
      </label>
      {url && (
        <div className="grid grid-cols-2 gap-2">
          <label><span className={rot}>Fonte</span>
            <select name="tipoFonte" className={inp} value={fonte || fonteSugerida} onChange={e => setFonte(e.target.value)}>
              {FONTES_FILA.map(x => <option key={x} value={x}>{FONTE_LABEL[x] ?? x}</option>)}
            </select>
          </label>
          <label><span className={rot}>Data da evidência</span>
            <input name="dataEvidencia" type="date" defaultValue={hojeRecife()} max={hojeRecife()} className={inp} />
          </label>
          <label className="col-span-2"><span className={rot}>Trecho curto (opcional)</span>
            <input name="trecho" maxLength={400} className={inp} placeholder="Ex.: “Concreto usinado e bombeado em Caruaru”" />
          </label>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-100 pt-2">
        <p className={rot}>b) Potencial para compra de equipamentos usados</p>
        <select name="potencialCompra" className={inp} defaultValue={props.potencialAtual} required>
          {NIVEIS_POTENCIAL.map(n => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
        </select>
        <p className={rot}>Equipamentos de interesse provável</p>
        <div className="grid grid-cols-2 gap-1">
          {EQUIPAMENTOS.filter(e => e !== "OUTRO").map(e => (
            <label key={e} className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" name="equipamentos" value={e} defaultChecked={props.equipamentosExistentes.includes(e)} disabled={props.equipamentosExistentes.includes(e)} className="h-4 w-4" />
              {EQUIPAMENTO_LABEL[e]}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={rot}>Prioridade de abordagem futura</span>
            <select name="prioridade" className={inp} defaultValue={props.prioridadeAtual ?? ""}>
              <option value="">—</option>{PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>)}
            </select>
          </label>
          <label className="col-span-2"><span className={rot}>Observação comercial</span>
            <textarea name="observacaoComercial" rows={2} className={inp} defaultValue={props.observacaoAtual ?? ""} placeholder="Frota, porte, região, interesse provável…" />
          </label>
        </div>
      </div>

      {erros.length > 0 && <ul className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">{erros.map(e => <li key={e}>• {e}</li>)}</ul>}
      {ok && <p className="rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-700">Gravado com responsável, data e histórico.</p>}
      <p className="text-[10px] text-slate-400">Responsável e data são registrados automaticamente com o seu usuário.</p>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={Boolean(gravando) || !decisao} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 sm:text-xs">
          {gravando === "proxima" ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : null} Gravar e próxima
        </button>
        <button type="button" disabled={Boolean(gravando) || !decisao} onClick={e => void enviar(e.currentTarget.form!, "gravar")} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 disabled:opacity-50 sm:text-xs">Gravar</button>
        <button type="button" disabled={Boolean(gravando)} onClick={() => { setGravando("pular"); void proxima(props.candidataId); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600 sm:text-xs">
          <SkipForward className="h-3.5 w-3.5" /> Pular
        </button>
      </div>
    </form>
  );
}
