"use client";

// ARQUIVO: components/inteligencia/InteligenciaSidebar.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Sidebar escura exclusiva do Centro de Inteligência Comercial.
// V1.0 — João como colaborador digital com status dinâmico, progresso e dossiê em investigação.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot,
  Brain,
  Building2,
  ChevronLeft,
  Factory,
  FolderOpen,
  Inbox,
  Radar,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Centro de Inteligência — entrada principal
const menuVisao = [
  { label: "Visão Geral", href: "/inteligencia", icon: Brain, exact: true },
];

// Seção João — ações e ferramentas do agente
const menuJoao = [
  { label: "Radar", href: "/inteligencia", icon: Radar, exact: true },
  { label: "Dossiês Comerciais", href: "/inteligencia/dossies", icon: FolderOpen, exact: false, badge: true },
  { label: "Minhas Solicitações", href: "/inteligencia/minhas-solicitacoes", icon: Inbox, exact: false },
];

const menuCarteiras = [
  { label: "Construtoras", href: "/inteligencia/carteiras/construtoras-brasil", icon: Building2, exact: false },
  { label: "Minha Casa Minha Vida", href: "/inteligencia/carteiras/mcmv", icon: Building2, exact: false },
  { label: "Pré-moldados", href: "/inteligencia/carteiras/pre-moldados", icon: Target, exact: false },
  { label: "Concreteiras", href: "/inteligencia/carteiras/concreteiras", icon: Factory, exact: false },
  { label: "Agências de Caminhões", href: "/inteligencia/carteiras/revendas-caminhoes", icon: Users, exact: false },
];

const menuComercial = [
  { label: "Empresas", href: "/empresas", icon: Building2, exact: false },
  { label: "Decisores", href: "/contatos", icon: Users, exact: false },
  { label: "Campanhas", href: "/campanhas", icon: Target, exact: false },
];

const menuCanais = [
  { label: "LinkedIn", href: "/inteligencia/linkedin", icon: Users, exact: false },
];

// menuSistema mantido para compatibilidade futura — itens removidos da nav principal
// conforme redesign executivo 08/09/2026 (mantidos aqui, não excluídos)
const menuSistema: typeof menuVisao = [];

type MenuItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }>; exact: boolean; badge?: boolean };

function NavItem({ item, pathname, totalDossies }: { item: MenuItem; pathname: string; totalDossies?: number }) {
  const isActive = item.exact
    ? pathname === item.href || pathname === "/inteligencia"
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
        isActive
          ? "bg-blue-600/20 text-blue-300 font-medium"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
      )}
    >
      <item.icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge && totalDossies && totalDossies > 0 ? (
        <span className="bg-blue-600/30 text-blue-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
          {totalDossies}
        </span>
      ) : null}
    </Link>
  );
}

type JoaoSidebarStatus = {
  totalDossies: number;
  dossiesInvestigando: number;
  missaoAtual: string;
  dossieAtual?: { id: string; titulo: string } | null;
  progressoMissao?: number | null;
  descobertas24h: number;
  ultimaDescoberta?: { descricao: string; dossie: string; dossieId: string; quando: string } | null;
};

type CockpitData = {
  joao?: JoaoSidebarStatus;
  solicitacoesCount?: number;
};

type Props = { totalDossies?: number };

export function InteligenciaSidebar({ totalDossies }: Props) {
  const pathname = usePathname();
  const [joao, setJoao] = useState<JoaoSidebarStatus | null>(null);
  const [solicitacoesCount, setSolicitacoesCount] = useState<number>(0);

  useEffect(() => {
    fetch("/api/inteligencia/cockpit")
      .then(r => r.ok ? r.json() : null)
      .then((data: CockpitData | null) => {
        if (data?.joao) setJoao(data.joao);
        if (typeof data?.solicitacoesCount === "number") setSolicitacoesCount(data.solicitacoesCount);
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col border-r border-white/5" style={{ background: "#0D1829" }}>
      {/* Brand */}
      <div className="px-4 py-4 border-b border-white/5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
          Centro de Inteligência
        </p>
        <Link href="/oportunidades" className="flex items-center gap-2 group">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover:opacity-80 transition-opacity"
            style={{ background: "#1A3A6B" }}
          >
            V
          </div>
          <span className="text-sm font-semibold text-slate-200 leading-tight group-hover:text-white transition-colors">Villa<br />Empreendimentos</span>
        </Link>
      </div>
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Centro de Inteligência
        </p>
        {menuVisao.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          João
        </p>
        {menuJoao.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} totalDossies={item.badge ? joao?.totalDossies ?? totalDossies : undefined} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Carteiras do João
        </p>
        {menuCarteiras.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Comercial
        </p>
        {menuComercial.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Canais
        </p>
        {menuCanais.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        <div className="pt-4" />
        {menuSistema.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        {/* Saída */}
        <div className="pt-5 pb-1">
          <div
            className="mx-1 rounded-lg p-2.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[9px] text-slate-600 mb-1.5">Saída da Central</p>
            <Link
              href="/oportunidades"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
              Voltar ao CRM Comercial
            </Link>
          </div>
        </div>
      </nav>

      {/* João status — identificação simplificada (detalhes ocultados a pedido de Horacio 13/07/2026) */}
      <div className="p-3 border-t border-white/5" style={{ background: "rgba(0,0,0,0.2)" }}>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1e3a5f, #1d4ed8)" }}
          >
            🤖
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-300">João Hunter IA</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
              <p className="text-[10px] text-emerald-500 font-medium">Ativo</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
