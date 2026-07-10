// ARQUIVO: app/inteligencia/layout.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Layout dedicado do Centro de Inteligência Comercial.
// Substitui o PageNavigation padrão do CRM por sidebar escura própria.
// Envolve todas as rotas sob /inteligencia/* automaticamente (Next.js App Router).

import { InteligenciaSidebar } from "@/components/inteligencia/InteligenciaSidebar";

export default function InteligenciaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar escura — identidade exclusiva da Central */}
      <InteligenciaSidebar />

      {/* Área de conteúdo principal */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
