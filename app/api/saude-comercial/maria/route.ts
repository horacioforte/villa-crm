import { NextResponse } from "next/server";

import {
  CanalOrigem,
  StatusOportunidade,
  TemperaturaOportunidade,
  TipoContato,
} from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function startOfDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffMinutes(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function getMariaChannel(oportunidade: {
  canalOrigem: CanalOrigem | null;
  historicos: Array<{ tipo: TipoContato }>;
}) {
  if (oportunidade.canalOrigem === CanalOrigem.SITE) {
    return "SITE";
  }

  if (oportunidade.historicos.some((historico) => historico.tipo === TipoContato.WHATSAPP)) {
    return "WHATSAPP";
  }

  return "EMAIL";
}

export async function GET(request: Request) {
  const authResult = await requirePermission("relatorios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const hoje = startOfDay();
  const semana = daysAgo(7);
  const mes = daysAgo(30);

  const oportunidades = await prisma.oportunidade.findMany({
    where: {
      ativa: true,
      OR: [
        { canalOrigem: { in: [CanalOrigem.SITE, CanalOrigem.OUTROS] } },
        { historicos: { some: { tipo: { in: [TipoContato.EMAIL, TipoContato.WHATSAPP] } } } },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      historicos: {
        where: {
          tipo: {
            in: [TipoContato.EMAIL, TipoContato.WHATSAPP, TipoContato.OUTRO],
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        select: {
          tipo: true,
          createdAt: true,
        },
      },
    },
  });

  const porCanal = {
    SITE: 0,
    EMAIL: 0,
    WHATSAPP: 0,
  };

  let quentes = 0;
  let medias = 0;
  let frias = 0;
  let oportunidadesGanhas = 0;
  let oportunidadesPerdidas = 0;
  let oportunidadesEmAndamento = 0;
  let valorPotencial = 0;
  const temposResposta: number[] = [];

  oportunidades.forEach((oportunidade) => {
    const canal = getMariaChannel(oportunidade);
    porCanal[canal] += 1;

    if (oportunidade.temperatura === TemperaturaOportunidade.QUENTE) quentes += 1;
    if (oportunidade.temperatura === TemperaturaOportunidade.MEDIA) medias += 1;
    if (oportunidade.temperatura === TemperaturaOportunidade.FRIA) frias += 1;

    if (oportunidade.status === StatusOportunidade.GANHA) {
      oportunidadesGanhas += 1;
    } else if (oportunidade.status === StatusOportunidade.PERDIDA) {
      oportunidadesPerdidas += 1;
    } else {
      oportunidadesEmAndamento += 1;
    }

    valorPotencial += Number(
      oportunidade.potencialOportunidade ?? oportunidade.valorContrato ?? 0,
    );

    const primeiroHistorico = oportunidade.historicos[0];
    if (primeiroHistorico) {
      temposResposta.push(diffMinutes(oportunidade.createdAt, primeiroHistorico.createdAt));
    }
  });

  const totalLeads = oportunidades.length;
  const tempoMedioResposta =
    temposResposta.length > 0
      ? Math.round(
          temposResposta.reduce((total, tempo) => total + tempo, 0) /
            temposResposta.length,
        )
      : 0;

  return NextResponse.json({
    totalLeads,
    leadsHoje: oportunidades.filter((oportunidade) => oportunidade.createdAt >= hoje).length,
    leadsSemana: oportunidades.filter((oportunidade) => oportunidade.createdAt >= semana)
      .length,
    leadsMes: oportunidades.filter((oportunidade) => oportunidade.createdAt >= mes).length,
    quentes,
    medias,
    frias,
    porCanal,
    oportunidadesGanhas,
    oportunidadesPerdidas,
    oportunidadesEmAndamento,
    taxaConversao: totalLeads > 0 ? Math.round((oportunidadesGanhas / totalLeads) * 100) : 0,
    valorPotencial,
    tempoMedioResposta,
    ultimasOportunidades: oportunidades.slice(0, 10).map((oportunidade) => ({
      id: oportunidade.id,
      titulo: oportunidade.titulo,
      temperatura: oportunidade.temperatura,
      canalOrigem: getMariaChannel(oportunidade),
      status: oportunidade.status,
      createdAt: oportunidade.createdAt.toISOString(),
    })),
  });
}
