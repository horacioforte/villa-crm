"use client";

// ARQUIVO: components/inteligencia/InteligenciaSidebar.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Sidebar escura exclusiva do Centro de Inteligência Comercial.
// V1.0 — João como colaborador digital com status dinâmico, progresso e dossiê em investigação.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart2,
  Bot,
  Brain,
  Building2,
  ChevronLeft,
  FolderOpen,
  Radar,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuPrincipal = [
  { label: "Visão Geral",          href: "/inteligencia",  icon: Brain,      exact: true },
  { label: "Dossiês Comerciais",   href: "/inteligencia",  icon: FolderOpen, exact: true, badge: true },
  { label: "Radar de Oportunidades", href: "/inteligencia", icon: Radar,     exact: false },
];

const menuDados = [
  { label: "Empresas",   href: "/inteligencia", icon: Building2, exact: false },
  { label: "Decisores",  href: "/inteligencia", icon: Users,     exact: false },
  { label: "Campanhas",  href: "/campanhas",    icon: Target,    exact: false },
];

const menuSistema = [
  { label: "João Hunter IA",  href: "/inteligencia", icon: Bot,      exact: false },
  { label: "Analytics",       href: "/inteligencia", icon: BarChart2,exact: false },
  { label: "Configurações",   href: "/inteligencia", icon: Settings, exact: false },
];

type MenuItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }>; exact: boolean; badge?: boolean };

function NavItem({ item, pathname, totalDossies }: { item: MenuItem; pathname: string; totalDossies?: number }) {
  const isActive = item.exact ? pathname === "/inteligencia" : false;
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

type Props = { totalDossies?: number };

export function InteligenciaSidebar({ totalDossies }: Props) {
  const pathname = usePathname();
  const [joao, setJoao] = useState<JoaoSidebarStatus | null>(null);

  useEffect(() => {
    fetch("/api/inteligencia/cockpit")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.joao) setJoao(data.joao);
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
        {menuPrincipal.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} totalDossies={totalDossies} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Dados
        </p>
        {menuDados.map(item => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}

        <p className="px-3 pt-4 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Sistema
        </p>
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

      {/* João status — colaborador digital da equipe */}
      <div className="p-3 border-t border-white/5" style={{ background: "rgba(0,0,0,0.2)" }}>
        {/* Header João */}
        <div className="flex items-center gap-2 mb-2.5">
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
              <p className="text-[10px] text-emerald-500 font-medium truncate">
                {joao
                  ? `${joao.totalDossies} dossiês · ${joao.dossiesInvestigando ?? 0} investigando`
                  : "Ativo"}
              </p>
            </div>
          </div>
        </div>

        {/* Detalhes do colaborador */}
        <div className="space-y-2">
          {/* Missão atual */}
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-0.5">
              Missão atual
            </p>
            <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">
              {joao?.missaoAtual ?? "Monitorando o mercado"}
            </p>
          </div>

          {/* Dossiê em investigação — link clicável */}
          {joao?.dossieAtual && (
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-0.5">
                Investigando
              </p>
              <Link
                href={`/inteligencia/${joao.dossieAtual.id}`}
                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors leading-snug line-clamp-1 block"
                title={joao.dossieAtual.titulo}
              >
                → {joao.dossieAtual.titulo}
              </Link>
            </div>
          )}

          {/* Progresso da missão (barra) */}
          {joao?.progressoMissao != null && (
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Completude do dossiê
                </p>
                <span className="text-[9px] font-medium text-slate-500">{joao.progressoMissao}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${joao.progressoMissao}%` }}
                />
              </div>
            </div>
          )}

          {/* Descobertas nas últimas 24h */}
          {joao != null && joao.descobertas24h > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-400">
                {joao.descobertas24h} descoberta{joao.descobertas24h !== 1 ? "s" : ""} nas últimas 24h
              </p>
            </div>
          )}

          {/* Última descoberta */}
          {joao?.ultimaDescoberta && (
            <div>
              <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-0.5">
                Última descoberta
              </p>
              <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                {joao.ultimaDescoberta.descricao}
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">
                {new Date(joao.ultimaDescoberta.quando).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          )}

          {/* Próxima investigação */}
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-0.5">
              Próxima investigação
            </p>
            <p className="text-[10px] text-slate-600 italic">
              Contínua — em monitoramento
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
