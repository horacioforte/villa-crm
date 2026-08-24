// ARQUIVO: app/api/cron/joao-investigar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Cron Mon+Wed — João investiga dossiês com Claude Haiku + GPT-4o em paralelo.
// Roda às 10h BRT (13h UTC) via Vercel Cron.
// Auth: CRON_SECRET (Vercel) ou AGENT_API_KEY (teste manual).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { investigarDossieCombinado, sanitizarDecimal } from "@/lib/agentes/joao/investigador-combinado";
import { investigarConstrutora, faseParaTipoEvidencia, faseParaTipoMovimentacao, fasePossuiEvidenciaTemporal, calcularNovoStatusCarteira } from "@/lib/agentes/joao/investigador-construtora";
import type { ResultadoInvestigacaoConstrutora } from "@/lib/agentes/joao/investigador-construtora";
import { recalcularDossie } from "@/lib/inteligencia/completude";
import {
  exportarScoresJoaoParaPersistencia,
  montarPayloadAtualizacaoJoao,
  upsertDossieEvidenciaPersistida,
  upsertDossieMovimentacaoPersistida,
} from "@/lib/inteligencia/joao-estrutura";
import type { ResultadoInvestigacao } from "@/lib/agentes/joao/investigador";
import { CarteiraEstrategica } from "@/app/generated/prisma/client";

export const maxDuration = 300; // 5 minutos

function autenticado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization");
  return Boolean(
    (secret && auth === `Bearer ${secret}`) ||
    (process.env.AGENT_API_KEY && auth === `Bearer ${process.env.AGENT_API_KEY}`)
  );
}

// ─── salvarResultado ──────────────────────────────────────────────────────────
// Salva o resultado de um investigador (Claude ou GPT-4o) no banco.

async function salvarResultado(
  dossieId: string,
  dossie: {
    id: string; status: string; completude: number;
    decisores: { nome: string | null; cargo?: string | null; telefone?: string | null; email?: string | null; linkedin?: string | null }[];
    [key: string]: unknown;
  },
  resultado: ResultadoInvestigacao,
  agenteLabel: string, // "joao-claude" | "joao-gpt4o"
): Promise<{ camposAtualizados: string[]; decisorEncontrado: boolean; noticias: number }> {
  const camposAtualizados: string[] = [];
  let decisorEncontrado = false;
  let noticiasCount = 0;

  // Campos string
  const camposString = ["construtora","epc","epcm","faseObra","cronograma","concorrentes","fonteInformacao","linkFonte"];
  const camposDecimal = ["valorEstimado","volumeConcreto"];

  const camposNovos: Record<string, unknown> = {};

  for (const campo of camposString) {
    const valor = resultado.campos[campo];
    const valorAtual = dossie[campo];
    if (valor !== undefined && valor !== null && valor !== "" && valor !== valorAtual) {
      camposNovos[campo] = valor;
      camposAtualizados.push(campo);
    }
  }
  for (const campo of camposDecimal) {
    const raw = resultado.campos[campo];
    const valorAtual = dossie[campo];
    const sanitized = sanitizarDecimal(raw);
    if (sanitized !== undefined && sanitized !== sanitizarDecimal(valorAtual)) {
      camposNovos[campo] = sanitized;
      camposAtualizados.push(campo);
    }
  }

  const dadosMesclados = { ...dossie, ...camposNovos } as any;
  const { completude, missaoAtual, maturidadeComercial } = recalcularDossie(dadosMesclados as any, dossie.decisores as any);
  const scoresPersistencia = exportarScoresJoaoParaPersistencia(dadosMesclados as any);
  const payloadAtualizacao = montarPayloadAtualizacaoJoao(dadosMesclados as any, camposNovos, {
    completude,
    missaoAtual,
    maturidadeComercial,
    ultimaAtividade: new Date(),
    ...(completude >= 80 && dossie.status === "INVESTIGANDO" ? { status: "AGUARDANDO_VALIDACAO" } : {}),
  });

  const possuiMudancaPersistida = Object.keys(payloadAtualizacao).some((campo) => {
    const valorAtual = (dossie as Record<string, unknown>)[campo];
    const valorNovo = payloadAtualizacao[campo];
    return valorAtual !== valorNovo;
  });

  if (Object.keys(camposNovos).length > 0 || possuiMudancaPersistida) {
    try {
      await prisma.$transaction([
        prisma.dossieComercial.update({ where: { id: dossieId }, data: payloadAtualizacao }),
        prisma.atualizacaoDossie.create({
          data: {
            dossieId,
            tipo:    "CAMPO_ATUALIZADO",
            titulo:  `[${agenteLabel}] Campos atualizados: ${camposAtualizados.join(", ") || "scores João"}`,
            conteudo: resultado.resumoInvestigacao,
            agente:  agenteLabel,
            fonte:   typeof resultado.campos.fonteInformacao === "string" ? resultado.campos.fonteInformacao : null,
            link:    typeof resultado.campos.linkFonte === "string" ? resultado.campos.linkFonte : null,
          },
        }),
      ]);
    } catch (e) {
      console.error(`[cron] Erro ao salvar campos (${agenteLabel}):`, e);
    }
  } else if (resultado.resumoInvestigacao && !resultado.erro) {
    // Mesmo sem campos novos, salva o relatório de investigação para o log
    try {
      await prisma.atualizacaoDossie.create({
        data: {
          dossieId,
          tipo:    "CAMPO_ATUALIZADO",
          titulo:  `[${agenteLabel}] Investigação — sem novos campos`,
          conteudo: resultado.resumoInvestigacao,
          agente:  agenteLabel,
        },
      });
      await prisma.dossieComercial.update({
        where: { id: dossieId },
        data:  { ultimaAtividade: new Date() },
      });
    } catch (e) {
      console.error(`[cron] Erro ao salvar log vazio (${agenteLabel}):`, e);
    }
  }

  // Decisor
  if (resultado.decisor?.nome) {
    const jaExiste = dossie.decisores.some(
      d => d.nome?.toLowerCase() === resultado.decisor!.nome.toLowerCase()
    );
    if (!jaExiste) {
      try {
        const decisor = await prisma.decisorDossie.create({
          data: {
            dossieId,
            nome:      resultado.decisor.nome,
            cargo:     resultado.decisor.cargo    ?? null,
            empresa:   resultado.decisor.empresa  ?? null,
            linkedin:  resultado.decisor.linkedin ?? null,
            telefone:  resultado.decisor.telefone ?? null,
            email:     resultado.decisor.email    ?? null,
            confianca: 60,
            fonte:     resultado.decisor.fonte ?? agenteLabel,
          },
        });
        const decisoresAtualizados = [
          ...dossie.decisores,
          { nome: decisor.nome, telefone: decisor.telefone, email: decisor.email, linkedin: decisor.linkedin },
        ];
        const { completude: compDec, missaoAtual: missaoDec, maturidadeComercial: maturDec } = recalcularDossie(dossie as any, decisoresAtualizados as any);
        await prisma.$transaction([
          prisma.dossieComercial.update({
            where: { id: dossieId },
            data: {
              completude: compDec, missaoAtual: missaoDec, maturidadeComercial: maturDec,
              totalDecisores: { increment: 1 }, ultimaAtividade: new Date(),
              ...(compDec >= 80 && dossie.status === "INVESTIGANDO" ? { status: "AGUARDANDO_VALIDACAO" } : {}),
            },
          }),
          prisma.atualizacaoDossie.create({
            data: {
              dossieId,
              tipo:    "DECISOR_ENCONTRADO",
              titulo:  `[${agenteLabel}] Decisor: ${resultado.decisor.nome}`,
              conteudo: [
                `Nome: ${resultado.decisor.nome}`,
                resultado.decisor.cargo    ? `Cargo: ${resultado.decisor.cargo}`       : null,
                resultado.decisor.empresa  ? `Empresa: ${resultado.decisor.empresa}`   : null,
                resultado.decisor.linkedin ? `LinkedIn: ${resultado.decisor.linkedin}` : null,
                resultado.decisor.fonte    ? `Fonte: ${resultado.decisor.fonte}`       : null,
              ].filter(Boolean).join("\n"),
              agente: agenteLabel,
              fonte:  resultado.decisor.fonte ?? null,
            },
          }),
        ]);
        decisorEncontrado = true;
      } catch (e) {
        console.error(`[cron] Erro ao salvar decisor (${agenteLabel}):`, e);
      }
    }
  }

  // Notícias
  for (const noticia of resultado.noticias) {
    if (!noticia.titulo?.trim() || !noticia.conteudo?.trim()) continue;
    try {
      await prisma.$transaction([
        prisma.atualizacaoDossie.create({
          data: {
            dossieId,
            tipo:    "NOTICIA_ENCONTRADA",
            titulo:  `[${agenteLabel}] ${noticia.titulo}`,
            conteudo: noticia.conteudo,
            fonte:   noticia.fonte ?? null,
            link:    noticia.link  ?? null,
            agente:  agenteLabel,
          },
        }),
        prisma.dossieComercial.update({
          where: { id: dossieId },
          data:  { totalNoticias: { increment: 1 }, totalAtualizacoes: { increment: 1 }, ultimaAtividade: new Date() },
        }),
      ]);
      noticiasCount++;
    } catch (e) {
      console.error(`[cron] Erro ao salvar notícia (${agenteLabel}):`, e);
    }
  }

  return { camposAtualizados, decisorEncontrado, noticias: noticiasCount };
}

// ─── Tipos para dossiês de construtoras ───────────────────────────────────────

type DossieCarteiraSelecionada = {
  id: string;
  status: string;
  proximaAcao: string | null;
  ultimaInvestigacao: Date | null;
  decisores: number;
};

type DossieConstrutoraSelecionado = {
  id: string; titulo: string; resumo: string | null; segmento: string | null;
  cidade: string | null; estado: string | null; status: string; completude: number;
  clienteFinal: string | null; construtora: string | null; epc: string | null;
  epcm: string | null; faseObra: string | null; cronograma: string | null;
  valorEstimado: unknown; volumeConcreto: unknown; concorrentes: string | null;
  missaoAtual: string | null; fonteInformacao: string | null;
  decisores: { nome: string | null; cargo?: string | null; telefone?: string | null; email?: string | null; linkedin?: string | null }[];
  carteiras: DossieCarteiraSelecionada[];
};

// ─── salvarResultadoConstrutora ───────────────────────────────────────────────
// Persiste o resultado de investigarConstrutora():
//   1. PATCH campos no DossieComercial (fase mais avançada, valor, cronograma, fonte)
//   2. DossieEvidencia por obra encontrada   (idempotente via hashUrl/hashConteudo)
//   3. DossieMovimentacao por fase comprovada (idempotente via hashUnico)
//   4. Decisor (se novo)
//   5. Notícias como AtualizacaoDossie
//   6. Update DossieCarteira (status, score, ultimaInvestigacao, proximaAcao)

async function salvarResultadoConstrutora(
  dossieId: string,
  dossie: DossieConstrutoraSelecionado,
  resultado: ResultadoInvestigacaoConstrutora,
  agenteLabel: string,
): Promise<{
  obrasEncontradas: number;
  evidenciasSalvas: number;
  movimentacoesSalvas: number;
  decisorEncontrado: boolean;
  noticias: number;
}> {
  let evidenciasSalvas = 0;
  let movimentacoesSalvas = 0;
  let decisorEncontrado = false;
  let noticiasCount = 0;

  // 1. Campos para PATCH no DossieComercial
  const camposNovos: Record<string, unknown> = {};
  const camposString = ["faseObra", "cronograma", "fonteInformacao", "linkFonte"] as const;
  for (const campo of camposString) {
    const valor = resultado.camposDossie[campo];
    const valorAtual = (dossie as Record<string, unknown>)[campo];
    if (valor && valor !== valorAtual) camposNovos[campo] = valor;
  }
  if (resultado.camposDossie.valorEstimado && resultado.camposDossie.valorEstimado > 0) {
    camposNovos.valorEstimado = resultado.camposDossie.valorEstimado;
  }
  if (resultado.proximaMissao) {
    camposNovos.proximaAcaoSugerida = resultado.proximaMissao;
  }

  // Recalcular scores deterministicamente (LLM não calcula scores)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dadosMesclados = { ...dossie, ...camposNovos } as any;
  const { completude, missaoAtual, maturidadeComercial } = recalcularDossie(dadosMesclados, dossie.decisores as Parameters<typeof recalcularDossie>[1]);
  const scoresPersistencia = exportarScoresJoaoParaPersistencia(dadosMesclados);

  const payloadAtualizacaoDossie = montarPayloadAtualizacaoJoao(dadosMesclados, camposNovos, {
    completude,
    missaoAtual: resultado.proximaMissao || missaoAtual,
    maturidadeComercial,
    ultimaAtividade: new Date(),
    ...(completude >= 80 && dossie.status === "INVESTIGANDO" ? { status: "AGUARDANDO_VALIDACAO" } : {}),
  });

  try {
    await prisma.$transaction([
      prisma.dossieComercial.update({ where: { id: dossieId }, data: payloadAtualizacaoDossie }),
      prisma.atualizacaoDossie.create({
        data: {
          dossieId,
          tipo: "CAMPO_ATUALIZADO",
          titulo: `[${agenteLabel}-construtora] ${resultado.obras.length} obra(s) — ${resultado.resumoInvestigacao.slice(0, 80)}`,
          conteudo: resultado.resumoInvestigacao,
          agente: agenteLabel,
          fonte: resultado.camposDossie.fonteInformacao ?? null,
          link: resultado.camposDossie.linkFonte ?? null,
        },
      }),
    ]);
  } catch (e) {
    console.error(`[cron-construtora] Erro ao salvar PATCH dossiê ${dossieId}:`, e);
  }

  // 2. DossieEvidencia + DossieMovimentacao por obra
  for (const obra of resultado.obras) {
    if (!obra.nome?.trim() || !obra.evidenciaTextual?.trim()) continue;

    const tipoEvidencia = faseParaTipoEvidencia(obra.fase ?? "");
    const dataInfo = obra.dataInformacao ? new Date(obra.dataInformacao) : null;
    const titulo = obra.nome.trim();
    const descricao = [
      obra.evidenciaTextual,
      obra.cidade ? `Local: ${obra.cidade}${obra.estado ? `/${obra.estado}` : ""}` : null,
      obra.clienteFinal ? `Cliente: ${obra.clienteFinal}` : null,
      obra.fase ? `Fase: ${obra.fase}` : null,
      obra.cronograma ? `Cronograma: ${obra.cronograma}` : null,
      obra.valor ? `Valor: R$ ${obra.valor.toLocaleString("pt-BR")}` : null,
    ].filter(Boolean).join("\n");

    // DossieEvidencia (idempotente via hashUrl/hashConteudo)
    try {
      await upsertDossieEvidenciaPersistida(
        dossieId,
        {
          tipo: tipoEvidencia,
          titulo,
          descricao,
          fonteTipo: obra.url ? "MIDIA" : "OUTRA",
          fonteNome: obra.fonteNome,
          url: obra.url ?? null,
          dataInformacao: dataInfo,
          confianca: obra.confianca ?? "SINAL",
          estado: "ATIVA",
        },
        prisma,
      );
      evidenciasSalvas++;
    } catch (e) {
      console.error(`[cron-construtora] Erro ao salvar evidência (${obra.nome}):`, e);
    }

    // DossieMovimentacao — somente se fase temporal comprovada (não "anunciada" ou "planejada")
    if (obra.fase && fasePossuiEvidenciaTemporal(obra.fase)) {
      const tipoMovimentacao = faseParaTipoMovimentacao(obra.fase);
      try {
        await upsertDossieMovimentacaoPersistida(
          {
            dossieId,
            tipo: tipoMovimentacao,
            titulo,
            descricao: obra.evidenciaTextual,
            momento: dataInfo,
            relevancia: 70,
            status: "ATIVA",
          },
          prisma,
        );
        movimentacoesSalvas++;
      } catch (e) {
        console.error(`[cron-construtora] Erro ao salvar movimentação (${obra.nome}):`, e);
      }
    }
  }

  // 3. Decisor
  if (resultado.decisor?.nome) {
    const jaExiste = dossie.decisores.some(
      (d) => d.nome?.toLowerCase() === resultado.decisor!.nome.toLowerCase(),
    );
    if (!jaExiste) {
      try {
        await prisma.$transaction([
          prisma.decisorDossie.create({
            data: {
              dossieId,
              nome: resultado.decisor.nome,
              cargo: resultado.decisor.cargo ?? null,
              empresa: resultado.decisor.empresa ?? null,
              linkedin: resultado.decisor.linkedin ?? null,
              telefone: resultado.decisor.telefone ?? null,
              email: resultado.decisor.email ?? null,
              confianca: 60,
              fonte: resultado.decisor.fonte ?? agenteLabel,
            },
          }),
          prisma.dossieComercial.update({
            where: { id: dossieId },
            data: { totalDecisores: { increment: 1 }, ultimaAtividade: new Date() },
          }),
          prisma.atualizacaoDossie.create({
            data: {
              dossieId,
              tipo: "DECISOR_ENCONTRADO",
              titulo: `[${agenteLabel}-construtora] Decisor: ${resultado.decisor.nome}`,
              conteudo: [
                `Nome: ${resultado.decisor.nome}`,
                resultado.decisor.cargo ? `Cargo: ${resultado.decisor.cargo}` : null,
                resultado.decisor.empresa ? `Empresa: ${resultado.decisor.empresa}` : null,
                resultado.decisor.linkedin ? `LinkedIn: ${resultado.decisor.linkedin}` : null,
                resultado.decisor.fonte ? `Fonte: ${resultado.decisor.fonte}` : null,
              ]
                .filter(Boolean)
                .join("\n"),
              agente: agenteLabel,
            },
          }),
        ]);
        decisorEncontrado = true;
      } catch (e) {
        console.error(`[cron-construtora] Erro ao salvar decisor:`, e);
      }
    }
  }

  // 4. Notícias
  for (const noticia of resultado.noticias) {
    if (!noticia.titulo?.trim() || !noticia.conteudo?.trim()) continue;
    try {
      await prisma.atualizacaoDossie.create({
        data: {
          dossieId,
          tipo: "NOTICIA_ENCONTRADA",
          titulo: `[${agenteLabel}-construtora] ${noticia.titulo}`,
          conteudo: noticia.conteudo,
          fonte: noticia.fonte ?? null,
          link: noticia.link ?? null,
          agente: agenteLabel,
        },
      });
      await prisma.dossieComercial.update({
        where: { id: dossieId },
        data: { totalNoticias: { increment: 1 }, totalAtualizacoes: { increment: 1 }, ultimaAtividade: new Date() },
      });
      noticiasCount++;
    } catch (e) {
      console.error(`[cron-construtora] Erro ao salvar notícia:`, e);
    }
  }

  // 5. Update DossieCarteira
  const carteira = dossie.carteiras?.[0];
  if (carteira?.id) {
    const novoStatus = calcularNovoStatusCarteira(
      carteira.status,
      resultado.obras.length,
      decisorEncontrado,
    );
    const principalSinal = resultado.obras[0]?.evidenciaTextual?.slice(0, 200) ?? null;

    try {
      await prisma.dossieCarteira.update({
        where: { id: carteira.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: novoStatus as any,
          ultimaInvestigacao: new Date(),
          ultimaAtualizacao: new Date(),
          proximaAcao: resultado.proximaMissao || null,
          ...(principalSinal ? { principalSinal } : {}),
          score: scoresPersistencia.potencialVilla ?? 0,
          ...(decisorEncontrado ? { decisores: { increment: 1 } } : {}),
        },
      });
    } catch (e) {
      console.error(`[cron-construtora] Erro ao atualizar DossieCarteira:`, e);
    }
  }

  return {
    obrasEncontradas: resultado.obras.length,
    evidenciasSalvas,
    movimentacoesSalvas,
    decisorEncontrado,
    noticias: noticiasCount,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!autenticado(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const selectDossie = {
      id: true, titulo: true, resumo: true, segmento: true,
      cidade: true, estado: true, status: true, clienteFinal: true,
      construtora: true, epc: true, epcm: true, faseObra: true,
      cronograma: true, valorEstimado: true, volumeConcreto: true,
      concorrentes: true, missaoAtual: true, fonteInformacao: true,
      completude: true,
      decisores: {
        select: { nome: true, cargo: true, telefone: true, email: true, linkedin: true },
      },
    } as const;

    // ── CONSTRUTORA_BRASIL — rota separada ───────────────────────────────────
    // Dossiês com carteira CONSTRUTORA_BRASIL usam investigarConstrutora() e
    // salvarResultadoConstrutora() em vez do fluxo obra-cêntrico padrão.
    // Processados ANTES da fila regular para garantir prioridade de slot.
    const dossieIdParam = req.nextUrl.searchParams.get("dossieId");
    // (modo direto por dossieId é tratado mais abaixo — não interceptamos aqui)
    if (!dossieIdParam) {
      const dossiesConstrutora = await prisma.dossieComercial.findMany({
        where: {
          status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
          carteiras: { some: { carteira: CarteiraEstrategica.CONSTRUTORA_BRASIL } },
        },
        orderBy: { ultimaAtividade: "asc" },
        take: 3,
        select: {
          ...selectDossie,
          carteiras: {
            // alias não é suportado diretamente — usamos a relação carteiras filtrada
            where: { carteira: CarteiraEstrategica.CONSTRUTORA_BRASIL },
            select: { id: true, status: true, proximaAcao: true, ultimaInvestigacao: true, decisores: true },
          },
        },
      });

      if (dossiesConstrutora.length > 0) {
        const resumosConstrutora: {
          dossieId: string; titulo: string;
          obrasEncontradas: number; evidencias: number; movimentacoes: number;
          decisor: boolean; noticias: number; erro?: string;
        }[] = [];

        for (const dossie of dossiesConstrutora) {
          console.log(`[cron/joao-investigar] Construtora: ${dossie.titulo}`);
          let resultado: ResultadoInvestigacaoConstrutora;
          try {
            resultado = await investigarConstrutora(dossie as unknown as Parameters<typeof investigarConstrutora>[0]);
          } catch (e) {
            console.error(`[cron/joao-investigar] Falha construtora ${dossie.id}:`, e);
            resumosConstrutora.push({
              dossieId: dossie.id, titulo: dossie.titulo,
              obrasEncontradas: 0, evidencias: 0, movimentacoes: 0,
              decisor: false, noticias: 0, erro: String(e),
            });
            continue;
          }

          // Recarrega o dossiê para ter os decisores atualizados antes do salvar
          const dossieAtualizado = await prisma.dossieComercial.findUnique({
            where: { id: dossie.id },
            select: {
              id: true, status: true, completude: true, segmento: true,
              faseObra: true, cronograma: true, valorEstimado: true, volumeConcreto: true,
              concorrentes: true, missaoAtual: true, fonteInformacao: true,
              cidade: true, estado: true, clienteFinal: true,
              construtora: true, epc: true, epcm: true,
              equipamentosSugeridos: true, campanhasSugerida: true, licenciamento: true,
              decisores: { select: { nome: true, cargo: true, telefone: true, email: true, linkedin: true } },
              carteiras: {
                where: { carteira: CarteiraEstrategica.CONSTRUTORA_BRASIL },
                select: { id: true, status: true, proximaAcao: true, ultimaInvestigacao: true, decisores: true },
              },
            },
          });

          const dossieParaSalvar = {
            ...dossie,
            ...(dossieAtualizado ?? {}),
          } as DossieConstrutoraSelecionado;

          const stats = await salvarResultadoConstrutora(
            dossie.id,
            dossieParaSalvar,
            resultado,
            "joao-claude",
          );

          resumosConstrutora.push({
            dossieId: dossie.id, titulo: dossie.titulo,
            obrasEncontradas: stats.obrasEncontradas,
            evidencias: stats.evidenciasSalvas,
            movimentacoes: stats.movimentacoesSalvas,
            decisor: stats.decisorEncontrado,
            noticias: stats.noticias,
            ...(resultado.erro ? { erro: resultado.erro } : {}),
          });
        }

        // Se só processamos construtoras nesta rodada, retorna logo
        // (o cron pode ser chamado novamente para processar a fila regular)
        if (resumosConstrutora.length > 0) {
          return NextResponse.json({
            sucesso: true,
            processados: resumosConstrutora.length,
            modo: "construtora",
            detalhes: resumosConstrutora,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
    // ── Fim CONSTRUTORA_BRASIL ───────────────────────────────────────────────

    // ── Modo direto: investigar um dossiê específico imediatamente ─────────────
    // Ativado via ?dossieId=xxx (usado pelo trigger automático pós-criação)
    if (dossieIdParam) {
      const dossieEspecifico = await prisma.dossieComercial.findUnique({
        where: { id: dossieIdParam },
        select: selectDossie,
      });

      if (!dossieEspecifico) {
        return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });
      }

      console.log(`[cron/joao-investigar] Modo direto: ${dossieEspecifico.titulo}`);

      let combinado;
      try {
        combinado = await investigarDossieCombinado(dossieEspecifico);
      } catch (e) {
        return NextResponse.json({
          sucesso: false,
          erro: String(e),
          timestamp: new Date().toISOString(),
        }, { status: 500 });
      }

      const dossieAtualizado = await prisma.dossieComercial.findUnique({
        where: { id: dossieEspecifico.id },
        select: {
          id: true, status: true, completude: true,
          decisores: { select: { nome: true, cargo: true, telefone: true, email: true, linkedin: true } },
          construtora: true, epc: true, epcm: true, faseObra: true,
          cronograma: true, valorEstimado: true, volumeConcreto: true,
          concorrentes: true, missaoAtual: true, fonteInformacao: true,
          cidade: true, estado: true, clienteFinal: true,
        },
      }) ?? dossieEspecifico;

      const [resultadoClaude, resultadoGPT4o] = await Promise.all([
        salvarResultado(dossieEspecifico.id, { ...dossieAtualizado, titulo: dossieEspecifico.titulo }, combinado.claude, "joao-claude"),
        salvarResultado(dossieEspecifico.id, { ...dossieAtualizado, titulo: dossieEspecifico.titulo }, combinado.gpt4o,  "joao-gpt4o"),
      ]);

      return NextResponse.json({
        sucesso:     true,
        processados: 1,
        modo:        "direto",
        detalhes: [{
          dossieId: dossieEspecifico.id,
          titulo:   dossieEspecifico.titulo,
          claude: { achou: combinado.claude.achou, campos: resultadoClaude.camposAtualizados.length, decisor: resultadoClaude.decisorEncontrado, noticias: resultadoClaude.noticias },
          gpt4o:  { achou: combinado.gpt4o.achou,  campos: resultadoGPT4o.camposAtualizados.length,  decisor: resultadoGPT4o.decisorEncontrado,  noticias: resultadoGPT4o.noticias  },
        }],
        timestamp: new Date().toISOString(),
      });
    }
    // ── Fim modo direto ────────────────────────────────────────────────────────

    // Dossiês MANUAL (solicitados pelo usuário) têm prioridade absoluta.
    // Slots restantes são preenchidos com dossiês do Radar João.
    const dossiesManual = await prisma.dossieComercial.findMany({
      where: { status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] }, origem: "MANUAL" },
      orderBy: { ultimaAtividade: "asc" },
      take: 5,
      select: selectDossie,
    });

    const slotsRestantes = 5 - dossiesManual.length;
    const dossiesRadar = slotsRestantes > 0
      ? await prisma.dossieComercial.findMany({
          where: {
            status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
            origem: { not: "MANUAL" },
            ...(dossiesManual.length > 0
              ? { id: { notIn: dossiesManual.map(d => d.id) } }
              : {}),
          },
          orderBy: { ultimaAtividade: "asc" },
          take: slotsRestantes,
          select: selectDossie,
        })
      : [];

    const dossies = [...dossiesManual, ...dossiesRadar];

    if (dossies.length === 0) {
      return NextResponse.json({
        sucesso: true,
        mensagem: "Nenhum dossiê ativo para investigar.",
        processados: 0,
        timestamp: new Date().toISOString(),
      });
    }

    const resumos: {
      dossieId: string; titulo: string;
      claude: { achou: boolean; campos: number; decisor: boolean; noticias: number; erro?: string };
      gpt4o:  { achou: boolean; campos: number; decisor: boolean; noticias: number; erro?: string };
    }[] = [];

    for (const dossie of dossies) {
      console.log(`[cron/joao-investigar] Iniciando: ${dossie.titulo}`);

      let combinado;
      try {
        combinado = await investigarDossieCombinado(dossie);
      } catch (e) {
        console.error(`[cron/joao-investigar] Falha combinada para ${dossie.id}:`, e);
        resumos.push({
          dossieId: dossie.id, titulo: dossie.titulo,
          claude: { achou: false, campos: 0, decisor: false, noticias: 0, erro: String(e) },
          gpt4o:  { achou: false, campos: 0, decisor: false, noticias: 0, erro: String(e) },
        });
        continue;
      }

      // Recarrega o dossiê para o segundo salvar refletir mudanças do primeiro
      const dossieAtualizado = await prisma.dossieComercial.findUnique({
        where: { id: dossie.id },
        select: {
          id: true, status: true, completude: true,
          decisores: { select: { nome: true, cargo: true, telefone: true, email: true, linkedin: true } },
          construtora: true, epc: true, epcm: true, faseObra: true,
          cronograma: true, valorEstimado: true, volumeConcreto: true,
          concorrentes: true, missaoAtual: true, fonteInformacao: true,
          cidade: true, estado: true, clienteFinal: true,
        },
      }) ?? dossie;

      const [resultadoClaude, resultadoGPT4o] = await Promise.all([
        salvarResultado(dossie.id, { ...dossieAtualizado, titulo: dossie.titulo }, combinado.claude, "joao-claude"),
        salvarResultado(dossie.id, { ...dossieAtualizado, titulo: dossie.titulo }, combinado.gpt4o,  "joao-gpt4o"),
      ]);

      resumos.push({
        dossieId: dossie.id,
        titulo:   dossie.titulo,
        claude: {
          achou:   combinado.claude.achou,
          campos:  resultadoClaude.camposAtualizados.length,
          decisor: resultadoClaude.decisorEncontrado,
          noticias: resultadoClaude.noticias,
          ...(combinado.claude.erro ? { erro: combinado.claude.erro } : {}),
        },
        gpt4o: {
          achou:   combinado.gpt4o.achou,
          campos:  resultadoGPT4o.camposAtualizados.length,
          decisor: resultadoGPT4o.decisorEncontrado,
          noticias: resultadoGPT4o.noticias,
          ...(combinado.gpt4o.erro ? { erro: combinado.gpt4o.erro } : {}),
        },
      });
    }

    return NextResponse.json({
      sucesso:     true,
      processados: dossies.length,
      detalhes:    resumos,
      timestamp:   new Date().toISOString(),
    });

  } catch (errGlobal) {
    console.error("[cron/joao-investigar] Erro global:", errGlobal);
    return NextResponse.json({
      sucesso: false,
      erro: errGlobal instanceof Error ? errGlobal.message : String(errGlobal),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
