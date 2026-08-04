// ARQUIVO: app/api/cron/joao-investigar/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Cron Mon+Wed — João investiga dossiês com Claude Haiku + GPT-4o em paralelo.
// Roda às 10h BRT (13h UTC) via Vercel Cron.
// Auth: CRON_SECRET (Vercel) ou AGENT_API_KEY (teste manual).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { investigarDossieCombinado, sanitizarDecimal } from "@/lib/agentes/joao/investigador-combinado";
import { recalcularDossie } from "@/lib/inteligencia/completude";
import type { ResultadoInvestigacao } from "@/lib/agentes/joao/investigador";

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

  if (Object.keys(camposNovos).length > 0) {
    try {
      const dadosMesclados = { ...dossie, ...camposNovos };
      const { completude, missaoAtual, maturidadeComercial } = recalcularDossie(dadosMesclados, dossie.decisores);
      camposNovos.completude          = completude;
      camposNovos.missaoAtual         = missaoAtual;
      camposNovos.maturidadeComercial = maturidadeComercial;
      camposNovos.ultimaAtividade     = new Date();
      if (completude >= 80 && dossie.status === "INVESTIGANDO") {
        camposNovos.status = "AGUARDANDO_VALIDACAO";
      }
      await prisma.$transaction([
        prisma.dossieComercial.update({ where: { id: dossieId }, data: camposNovos }),
        prisma.atualizacaoDossie.create({
          data: {
            dossieId,
            tipo:    "CAMPO_ATUALIZADO",
            titulo:  `[${agenteLabel}] Campos atualizados: ${camposAtualizados.join(", ")}`,
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
        const { completude: compDec, missaoAtual: missaoDec, maturidadeComercial: maturDec } = recalcularDossie(dossie, decisoresAtualizados);
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

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!autenticado(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const dossies = await prisma.dossieComercial.findMany({
      where: { status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] } },
      orderBy: { ultimaAtividade: "asc" },
      take: 5,
      select: {
        id: true, titulo: true, resumo: true, segmento: true,
        cidade: true, estado: true, status: true, clienteFinal: true,
        construtora: true, epc: true, epcm: true, faseObra: true,
        cronograma: true, valorEstimado: true, volumeConcreto: true,
        concorrentes: true, missaoAtual: true, fonteInformacao: true,
        completude: true,
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
