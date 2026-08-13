// ARQUIVO: lib/whatsapp/agentes/joao.ts
// Fase 2 — núcleo do processador do agente João, desacoplado de qualquer rota HTTP.
//
// Extraído de lib/whatsapp/joao-webhook-v2.ts (Etapa 4 — roteador unificado) para que
// tanto o adaptador legado (/api/webhook/whatsapp/joao, via joao-webhook-v2.ts) quanto
// o roteador unificado (/api/webhook/whatsapp/meta, via meta-router-v2.ts) possam
// chamar exatamente a mesma lógica — idempotência, criação de conversa, estado de
// processamento, IA e CRM não são duplicados em lugar nenhum.
//
// Este módulo não sabe nada sobre HTTP, assinatura, ou qual rota o chamou — recebe só
// um CanalWhatsapp já resolvido/validado e um "value" (recorte do payload da Meta já
// correspondido a esse canal) e faz o processamento.

import { prisma } from "@/lib/prisma";
import {
  AutorMensagem,
  Prisma,
  ProcessamentoMensagemStatus,
  StatusMensagem,
  type CanalWhatsapp,
} from "@/app/generated/prisma/client";
import { enviarTextoMeta } from "../meta-client";
import { adquirirParaProcessamento, marcarErroProcessamento, marcarProcessada } from "../processamento-mensagem";
import { getContextoJoao } from "@/lib/agentes/joao/contexto";
import { analisarMensagemJoao } from "@/lib/agentes/joao/handler";
import { processarRespostaJoao } from "@/lib/agentes/joao/crm";
import { statusAposNovaMensagemCliente } from "@/lib/conversas/reabertura";

// ─── Tipos do payload Meta Cloud API (usados também pelo roteador unificado) ──

export type MetaMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "image" | "audio" | "document" | "sticker" | "reaction" | string;
  text?: { body: string };
};

export type MetaContact = { profile: { name: string }; wa_id: string };

export type MetaStatus = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
};

export type MetaValue = {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
  statuses?: MetaStatus[];
};

export type MetaWebhookPayload = {
  object: string;
  entry: Array<{ id: string; changes: Array<{ value: MetaValue; field: string }> }>;
};

const INSTANCE_NAME = "joao-villa";

// ─── API pública — chamada pelo adaptador legado e pelo roteador unificado ────

/**
 * Processa um único "value" do payload da Meta (já correspondido a `canal` pelo
 * chamador — este módulo não valida phone_number_id nem assinatura, isso é
 * responsabilidade de quem identificou o canal).
 */
export async function processarValorMetaJoao({ canal, value }: { canal: CanalWhatsapp; value: MetaValue }) {
  for (const msg of value.messages ?? []) {
    await processarMensagemRecebida({ canal, msg, contacts: value.contacts ?? [] }).catch((err) => {
      console.error("[agentes/joao] Erro ao processar mensagem recebida:", err);
    });
  }

  for (const status of value.statuses ?? []) {
    await processarStatusRecebido(status).catch((err) => {
      console.error("[agentes/joao] Erro ao processar status recebido:", err);
    });
  }
}

// ─── Conversa ──────────────────────────────────────────────────────────────────

async function encontrarOuCriarConversa({
  canal,
  telefone,
  nomeContato,
}: {
  canal: CanalWhatsapp;
  telefone: string;
  nomeContato: string;
}) {
  const existente = await prisma.conversa.findFirst({
    where: { telefone, instanceName: INSTANCE_NAME },
    orderBy: { updatedAt: "desc" },
  });

  if (existente) {
    if (existente.canalWhatsappId && existente.canalWhatsappId !== canal.id) {
      throw new Error(
        `Conversa ${existente.id} já está vinculada ao canal ${existente.canalWhatsappId}, divergente do canal ${canal.id} resolvido para este evento.`,
      );
    }
    if (!existente.canalWhatsappId) {
      return prisma.conversa.update({
        where: { id: existente.id },
        data: { canalWhatsappId: canal.id, nomeContato },
      });
    }
    return existente;
  }

  return prisma.conversa.create({
    data: { instanceName: INSTANCE_NAME, telefone, nomeContato, canalWhatsappId: canal.id },
  });
}

// ─── Mensagem recebida (inbound) ──────────────────────────────────────────────

async function processarMensagemRecebida({
  canal,
  msg,
  contacts,
}: {
  canal: CanalWhatsapp;
  msg: MetaMessage;
  contacts: MetaContact[];
}) {
  const externalMessageId = msg.id;
  if (!externalMessageId) {
    // Nunca inventamos um identificador — sem id da Meta, não há como garantir
    // idempotência, então a mensagem é descartada em vez de gravada sem controle.
    console.warn("[agentes/joao] Mensagem sem id da Meta — descartada (nenhum identificador é inventado).");
    return;
  }

  const jaProcessada = await prisma.mensagem.findFirst({
    where: { canalWhatsappId: canal.id, externalMessageId },
    select: { id: true },
  });
  if (jaProcessada) {
    console.info("[agentes/joao] Evento duplicado (mesmo externalMessageId já processado) — ignorado.", {
      externalMessageId,
    });
    return;
  }

  const telefone = msg.from;
  if (!telefone) return;

  const nomeContato = contacts.find((c) => c.wa_id === telefone)?.profile?.name?.trim() || "Cliente";
  const texto = msg.type === "text" ? msg.text?.body ?? "" : "";

  const conversa = await encontrarOuCriarConversa({ canal, telefone, nomeContato });

  let mensagemCriada: Awaited<ReturnType<typeof prisma.mensagem.create>>;
  try {
    mensagemCriada = await prisma.mensagem.create({
      data: {
        conversaId: conversa.id,
        conteudo: texto || `[${msg.type}]`,
        direcao: "ENTRADA",
        autor: AutorMensagem.CLIENTE,
        status: StatusMensagem.RECEBIDA,
        canalWhatsappId: canal.id,
        externalMessageId,
        messageType: msg.type,
        rawPayload: msg as unknown as Prisma.InputJsonValue,
        receivedAt: new Date(),
        // Mensagem de cliente em canal com IA nasce PENDENTE — nunca NAO_APLICAVEL
        // (esse é o default do schema, usado só por mensagens de saída ou sem IA).
        processamentoStatus: ProcessamentoMensagemStatus.PENDENTE,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Duas entregas concorrentes do mesmo evento: a checagem acima e este insert não
      // são atômicos entre si, então duas requisições podem passar pela checagem antes
      // de qualquer uma delas inserir. A constraint composta (canalWhatsappId,
      // externalMessageId) no banco garante que só uma linha é criada — a segunda
      // tentativa cai aqui e é tratada como sucesso idempotente, não como erro.
      console.info("[agentes/joao] Corrida concorrente detectada — mensagem já inserida por outra requisição.", {
        externalMessageId,
      });
      return;
    }
    throw err;
  }

  // Ciclo de Atendimento — reabertura automática: PENDENTE/CONCLUIDA voltam para
  // ABERTA ao chegar mensagem real do cliente; SPAM nunca reabre sozinho. Resposta
  // automática da IA (abaixo) nunca conta como atendimento humano.
  const novoStatus = statusAposNovaMensagemCliente(conversa.status);
  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date(), ...(novoStatus ? { status: novoStatus } : {}) },
  });

  // Aquisição atômica: transiciona PENDENTE→PROCESSANDO só se ninguém mais adquiriu
  // primeiro (na prática, sempre bem-sucedida aqui — a mensagem acabou de ser criada
  // e só este processo conhece o id — mas o mecanismo é o mesmo usado no reprocessamento
  // manual, onde a concorrência é real).
  let adquirida;
  try {
    adquirida = await adquirirParaProcessamento(mensagemCriada.id);
  } catch (err) {
    console.error("[agentes/joao] Falha ao adquirir mensagem para processamento:", err);
    return;
  }
  if (!adquirida) {
    console.warn("[agentes/joao] Mensagem não pôde ser adquirida para processamento (corrida ou já concluída).", {
      mensagemId: mensagemCriada.id,
    });
    return;
  }

  if (!texto) {
    // Só mensagens de texto acionam a IA (igual ao V1) — tipos não suportados são
    // considerados processamento concluído (decisão de não responder), não travados.
    await marcarProcessada(mensagemCriada.id);
    return;
  }

  try {
    const contexto = await getContextoJoao(telefone);
    const { resposta, interesse, confidenceScore, gatilho } = await analisarMensagemJoao({
      nomeContato,
      texto,
      contexto,
    });

    // "Envio aceito pela Meta" — enviarTextoMeta só retorna sem lançar quando a Meta
    // aceitou a mensagem (ver lib/whatsapp/meta-client.ts: marca ERRO e relança em falha).
    await enviarTextoMeta({ canalId: canal.id, conversaId: conversa.id, telefone, texto: resposta });

    // Atualizações essenciais do CRM (dossiê/prospect) — sem .catch() silencioso: uma
    // falha aqui impede PROCESSADA e vira ERRO_PROCESSAMENTO, porque a regra exige
    // IA + envio + CRM concluídos antes de marcar concluído.
    await processarRespostaJoao({
      telefone,
      nomeContato,
      textoCiente: texto,
      textoJoao: resposta,
      interesse,
      confidenceScore,
      gatilho,
      salvarMensagens: false, // já persistido acima via Mensagem/meta-client
    });

    await marcarProcessada(mensagemCriada.id);
  } catch (err) {
    await marcarErroProcessamento(mensagemCriada.id, err);
    throw err; // o chamador também loga — comportamento existente mantido
  }
}

// ─── Status recebido (delivered/read/failed de mensagens que ENVIAMOS) ────────

async function processarStatusRecebido(status: MetaStatus) {
  const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: status.id } });
  if (!mensagem) return; // Pode ser status de mensagem enviada fora deste fluxo — sem correspondência, ignora.

  if (status.status === "delivered") {
    await prisma.mensagem.update({
      where: { id: mensagem.id },
      data: { status: StatusMensagem.ENTREGUE, deliveredAt: new Date() },
    });
    return;
  }

  if (status.status === "read") {
    await prisma.mensagem.update({
      where: { id: mensagem.id },
      data: { status: StatusMensagem.LIDA, readAt: new Date() },
    });
    return;
  }

  if (status.status === "failed") {
    const erro = status.errors?.[0];
    await prisma.mensagem.update({
      where: { id: mensagem.id },
      data: {
        status: StatusMensagem.ERRO,
        errorCode: erro?.code !== undefined ? String(erro.code) : "FAILED",
        errorMessage: erro?.title ?? "Falha reportada pela Meta.",
      },
    });
  }

  // "sent" já é refletido no momento do envio (meta-client marca ENVIADA); outros
  // valores de status não mapeados são ignorados silenciosamente.
}
