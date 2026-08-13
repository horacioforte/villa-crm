// ARQUIVO: app/api/conversas/route.ts
// REGRA: nunca remover. Apenas acrescentar.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { calcularAguardandoRespostaDesde } from "@/lib/conversas/aguardando-resposta";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // ABERTA | PENDENTE | CONCLUIDA
  const instance = searchParams.get("instance"); // maria-villa | joao-villa | ...
  const busca = searchParams.get("busca");
  const responsavelId = searchParams.get("responsavelId"); // UUID do usuário atendente
  const semResponsavel = searchParams.get("semResponsavel") === "1"; // conversas sem atendente
  const empresaId = searchParams.get("empresaId");
  const pessoaId = searchParams.get("pessoaId");
  const oportunidadeId = searchParams.get("oportunidadeId");

  const conversas = await prisma.conversa.findMany({
    where: {
      ...(status ? { status: status as "ABERTA" | "PENDENTE" | "CONCLUIDA" | "SPAM" } : {}),
      ...(instance ? { instanceName: instance } : {}),
      ...(responsavelId ? { atendidoPorId: responsavelId } : {}),
      ...(semResponsavel ? { atendidoPorId: null } : {}),
      ...(empresaId ? { empresaId } : {}),
      ...(pessoaId ? { pessoaId } : {}),
      ...(oportunidadeId ? { oportunidadeId } : {}),
      ...(busca
        ? {
            OR: [
              { nomeContato: { contains: busca, mode: "insensitive" } },
              { telefone: { contains: busca } },
            ],
          }
        : {}),
    },
    orderBy: [
      { ultimaMensagemEm: "desc" },
      { createdAt: "desc" },
    ],
    take: 100,
    include: {
      mensagens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          conteudo: true,
          direcao: true,
          createdAt: true,
        },
      },
      atendidoPor: { select: { nome: true } },
      pessoa: { select: { nome: true } },
      empresa: { select: { razaoSocial: true, nomeFantasia: true } },
      canalWhatsapp: { select: { nome: true, displayPhoneNumber: true } },
    },
  });

  // Ciclo de Atendimento — "aguardando resposta" nunca é persistido (ver auditoria em
  // lib/conversas/aguardando-resposta.ts). Calculado aqui com duas agregações Prisma
  // tipadas (groupBy + _max), não SQL raw: para cada conversa da página, precisamos da
  // última mensagem ENTRADA e da última SAIDA/HUMANO — Prisma não permite duas
  // sub-seleções da mesma relação com filtros diferentes num único include, mas
  // groupBy cobre exatamente esse caso sem sair do client tipado.
  const conversaIds = conversas.map((c) => c.id);

  const [ultimasDoCliente, ultimasRespostasHumanas] = conversaIds.length
    ? await Promise.all([
        prisma.mensagem.groupBy({
          by: ["conversaId"],
          where: { conversaId: { in: conversaIds }, direcao: "ENTRADA" },
          _max: { createdAt: true },
        }),
        prisma.mensagem.groupBy({
          by: ["conversaId"],
          where: { conversaId: { in: conversaIds }, direcao: "SAIDA", autor: "HUMANO" },
          _max: { createdAt: true },
        }),
      ])
    : [[], []];

  const mapaUltimaCliente = new Map(ultimasDoCliente.map((r) => [r.conversaId, r._max.createdAt]));
  const mapaUltimaHumana = new Map(ultimasRespostasHumanas.map((r) => [r.conversaId, r._max.createdAt]));

  const conversasComAguardando = conversas.map((c) => ({
    ...c,
    aguardandoRespostaDesde: calcularAguardandoRespostaDesde(
      mapaUltimaCliente.get(c.id) ?? null,
      mapaUltimaHumana.get(c.id) ?? null,
    ),
  }));

  return NextResponse.json(conversasComAguardando);
}
