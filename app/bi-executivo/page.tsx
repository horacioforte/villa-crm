import { redirect } from "next/navigation";

import { PageNavigation } from "@/components/layout/PageNavigation";
import { TooltipProvider } from "@/components/ui/tooltip";
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
    <TooltipProvider delay={150}>
      <main className="min-h-screen bg-[#F4F6FA] px-5 py-3 text-[#172033] sm:px-8 print:min-h-0 print:bg-white print:px-0 print:py-0">
        <div className="mx-auto max-w-[1500px] pb-10 print:max-w-none print:pb-0">
          <div className="print:hidden">
            <PageNavigation currentPage="BI Executivo" currentHref="/bi-executivo" />
          </div>

          {/* Cabeçalho compacto: título + período numa linha, controles na mesma linha à direita */}
          <header className="flex flex-wrap items-center justify-between gap-3 print:flex-nowrap">
            <div>
              <h1 className="text-lg font-bold leading-tight text-[#1A2E5A]">
                Visão Executiva
                <span className="ml-2 text-xs font-normal text-[#667085]">
                  Panorama comercial · {label}
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <FiltrosBI periodoAtual={periodo} tipoAtual={tipo ?? "TODOS"} />
              <BotaoGerarPdf periodo={periodo} tipo={tipo} />
            </div>
          </header>

          {/* Cockpit 3×2 — 3 colunas no desktop, 2 no tablet, 1 no mobile */}
          <section className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 print:mt-2 print:grid-cols-3 print:gap-1.5">
            <div className="print:break-inside-avoid">
              <BlocoOportunidadesAbertas abertas={funil.abertas} evolucao={evolucaoAbertas} />
            </div>
            <div className="print:break-inside-avoid">
              <BlocoFunilComercial funil={funil} />
            </div>
            <div className="print:break-inside-avoid">
              <BlocoPipelineProposto proposto={pipelineProposto} potencial={pipelinePotencial} />
            </div>
            <div className="print:break-inside-avoid">
              <BlocoPipelinePorEstagio dados={porEstagio} />
            </div>
            <div className="print:break-inside-avoid">
              <BlocoResultadoComercial
                ganhas={ganhosPerdas.ganhas}
                perdidas={ganhosPerdas.perdidas}
                taxaConversao={ganhosPerdas.taxaConversao}
                evolucao={evolucaoResultado}
              />
            </div>
            <div className="print:break-inside-avoid">
              <BlocoOportunidadesEstrategicas oportunidades={estrategicasSemProposta} />
            </div>
          </section>

          <section className="mt-3 print:mt-1.5 print:break-inside-avoid">
            <AnaliseIA analise={analiseIA} />
          </section>
        </div>
      </main>
    </TooltipProvider>
  );
}
