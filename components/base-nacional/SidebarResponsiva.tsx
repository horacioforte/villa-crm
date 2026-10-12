"use client";

// ARQUIVO: components/base-nacional/SidebarResponsiva.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Envolve a InteligenciaSidebar SEM alterá-la: no computador ela aparece como antes;
// no celular vira uma gaveta aberta por um botão, liberando a tela para o conteúdo.
// Usada apenas no layout /comercial/*. As telas /inteligencia/* não mudam.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { InteligenciaSidebar } from "@/components/inteligencia/InteligenciaSidebar";

export function SidebarResponsiva() {
  const pathname = usePathname();
  // Guarda a página em que a gaveta foi aberta: ao navegar, ela fecha sozinha.
  const [abertaEm, setAbertaEm] = useState<string | null>(null);
  const aberta = abertaEm !== null && abertaEm === pathname;
  const setAberta = (v: boolean) => setAbertaEm(v ? pathname : null);

  return (
    <>
      {/* Computador: barra fixa, igual ao comportamento anterior */}
      <div className="hidden md:flex">
        <InteligenciaSidebar />
      </div>

      {/* Celular: barra superior compacta */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 md:hidden" style={{ background: "#0D1829" }}>
        <button type="button" onClick={() => setAberta(true)} aria-label="Abrir menu"
          className="rounded-md p-1.5 text-slate-200 hover:bg-white/10">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-slate-200">Villa CRM</span>
      </div>

      {aberta && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div className="flex h-full max-w-[80vw] overflow-y-auto">
            <InteligenciaSidebar />
          </div>
          <button type="button" aria-label="Fechar menu" onClick={() => setAberta(false)}
            className="flex-1 bg-black/40">
            <X className="ml-auto mr-3 mt-3 h-6 w-6 text-white" />
          </button>
        </div>
      )}
    </>
  );
}
