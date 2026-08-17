"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart2,
  Bot,
  Brain,
  Building2,
  CalendarCheck,
  ChevronDown,
  ClipboardList,
  HardHat,
  History,
  MessageCircle,
  MessageSquarePlus,
  Sparkles,
  Truck,
  UserCog,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Itens primários — sempre visíveis
const primaryItems = [
  { label: "Relatórios", href: "/relatorios", icon: BarChart2 },
  { label: "Saúde Comercial", href: "/saude-comercial", icon: Activity },
  { label: "Oportunidades", href: "/oportunidades", icon: ClipboardList },
  { label: "Conversas", href: "/conversas", icon: MessageCircle },
  { label: "Inteligência", href: "/inteligencia", icon: Brain },
  { label: "Maria", href: "/maria", icon: Sparkles },
  { label: "Agenda", href: "/tarefas", icon: CalendarCheck },
];

// Itens secundários — ficam no dropdown "Mais ▾"
const secondaryItems = [
  { label: "Empresas", href: "/empresas", icon: Building2 },
  { label: "Contatos", href: "/contatos", icon: Users },
  { label: "Obras", href: "/obras", icon: HardHat },
  { label: "Feedback", href: "/feedback", icon: MessageSquarePlus },
  { label: "Equipamentos", href: "/equipamentos", icon: Truck },
  { label: "Usuarios", href: "/usuarios", icon: UserCog },
  { label: "Campanhas", href: "/campanhas", icon: Bot },
  { label: "Agentes", href: "/admin/agentes", icon: Bot, adminOnly: true },
  {
    label: "Auditoria do Pipeline",
    href: "/auditoria/pipeline",
    icon: History,
    visibleRoles: ["ADMIN", "GERENTE"],
  },
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [papel, setPapel] = useState<string | null>(null);
  const [maisAberto, setMaisAberto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    async function loadSession() {
      const response = await fetch("/api/auth/session");
      if (!response.ok) return;
      const session = await response.json();
      setIsAdmin(session?.user?.papel === "ADMIN");
      setPapel(session?.user?.papel ?? null);
    }
    loadSession();
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMaisAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSecondary = secondaryItems
    .filter((item) => !item.adminOnly || isAdmin)
    .filter((item) => !item.visibleRoles || (papel && item.visibleRoles.includes(papel)));

  // Se a página atual é um item secundário, destaca o botão "Mais"
  const isSecondaryActive = filteredSecondary.some(
    (item) =>
      currentHref === item.href ||
      (item.href !== "/" && currentHref?.startsWith(item.href))
  );

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

        <nav className="flex flex-wrap items-center gap-2" aria-label="Menu principal">
          {/* Itens primários */}
          {primaryItems.map((item) => {
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

          {/* Dropdown "Mais ▾" */}
          {filteredSecondary.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setMaisAberto((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold transition",
                  isSecondaryActive
                    ? "bg-[#1A2E5A] text-white"
                    : "bg-[#F4F6FA] text-[#1A2E5A] hover:bg-[#E8EEFB]",
                )}
              >
                Mais
                <ChevronDown
                  className={cn("size-3.5 transition-transform", maisAberto && "rotate-180")}
                />
              </button>

              {maisAberto && (
                <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-[#D7DEEA] bg-white py-2 shadow-lg">
                  {filteredSecondary.map((item) => {
                    const isActive =
                      currentHref === item.href ||
                      (item.href !== "/" && currentHref?.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMaisAberto(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition",
                          isActive
                            ? "bg-[#E8EEFB] text-[#1A2E5A]"
                            : "text-[#1A2E5A] hover:bg-[#F4F6FA]",
                        )}
                      >
                        <item.icon className="size-4 flex-shrink-0 text-[#667085]" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
