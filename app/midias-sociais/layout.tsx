import type { ReactNode } from "react";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { MidiasSociaisTabs } from "@/components/midias-sociais/MidiasSociaisTabs";

// Layout compartilhado por /midias-sociais e todas as subrotas
// (instagram, facebook, youtube, configuracoes). Mantém o cabeçalho padrão
// do CRM (PageNavigation) e adiciona a barra de abas específica da Central
// de Mídias Sociais — mesma convenção visual das demais páginas do Villa CRM.
export default function MidiasSociaisLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-8 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation currentPage="Mídias Sociais" currentHref="/midias-sociais" />
        <MidiasSociaisTabs />
        {children}
      </div>
    </main>
  );
}
