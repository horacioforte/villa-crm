// ARQUIVO: lib/base-nacional/joao/pesquisa-ia-executar.ts
// REGRA: nunca remover. Apenas acrescentar.
// Orquestração (banco + provedor) da pesquisa assistida por IA — chamada só pela rota
// /api/base-nacional/joao/[chave]/pesquisa-ia, só quando pesquisaIaAtiva() é true.
//
// Travas, nesta ordem:
//   1. cache — mesma chave de grupo + mesma entrada nunca busca de novo (JoaoEnriquecimentoCache);
//   2. limite de buscas por grupo — reforça "nunca repete" mesmo se o cache for limpo (conta em
//      JoaoEnriquecimentoConsumo, nunca no cache sozinho);
//   3. limite mensal de gasto — soma custoUsd do mês corrente antes de chamar o provedor.
// Toda chamada (mesmo vinda do cache) fica registrada. O resultado NUNCA grava pessoa/contato
// sozinho — só devolve o JSON pronto para `joao-enriquecer.ts --importar-web` revisar.

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  montarEntradaImportarWeb,
  montarPromptPesquisaIA,
  validarAchadosPesquisaIA,
  type ClienteBuscaIA,
  type EntradaImportarWeb,
  type EntradaPesquisaIA,
  type RejeicaoPesquisaIA,
} from "./pesquisa-ia";
import { limiteBuscasPorGrupo, limiteMensalUsd } from "./pesquisa-ia-config";

const ETAPA = "pesquisa-ia";
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 20);
const chaveCache = (grupoChave: string, entrada: EntradaPesquisaIA) => `pesquisa-ia:${grupoChave}:${hash(JSON.stringify(entrada))}`;

export type ResultadoExecutarPesquisaIA =
  | { ok: true; doCache: boolean; entradaImportarWeb: EntradaImportarWeb; rejeitados: RejeicaoPesquisaIA[] }
  | { ok: false; motivo: string };

export async function executarPesquisaIA(args: {
  grupoChave: string;
  entrada: EntradaPesquisaIA;
  nomesEmpresa: string[];
  cliente: ClienteBuscaIA;
}): Promise<ResultadoExecutarPesquisaIA> {
  const chave = chaveCache(args.grupoChave, args.entrada);

  const cache = await prisma.joaoEnriquecimentoCache.findUnique({ where: { chave } });
  if (cache?.dados) {
    return { ok: true, doCache: true, entradaImportarWeb: cache.dados as unknown as EntradaImportarWeb, rejeitados: [] };
  }

  const jaFeitas = await prisma.joaoEnriquecimentoConsumo.count({ where: { grupoChave: args.grupoChave, etapa: ETAPA } });
  const limitePorGrupo = limiteBuscasPorGrupo();
  if (jaFeitas >= limitePorGrupo) {
    return { ok: false, motivo: `limite de ${limitePorGrupo} busca${limitePorGrupo > 1 ? "s" : ""} por grupo já atingido — este grupo já foi pesquisado.` };
  }

  const inicioMes = new Date();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);
  const gastoAgg = await prisma.joaoEnriquecimentoConsumo.aggregate({
    where: { etapa: ETAPA, pago: true, createdAt: { gte: inicioMes } },
    _sum: { custoUsd: true },
  });
  const gastoAtual = Number(gastoAgg._sum.custoUsd ?? 0);
  const limiteMes = limiteMensalUsd();
  if (gastoAtual >= limiteMes) {
    return { ok: false, motivo: `limite mensal de gasto do módulo (US$ ${limiteMes.toFixed(2)}) já atingido neste mês.` };
  }

  const prompt = montarPromptPesquisaIA(args.entrada);
  const resposta = await args.cliente.buscar(args.entrada, prompt);
  const { achados, rejeitados } = validarAchadosPesquisaIA(resposta.achados, args.nomesEmpresa);
  const entradaImportarWeb = montarEntradaImportarWeb({ grupoChave: args.grupoChave, entrada: args.entrada, achados, tokensEstimados: resposta.tokensEstimados });

  await prisma.$transaction([
    prisma.joaoEnriquecimentoCache.upsert({
      where: { chave },
      create: { chave, tipo: "pesquisa-ia", dados: entradaImportarWeb as never, fonteUrl: null },
      update: { dados: entradaImportarWeb as never, buscadoEm: new Date() },
    }),
    prisma.joaoEnriquecimentoConsumo.create({
      data: {
        id: `pia-${hash(`${args.grupoChave}|${args.cliente.provedor}|${Date.now()}`)}`,
        grupoChave: args.grupoChave,
        etapa: ETAPA,
        ferramenta: `pesquisa-ia-${args.cliente.provedor}`,
        chamadas: 1,
        tokensEstimados: resposta.tokensEstimados,
        custoUsd: resposta.custoUsd,
        pago: resposta.custoUsd > 0,
      },
    }),
  ]);

  return { ok: true, doCache: false, entradaImportarWeb, rejeitados };
}
