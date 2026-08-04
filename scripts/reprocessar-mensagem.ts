// ARQUIVO: scripts/reprocessar-mensagem.ts
// Fase 2 — Etapa 3. Reprocessamento manual e seguro de uma mensagem CLIENTE/ENTRADA
// travada (PENDENTE ou PROCESSANDO há tempo demais) ou com ERRO_PROCESSAMENTO — ver
// scripts/diagnostico-mensagens-travadas.ts para encontrar candidatas.
//
// Reusa exatamente o mesmo pipeline do webhook V2 (getContextoJoao →
// analisarMensagemJoao → enviarTextoMeta → processarRespostaJoao), nunca inventa uma
// resposta diferente. A aquisição é por UPDATE condicional atômico
// (adquirirParaProcessamento), nunca leitura seguida de update separado — protege
// contra reprocessar uma mensagem que outra execução (webhook real, ou outro
// reprocessamento) esteja processando ao mesmo tempo. Mensagens que já esgotaram o
// limite de tentativas são recusadas — exigem revisão humana antes de qualquer nova
// tentativa (não há bypass automático aqui).
//
// Modo padrão: DRY RUN (só mostra a candidata, não adquire nem processa). --apply executa.
//
// Uso:
//   npx tsx scripts/reprocessar-mensagem.ts <mensagemId>            (dry run)
//   npx tsx scripts/reprocessar-mensagem.ts <mensagemId> --apply    (reprocessa de verdade)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ProcessamentoMensagemStatus } from "../app/generated/prisma/client";
import {
  adquirirParaProcessamento,
  marcarErroProcessamento,
  marcarProcessada,
  LimiteDeTentativasExcedidoError,
  PROCESSAMENTO_MAX_TENTATIVAS,
} from "../lib/whatsapp/processamento-mensagem";

const APLICAR = process.argv.includes("--apply");
const mensagemId = process.argv[2];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const STATUS_ELEGIVEIS_PARA_REPROCESSAR: ProcessamentoMensagemStatus[] = [
  ProcessamentoMensagemStatus.PENDENTE,
  ProcessamentoMensagemStatus.PROCESSANDO,
  ProcessamentoMensagemStatus.ERRO_PROCESSAMENTO,
];

async function main() {
  if (!mensagemId || mensagemId === "--apply") {
    console.error("Uso: npx tsx scripts/reprocessar-mensagem.ts <mensagemId> [--apply]");
    process.exitCode = 1;
    return;
  }

  const mensagem = await prisma.mensagem.findUnique({
    where: { id: mensagemId },
    include: { conversa: { include: { canalWhatsapp: true } } },
  });

  if (!mensagem) {
    console.error("Mensagem não encontrada.");
    process.exitCode = 1;
    return;
  }

  if (mensagem.autor !== "CLIENTE" || mensagem.direcao !== "ENTRADA") {
    console.error("Só é possível reprocessar mensagens de entrada do cliente (autor=CLIENTE, direcao=ENTRADA).");
    process.exitCode = 1;
    return;
  }

  const canal = mensagem.conversa.canalWhatsapp;
  if (!canal || canal.agenteIA !== "joao" || !canal.ativo) {
    console.log(JSON.stringify({
      elegivel: false,
      motivo: "Canal da conversa não é o João ativo — este script só reprocessa o fluxo do João.",
    }, null, 2));
    return;
  }

  console.log(JSON.stringify({
    modo: APLICAR ? "APLICAR" : "DRY_RUN",
    mensagemId: mensagem.id,
    statusAtual: mensagem.processamentoStatus,
    tentativasAteAgora: mensagem.processamentoTentativas,
    limiteMaximoTentativas: PROCESSAMENTO_MAX_TENTATIVAS,
    conversaId: mensagem.conversaId,
    telefone: mensagem.conversa.telefone,
    trechoConteudo: mensagem.conteudo.slice(0, 80),
  }, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nada foi adquirido nem enviado. Rode com --apply para reprocessar de verdade.");
    return;
  }

  const telefone = mensagem.conversa.telefone;
  if (!telefone) {
    console.error("Conversa sem telefone — não é possível reenviar.");
    process.exitCode = 1;
    return;
  }

  let adquirida;
  try {
    adquirida = await adquirirParaProcessamento(mensagem.id, { statusElegiveis: STATUS_ELEGIVEIS_PARA_REPROCESSAR });
  } catch (err) {
    if (err instanceof LimiteDeTentativasExcedidoError) {
      console.error(`RECUSADO — ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (!adquirida) {
    console.error(
      "RECUSADO — não foi possível adquirir a mensagem (outra execução já está processando, ou o status mudou entre a leitura acima e agora).",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Mensagem adquirida para reprocessamento (tentativa nº ${adquirida.processamentoTentativas}).`);

  const nomeContato = mensagem.conversa.nomeContato ?? "Cliente";
  const texto = mensagem.conteudo;

  try {
    const { getContextoJoao } = await import("../lib/agentes/joao/contexto");
    const { analisarMensagemJoao } = await import("../lib/agentes/joao/handler");
    const { enviarTextoMeta } = await import("../lib/whatsapp/meta-client");
    const { processarRespostaJoao } = await import("../lib/agentes/joao/crm");

    const contexto = await getContextoJoao(telefone);
    const { resposta, interesse, confidenceScore, gatilho } = await analisarMensagemJoao({ nomeContato, texto, contexto });

    await enviarTextoMeta({ canalId: canal.id, conversaId: mensagem.conversaId, telefone, texto: resposta });

    await processarRespostaJoao({
      telefone,
      nomeContato,
      textoCiente: texto,
      textoJoao: resposta,
      interesse,
      confidenceScore,
      gatilho,
      salvarMensagens: false,
    });

    await marcarProcessada(mensagem.id);
    console.log("Reprocessado com sucesso — processamentoStatus=PROCESSADA.");
  } catch (err) {
    await marcarErroProcessamento(mensagem.id, err);
    console.error("Reprocessamento falhou — processamentoStatus=ERRO_PROCESSAMENTO.", err);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
