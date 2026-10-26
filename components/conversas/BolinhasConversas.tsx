"use client";
// ACRESCENTADO — bolinhas ao lado do item "Conversas" do menu:
// vermelha = urgentes (> 4h sem resposta); azul = chegaram e ninguém respondeu (<= 4h).
// Atualiza a cada 30s; falha silenciosa (sem bolinha) se a API não responder.
import { useEffect, useState } from "react";

type Resumo = { urgentes: number; novas: number };

export function BolinhasConversas() {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const resp = await fetch("/api/conversas/resumo-espera");
        if (!resp.ok || cancelado) return;
        const data = await resp.json();
        if (!cancelado && typeof data?.urgentes === "number" && typeof data?.novas === "number") {
          setResumo(data);
        }
      } catch {
        // best-effort
      }
    }
    carregar();
    const timer = setInterval(carregar, 30_000);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, []);

  if (!resumo || (resumo.urgentes === 0 && resumo.novas === 0)) return null;

  return (
    <span className="ml-auto inline-flex items-center gap-1">
      {resumo.urgentes > 0 ? (
        <span
          title={`${resumo.urgentes} urgente(s): mais de 4h sem resposta`}
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
        >
          {resumo.urgentes}
        </span>
      ) : null}
      {resumo.novas > 0 ? (
        <span
          title={`${resumo.novas} conversa(s) chegaram e ninguém respondeu`}
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
        >
          {resumo.novas}
        </span>
      ) : null}
    </span>
  );
}
