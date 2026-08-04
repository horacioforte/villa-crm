// ARQUIVO: scripts/diagnostico-mensagens-travadas.ts
// Fase 2 — Etapa 3. Localiza mensagens travadas ou com erro de processamento usando o
// estado persistente real (Mensagem.processamentoStatus), não mais uma heurística.
//
// "Travada" cobre dois casos, os dois sinais objetivos de interrupção:
//   - processamentoStatus=PROCESSANDO há mais que PROCESSAMENTO_TRAVADO_MINUTOS: o
//     processo que adquiriu a mensagem foi interrompido depois de adquirir.
//   - processamentoStatus=PENDENTE há mais que PROCESSAMENTO_TRAVADO_MINUTOS: o
//     processo foi interrompido ENTRE inserir a mensagem e conseguir adquiri-la
//     (janela pequena no código, mas não impossível em serverless).
// "Com erro" = processamentoStatus=ERRO_PROCESSAMENTO — falha capturada e registrada.
// Mensagens com processamentoTentativas >= limite são destacadas como exigindo revisão
// humana antes de qualquer nova tentativa (reprocessar-mensagem.ts recusa essas).
//
// Uso: npx tsx scripts/diagnostico-mensagens-travadas.ts

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { PROCESSAMENTO_MAX_TENTATIVAS, PROCESSAMENTO_TRAVADO_MINUTOS } from "../lib/whatsapp/processamento-mensagem";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const limite = new Date(Date.now() - PROCESSAMENTO_TRAVADO_MINUTOS * 60_000);

  const travadas = await prisma.mensagem.findMany({
    where: {
      OR: [
        { processamentoStatus: "PROCESSANDO", processamentoAtualizadoEm: { lt: limite } },
        { processamentoStatus: "PENDENTE", createdAt: { lt: limite } },
      ],
    },
    select: {
      id: true,
      conversaId: true,
      conteudo: true,
      processamentoStatus: true,
      processamentoTentativas: true,
      processamentoAtualizadoEm: true,
      createdAt: true,
      conversa: { select: { telefone: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const comErro = await prisma.mensagem.findMany({
    where: { processamentoStatus: "ERRO_PROCESSAMENTO" },
    select: {
      id: true,
      conversaId: true,
      conteudo: true,
      processamentoStatus: true,
      processamentoTentativas: true,
      processamentoErroCodigo: true,
      processamentoErro: true,
      processamentoAtualizadoEm: true,
      createdAt: true,
      conversa: { select: { telefone: true } },
    },
    orderBy: { processamentoAtualizadoEm: "asc" },
  });

  const formatar = (m: (typeof travadas)[number] | (typeof comErro)[number]) => ({
    mensagemId: m.id,
    conversaId: m.conversaId,
    telefone: m.conversa.telefone,
    status: m.processamentoStatus,
    tentativas: m.processamentoTentativas,
    // PENDENTE nunca teve processamentoAtualizadoEm setado — usa createdAt nesse caso.
    desdeQuando: m.processamentoAtualizadoEm ?? m.createdAt,
    trechoConteudo: m.conteudo.slice(0, 60),
    exigeRevisaoHumana: m.processamentoTentativas >= PROCESSAMENTO_MAX_TENTATIVAS,
    ...("processamentoErroCodigo" in m ? { errorCode: m.processamentoErroCodigo, errorMessage: m.processamentoErro } : {}),
  });

  const resultado = {
    parametros: { limiteMinutos: PROCESSAMENTO_TRAVADO_MINUTOS, maxTentativas: PROCESSAMENTO_MAX_TENTATIVAS },
    totalTravadas: travadas.length,
    totalComErro: comErro.length,
    travadas: travadas.map(formatar),
    comErro: comErro.map(formatar),
  };

  console.log(JSON.stringify(resultado, null, 2));

  if (travadas.length || comErro.length) {
    console.log(
      "\nPara reprocessar uma candidata elegível: npx tsx scripts/reprocessar-mensagem.ts <mensagemId> --apply",
    );
  }
}

main().finally(() => prisma.$disconnect());
