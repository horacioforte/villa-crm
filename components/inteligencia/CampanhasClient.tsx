"use client";
import { useState } from "react";

type Dest = { nome: string; email: string; empresa: string; cidade?: string; estado?: string; cargo?: string; segmento?: string; observacoes?: string };

export default function CampanhasClient() {
  const [text, setText] = useState("");
  const [tipo, setTipo] = useState("PRE_MOLDADO");
  const [destinatarios, setDestinatarios] = useState<Dest[]>([]);
  const [sending, setSending] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [statusLines, setStatusLines] = useState<Array<{email:string; empresa:string; status:string; detalhe?:string}>>([]);

  function parse() {
    const rows = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
    const parsed: Dest[] = rows.map(r => {
      const parts = r.split(",").map(p => p.trim());
      return { nome: parts[0] ?? "-", email: parts[1] ?? "", empresa: parts[2] ?? "" };
    }).filter(d => d.email && d.nome);
    setDestinatarios(parsed);
  }

  async function fetchPreview() {
    if (destinatarios.length === 0) return alert('Parseie a lista primeiro para gerar preview.');
    const first = destinatarios[0];
    try {
      const res = await fetch('/api/inteligencia/campanhas/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, destinatario: first }),
      });
      const data = await res.json();
      setPreviewSubject(data.subject);
      setPreviewHtml(data.html);
    } catch (err) {
      alert('Erro ao gerar preview: ' + String(err));
    }
  }

  async function streamSend() {
    if (destinatarios.length === 0) return alert("Adicione destinatários antes de enviar.");
    setSending(true);
    setStatusLines([]);

    try {
      const res = await fetch('/api/inteligencia/campanhas/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, destinatarios }),
      });

      if (!res.body) throw new Error('Resposta sem stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.finished) {
              // finished marker
            } else {
              setStatusLines(prev => [...prev, parsed]);
            }
          } catch (e) {
            console.warn('ignorar linha inválida', line);
          }
        }
      }

    } catch (err) {
      alert('Erro no envio: ' + String(err));
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
          <button className="px-3 py-1 bg-sky-500 text-white rounded mr-2" onClick={fetchPreview}>Gerar preview</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={streamSend} disabled={sending}>{sending ? 'Enviando...' : 'Disparar campanha (stream)'}</button>
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

      {previewHtml && (
        <div className="mb-3 p-3 bg-white border rounded">
          <h4 className="font-medium mb-2">Preview — {previewSubject}</h4>
          <div className="border p-3" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}

      <div className="mb-3">
        <h3 className="font-semibold">Status em tempo real</h3>
        <div className="mt-2 max-h-48 overflow-auto bg-white rounded p-2 border text-sm">
          {statusLines.length === 0 ? <div className="text-slate-500">Nenhum status ainda</div> : (
            <ul>
              {statusLines.map((s, i) => (
                <li key={i} className={s.status === 'enviado' ? 'text-green-600' : 'text-red-600'}>{s.email} — {s.empresa} — {s.status}{s.detalhe ? ` — ${s.detalhe}` : ''}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
