import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requirePermission("oportunidades", "update", request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await context.params;

  const oportunidade = await prisma.oportunidade.findFirst({
    where: { id, ativa: true },
    include: {
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      obra: { select: { nome: true, dataInicio: true, dataTermino: true } },
      historicos: {
        orderBy: { dataContato: "desc" },
        take: 10,
        select: {
          tipo: true,
          resumo: true,
          proximoContato: true,
          dataContato: true,
        },
      },
      propostas: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { status: true, valorTotal: true, createdAt: true },
      },
    },
  });

  if (!oportunidade) {
    return NextResponse.json({ message: "Oportunidade não encontrada." }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "ANTHROPIC_API_KEY não configurada." }, { status: 503 });
  }

  // Calcular dias sem contato
  const ultimoHistorico = oportunidade.historicos[0];
  const diasSemContato = ultimoHistorico
    ? Math.floor((Date.now() - new Date(ultimoHistorico.dataContato).getTime()) / 86400000)
    : null;

  const proximoContato = oportunidade.historicos.find((h) => h.proximoContato);

  const prompt = `Você é um analista de CRM especializado em locação e venda de equipamentos de construção civil.

Classifique a temperatura desta oportunidade de negócio como QUENTE, MEDIA ou FRIA com base no contexto abaixo.

## Oportunidade
- Título: ${oportunidade.titulo}
- Tipo: ${oportunidade.tipo}
- Status: ${oportunidade.status}
- Valor: ${oportunidade.valor ? `R$ ${oportunidade.valor}` : "Não informado"}
- Probabilidade: ${oportunidade.probabilidade ?? "Não informada"}%
- Previsão de fechamento: ${oportunidade.previsaoFechamento ? new Date(oportunidade.previsaoFechamento).toLocaleDateString("pt-BR") : "Não informada"}
- Empresa: ${oportunidade.empresa.nomeFantasia ?? oportunidade.empresa.razaoSocial}
- Obra: ${oportunidade.obra?.nome ?? "Não vinculada"}${oportunidade.obra?.dataTermino ? ` (prazo: ${new Date(oportunidade.obra.dataTermino).toLocaleDateString("pt-BR")})` : ""}

## Atividade
- Dias sem contato: ${diasSemContato ?? "Desconhecido"}
- Próximo contato agendado: ${proximoContato?.proximoContato ? new Date(proximoContato.proximoContato).toLocaleDateString("pt-BR") : "Não agendado"}

## Histórico recente (${oportunidade.historicos.length} registros)
${oportunidade.historicos.length === 0 ? "Sem histórico de contatos." : oportunidade.historicos.slice(0, 5).map((h) => `- [${h.tipo}] ${h.resumo.slice(0, 100)}`).join("\n")}

## Propostas (${oportunidade.propostas.length} registros)
${oportunidade.propostas.length === 0 ? "Sem propostas." : oportunidade.propostas.map((p) => `- ${p.status}${p.valorTotal ? ` R$ ${p.valorTotal}` : ""}`).join("\n")}

## Critérios de classificação
- QUENTE: Alta probabilidade, contato recente (< 7 dias), próximo fechamento, proposta aprovada/aceita
- MEDIA: Andamento normal, contato nos últimos 14 dias, negociação em curso
- FRIA: Sem contato há muito tempo (> 14 dias), sem proposta, status parado, obra atrasada

Responda EXATAMENTE neste formato (sem mais nada):
TEMPERATURA: QUENTE|MEDIA|FRIA
MOTIVO: [explicação em uma frase curta em português]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.error("Anthropic API error:", err);
      return NextResponse.json({ message: "Erro ao chamar API de IA." }, { status: 502 });
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? "";

    const temperaturaMatch = text.match(/TEMPERATURA:\s*(QUENTE|MEDIA|FRIA)/i);
    const motivoMatch = text.match(/MOTIVO:\s*(.+)/i);

    if (!temperaturaMatch) {
      return NextResponse.json({ message: "Resposta inválida da IA." }, { status: 502 });
    }

    const temperatura = temperaturaMatch[1].toUpperCase() as "QUENTE" | "MEDIA" | "FRIA";
    const motivo = motivoMatch?.[1]?.trim() ?? null;

    const updated = await prisma.oportunidade.update({
      where: { id },
      // @ts-expect-error — campo adicionado via migration; remover após prisma generate
      data: { temperatura, temperaturaMotivo: motivo },
      select: { id: true },
    });

    return NextResponse.json({ id: updated.id, temperatura, temperaturaMotivo: motivo });
  } catch (error) {
    console.error("Temperatura error:", error);
    return NextResponse.json({ message: "Erro interno ao classificar oportunidade." }, { status: 500 });
  }
}
