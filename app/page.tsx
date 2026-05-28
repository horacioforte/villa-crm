import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  FileText,
  HardHat,
  Menu,
  MessageCircle,
  Phone,
  PhoneCall,
  Search,
  Settings,
  Truck,
  UserCog,
  Users,
} from "lucide-react";

import {
  StatusExcecaoProposta,
  StatusEquipamento,
  StatusOportunidade,
  StatusPropostaComercial,
  type Prisma,
} from "@/app/generated/prisma/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ProposalQuickActions } from "@/components/dashboard/ProposalQuickActions";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const pendingProposalStatuses: StatusPropostaComercial[] = [
  StatusPropostaComercial.RASCUNHO,
  StatusPropostaComercial.AGUARDANDO_APROVACAO,
  StatusPropostaComercial.APROVADA,
  StatusPropostaComercial.ENVIADA,
];

const proposalStatusConfig: Record<
  StatusPropostaComercial,
  { label: string; className: string }
> = {
  RASCUNHO: {
    label: "Aguardando revisao",
    className: "bg-amber-100 text-amber-800",
  },
  AGUARDANDO_APROVACAO: {
    label: "Aguardando aprovacao",
    className: "bg-amber-100 text-amber-800",
  },
  APROVADA: {
    label: "Aprovada",
    className: "bg-emerald-100 text-emerald-700",
  },
  ENVIADA: {
    label: "Aguardando cliente",
    className: "bg-blue-100 text-blue-700",
  },
  ACEITA: {
    label: "Aceita",
    className: "bg-green-100 text-green-700",
  },
  REJEITADA: {
    label: "Rejeitada",
    className: "bg-red-100 text-red-700",
  },
  VENCIDA: {
    label: "Vencida",
    className: "bg-zinc-100 text-zinc-700",
  },
  CANCELADA: {
    label: "Cancelada",
    className: "bg-zinc-100 text-zinc-700",
  },
};

const opportunityStatusConfig: Record<
  StatusOportunidade,
  { label: string; className: string }
> = {
  NOVA: { label: "Nova", className: "bg-blue-100 text-blue-700" },
  EM_ATENDIMENTO: {
    label: "Em atendimento",
    className: "bg-blue-100 text-blue-700",
  },
  PROPOSTA_ENVIADA: {
    label: "Proposta enviada",
    className: "bg-amber-100 text-amber-800",
  },
  NEGOCIACAO: {
    label: "Negociacao",
    className: "bg-blue-100 text-blue-700",
  },
  GANHA: { label: "Ganha", className: "bg-green-100 text-green-700" },
  PERDIDA: { label: "Perdida", className: "bg-red-100 text-red-700" },
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatCurrency(value: string | number | { toString(): string } | null) {
  if (value === null) {
    return "Valor nao informado";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function daysFromNow(value: Date) {
  const oneDay = 1000 * 60 * 60 * 24;
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / oneDay);
}

function getClientName(proposta: {
  oportunidade: {
    empresa: {
      razaoSocial: string;
      nomeFantasia: string | null;
    };
  };
}) {
  return (
    proposta.oportunidade.empresa.nomeFantasia ??
    proposta.oportunidade.empresa.razaoSocial
  );
}

function getProposalPriority(proposta: {
  status: StatusPropostaComercial;
  validadeProposta: Date;
  excecoes: Array<{ status: StatusExcecaoProposta }>;
}) {
  const pendingExceptions = proposta.excecoes.filter(
    (excecao) => excecao.status === StatusExcecaoProposta.PENDENTE,
  ).length;
  const daysToExpire = daysFromNow(proposta.validadeProposta);

  if (
    daysToExpire < 0 ||
    proposta.status === StatusPropostaComercial.REJEITADA
  ) {
    return {
      label: "Atrasada",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (
    pendingExceptions > 0 ||
    proposta.status === StatusPropostaComercial.AGUARDANDO_APROVACAO ||
    daysToExpire <= 2
  ) {
    return {
      label: "Alta",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (
    proposta.status === StatusPropostaComercial.ENVIADA ||
    proposta.status === StatusPropostaComercial.RASCUNHO ||
    proposta.status === StatusPropostaComercial.APROVADA
  ) {
    return {
      label: "Media",
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  return {
    label: "Baixa",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };
}

function getLeadTemperature(lastContactAt?: Date | null) {
  if (!lastContactAt) {
    return {
      label: "Sem historico",
      className: "bg-zinc-100 text-zinc-700",
    };
  }

  const daysSinceContact = Math.abs(daysFromNow(lastContactAt));

  if (daysSinceContact < 3) {
    return {
      label: "Quente",
      className: "bg-green-100 text-green-700",
    };
  }

  if (daysSinceContact <= 7) {
    return {
      label: "Morna",
      className: "bg-amber-100 text-amber-800",
    };
  }

  return {
    label: "Fria",
    className: "bg-red-100 text-red-700",
  };
}

function buildWhatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;

  return `https://wa.me/${withCountryCode}`;
}

async function getProposalDashboardData(
  propostaAccessWhere: Prisma.PropostaComercialWhereInput,
) {
  try {
    const [
      propostasPendentes,
      propostasPendentesPorStatus,
      propostasRecentes,
      aguardandoAprovacaoTotal,
      propostasAguardandoAprovacao,
    ] = await Promise.all([
      prisma.propostaComercial.count({
        where: {
          ...propostaAccessWhere,
          status: {
            in: pendingProposalStatuses,
          },
        },
      }),
      prisma.propostaComercial.groupBy({
        by: ["status"],
        where: {
          ...propostaAccessWhere,
          status: {
            in: pendingProposalStatuses,
          },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.propostaComercial.findMany({
        where: propostaAccessWhere,
        orderBy: {
          updatedAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          numeroProposta: true,
          versao: true,
          status: true,
          valorTotal: true,
          validadeProposta: true,
          updatedAt: true,
          criadoPor: {
            select: {
              nome: true,
            },
          },
          oportunidade: {
            select: {
              titulo: true,
              empresa: {
                select: {
                  razaoSocial: true,
                  nomeFantasia: true,
                },
              },
              obra: {
                select: {
                  nome: true,
                },
              },
              responsavel: {
                select: {
                  nome: true,
                },
              },
            },
          },
          excecoes: {
            where: {
              status: StatusExcecaoProposta.PENDENTE,
            },
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
      prisma.propostaComercial.count({
        where: {
          ...propostaAccessWhere,
          OR: [
            { status: StatusPropostaComercial.AGUARDANDO_APROVACAO },
            {
              excecoes: {
                some: {
                  status: StatusExcecaoProposta.PENDENTE,
                },
              },
            },
          ],
        },
      }),
      prisma.propostaComercial.findMany({
        where: {
          ...propostaAccessWhere,
          OR: [
            { status: StatusPropostaComercial.AGUARDANDO_APROVACAO },
            {
              excecoes: {
                some: {
                  status: StatusExcecaoProposta.PENDENTE,
                },
              },
            },
          ],
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 4,
        select: {
          id: true,
          numeroProposta: true,
          versao: true,
          status: true,
          validadeProposta: true,
          oportunidade: {
            select: {
              titulo: true,
              empresa: {
                select: {
                  razaoSocial: true,
                  nomeFantasia: true,
                },
              },
              obra: {
                select: {
                  nome: true,
                },
              },
              responsavel: {
                select: {
                  nome: true,
                },
              },
            },
          },
          excecoes: {
            where: {
              status: StatusExcecaoProposta.PENDENTE,
            },
            select: {
              id: true,
              campo: true,
              status: true,
              createdAt: true,
              solicitante: {
                select: {
                  nome: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      propostasPendentes,
      propostasPendentesPorStatus,
      propostasRecentes,
      aguardandoAprovacaoTotal,
      propostasAguardandoAprovacao,
    };
  } catch (error) {
    console.error("Falha ao carregar dados de propostas no dashboard", error);
    return null;
  }
}

export default async function Home() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  const oportunidadeAccessWhere: Prisma.OportunidadeWhereInput = {
    ativa: true,
    ...(currentUser.papel === "COMERCIAL"
      ? {
          OR: [{ responsavelId: currentUser.id }, { createdById: currentUser.id }],
        }
      : {}),
  };
  const propostaAccessWhere: Prisma.PropostaComercialWhereInput = {
    oportunidade: oportunidadeAccessWhere,
  };

  const [
    oportunidadesAbertas,
    oportunidadesRecentes,
    proximoContato,
    equipamentosDisponiveis,
  ] = await Promise.all([
    prisma.oportunidade.count({
      where: {
        ...oportunidadeAccessWhere,
        status: {
          notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
        },
      },
    }),
    prisma.oportunidade.findMany({
      where: oportunidadeAccessWhere,
      orderBy: {
        updatedAt: "desc",
      },
      take: 4,
      select: {
        id: true,
        titulo: true,
        status: true,
        valor: true,
        updatedAt: true,
        empresa: {
          select: {
            razaoSocial: true,
            nomeFantasia: true,
          },
        },
        obra: {
          select: {
            nome: true,
          },
        },
        responsavel: {
          select: {
            nome: true,
          },
        },
        historicos: {
          orderBy: {
            dataContato: "desc",
          },
          take: 1,
          select: {
            dataContato: true,
            proximoContato: true,
          },
        },
      },
    }),
    prisma.historicoContato.findFirst({
      where: {
        proximoContato: {
          not: null,
        },
        oportunidade: {
          is: oportunidadeAccessWhere,
        },
      },
      orderBy: {
        proximoContato: "asc",
      },
      select: {
        id: true,
        resumo: true,
        proximoContato: true,
        pessoa: {
          select: {
            nome: true,
            telefone: true,
            whatsapp: true,
          },
        },
        empresa: {
          select: {
            razaoSocial: true,
            nomeFantasia: true,
            telefone: true,
          },
        },
        usuario: {
          select: {
            nome: true,
          },
        },
        oportunidade: {
          select: {
            id: true,
            titulo: true,
            status: true,
            empresa: {
              select: {
                razaoSocial: true,
                nomeFantasia: true,
                telefone: true,
              },
            },
            pessoa: {
              select: {
                nome: true,
                telefone: true,
                whatsapp: true,
              },
            },
            obra: {
              select: {
                nome: true,
              },
            },
            responsavel: {
              select: {
                nome: true,
              },
            },
            historicos: {
              orderBy: {
                dataContato: "desc",
              },
              take: 1,
              select: {
                dataContato: true,
              },
            },
          },
        },
      },
    }),
    prisma.equipamento.count({
      where: {
        status: StatusEquipamento.DISPONIVEL,
      },
    }),
  ]);

  const proposalDashboard = await getProposalDashboardData(propostaAccessWhere);
  const propostasPendentes = proposalDashboard?.propostasPendentes ?? 0;
  const propostasPendentesPorStatus =
    proposalDashboard?.propostasPendentesPorStatus ?? [];
  const propostasRecentes = proposalDashboard?.propostasRecentes ?? [];
  const aguardandoAprovacaoTotal =
    proposalDashboard?.aguardandoAprovacaoTotal ?? 0;
  const propostasAguardandoAprovacao =
    proposalDashboard?.propostasAguardandoAprovacao ?? [];

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

  const countByStatus = new Map(
    propostasPendentesPorStatus.map((item) => [item.status, item._count._all]),
  );
  const aguardandoAprovacao =
    countByStatus.get(StatusPropostaComercial.AGUARDANDO_APROVACAO) ?? 0;
  const aguardandoEnvioOuRevisao =
    (countByStatus.get(StatusPropostaComercial.RASCUNHO) ?? 0) +
    (countByStatus.get(StatusPropostaComercial.APROVADA) ?? 0);
  const aguardandoCliente =
    countByStatus.get(StatusPropostaComercial.ENVIADA) ?? 0;

  const metrics = [
    {
      label: "Oportunidades abertas",
      value: oportunidadesAbertas.toString(),
      detail: "Ativas, sem ganhas ou perdidas",
      badge: "Pipeline",
      badgeClassName: "bg-blue-100 text-blue-700",
    },
    {
      label: "Propostas pendentes",
      value: propostasPendentes.toString(),
      detail: `${aguardandoAprovacao} aprovacao | ${aguardandoEnvioOuRevisao} envio/revisao | ${aguardandoCliente} cliente`,
      badge: `${aguardandoAprovacao} alta prioridade`,
      badgeClassName:
        aguardandoAprovacao > 0
          ? "bg-amber-100 text-amber-800"
          : "bg-green-100 text-green-700",
    },
    {
      label: "Equipamentos disponiveis",
      value: equipamentosDisponiveis.toString(),
      detail: "Status DISPONIVEL no cadastro",
      badge: "Operacao",
      badgeClassName: "bg-zinc-100 text-zinc-700",
    },
  ];
  const nextContactOpportunity = proximoContato?.oportunidade;
  const nextContactPhone =
    nextContactOpportunity?.pessoa?.whatsapp ??
    nextContactOpportunity?.pessoa?.telefone ??
    proximoContato?.pessoa?.whatsapp ??
    proximoContato?.pessoa?.telefone ??
    nextContactOpportunity?.empresa.telefone ??
    proximoContato?.empresa?.telefone;
  const nextContactTemperature = getLeadTemperature(
    nextContactOpportunity?.historicos[0]?.dataContato,
  );

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
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#667085]">
                    {metric.label}
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${metric.badgeClassName}`}
                  >
                    {metric.badge}
                  </span>
                </div>
                <strong className="mt-3 block text-4xl font-bold text-[#1A2E5A]">
                  {metric.value}
                </strong>
                <p className="mt-2 text-sm text-[#1E4FAB]">{metric.detail}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
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
                {oportunidadesRecentes.length > 0 ? (
                  oportunidadesRecentes.map((oportunidade) => (
                    <div
                      key={oportunidade.id}
                      className="rounded-2xl border border-[#D7DEEA] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-[#1A2E5A]">
                            {oportunidade.titulo}
                          </p>
                          <p className="mt-1 text-sm text-[#667085]">
                            {oportunidade.empresa.nomeFantasia ??
                              oportunidade.empresa.razaoSocial}
                            {oportunidade.obra
                              ? ` - ${oportunidade.obra.nome}`
                              : ""}
                          </p>
                          <p className="mt-1 text-xs text-[#667085]">
                            Responsavel:{" "}
                            {oportunidade.responsavel?.nome ??
                              "Nao informado"}{" "}
                            | Atualizada em {formatDate(oportunidade.updatedAt)}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${opportunityStatusConfig[oportunidade.status].className}`}
                        >
                          {opportunityStatusConfig[oportunidade.status].label}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#1A2E5A]">
                          {formatCurrency(oportunidade.valor)}
                        </p>
                        <Link
                          href="/oportunidades"
                          className="rounded-2xl border border-[#D7DEEA] px-3 py-2 text-xs font-semibold text-[#1A2E5A] transition hover:border-[#1E4FAB] hover:text-[#1E4FAB]"
                        >
                          Abrir pipeline
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D7DEEA] p-5 text-sm text-[#667085]">
                    Nenhuma oportunidade ativa encontrada para o seu perfil.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-[#D7DEEA] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-[#E8EEFB] p-3 text-[#1E4FAB]">
                    <Phone className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#667085]">
                      Proximo contato
                    </p>
                    <h3 className="text-xl font-bold text-[#1A2E5A]">
                      {nextContactOpportunity
                        ? (nextContactOpportunity.empresa.nomeFantasia ??
                          nextContactOpportunity.empresa.razaoSocial)
                        : "Sem follow-up agendado"}
                    </h3>
                  </div>
                </div>
                {nextContactOpportunity ? (
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${nextContactTemperature.className}`}
                  >
                    Lead {nextContactTemperature.label}
                  </span>
                ) : null}
              </div>

              {nextContactOpportunity && proximoContato?.proximoContato ? (
                <>
                  <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-[#F4F6FA] p-3">
                      <p className="text-xs font-semibold text-[#667085]">
                        Data e hora
                      </p>
                      <p className="mt-1 font-bold text-[#1A2E5A]">
                        {formatDateTime(proximoContato.proximoContato)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F4F6FA] p-3">
                      <p className="text-xs font-semibold text-[#667085]">
                        Responsavel
                      </p>
                      <p className="mt-1 font-bold text-[#1A2E5A]">
                        {nextContactOpportunity.responsavel?.nome ??
                          proximoContato.usuario?.nome ??
                          "Nao informado"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F4F6FA] p-3">
                      <p className="text-xs font-semibold text-[#667085]">
                        Telefone
                      </p>
                      <p className="mt-1 font-bold text-[#1A2E5A]">
                        {nextContactPhone ?? "Nao informado"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F4F6FA] p-3">
                      <p className="text-xs font-semibold text-[#667085]">
                        Status
                      </p>
                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${opportunityStatusConfig[nextContactOpportunity.status].className}`}
                      >
                        {
                          opportunityStatusConfig[nextContactOpportunity.status]
                            .label
                        }
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#667085]">
                    {proximoContato.resumo}{" "}
                    {nextContactOpportunity.obra
                      ? `- ${nextContactOpportunity.obra.nome}`
                      : ""}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {nextContactPhone ? (
                      <>
                        <Link
                          href={`tel:${nextContactPhone.replace(/\s/g, "")}`}
                          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#1E4FAB] px-3 text-xs font-semibold text-white transition hover:bg-[#1A2E5A]"
                        >
                          <PhoneCall className="size-4" />
                          Ligar
                        </Link>
                        <Link
                          href={buildWhatsappHref(nextContactPhone)}
                          target="_blank"
                          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                        >
                          <MessageCircle className="size-4" />
                          WhatsApp
                        </Link>
                      </>
                    ) : null}
                    <Link
                      href="/oportunidades"
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#D7DEEA] px-3 text-xs font-semibold text-[#1A2E5A] transition hover:border-[#1E4FAB] hover:text-[#1E4FAB]"
                    >
                      Registrar contato
                    </Link>
                    <Link
                      href="/oportunidades"
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#D7DEEA] px-3 text-xs font-semibold text-[#1A2E5A] transition hover:border-[#1E4FAB] hover:text-[#1E4FAB]"
                    >
                      Gerar proposta
                    </Link>
                    <Link
                      href="/oportunidades"
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#D7DEEA] px-3 text-xs font-semibold text-[#1A2E5A] transition hover:border-[#1E4FAB] hover:text-[#1E4FAB]"
                    >
                      Reagendar
                    </Link>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[#D7DEEA] p-5 text-sm leading-6 text-[#667085]">
                  Nenhum HistoricoContato com proximoContato foi encontrado para
                  montar o proximo follow-up.
                </div>
              )}
            </article>
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.25fr_0.9fr]">
            <article className="rounded-3xl border border-[#D7DEEA] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1E4FAB]">
                    Propostas
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-[#1A2E5A]">
                    Propostas recentes
                  </h3>
                </div>
                <FileText className="size-7 text-[#1E4FAB]" />
              </div>

              <div className="mt-6 space-y-4">
                {propostasRecentes.length > 0 ? (
                  propostasRecentes.map((proposta) => {
                    const status = proposalStatusConfig[proposta.status];
                    const priority = getProposalPriority(proposta);
                    const hasPendingException = proposta.excecoes.length > 0;

                    return (
                      <div
                        key={proposta.id}
                        className="rounded-2xl border border-[#D7DEEA] p-4"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-bold text-[#1A2E5A]">
                              {proposta.numeroProposta} v{proposta.versao}
                            </p>
                            <p className="mt-1 text-sm text-[#667085]">
                              {getClientName(proposta)}{" "}
                              {proposta.oportunidade.obra
                                ? `- ${proposta.oportunidade.obra.nome}`
                                : ""}
                            </p>
                            <p className="mt-1 text-xs text-[#667085]">
                              Responsavel:{" "}
                              {proposta.oportunidade.responsavel?.nome ??
                                proposta.criadoPor?.nome ??
                                "Nao informado"}{" "}
                              | {formatDate(proposta.updatedAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}
                            >
                              {status.label}
                            </span>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-bold ${priority.className}`}
                            >
                              Prioridade {priority.label}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-[#1A2E5A]">
                            {formatCurrency(proposta.valorTotal)} | Validade{" "}
                            {formatDate(proposta.validadeProposta)}
                          </p>
                          <ProposalQuickActions
                            propostaId={proposta.id}
                            status={proposta.status}
                            hasPendingException={hasPendingException}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D7DEEA] p-5 text-sm text-[#667085]">
                    Nenhuma proposta comercial encontrada para o seu perfil.
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-[#D7DEEA] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1E4FAB]">
                    Governanca
                  </p>
                  <h3 className="mt-1 text-2xl font-bold text-[#1A2E5A]">
                    Aguardando aprovacao
                  </h3>
                  <p className="mt-1 text-sm text-[#667085]">
                    {aguardandoAprovacaoTotal} proposta(s) com excecao ou status
                    pendente.
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-800">
                  <AlertTriangle className="size-6" />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {propostasAguardandoAprovacao.length > 0 ? (
                  propostasAguardandoAprovacao.map((proposta) => {
                    const priority = getProposalPriority(proposta);
                    const daysToExpire = daysFromNow(proposta.validadeProposta);
                    const pendingExceptions = proposta.excecoes.length;

                    return (
                      <div
                        key={proposta.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-[#1A2E5A]">
                              {proposta.numeroProposta} v{proposta.versao}
                            </p>
                            <p className="mt-1 text-sm text-[#667085]">
                              {getClientName(proposta)}
                              {proposta.oportunidade.obra
                                ? ` - ${proposta.oportunidade.obra.nome}`
                                : ""}
                            </p>
                            <p className="mt-1 text-xs text-[#667085]">
                              Responsavel:{" "}
                              {proposta.oportunidade.responsavel?.nome ??
                                "Nao informado"}
                            </p>
                          </div>
                          <span
                            className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${priority.className}`}
                          >
                            {priority.label}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                            <Clock3 className="size-3.5" />
                            Aguardando gerente/diretoria
                          </span>
                          {pendingExceptions > 0 ? (
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                              {pendingExceptions} excecao(oes) critica(s)
                            </span>
                          ) : null}
                          {daysToExpire <= 2 ? (
                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                              {daysToExpire < 0
                                ? "Validade vencida"
                                : "Vencendo"}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs text-[#667085]">
                            Validade {formatDate(proposta.validadeProposta)}
                          </p>
                          <Link
                            href={`/propostas/${proposta.id}`}
                            className="inline-flex h-9 items-center gap-2 rounded-2xl bg-[#1E4FAB] px-3 text-xs font-semibold text-white transition hover:bg-[#1A2E5A]"
                          >
                            <BadgeCheck className="size-4" />
                            Analisar
                          </Link>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D7DEEA] p-5 text-sm text-[#667085]">
                    Nenhuma proposta aguardando aprovacao agora.
                  </div>
                )}
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
