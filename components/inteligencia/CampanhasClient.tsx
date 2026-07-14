"use client";
import { useState } from "react";

type Dest = { nome: string; email: string; empresa: string; cidade?: string; estado?: string; cargo?: string; segmento?: string; observacoes?: string };

export default function CampanhasClient() {
  const [text, setText] = useState("");
  const [tipo, setTipo] = useState("PRE_MOLDADO");
  const [destinatarios, setDestinatarios] = useState<Dest[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  function parse() {
    const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    const parsed: Dest[] = rows.map(r => {
      const parts = r.split(",").map(p => p.trim());
      return { nome: parts[0] ?? "-", email: parts[1] ?? "", empresa: parts[2] ?? "" };
    }).filter(d => d.email && d.nome);
    setDestinatarios(parsed);
  }

  async function send() {
    if (destinatarios.length === 0) return alert("Adicione destinatários antes de enviar.");
    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/api/inteligencia/campanhas/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, destinatarios }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Tipo de campanha</label>
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="p-2 rounded border">
          <option value="PRE_MOLDADO">Email pré-moldado</option>
          <option value="OBRA">Email obra</option>
          <option value="GENERICO">Email genérico</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Cole a lista (nome,email,empresa por linha)</label>
        <textarea className="w-full p-2 border rounded h-40" value={text} onChange={e => setText(e.target.value)} />
        <div className="mt-2">
          <button className="px-3 py-1 bg-slate-200 rounded mr-2" onClick={parse}>Parsear lista</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={send} disabled={sending}>{sending ? 'Enviando...' : 'Disparar campanha'}</button>
        </div>
      </div>

      <div className="mb-3">
        <h3 className="font-semibold">Destinatários ({destinatarios.length})</h3>
        <div className="mt-2 max-h-48 overflow-auto bg-white rounded p-2 border">
          {destinatarios.length === 0 ? <div className="text-sm text-slate-500">Nenhum</div> : (
            <ul className="text-sm">
              {destinatarios.map((d, i) => (
                <li key={i}>{d.nome} — {d.email} — {d.empresa}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-4 p-3 bg-white border rounded">
          <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
