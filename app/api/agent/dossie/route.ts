// ARQUIVO: app/api/agent/dossie/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// João cria um novo DossieComercial via radar — autenticação Bearer AGENT_API_KEY.
// Este endpoint é o ponto de entrada da NOVA REGRA (Phase 3):
// em vez de criar Oportunidade diretamente, o radar alimenta a Central de Inteligência.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";
import { exportarScoresJoaoParaPersistencia } from "@/lib/inteligencia/joao-estrutura";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

// ─── POST — criar novo dossiê via agente João (radar) ────────────────────────

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: {
    // Obrigatório
    titulo: string;
    // Enriquecimento
    resumo?: string;
    segmento?: string;
    cidade?: string;
    estado?: string;
    clienteFinal?: string;
    construtora?: string;
    epc?: string;
    epcm?: string;
    faseObra?: string;
    valorEstimado?: number;
    fonteInformacao?: string;
    linkFonte?: string;
    score?: number;
    prioridade?: string;
    tipo?: string;
    // Empresa vinculada (razão social para buscar/criar)
    empresaNome?: string;
    empresaCnpj?: string;
    empresaSite?: string;
    empresaSegmento?: string;
    empresaCidade?: string;
    empresaEstado?: string;
    // Obra vinculada (nome para buscar/criar)
    obraNome?: string;
    obraDescricao?: string;
    obraCidade?: string;
    obraEstado?: string;
    // Decisor inicial
    decisorNome?: string;
    decisorCargo?: string;
    decisorTelefone?: string;
    decisorEmail?: string;
    decisorLinkedin?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });
  }

  // ─── Verificação 0: a obra já existe como Oportunidade no funil comercial? ──
  // StatusOportunidade real (schema): NOVA, PRE_QUALIFICADA, EM_ATENDIMENTO,
  // PROPOSTA_ENVIADA, NEGOCIACAO, GANHA, PERDIDA. Checa TODOS os status — inclusive
  // GANHA (já é cliente nessa obra) e PERDIDA (pode voltar, mas não via dossiê novo).
  const tituloParaBusca = body.titulo.trim();
  let oportunidadeExistente = await prisma.oportunidade.findFirst({
    where: { titulo: { contains: tituloParaBusca.slice(0, 50), mode: "insensitive" } },
    select: { id: true, titulo: true, status: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  // Busca secundária (título com palavras levemente diferentes): exige palavra-chave
  // do título E cidade batendo (via Obra ou Empresa — Oportunidade não tem campo
  // cidade próprio). Sem body.cidade, não roda — palavra isolada sem localização é
  // match frouxo demais e arriscaria bloquear uma obra nova por engano.
  if (!oportunidadeExistente && body.cidade?.trim()) {
    const palavras = tituloParaBusca.split(/\s+/).filter((p: string) => p.length > 5).slice(0, 2);
    if (palavras.length >= 1) {
      oportunidadeExistente = await prisma.oportunidade.findFirst({
        where: {
          titulo: { contains: palavras[0], mode: "insensitive" },
          OR: [
            { obra: { cidade: { contains: body.cidade.trim(), mode: "insensitive" } } },
            { empresa: { cidade: { contains: body.cidade.trim(), mode: "insensitive" } } },
          ],
        },
        select: { id: true, titulo: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      });
    }
  }

  if (oportunidadeExistente) {
    const foiPerdida = oportunidadeExistente.status === "PERDIDA";
    const foiGanha   = oportunidadeExistente.status === "GANHA";
    const estaAtiva  = !foiPerdida && !foiGanha;

    return NextResponse.json({
      sucesso:                 false,
      jaExisteComoOportunidade: true,
      estaAtiva,
      foiPerdida,
      foiGanha,
      oportunidade:            oportunidadeExistente,
      mensagem: foiGanha
        ? `Esta obra já é uma Oportunidade GANHA ("${oportunidadeExistente.titulo}"). Não criar dossiê.`
        : foiPerdida
          ? `Esta obra já foi trabalhada como oportunidade e foi perdida ("${oportunidadeExistente.titulo}"). Revise antes de criar novo dossiê.`
          : `Esta obra já está no funil comercial como oportunidade ativa ("${oportunidadeExistente.titulo}", status: ${oportunidadeExistente.status}). Não criar dossiê.`,
    }, { status: 200 });
  }

  // ─── Verificação de duplicata com merge inteligente (2 camadas) ─────────────
  // Se encontrar dossiê existente, não descarta — enriquece com dados novos.

  // Camada 1: título idêntico (case-insensitive)
  let dossieExistente = await prisma.dossieComercial.findFirst({
    where: { titulo: { equals: body.titulo.trim(), mode: "insensitive" } },
    include: { decisores: { select: { nome: true, telefone: true, email: true, linkedin: true } } },
  });

  // Camada 2: mesma empresa (clienteFinal) + mesma cidade
  if (!dossieExistente && body.clienteFinal?.trim() && body.cidade?.trim()) {
    dossieExistente = await prisma.dossieComercial.findFirst({
      where: {
        clienteFinal: { equals: body.clienteFinal.trim(), mode: "insensitive" },
        cidade:       { equals: body.cidade.trim(),       mode: "insensitive" },
        status:       { not: "ARQUIVADO" },
      },
      include: { decisores: { select: { nome: true, telefone: true, email: true, linkedin: true } } },
    });
  }

  // ─── Merge inteligente — enriquece o existente com dados novos ───────────────
  if (dossieExistente) {
    let concorrenteAdicionado = false;
    const camposMergeaveis = [
      "resumo", "segmento", "cidade", "estado",
      "clienteFinal", "construtora", "epc", "epcm",
      "faseObra", "fonteInformacao", "linkFonte",
    ] as const;

    const camposNovos: Record<string, unknown> = {};
    const camposEnriquecidos: string[] = [];

    for (const campo of camposMergeaveis) {
      const valorExistente = (dossieExistente as Record<string, unknown>)[campo];
      const valorNovo      = (body as Record<string, unknown>)[campo];
      // Só preenche se o campo está vazio no existente e o novo tem valor
      if (!valorExistente && valorNovo) {
        camposNovos[campo] = valorNovo;
        camposEnriquecidos.push(campo);
      }
    }

    // valorEstimado: preenche se vazio, ou atualiza se o novo for maior
    if (body.valorEstimado) {
      const existente = dossieExistente.valorEstimado ? Number(dossieExistente.valorEstimado) : 0;
      if (!existente || body.valorEstimado > existente) {
        camposNovos.valorEstimado = String(body.valorEstimado);
        camposEnriquecidos.push("valorEstimado");
      }
    }

    // score: atualiza se o novo for maior
    if (body.score && body.score > (dossieExistente.score ?? 0)) {
      camposNovos.score = body.score;
      camposEnriquecidos.push("score");
    }

    // Recalcula completude se há campos novos
    if (camposEnriquecidos.length > 0) {
      const dadosMesclados = { ...dossieExistente, ...camposNovos };
      const { completude, missaoAtual, maturidadeComercial } = recalcularDossie(dadosMesclados, dossieExistente.decisores);
      const scoresPersistencia = exportarScoresJoaoParaPersistencia(dadosMesclados);
      Object.assign(camposNovos, scoresPersistencia);
      camposNovos.completude           = completude;
      camposNovos.missaoAtual          = missaoAtual;
      camposNovos.maturidadeComercial  = maturidadeComercial;
      camposNovos.ultimaAtividade      = new Date();
      if (completude >= 80 && dossieExistente.status === "INVESTIGANDO") {
        camposNovos.status = "AGUARDANDO_VALIDACAO";
      }

      await prisma.$transaction([
        prisma.dossieComercial.update({ where: { id: dossieExistente.id }, data: camposNovos }),
        prisma.atualizacaoDossie.create({
          data: {
            dossieId: dossieExistente.id,
            tipo:     "CAMPO_ATUALIZADO",
            titulo:   `Enriquecido pelo radar — ${camposEnriquecidos.join(", ")}`,
            conteudo: `Radar encontrou novos dados e atualizou automaticamente.\nCampos: ${camposEnriquecidos.join(", ")}\nFonte: ${body.fonteInformacao ?? "radar"}`,
            agente:   "joao-radar",
            fonte:    body.fonteInformacao ?? null,
            link:     body.linkFonte       ?? null,
          },
        }),
      ]);
    }

    // Adiciona decisor novo se vier no payload e ainda não existir
    if (body.decisorNome?.trim()) {
      const jaTemDecisor = dossieExistente.decisores.some(
        d => d.nome?.toLowerCase() === body.decisorNome!.toLowerCase(),
      );
      if (!jaTemDecisor) {
        await prisma.decisorDossie.create({
          data: {
            dossieId:  dossieExistente.id,
            nome:      body.decisorNome.trim(),
            cargo:     body.decisorCargo     ?? null,
            telefone:  body.decisorTelefone  ?? null,
            email:     body.decisorEmail     ?? null,
            linkedin:  body.decisorLinkedin  ?? null,
            confianca: 70,
            fonte:     body.fonteInformacao  ?? null,
          },
        });
        const decisoresAtualizados = [
          ...dossieExistente.decisores,
          { nome: body.decisorNome, telefone: body.decisorTelefone ?? null, email: body.decisorEmail ?? null, linkedin: body.decisorLinkedin ?? null },
        ];
        const { completude: c2, missaoAtual: m2, maturidadeComercial: mat2 } = recalcularDossie(dossieExistente, decisoresAtualizados);
        await prisma.dossieComercial.update({
          where: { id: dossieExistente.id },
          data: {
            completude: c2, missaoAtual: m2,
            maturidadeComercial: mat2,
            totalDecisores: { increment: 1 },
            ultimaAtividade: new Date(),
          },
        });
        camposEnriquecidos.push(`decisor:${body.decisorNome}`);
      }
    }

    // ─── Concorrentes: outra construtora disputando a MESMA obra (licitação) ────
    // O dossiê representa a obra, não a construtora — uma segunda construtora não
    // vira um dossiê novo, vira um concorrente registrado neste mesmo dossiê.
    const novaConstrutora = body.construtora?.trim();
    if (novaConstrutora) {
      // Compara contra o valor EFETIVO (pós-merge): se "construtora" estava vazia e
      // acabou de ser preenchida com este mesmo payload (bloco camposMergeaveis acima),
      // dossieExistente.construtora ainda está desatualizado (lido antes do update) —
      // usar só esse valor trataria a própria construtora recém-atribuída como seu
      // próprio concorrente.
      const construtoraEfetiva = (camposNovos.construtora as string | undefined) ?? dossieExistente.construtora ?? null;
      const construtoraExistenteNoDossie = construtoraEfetiva?.toLowerCase() === novaConstrutora.toLowerCase();

      const concorrentesAtuais: string[] = dossieExistente.concorrentes
        ? dossieExistente.concorrentes.split(",").map((c: string) => c.trim()).filter(Boolean)
        : [];
      const jaEhConcorrente = concorrentesAtuais.some(c => c.toLowerCase() === novaConstrutora.toLowerCase());

      if (!construtoraExistenteNoDossie && !jaEhConcorrente) {
        concorrentesAtuais.push(novaConstrutora);
        const novosConcorrentes = concorrentesAtuais.join(", ");

        await prisma.$transaction([
          prisma.dossieComercial.update({
            where: { id: dossieExistente.id },
            data: { concorrentes: novosConcorrentes, ultimaAtividade: new Date() },
          }),
          prisma.atualizacaoDossie.create({
            data: {
              dossieId: dossieExistente.id,
              tipo:     "CAMPO_ATUALIZADO",
              titulo:   `Nova construtora identificada na licitação: ${novaConstrutora}`,
              conteudo: `O radar identificou ${novaConstrutora} como participante da licitação desta obra.\nConcorrentes atualizados: ${novosConcorrentes}`,
              agente:   "joao-radar",
              fonte:    body.fonteInformacao ?? null,
              link:     body.linkFonte ?? null,
            },
          }),
        ]);

        camposEnriquecidos.push("concorrentes");
        concorrenteAdicionado = true;
      }
    }

    return NextResponse.json({
      sucesso:              true,
      duplicata:            true,
      merged:               true,
      concorrenteAdicionado,
      mensagem:           camposEnriquecidos.length > 0
        ? `Dossiê existente enriquecido com: ${camposEnriquecidos.join(", ")}.`
        : "Dossiê já existente — nenhum campo novo para enriquecer.",
      dossieId:           dossieExistente.id,
      status:             dossieExistente.status,
      camposEnriquecidos,
    });
  }

  // Buscar ou criar Empresa vinculada
  let empresaId: string | null = null;
  if (body.empresaNome?.trim()) {
    let empresa = await prisma.empresa.findFirst({
      where: { razaoSocial: { equals: body.empresaNome.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          razaoSocial: body.empresaNome.trim(),
          cnpj:        body.empresaCnpj     ?? null,
          site:        body.empresaSite     ?? null,
          segmento:    body.empresaSegmento ?? null,
          cidade:      body.empresaCidade   ?? null,
          estado:      body.empresaEstado   ?? null,
          ativa: true,
        },
        select: { id: true },
      });
    }
    empresaId = empresa.id;
  }

  // Buscar ou criar Obra vinculada
  let obraId: string | null = null;
  if (body.obraNome?.trim() && empresaId) {
    let obra = await prisma.obra.findFirst({
      where: {
        empresaId,
        nome: { equals: body.obraNome.trim(), mode: "insensitive" },
      },
      select: { id: true },
    });
    if (!obra) {
      obra = await prisma.obra.create({
        data: {
          nome:      body.obraNome.trim(),
          descricao: body.obraDescricao ?? null,
          cidade:    body.obraCidade    ?? null,
          estado:    body.obraEstado    ?? null,
          status:    "EM_ANDAMENTO",
          empresaId,
          ativa: true,
        },
        select: { id: true },
      });
    }
    obraId = obra.id;
  }

  // Calcular completude inicial
  const dadosParaCalculo = {
    titulo:         body.titulo,
    resumo:         body.resumo,
    segmento:       body.segmento,
    cidade:         body.cidade,
    estado:         body.estado,
    clienteFinal:   body.clienteFinal,
    construtora:    body.construtora,
    faseObra:       body.faseObra,
    fonteInformacao: body.fonteInformacao,
    linkFonte:      body.linkFonte,
  };

  const decisoresIniciais = body.decisorNome
    ? [{ nome: body.decisorNome, telefone: body.decisorTelefone ?? null, email: body.decisorEmail ?? null, linkedin: body.decisorLinkedin ?? null }]
    : [];

  const { completude, missaoAtual, maturidadeComercial } = recalcularDossie(dadosParaCalculo, decisoresIniciais);
  const scoresPersistencia = exportarScoresJoaoParaPersistencia(dadosParaCalculo);

  // Criar DossieComercial
  const dossie = await prisma.dossieComercial.create({
    data: {
      titulo:               body.titulo.trim(),
      resumo:               body.resumo          ?? null,
      origem:               "JOAO_RADAR",
      tipo:                 (body.tipo as "OBRA" | "EMPRESA" | "MOVIMENTO_ESTRATEGICO" | "LICENCIAMENTO" | "LEAD") ?? "OBRA",
      segmento:             body.segmento        ?? null,
      cidade:               body.cidade          ?? null,
      estado:               body.estado          ?? null,
      clienteFinal:         body.clienteFinal    ?? null,
      construtora:          body.construtora     ?? null,
      epc:                  body.epc             ?? null,
      epcm:                 body.epcm            ?? null,
      faseObra:             body.faseObra        ?? null,
      valorEstimado:        body.valorEstimado   ? String(body.valorEstimado) : null,
      fonteInformacao:      body.fonteInformacao ?? null,
      linkFonte:            body.linkFonte       ?? null,
      score:                body.score           ?? 50,
      prioridade:           body.prioridade      ?? null,
      ...scoresPersistencia,
      completude,
      missaoAtual,
      maturidadeComercial,
      criadoPorAgente:      "joao-radar",
      ultimaAtividade:      new Date(),
      empresaId,
      obraId,
    },
  });

  // Log de criação
  await prisma.atualizacaoDossie.create({
    data: {
      dossieId: dossie.id,
      tipo:     "CRIACAO",
      titulo:   "Dossiê criado pelo João Radar",
      conteudo: [
        body.resumo                 ? `Resumo: ${body.resumo}` : null,
        body.segmento               ? `Segmento: ${body.segmento}` : null,
        body.clienteFinal           ? `Cliente final: ${body.clienteFinal}` : null,
        body.fonteInformacao        ? `Fonte: ${body.fonteInformacao}` : null,
        body.linkFonte              ? `Link: ${body.linkFonte}` : null,
        body.faseObra               ? `Fase: ${body.faseObra}` : null,
        `Score: ${body.score ?? 50}`,
      ].filter(Boolean).join("\n"),
      agente: "joao-radar",
      fonte:  body.linkFonte ?? body.fonteInformacao ?? null,
    },
  });

  // Criar decisor inicial se fornecido
  if (body.decisorNome?.trim()) {
    await prisma.decisorDossie.create({
      data: {
        dossieId:  dossie.id,
        nome:      body.decisorNome.trim(),
        cargo:     body.decisorCargo     ?? null,
        telefone:  body.decisorTelefone  ?? null,
        email:     body.decisorEmail     ?? null,
        linkedin:  body.decisorLinkedin  ?? null,
        confianca: 70,
        fonte:     body.fonteInformacao  ?? null,
      },
    });

    await prisma.dossieComercial.update({
      where: { id: dossie.id },
      data:  { totalDecisores: 1, completude, missaoAtual, maturidadeComercial },
    });
  }

  return NextResponse.json({
    sucesso:    true,
    mensagem:   "Dossiê criado com sucesso na Central de Inteligência.",
    dossieId:   dossie.id,
    completude,
    missaoAtual,
    urlCRM:     `https://villa-crm.vercel.app/inteligencia/${dossie.id}`,
  }, { status: 201 });
}
