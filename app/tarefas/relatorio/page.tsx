import Link from "next/link";
import { redirect } from "next/navigation";
import { endOfDay, startOfDay, subDays } from "date-fns";

import { PageNavigation } from "@/components/layout/PageNavigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function RelatorioTarefasPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!["ADMIN", "GERENTE"].includes(user.papel)) {
    redirect("/tarefas");
  }

  const hoje = new Date();
  const inicioPeriodo = startOfDay(subDays(hoje, 30));
  const fimHoje = endOfDay(hoje);

  const [
    tarefasPorUsuario,
    totalPeriodo,
    concluidasPeriodo,
    oportunidadesSemFollowUp,
    rankingAtividades,
    vencidasPorResponsavel,
  ] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        ativo: true,
      },
      select: {
        id: true,
        nome: true,
        _count: {
          select: {
            tarefasResponsavel: {
              where: {
                status: {
                  in: ["PENDENTE", "EM_ANDAMENTO"],
                },
              },
            },
          },
        },
        tarefasResponsavel: {
          where: {
            status: "CONCLUIDA",
            concluidaEm: {
              gte: inicioPeriodo,
              lte: fimHoje,
            },
          },
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    }),
    prisma.tarefa.count({
      where: {
        createdAt: {
          gte: inicioPeriodo,
          lte: fimHoje,
        },
      },
    }),
    prisma.tarefa.count({
      where: {
        status: "CONCLUIDA",
        concluidaEm: {
          gte: inicioPeriodo,
          lte: fimHoje,
        },
      },
    }),
    prisma.oportunidade.findMany({
      where: {
        ativa: true,
        status: {
          in: ["NOVA", "EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIACAO"],
        },
        tarefas: {
          none: {
            status: {
              in: ["PENDENTE", "EM_ANDAMENTO"],
            },
          },
        },
      },
      include: {
        empresa: true,
        responsavel: true,
      },
      take: 10,
      orderBy: {
        updatedAt: "asc",
      },
    }),
    prisma.tarefa.groupBy({
      by: ["tipo"],
      where: {
        createdAt: {
          gte: inicioPeriodo,
          lte: fimHoje,
        },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          tipo: "desc",
        },
      },
      take: 6,
    }),
    prisma.tarefa.groupBy({
      by: ["responsavelId"],
      where: {
        status: {
          in: ["PENDENTE", "EM_ANDAMENTO"],
        },
        dataVencimento: {
          lt: startOfDay(hoje),
        },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          responsavelId: "desc",
        },
      },
    }),
  ]);

  const usuariosVencidos = await prisma.usuario.findMany({
    where: {
      id: {
        in: vencidasPorResponsavel
          .map((item) => item.responsavelId)
          .filter(Boolean) as string[],
      },
    },
    select: {
      id: true,
      nome: true,
    },
  });
  const usuariosMap = new Map(usuariosVencidos.map((item) => [item.id, item.nome]));
  const taxaConclusao =
    totalPeriodo > 0 ? Math.round((concluidasPeriodo / totalPeriodo) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <PageNavigation
          currentPage="Relatorio de tarefas"
          currentHref="/tarefas/relatorio"
        />

        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
            Gestao comercial
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
            Relatorio de tarefas
          </h1>
          <p className="mt-2 text-sm text-[#667085]">
            Visao dos ultimos 30 dias para acompanhamento de follow-ups.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardTitle>Taxa de conclusao</CardTitle>
              <CardDescription>Tarefas concluidas no periodo</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-[#1E4FAB]">
                {taxaConclusao}%
              </p>
              <p className="mt-2 text-sm text-[#667085]">
                {concluidasPeriodo} de {totalPeriodo} tarefas
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-[#D7DEEA] lg:col-span-2">
            <CardHeader>
              <CardTitle>Tarefas por usuario</CardTitle>
              <CardDescription>Pendentes e concluidas no periodo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tarefasPorUsuario.map((usuario) => (
                <div
                  key={usuario.id}
                  className="flex items-center justify-between rounded-2xl bg-[#F4F6FA] p-3"
                >
                  <span className="font-semibold text-[#1A2E5A]">
                    {usuario.nome}
                  </span>
                  <span className="text-sm text-[#667085]">
                    {usuario._count.tarefasResponsavel} pendentes ·{" "}
                    {usuario.tarefasResponsavel.length} concluidas
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-[#D7DEEA] lg:col-span-2">
            <CardHeader>
              <CardTitle>Oportunidades sem follow-up</CardTitle>
              <CardDescription>
                Abertas sem tarefa pendente ou em andamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {oportunidadesSemFollowUp.length === 0 ? (
                <p className="text-sm text-[#667085]">
                  Todas as oportunidades abertas possuem proxima acao.
                </p>
              ) : (
                oportunidadesSemFollowUp.map((oportunidade) => (
                  <Link
                    key={oportunidade.id}
                    href="/oportunidades"
                    className="block rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 hover:border-red-300"
                  >
                    <strong>{oportunidade.titulo}</strong> ·{" "}
                    {oportunidade.empresa.nomeFantasia ??
                      oportunidade.empresa.razaoSocial}
                    {oportunidade.responsavel
                      ? ` · ${oportunidade.responsavel.nome}`
                      : ""}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-[#D7DEEA]">
            <CardHeader>
              <CardTitle>Ranking de atividades</CardTitle>
              <CardDescription>Tipos mais executados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankingAtividades.map((item) => (
                <div
                  key={item.tipo}
                  className="flex items-center justify-between rounded-2xl bg-[#F4F6FA] p-3 text-sm"
                >
                  <span className="font-semibold text-[#1A2E5A]">
                    {item.tipo}
                  </span>
                  <span className="text-[#667085]">{item._count._all}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-[#D7DEEA] lg:col-span-3">
            <CardHeader>
              <CardTitle>Tarefas vencidas por responsavel</CardTitle>
              <CardDescription>Acumulado atual de atrasos</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {vencidasPorResponsavel.length === 0 ? (
                <p className="text-sm text-[#667085]">Sem tarefas vencidas.</p>
              ) : (
                vencidasPorResponsavel.map((item) => (
                  <div
                    key={item.responsavelId ?? "sem-responsavel"}
                    className="rounded-2xl border border-red-100 bg-red-50 p-4"
                  >
                    <p className="font-semibold text-red-700">
                      {item.responsavelId
                        ? (usuariosMap.get(item.responsavelId) ?? "Responsavel")
                        : "Sem responsavel"}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-red-700">
                      {item._count._all}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
