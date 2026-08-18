import { redirect } from "next/navigation";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { FiltrosBI } from "@/components/bi-executivo/FiltrosBI";
import { BlocoOportunidadesAbertas } from "@/components/bi-executivo/BlocoOportunidadesAbertas";
import { BlocoFunilComercial } from "@/components/bi-executivo/BlocoFunilComercial";
import { BlocoPipelineProposto } from "@/components/bi-executivo/BlocoPipelineProposto";
import { BlocoPipelinePorEstagio } from "@/components/bi-executivo/BlocoPipelinePorEstagio";
import { BlocoResultadoComercial } from "@/components/bi-executivo/BlocoResultadoComercial";
import { BlocoOportunidadesEstrategicas } from "@/components/bi-executivo/BlocoOportunidadesEstrategicas";
import { AnaliseIA } from "@/components/bi-executivo/AnaliseIA";
import { BotaoGerarPdf } from "@/components/bi-executivo/BotaoGerarPdf";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getPipelinePotencial,
  getPipelineProposto,
  getFunilComercial,
  getPipelinePorEstagio,
  getGanhosPerdas,
  getOportunidadesEstrategicasSemProposta,
  getEvolucaoOportunidadesAbertas,
  getEvolucaoResultadoComercial,
} from "@/lib/metrics/comercial";
import { gerarAnaliseExecutiva } from "@/lib/bi-executivo/analise";
import { resolvePeriodo, resolveTipo } from "@/lib/bi-executivo/periodo";

export default async function BiExecutivoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; dataInicio?: string; dataFim?: string; tipo?: string }>;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.papel !== "ADMIN" && currentUser.papel !== "GERENTE") redirect("/oportunidades");

  const params = await searchParams;
  const { inicio, fim, label, periodo } = resolvePeriodo(params);
  const tipo = resolveTipo(params.tipo);

  const filtrosEstoque = { user: currentUser, tipo };
  const filtrosPeriodo = { user: currentUser, tipo, dataInicio: inicio, dataFim: fim };

  const [
    pipelinePotencial,
    pipelineProposto,
    funil,
    porEstagio,
    ganhosPerdas,
    estrategicasSemProposta,
    evolucaoAbertas,
    evolucaoResultado,
  ] = await Promise.all([
    getPipelinePotencial(filtrosEstoque),
    getPipelineProposto(filtrosEstoque),
    getFunilComercial(filtrosPeriodo),
    getPipelinePorEstagio(filtrosEstoque),
    getGanhosPerdas(filtrosPeriodo),
    getOportunidadesEstrategicasSemProposta(filtrosEstoque),
    getEvolucaoOportunidadesAbertas(filtrosEstoque),
    getEvolucaoResultadoComercial(filtrosEstoque),
  ]);

  const analiseIA = await gerarAnaliseExecutiva({
    periodoLabel: label,
    pipelinePotencial,
    pipelineProposto,
    pipelineContratadoPeriodo: ganhosPerdas.ganhas,
    perdidoPeriodo: ganhosPerdas.perdidas,
    funil,
    oportunidadesEstrategicasSemProposta: estrategicasSemProposta.length,
  });

  return (
    <main className="min-h-screen bg-[#F4F6FA] px-5 py-3 text-[#172033] sm:px-8">
      <div className="mx-auto max-w-[1500px] pb-16">
        <PageNavigation currentPage="BI Executivo" currentHref="/bi-executivo" />

        <header className="flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
              Villa CRM
            </p>
            <h1 className="text-2xl font-bold text-[#1A2E5A]">Visão Executiva</h1>
            <p className="mt-1 text-sm text-[#667085]">
              Panorama comercial atualizado em tempo real · {label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FiltrosBI periodoAtual={periodo} tipoAtual={tipo ?? "TODOS"} />
            <BotaoGerarPdf periodo={periodo} tipo={tipo} />
          </div>
        </header>

        <section className="mt-6 grid gap-4 xl:grid-cols-3">
          <BlocoOportunidadesAbertas
            abertas={funil.abertas}
            evolucao={evolucaoAbertas}
          />
          <BlocoFunilComercial funil={funil} />
          <BlocoPipelineProposto proposto={pipelineProposto} potencial={pipelinePotencial} />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-3">
          <BlocoPipelinePorEstagio dados={porEstagio} />
          <BlocoResultadoComercial
            ganhas={ganhosPerdas.ganhas}
            perdidas={ganhosPerdas.perdidas}
            taxaConversao={ganhosPerdas.taxaConversao}
            evolucao={evolucaoResultado}
          />
          <BlocoOportunidadesEstrategicas oportunidades={estrategicasSemProposta} />
        </section>

        <section className="mt-4">
          <AnaliseIA analise={analiseIA} />
        </section>
      </div>
    </main>
  );
}
