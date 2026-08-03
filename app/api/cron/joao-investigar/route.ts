// ARQUIVO: app/api/cron/joao-investigar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Cron diário — chama o loop de investigação do João.
// Roda às 10h BRT (13h UTC) via Vercel Cron.
// Auth: CRON_SECRET (injetado automaticamente pelo Vercel em produção).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { investigarDossie } from "@/lib/agentes/joao/investigador";
import { recalcularDossie } from "@/lib/inteligencia/completude";

export const maxDuration = 300; // 5 minutos

function autenticado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization");
  // Aceita CRON_SECRET (Vercel) ou AGENT_API_KEY (teste manual)
  return Boolean(
    (secret && auth === `Bearer ${secret}`) ||
    (process.env.AGENT_API_KEY && auth === `Bearer ${process.env.AGENT_API_KEY}`)
  );
}

export async function GET(req: NextRequest) {
  if (!autenticado(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Pega até 5 dossiês — prioriza os com menor ultimaAtividade
  const dossies = await prisma.dossieComercial.findMany({
    where: { status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] } },
    orderBy: { ultimaAtividade: "asc" },
    take: 5,
    select: {
      id:             true,
      titulo:         true,
      resumo:         true,
      segmento:       true,
      cidade:         true,
      estado:         true,
      status:         true,
      clienteFinal:   true,
      construtora:    true,
      epc:            true,
      epcm:           true,
      faseObra:       true,
      cronograma:     true,
      valorEstimado:  true,
      volumeConcreto: true,
      concorrentes:   true,
      missaoAtual:    true,
      fonteInformacao:true,
      completude:     true,
      decisores: {
        select: { nome: true, cargo: true, telefone: true, email: true, linkedin: true },
      },
    },
  });

  if (dossies.length === 0) {
    return NextResponse.json({
      sucesso: true,
      mensagem: "Nenhum dossiê ativo para investigar.",
      processados: 0,
      timestamp: new Date().toISOString(),
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
    console.log(`[cron/joao-investigar] Investigando: ${dossie.titulo}`);
    const resultado = await investigarDossie(dossie);
    const camposAtualizados: string[] = [];

    // Campos que podem ser atualizados
    const camposPermitidos = [
      "construtora", "epc", "epcm", "faseObra", "cronograma",
      "valorEstimado", "volumeConcreto", "concorrentes",
      "fonteInformacao", "linkFonte",
    ];

    const camposNovos: Record<string, unknown> = {};
    for (const campo of camposPermitidos) {
      const valor = resultado.campos[campo];
      const valorAtual = (dossie as Record<string, unknown>)[campo];
      if (valor !== undefined && valor !== null && valor !== "" && valor !== valorAtual) {
        camposNovos[campo] = valor;
        camposAtualizados.push(campo);
      }
    }

    if (Object.keys(camposNovos).length > 0) {
      const dadosMesclados = { ...dossie, ...camposNovos };
      const { completude, missaoAtual } = recalcularDossie(dadosMesclados, dossie.decisores);
      camposNovos.completude      = completude;
      camposNovos.missaoAtual     = missaoAtual;
      camposNovos.ultimaAtividade = new Date();
      if (completude >= 80 && dossie.status === "INVESTIGANDO") {
        camposNovos.status = "AGUARDANDO_VALIDACAO";
      }
      await prisma.$transaction([
        prisma.dossieComercial.update({ where: { id: dossie.id }, data: camposNovos }),
        prisma.atualizacaoDossie.create({
          data: {
            dossieId: dossie.id,
            tipo:     "CAMPO_ATUALIZADO",
            titulo:   `Cron investigação — ${camposAtualizados.join(", ")}`,
            conteudo: `João atualizou automaticamente: ${camposAtualizados.join(", ")}.\n\nFonte: ${resultado.campos.fonteInformacao ?? "busca web"}\n\n${resultado.resumoInvestigacao}`,
            agente:   "joao-cron",
            fonte:    typeof resultado.campos.fonteInformacao === "string" ? resultado.campos.fonteInformacao : null,
            link:     typeof resultado.campos.linkFonte === "string" ? resultado.campos.linkFonte : null,
          },
        }),
      ]);
    }

    // Decisor encontrado
    let decisorEncontrado = false;
    if (resultado.decisor?.nome) {
      const jaExiste = dossie.decisores.some(
        d => d.nome?.toLowerCase() === resultado.decisor!.nome.toLowerCase()
      );
      if (!jaExiste) {
        try {
          const decisor = await prisma.decisorDossie.create({
            data: {
              dossieId:  dossie.id,
              nome:      resultado.decisor.nome,
              cargo:     resultado.decisor.cargo    ?? null,
              empresa:   resultado.decisor.empresa  ?? null,
              linkedin:  resultado.decisor.linkedin ?? null,
              telefone:  resultado.decisor.telefone ?? null,
              email:     resultado.decisor.email    ?? null,
              confianca: 60,
              fonte:     resultado.decisor.fonte    ?? "joao-cron",
            },
          });
          const decisoresAtualizados = [
            ...dossie.decisores,
            { nome: decisor.nome, telefone: decisor.telefone, email: decisor.email, linkedin: decisor.linkedin },
          ];
          const { completude: compDec, missaoAtual: missaoDec } = recalcularDossie(dossie, decisoresAtualizados);
          await prisma.$transaction([
            prisma.dossieComercial.update({
              where: { id: dossie.id },
              data: {
                completude: compDec, missaoAtual: missaoDec,
                totalDecisores: { increment: 1 }, ultimaAtividade: new Date(),
                ...(compDec >= 80 && dossie.status === "INVESTIGANDO" ? { status: "AGUARDANDO_VALIDACAO" } : {}),
              },
            }),
            prisma.atualizacaoDossie.create({
              data: {
                dossieId: dossie.id,
                tipo:     "DECISOR_ENCONTRADO",
                titulo:   `Decisor encontrado: ${resultado.decisor.nome}`,
                conteudo: [
                  `Nome: ${resultado.decisor.nome}`,
                  resultado.decisor.cargo    ? `Cargo: ${resultado.decisor.cargo}`    : null,
                  resultado.decisor.empresa  ? `Empresa: ${resultado.decisor.empresa}`: null,
                  resultado.decisor.linkedin ? `LinkedIn: ${resultado.decisor.linkedin}` : null,
                  resultado.decisor.fonte    ? `Fonte: ${resultado.decisor.fonte}`    : null,
                ].filter(Boolean).join("\n"),
                agente: "joao-cron",
                fonte:  resultado.decisor.fonte ?? null,
              },
            }),
          ]);
          decisorEncontrado = true;
        } catch (e) {
          console.error(`[cron/joao-investigar] Erro ao salvar decisor:`, e);
        }
      }
    }

    // Notícias encontradas
    for (const noticia of resultado.noticias) {
      if (!noticia.titulo?.trim() || !noticia.conteudo?.trim()) continue;
      try {
        await prisma.$transaction([
          prisma.atualizacaoDossie.create({
            data: {
              dossieId: dossie.id,
              tipo:     "NOTICIA_ENCONTRADA",
              titulo:   noticia.titulo,
              conteudo: noticia.conteudo,
              fonte:    noticia.fonte ?? null,
              link:     noticia.link  ?? null,
              agente:   "joao-cron",
            },
          }),
          prisma.dossieComercial.update({
            where: { id: dossie.id },
            data:  { totalNoticias: { increment: 1 }, totalAtualizacoes: { increment: 1 }, ultimaAtividade: new Date() },
          }),
        ]);
      } catch (e) {
        console.error(`[cron/joao-investigar] Erro ao salvar notícia:`, e);
      }
    }

    // Marca atividade mesmo sem achados
    if (!resultado.achou && camposAtualizados.length === 0 && !decisorEncontrado && resultado.noticias.length === 0) {
      await prisma.dossieComercial.update({
        where: { id: dossie.id },
        data:  { ultimaAtividade: new Date() },
      });
    }

    resumos.push({
      dossieId:          dossie.id,
      titulo:            dossie.titulo,
      achou:             resultado.achou,
      camposAtualizados,
      decisorEncontrado,
      noticias:          resultado.noticias.length,
      resumo:            resultado.resumoInvestigacao,
      ...(resultado.erro ? { erro: resultado.erro } : {}),
    });
  }

  const totalAchados = resumos.filter(r => r.achou || r.camposAtualizados.length > 0 || r.decisorEncontrado || r.noticias > 0).length;

  return NextResponse.json({
    sucesso:      true,
    processados:  dossies.length,
    comAchados:   totalAchados,
    detalhes:     resumos,
    timestamp:    new Date().toISOString(),
  });
}
