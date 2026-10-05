"use client";

// ARQUIVO: app/comercial/concreteiras/base/CidadeAutocomplete.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Campo de cidade com busca no servidor (máx. 20 sugestões). Não carrega todas as cidades.

import { useEffect, useId, useRef, useState } from "react";

export function CidadeAutocomplete({ valorInicial, className }: { valorInicial?: string; className?: string }) {
  const [valor, setValor] = useState(valorInicial ?? "");
  const [sugestoes, setSugestoes] = useState<Array<{ cidade: string; uf: string | null }>>([]);
  const ref = useRef<HTMLInputElement>(null);
  const listaId = useId();

  useEffect(() => {
    const termo = valor.trim();
    if (termo.length < 2) return; // sugestões são limpas no onChange
    const controle = new AbortController();
    const t = setTimeout(async () => {
      const uf = (ref.current?.form?.elements.namedItem("uf") as HTMLSelectElement | null)?.value ?? "";
      try {
        const r = await fetch(`/api/base-nacional/cidades?q=${encodeURIComponent(termo)}${uf ? `&uf=${uf}` : ""}`, { signal: controle.signal });
        if (r.ok) setSugestoes((await r.json()).cidades ?? []);
      } catch { /* digitação cancelou a busca */ }
    }, 250);
    return () => { clearTimeout(t); controle.abort(); };
  }, [valor]);

  return (
    <>
      <input
        ref={ref}
        name="cidade"
        value={valor}
        onChange={e => { setValor(e.target.value); if (e.target.value.trim().length < 2) setSugestoes([]); }}
        list={listaId}
        autoComplete="off"
        placeholder="Cidade (digite 2 letras)"
        aria-label="Cidade"
        className={className}
      />
      <datalist id={listaId}>
        {sugestoes.map(s => <option key={`${s.cidade}-${s.uf}`} value={s.cidade}>{s.uf ?? ""}</option>)}
      </datalist>
    </>
  );
}
