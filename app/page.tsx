import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  HardHat,
  Menu,
  Phone,
  Search,
  Settings,
  Truck,
  UserCog,
  Users,
} from "lucide-react";

import {
  StatusEquipamento,
  StatusOportunidade,
} from "@/app/generated/prisma/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const [
    oportunidadesAbertas,
    propostasEnviadas,
    equipamentosDisponiveis,
  ] = await Promise.all([
    prisma.oportunidade.count({
      where: {
        ativa: true,
        status: {
          notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
        },
      },
    }),
    prisma.oportunidade.count({
      where: {
        ativa: true,
        status: StatusOportunidade.PROPOSTA_ENVIADA,
      },
    }),
    prisma.equipamento.count({
      where: {
        status: StatusEquipamento.DISPONIVEL,
      },
    }),
  ]);

  const menuItems = [
    { label: "Dashboard", icon: ChartNoAxesCombined, href: "/", active: true },
    { label: "Empresas", icon: Building2, href: "/empresas" },
    { label: "Pessoas", icon: Users, href: "/contatos" },
    { label: "Obras", icon: HardHat, href: "/obras" },
    { label: "Oportunidades", icon: ClipboardList, href: "/oportunidades" },
    { label: "Equipamentos", icon: Truck, href: "/equipamentos" },
    { label: "Usuarios", icon: UserCog, href: "/usuarios" },
    { label: "Agenda", icon: CalendarDays, href: "#" },
  ];

  const metrics = [
    {
      label: "Oportunidades abertas",
      value: oportunidadesAbertas.toString(),
      detail: "Ativas, sem ganhas ou perdidas",
    },
    {
      label: "Propostas enviadas",
      value: propostasEnviadas.toString(),
      detail: "Oportunidades ativas em proposta",
    },
    {
      label: "Equipamentos disponiveis",
      value: equipamentosDisponiveis.toString(),
      detail: "Status DISPONIVEL no cadastro",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-[#172033]">
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-[#1A2E5A] text-white lg:flex">
        <Link
          href="/"
          className="border-b border-white/10 px-8 py-7 transition hover:bg-white/10"
          aria-label="Ir para o dashboard"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/60">
            Villa
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Villa CRM</h1>
        </Link>
        <nav className="flex flex-1 flex-col gap-2 px-4 py-6">
          {menuItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                item.active
                  ? "bg-white text-[#1A2E5A] shadow-lg shadow-black/10"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="size-5" />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <a
            href="#"
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <Settings className="size-5" />
            Configuracoes
          </a>
          <LogoutButton />
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-[#D7DEEA] bg-white/90 backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="rounded-xl border border-[#D7DEEA] p-2 text-[#1A2E5A] lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="size-5" />
              </button>
              <div>
                <p className="text-sm font-semibold text-[#1E4FAB]">
                  Sprint 1
                </p>
                <h2 className="text-xl font-bold text-[#1A2E5A] sm:text-2xl">
                  Painel comercial
                </h2>
              </div>
            </div>
            <div className="hidden min-w-72 items-center gap-3 rounded-2xl border border-[#D7DEEA] bg-[#F4F6FA] px-4 py-3 text-sm text-[#667085] md:flex">
              <Search className="size-4" />
              Buscar empresas, obras ou oportunidades
            </div>
          </div>
        </header>

        <main className="px-5 py-8 sm:px-8">
          <section className="rounded-3xl bg-[#1A2E5A] p-8 text-white shadow-xl shadow-[#1A2E5A]/10">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/60">
                Villa Empreendimentos
              </p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Gestao de locacao e venda de bombas de concreto e betoneiras
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">
                Centralize empresas, contatos, obras, oportunidades e historico
                comercial em um fluxo unico para o time da Villa.
              </p>
            </div>
          </section>

          <section className="mt-8 grid gap-5 md:grid-cols-3">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className="rounded-3xl border border-[#D7DEEA] bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-semibold text-[#667085]">
                  {metric.label}
                </p>
                <strong className="mt-3 block text-4xl font-bold text-[#1A2E5A]">
                  {metric.value}
                </strong>
                <p className="mt-2 text-sm text-[#1E4FAB]">{metric.detail}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <article className="rounded-3xl border border-[#D7DEEA] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1E4FAB]">
                    Pipeline
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-[#1A2E5A]">
                    Oportunidades recentes
                  </h3>
                </div>
                <ClipboardList className="size-7 text-[#1E4FAB]" />
              </div>
              <div className="mt-6 space-y-4">
                {["Locacao de bomba estacionaria", "Venda de betoneira 400L", "Contrato mensal para obra residencial"].map(
                  (title) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-[#D7DEEA] p-4"
                    >
                      <p className="font-semibold text-[#1A2E5A]">{title}</p>
                      <p className="mt-1 text-sm text-[#667085]">
                        Proxima acao: contato comercial e envio de proposta.
                      </p>
                    </div>
                  ),
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-[#D7DEEA] bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#E8EEFB] p-3 text-[#1E4FAB]">
                  <Phone className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#667085]">
                    Proximo contato
                  </p>
                  <h3 className="text-xl font-bold text-[#1A2E5A]">
                    Construtora Almeida
                  </h3>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-[#667085]">
                Retornar sobre disponibilidade de bomba de concreto para obra
                em andamento e registrar historico da negociacao.
              </p>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
