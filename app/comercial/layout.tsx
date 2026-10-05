// ARQUIVO: app/comercial/layout.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Layout das rotas /comercial/* — reutiliza a sidebar escura da Central de Inteligência
// para que o item "CRM João — Concreteiras" apareça na seção COMERCIAL com estado ativo.
// Criado em 01/10/2026.

import { InteligenciaSidebar } from "@/components/inteligencia/InteligenciaSidebar";
import { SidebarResponsiva } from "@/components/base-nacional/SidebarResponsiva";

// 02/10/2026: no celular a barra vira gaveta (SidebarResponsiva). No computador, igual ao anterior.
// InteligenciaSidebar continua importada para referência; a renderização passou para SidebarResponsiva.
void InteligenciaSidebar;

export default function ComercialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 md:flex-row">
      <SidebarResponsiva />
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
