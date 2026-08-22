// ARQUIVO: app/api/agent/joao/investigar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Loop de Investigação Contínua — João percorre dossiês ativos e tenta avançar a missaoAtual.
// Chamado diariamente pelo cron. Auth: Bearer AGENT_API_KEY.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";
import {
  montarPayloadAtualizacaoJoao,
} from "@/lib/inteligencia/joao-estrutura";
import { investigarDossie } from "@/lib/agentes/joao/investigador";

export const maxDuration = 90;

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

function sanitizarDecimal(valor: unknown): number | undefined {
  if (valor === undefined || valor === null || valor === "") return undefined;
  if (typeof valor === "number" && !isNaN(valor)) return valor;
  if (typeof valor === "string") {
    const limpo = valor.replace(/[^0-9.,]/g, "").replace(",", ".");
    const num = parseFloat(limpo);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // sem body, usa default
  }

  const idsSolicitadosRaw = body?.dossieIds ?? body?.dossieId ?? body?.ids;
  const idsSolicitados = Array.isArray(idsSolicitadosRaw)
    ? idsSolicitadosRaw
    : typeof idsSolicitadosRaw === "string"
      ? [idsSolicitadosRaw]
      : [];

  const dossieIdsValidados = [...new Set(idsSolicitados.map((id: unknown) => String(id).trim()).filter(Boolean))];

  if (idsSolicitadosRaw !== undefined && idsSolicitadosRaw !== null && dossieIdsValidados.length === 0) {
    return NextResponse.json({ error: "Lista de dossieIds inválida. Envie uma lista com IDs válidos." }, { status: 400 });
  }

  if (dossieIdsValidados.length > 10) {
    return NextResponse.json({ error: "Máximo de 10 dossiês por chamada." }, { status: 400 });
  }

  let limite = 4;
  if (typeof body?.limite === "number") limite = Math.min(body.limite, 10);

  let dossies;

  if (dossieIdsValidados.length > 0) {
    const encontrados = await prisma.dossieComercial.findMany({
      where: {
        id: { in: dossieIdsValidados },
        status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
      },
      orderBy: { ultimaAtividade: "asc" },
      select: {
        id: true,
        titulo: true,
        resumo: true,
        segmento: true,
        cidade: true,
        estado: true,
        status: true,
        clienteFinal: true,
        construtora: true,
        epc: true,
        epcm: true,
        faseObra: true,
        cronograma: true,
        valorEstimado: true,
        volumeConcreto: true,
        concorrentes: true,
        missaoAtual: true,
        fonteInformacao: true,
        completude: true,
        decisores: {
          select: {
            nome: true,
            cargo: true,
            telefone: true,
            email: true,
            linkedin: true,
          },
        },
      },
    });

    const idsEncontrados = new Set(encontrados.map((d) => d.id));
    const idsInvalidos = dossieIdsValidados.filter((id) => !idsEncontrados.has(id));

    if (idsInvalidos.length > 0) {
      return NextResponse.json({
        error: "Alguns dossiês solicitados não existem ou não estão ativos para investigação.",
        invalidIds: idsInvalidos,
      }, { status: 400 });
    }

    dossies = encontrados;
  } else {
    dossies = await prisma.dossieComercial.findMany({
      where: {
        status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
      },
      orderBy: { ultimaAtividade: "asc" },
      take: limite,
      select: {
        id: true,
        titulo: true,
        resumo: true,
        segmento: true,
        cidade: true,
        estado: true,
        status: true,
        clienteFinal: true,
        construtora: true,
        epc: true,
        epcm: true,
        faseObra: true,
        cronograma: true,
        valorEstimado: true,
        volumeConcreto: true,
        concorrentes: true,
        missaoAtual: true,
        fonteInformacao: true,
        completude: true,
        decisores: {
          select: {
            nome: true,
            cargo: true,
            telefone: true,
            email: true,
            linkedin: true,
          },
        },
      },
    });
  }

  if (dossies.length === 0) {
    return NextResponse.json({
      sucesso: true,
      mensagem: dossieIdsValidados.length > 0 ? "Nenhum dossiê solicitado está ativo para investigar." : "Nenhum dossiê ativo para investigar.",
      processados: 0,
    });
  }

  const resumos: {
    dossieId: string;
    titulo: string;
    achou: boolean;
    camposAtualizados: string[];
    decisorEncontrado: boolean;
    noticias: number;
    resumo: string;
    erro?: string;
  }[] = [];

  for (const dossie of dossies) {
    console.log(`[joao/investigar] Investigando: ${dossie.titulo}`);

    const resultado = await investigarDossie(dossie);
    const camposAtualizados: string[] = [];

    const camposString = [
      "construtora", "epc", "epcm", "faseObra", "cronograma",
      "concorrentes", "fonteInformacao", "linkFonte",
    ];
    const camposDecimal = ["valorEstimado", "volumeConcreto"];

    const camposNovos: Record<string, unknown> = {};
    for (const campo of camposString) {
      const valor = resultado.campos[campo];
      const valorAtual = (dossie as Record<string, unknown>)[campo];
      if (valor !== undefined && valor !== null && valor !== "" && valor !== valorAtual) {
        camposNovos[campo] = valor;
        camposAtualizados.push(campo);
      }
    }
    for (const campo of camposDecimal) {
      const raw = resultado.campos[campo];
      const valorAtual = (dossie as Record<string, unknown>)[campo];
      const sanitized = sanitizarDecimal(raw);
      if (sanitized !== undefined && sanitized !== sanitizarDecimal(valorAtual)) {
        camposNovos[campo] = sanitized;
        camposAtualizados.push(campo);
      }
    }

    const dadosMesclados = { ...dossie, ...camposNovos };
    const { completude, missaoAtual, maturidadeComercial } = recalcularDossie(dadosMesclados, dossie.decisores);
    const payloadAtualizacao = montarPayloadAtualizacaoJoao(dadosMesclados, camposNovos, {
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
      await prisma.$transaction([
        prisma.dossieComercial.update({
          where: { id: dossie.id },
          data: payloadAtualizacao,
        }),
        prisma.atualizacaoDossie.create({
          data: {
            dossieId: dossie.id,
            tipo: "CAMPO_ATUALIZADO",
            titulo: `Loop investigação — ${camposAtualizados.join(", ") || "scores João"}`,
            conteudo: `João atualizou automaticamente: ${camposAtualizados.join(", ") || "scores João"}.\n\nFonte: ${resultado.campos.fonteInformacao ?? "busca web"}\n\n${resultado.resumoInvestigacao}`,
            agente: "joao-investigador",
            fonte: typeof resultado.campos.fonteInformacao === "string" ? resultado.campos.fonteInformacao : null,
            link: typeof resultado.campos.linkFonte === "string" ? resultado.campos.linkFonte : null,
          },
        }),
      ]);
    }

    let decisorEncontrado = false;
    if (resultado.decisor?.nome) {
      const jaExiste = dossie.decisores.some(
        (d) => d.nome?.toLowerCase() === resultado.decisor!.nome.toLowerCase(),
      );

      if (!jaExiste) {
        try {
          const decisor = await prisma.decisorDossie.create({
            data: {
              dossieId: dossie.id,
              nome: resultado.decisor.nome,
              cargo: resultado.decisor.cargo ?? null,
              empresa: resultado.decisor.empresa ?? null,
              linkedin: resultado.decisor.linkedin ?? null,
              telefone: resultado.decisor.telefone ?? null,
              email: resultado.decisor.email ?? null,
              confianca: 60,
              fonte: resultado.decisor.fonte ?? "joao-investigador",
            },
          });

          const decisoresAtualizados = [
            ...dossie.decisores,
            { nome: decisor.nome, telefone: decisor.telefone, email: decisor.email, linkedin: decisor.linkedin },
          ];
          const { completude: compDecisor, missaoAtual: missaoDecisor } = recalcularDossie(dossie, decisoresAtualizados);

          await prisma.$transaction([
            prisma.dossieComercial.update({
              where: { id: dossie.id },
              data: {
                completude: compDecisor,
                missaoAtual: missaoDecisor,
                totalDecisores: { increment: 1 },
                ultimaAtividade: new Date(),
                ...(compDecisor >= 80 && dossie.status === "INVESTIGANDO" ? { status: "AGUARDANDO_VALIDACAO" } : {}),
              },
            }),
            prisma.atualizacaoDossie.create({
              data: {
                dossieId: dossie.id,
                tipo: "DECISOR_ENCONTRADO",
                titulo: `Decisor encontrado: ${resultado.decisor.nome}`,
                conteudo: [
                  `Nome: ${resultado.decisor.nome}`,
                  resultado.decisor.cargo ? `Cargo: ${resultado.decisor.cargo}` : null,
                  resultado.decisor.empresa ? `Empresa: ${resultado.decisor.empresa}` : null,
                  resultado.decisor.telefone ? `Tel: ${resultado.decisor.telefone}` : null,
                  resultado.decisor.email ? `E-mail: ${resultado.decisor.email}` : null,
                  resultado.decisor.linkedin ? `LinkedIn: ${resultado.decisor.linkedin}` : null,
                  resultado.decisor.fonte ? `Fonte: ${resultado.decisor.fonte}` : null,
                ].filter(Boolean).join("\n"),
                agente: "joao-investigador",
                fonte: resultado.decisor.fonte ?? null,
              },
            }),
          ]);

          decisorEncontrado = true;
        } catch (errDecisor) {
          console.error(`[joao/investigar] Erro ao salvar decisor:`, errDecisor);
        }
      }
    }

    for (const noticia of resultado.noticias) {
      if (!noticia.titulo?.trim() || !noticia.conteudo?.trim()) continue;
      try {
        await prisma.$transaction([
          prisma.atualizacaoDossie.create({
            data: {
              dossieId: dossie.id,
              tipo: "NOTICIA_ENCONTRADA",
              titulo: noticia.titulo,
              conteudo: noticia.conteudo,
              fonte: noticia.fonte ?? null,
              link: noticia.link ?? null,
              agente: "joao-investigador",
            },
          }),
          prisma.dossieComercial.update({
            where: { id: dossie.id },
            data: {
              totalNoticias: { increment: 1 },
              totalAtualizacoes: { increment: 1 },
              ultimaAtividade: new Date(),
            },
          }),
        ]);
      } catch (errNoticia) {
        console.error(`[joao/investigar] Erro ao salvar notícia:`, errNoticia);
      }
    }

    if (!resultado.achou && camposAtualizados.length === 0 && !decisorEncontrado && resultado.noticias.length === 0) {
      await prisma.dossieComercial.update({
        where: { id: dossie.id },
        data: { ultimaAtividade: new Date() },
      });
    }

    resumos.push({
      dossieId: dossie.id,
      titulo: dossie.titulo,
      achou: resultado.achou,
      camposAtualizados,
      decisorEncontrado,
      noticias: resultado.noticias.length,
      resumo: resultado.resumoInvestigacao,
      ...(resultado.erro ? { erro: resultado.erro } : {}),
    });
  }

  const totalAchados = resumos.filter((r) => r.achou || r.camposAtualizados.length > 0 || r.decisorEncontrado || r.noticias > 0).length;

  return NextResponse.json({
    sucesso: true,
    processados: dossies.length,
    comAchados: totalAchados,
    semAchados: dossies.length - totalAchados,
    detalhes: resumos,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [investigando, pedirPesquisa] = await Promise.all([
    prisma.dossieComercial.count({ where: { status: "INVESTIGANDO" } }),
    prisma.dossieComercial.count({ where: { status: "PEDIR_MAIS_PESQUISA" } }),
  ]);

  return NextResponse.json({
    investigando,
    pedirPesquisa,
    total: investigando + pedirPesquisa,
    mensagem: `${investigando + pedirPesquisa} dossiês aguardando investigação.`,
  });
}

