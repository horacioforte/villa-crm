"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarCheck,
  ChartNoAxesCombined,
  ClipboardList,
  HardHat,
  MessageSquarePlus,
  Truck,
  UserCog,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const menuItems = [
  { label: "Dashboard", href: "/", icon: ChartNoAxesCombined },
  { label: "Empresas", href: "/empresas", icon: Building2 },
  { label: "Contatos", href: "/contatos", icon: Users },
  { label: "Obras", href: "/obras", icon: HardHat },
  { label: "Oportunidades", href: "/oportunidades", icon: ClipboardList },
  { label: "Agenda", href: "/tarefas", icon: CalendarCheck },
  { label: "Feedback", href: "/feedback", icon: MessageSquarePlus },
  { label: "Equipamentos", href: "/equipamentos", icon: Truck },
  { label: "Usuarios", href: "/usuarios", icon: UserCog },
];

type PageNavigationProps = {
  currentPage: string;
  currentHref?: string;
};

export function PageNavigation({
  currentPage,
  currentHref,
}: PageNavigationProps) {
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState(0);

  useEffect(() => {
    async function loadTarefasAtrasadas() {
      const response = await fetch("/api/tarefas?status=ATRASADA&periodo=todas");

      if (response.ok) {
        const data = await response.json();
        setTarefasAtrasadas(Array.isArray(data) ? data.length : 0);
      }
    }

    loadTarefasAtrasadas();
  }, []);

  return (
    <div className="mb-8 rounded-3xl border border-[#D7DEEA] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-2xl px-2 py-1 transition hover:bg-[#F4F6FA]"
          aria-label="Voltar para o dashboard"
        >
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#1A2E5A] text-sm font-bold text-white">
            V
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa
            </p>
            <p className="text-lg font-bold text-[#1A2E5A] group-hover:text-[#1E4FAB]">
              Villa CRM
            </p>
          </div>
        </Link>

        <nav className="flex flex-wrap gap-2" aria-label="Menu principal">
          {menuItems.map((item) => {
            const isActive =
              currentHref === item.href ||
              (item.href !== "/" && currentHref?.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-[#1A2E5A] text-white"
                    : "bg-[#F4F6FA] text-[#1A2E5A] hover:bg-[#E8EEFB]",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
                {item.href === "/tarefas" && tarefasAtrasadas > 0 ? (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {tarefasAtrasadas}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#D7DEEA] pt-4 text-sm">
        <Link href="/" className="font-semibold text-[#1E4FAB] hover:underline">
          Dashboard
        </Link>
        <span className="text-[#98A2B3]">/</span>
        <span className="font-semibold text-[#1A2E5A]">{currentPage}</span>
      </div>
    </div>
  );
}
