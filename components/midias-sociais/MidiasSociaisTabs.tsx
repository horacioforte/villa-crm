"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, LayoutGrid, Play, Settings, ThumbsUp } from "lucide-react";

import { cn } from "@/lib/utils";

// lucide-react não exporta mais ícones de marca (Facebook/Instagram/Youtube
// foram removidos por questão de trademark) — usamos ícones genéricos que
// remetem a cada rede.
const tabs = [
  { label: "Visão Geral", href: "/midias-sociais", icon: LayoutGrid },
  { label: "Instagram", href: "/midias-sociais/instagram", icon: Camera },
  { label: "Facebook", href: "/midias-sociais/facebook", icon: ThumbsUp },
  { label: "YouTube", href: "/midias-sociais/youtube", icon: Play },
];

export function MidiasSociaisTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#D7DEEA] bg-white p-2">
      <nav className="flex flex-wrap gap-1" aria-label="Abas de Mídias Sociais">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/midias-sociais"
              ? pathname === tab.href
              : pathname?.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition",
                isActive
                  ? "bg-[#1A2E5A] text-white"
                  : "text-[#667085] hover:bg-[#F4F6FA] hover:text-[#1A2E5A]",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/midias-sociais/configuracoes"
        className={cn(
          "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition",
          pathname?.startsWith("/midias-sociais/configuracoes")
            ? "bg-[#1A2E5A] text-white"
            : "bg-[#F4F6FA] text-[#1A2E5A] hover:bg-[#E8EEFB]",
        )}
      >
        <Settings className="size-4" />
        Configurações
      </Link>
    </div>
  );
}
