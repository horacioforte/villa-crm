// ARQUIVO: app/api/conversas/resumo-espera/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// ACRESCENTADO — contadores das bolinhas do menu "Conversas": quantas conversas ABERTAS
// estão aguardando resposta humana, separadas em urgentes (> 4h) e novas (<= 4h).
// Reaproveita calcularAguardandoRespostaDesde e getPrioridadeAguardando — mesma regra
// da etiqueta "Urgente" e do filtro "Urgente" em /conversas. Não escreve nada.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { calcularAguardandoRespostaDesde } from "@/lib/conversas/aguardando-resposta";
import { ehConversaUrgente } from "@/lib/conversas/prioridade";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const conversas = await prisma.conversa.findMany({
    where: { status: "ABERTA" },
    select: { id: true },
  });
  const ids = conversas.map((c) => c.id);
  if (ids.length === 0) return NextResponse.json({ urgentes: 0, novas: 0 });

  const [ultimasDoCliente, ultimasRespostasHumanas] = await Promise.all([
    prisma.mensagem.groupBy({
      by: ["conversaId"],
      where: { conversaId: { in: ids }, direcao: "ENTRADA" },
      _max: { createdAt: true },
    }),
    prisma.mensagem.groupBy({
      by: ["conversaId"],
      where: { conversaId: { in: ids }, direcao: "SAIDA", autor: "HUMANO" },
      _max: { createdAt: true },
    }),
  ]);

  const mapaCliente = new Map(ultimasDoCliente.map((r) => [r.conversaId, r._max.createdAt]));
  const mapaHumana = new Map(ultimasRespostasHumanas.map((r) => [r.conversaId, r._max.createdAt]));

  let urgentes = 0;
  let novas = 0;
  for (const id of ids) {
    const desde = calcularAguardandoRespostaDesde(mapaCliente.get(id) ?? null, mapaHumana.get(id) ?? null);
    if (!desde) continue;
    if (ehConversaUrgente(desde)) urgentes += 1;
    else novas += 1;
  }

  return NextResponse.json({ urgentes, novas });
}
