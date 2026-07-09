// ARQUIVO: app/api/agent/dossie/[id]/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// João enriquece um dossiê existente com novos dados descobertos.
// Auth: Bearer AGENT_API_KEY.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;

  const dossieAtual = await prisma.dossieComercial.findUnique({
    where: { id: id },
    include: { decisores: { select: { nome: true, telefone: true, email: true, linkedin: true } } },
  });
  if (!dossieAtual) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const camposPermitidos = [
    "resumo", "segmento", "cidade", "estado",
    "clienteFinal", "construtora", "epc", "epcm", "consorcio",
    "faseObra", "cronograma", "licenciamento",
    "valorEstimado", "volumeConcreto",
    "equipamentosSugeridos", "campanhasSugerida", "proximaAcaoSugerida",
    "concorrentes", "fornecedores", "concreteiras",
    "fonteInformacao", "linkFonte", "score", "prioridade",
  ] as const;

  const data: Record<string, unknown> = {};
  const camposAlterados: string[] = [];

  for (const campo of camposPermitidos) {
    if (campo in body && body[campo] !== undefined) {
      // Só atualiza se o valor novo não estiver vazio e for diferente do atual
      const valorNovo = body[campo];
      const valorAtual = (dossieAtual as Record<string, unknown>)[campo];
      if (valorNovo !== valorAtual) {
        data[campo] = valorNovo;
        camposAlterados.push(campo);
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ sucesso: true, mensagem: "Nenhum campo novo para atualizar.", completude: dossieAtual.completude });
  }

  // Recalcula completude
  const dadosMesclados = { ...dossieAtual, ...data };
  const { completude, missaoAtual } = recalcularDossie(dadosMesclados, dossieAtual.decisores);
  data.completude     = completude;
  data.missaoAtual    = missaoAtual;
  data.ultimaAtividade = new Date();

  // Se completude >= 80, sugere validação
  if (completude >= 80 && dossieAtual.status === "INVESTIGANDO") {
    data.status = "AGUARDANDO_VALIDACAO";
  }

  await prisma.$transaction([
    prisma.dossieComercial.update({ where: { id: id }, data }),
    prisma.atualizacaoDossie.create({
      data: {
        dossieId: id,
        tipo:     "CAMPO_ATUALIZADO",
        titulo:   `Dossiê enriquecido — ${camposAlterados.join(", ")}`,
        conteudo: `João atualizou os campos: ${camposAlterados.join(", ")}.\nCompletude: ${completude}%. Próxima missão: ${missaoAtual}`,
        agente:   "joao-radar",
        fonte:    typeof body.fonteInformacao === "string" ? body.fonteInformacao : null,
        link:     typeof body.linkFonte === "string" ? body.linkFonte : null,
      },
    }),
  ]);

  return NextResponse.json({
    sucesso:      true,
    completude,
    missaoAtual,
    camposAlterados,
    statusNovo:   completude >= 80 ? "AGUARDANDO_VALIDACAO" : dossieAtual.status,
  });
}
