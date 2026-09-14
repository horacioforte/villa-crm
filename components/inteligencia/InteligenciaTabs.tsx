// ARQUIVO: components/inteligencia/InteligenciaTabs.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Abas [João] [Maria] dentro do Centro de Inteligência.
// Criado em 14/09/2026.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function InteligenciaTabs() {
  const pathname = usePathname();
  const isMaria = pathname.startsWith("/inteligencia/maria");

  return (
    <div
      className="flex items-center gap-1 px-5 py-2.5 flex-shrink-0 border-b border-white/10"
      style={{ background: "#0D1829" }}
    >
      <Link
        href="/inteligencia"
        className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
          !isMaria
            ? "bg-[#1A3A6B] text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        João
      </Link>
      <Link
        href="/inteligencia/maria"
        className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
          isMaria
            ? "bg-[#1A3A6B] text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Maria ✦
      </Link>
    </div>
  );
}
