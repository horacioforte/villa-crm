// ARQUIVO: app/api/agent/joao/investigar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Loop de Investigação Contínua — João percorre dossiês ativos e tenta avançar a missaoAtual.
// Chamado diariamente pelo cron. Auth: Bearer AGENT_API_KEY.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";
import { investigarDossie } from "@/lib/agentes/joao/investigador";

export const maxDuration = 90;

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

// ─── POST — executa o loop ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Parâmetro opcional: limitar quantidade de dossiês processados por rodada
  let limite = 4;
  try {
    const body = await req.json();
    if (typeof body?.limite === "number") limite = Math.min(body.limite, 10);
  } catch { /* sem body, usa default */ }

  // Busca dossiês ativos (INVESTIGANDO ou PEDIR_MAIS_PESQUISA)
  // Ordena pelos que foram atualizados há mais tempo (garante rotação)
  const dossies = await prisma.dossieComercial.findMany({
    where: {
      status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
    },
    orderBy: { ultimaAtividade: "asc" },
    take: limite,
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
      fonteInformacao: true,
      completude:     true,
      decisores: {
        select: {
          nome:     true,
          cargo:    true,
          telefone: true,
          email:    true,
          linkedin: true,
        },
      },
    },
  });

  if (dossies.length === 0) {
    return NextResponse.json({
      sucesso: true,
      mensagem: "Nenhum dossiê ativo para investigar.",
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

  // ─── Processa cada dossiê ──────────────────────────────────────────────────

  for (const dossie of dossies) {
    console.log(`[joao/investigar] Investigando: ${dossie.titulo}`);

    const resultado = await investigarDossie(dossie);
    const camposAtualizados: string[] = [];

    // 1. Atualiza campos estruturados do dossiê (se encontrou algo)
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
        prisma.dossieComercial.update({
          where: { id: dossie.id },
          data: camposNovos,
        }),
        prisma.atualizacaoDossie.create({
          data: {
            dossieId: dossie.id,
            tipo:     "CAMPO_ATUALIZADO",
            titulo:   `Loop investigação — ${camposAtualizados.join(", ")}`,
            conteudo: `João atualizou automaticamente: ${camposAtualizados.join(", ")}.\n\nFonte: ${resultado.campos.fonteInformacao ?? "busca web"}\n\n${resultado.resumoInvestigacao}`,
            agente:   "joao-investigador",
            fonte:    typeof resultado.campos.fonteInformacao === "string" ? resultado.campos.fonteInformacao : null,
            link:     typeof resultado.campos.linkFonte === "string" ? resultado.campos.linkFonte : null,
          },
        }),
      ]);
    }

    // 2. Registra decisor encontrado (se missão era sobre decisor e encontrou)
    let decisorEncontrado = false;
    if (resultado.decisor?.nome) {
      // Verifica se já existe pelo nome
      const jaExiste = dossie.decisores.some(
        d => d.nome?.toLowerCase() === resultado.decisor!.nome.toLowerCase(),
      );

      if (!jaExiste) {
        try {
          const decisor = await prisma.decisorDossie.create({
            data: {
              dossieId:  dossie.id,
              nome:      resultado.decisor.nome,
              cargo:     resultado.decisor.cargo     ?? null,
              empresa:   resultado.decisor.empresa   ?? null,
              linkedin:  resultado.decisor.linkedin  ?? null,
              telefone:  resultado.decisor.telefone  ?? null,
              email:     resultado.decisor.email     ?? null,
              confianca: 60, // confiança moderada para achados automáticos
              fonte:     resultado.decisor.fonte     ?? "joao-investigador",
            },
          });

          // Recalcula completude com novo decisor
          const decisoresAtualizados = [
            ...dossie.decisores,
            { nome: decisor.nome, telefone: decisor.telefone, email: decisor.email, linkedin: decisor.linkedin },
          ];
          const { completude: compDecisor, missaoAtual: missaoDecisor } = recalcularDossie(dossie, decisoresAtualizados);

          await prisma.$transaction([
            prisma.dossieComercial.update({
              where: { id: dossie.id },
              data: {
                completude:      compDecisor,
                missaoAtual:     missaoDecisor,
                totalDecisores:  { increment: 1 },
                ultimaAtividade: new Date(),
                ...(compDecisor >= 80 && dossie.status === "INVESTIGANDO" ? { status: "AGUARDANDO_VALIDACAO" } : {}),
              },
            }),
            prisma.atualizacaoDossie.create({
              data: {
                dossieId: dossie.id,
                tipo:     "DECISOR_ENCONTRADO",
                titulo:   `Decisor encontrado: ${resultado.decisor.nome}`,
                conteudo: [
                  `Nome: ${resultado.decisor.nome}`,
                  resultado.decisor.cargo    ? `Cargo: ${resultado.decisor.cargo}`       : null,
                  resultado.decisor.empresa  ? `Empresa: ${resultado.decisor.empresa}`   : null,
                  resultado.decisor.telefone ? `Tel: ${resultado.decisor.telefone}`      : null,
                  resultado.decisor.email    ? `E-mail: ${resultado.decisor.email}`      : null,
                  resultado.decisor.linkedin ? `LinkedIn: ${resultado.decisor.linkedin}` : null,
                  resultado.decisor.fonte    ? `Fonte: ${resultado.decisor.fonte}`       : null,
                ].filter(Boolean).join("\n"),
                agente: "joao-investigador",
                fonte:  resultado.decisor.fonte ?? null,
              },
            }),
          ]);

          decisorEncontrado = true;
        } catch (errDecisor) {
          console.error(`[joao/investigar] Erro ao salvar decisor:`, errDecisor);
        }
      }
    }

    // 3. Registra notícias encontradas
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
              agente:   "joao-investigador",
            },
          }),
          prisma.dossieComercial.update({
            where: { id: dossie.id },
            data: {
              totalNoticias:     { increment: 1 },
              totalAtualizacoes: { increment: 1 },
              ultimaAtividade:   new Date(),
            },
          }),
        ]);
      } catch (errNoticia) {
        console.error(`[joao/investigar] Erro ao salvar notícia:`, errNoticia);
      }
    }

    // 4. Mesmo sem achados, registra que a investigação ocorreu (para rotação)
    if (!resultado.achou && camposAtualizados.length === 0 && !decisorEncontrado && resultado.noticias.length === 0) {
      await prisma.dossieComercial.update({
        where: { id: dossie.id },
        data: { ultimaAtividade: new Date() },
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
    sucesso:          true,
    processados:      dossies.length,
    comAchados:       totalAchados,
    semAchados:       dossies.length - totalAchados,
    detalhes:         resumos,
    timestamp:        new Date().toISOString(),
  });
}

// ─── GET — status rápido (quantos dossiês aguardam investigação) ───────────────

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
