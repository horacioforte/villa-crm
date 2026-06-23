// ARQUIVO: lib/agentes/joao/crm.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ações no CRM do João (outbound).
// REGRA FUNDAMENTAL: João NUNCA cria oportunidade automaticamente.
// Disparo → Prospect + Interação. Oportunidade só nasce com sinal real de interesse
// e confirmação manual pelo comercial (POST /api/prospects/[id]/qualificar).

import { prisma } from "@/lib/prisma";

// ─── Envio de WhatsApp ────────────────────────────────────────────────────────

export async function enviarWhatsappJoao({ telefone, texto }: { telefone: string; texto: string }) {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.JOAO_EVOLUTION_API_KEY;
  const instance = "joao-villa";

  if (!apiUrl || !apiKey) throw new Error("JOAO_EVOLUTION_API_KEY não configurada.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: telefone, text: texto }),
    });
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Prospect management ─────────────────────────────────────────────────────

/**
 * Encontra um prospect existente pelo telefone ou cria um novo com status ABORDADO.
 * Nunca cria oportunidade — apenas o registro do prospect.
 */
export async function encontrarOuCriarProspect({
  telefone,
  nomeContato,
  campanhaId,
  origem,
}: {
  telefone: string;
  nomeContato?: string;
  campanhaId?: string;
  origem?: string;
}): Promise<string> {
  // Busca pelo telefone em prospects do João já existentes
  const existente = await prisma.prospect.findFirst({
    where: { telefone, agente: "joao-villa" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  if (existente) {
    // Atualiza para ABORDADO se ainda estava apenas PROSPECTADO
    if (existente.status === "PROSPECTADO") {
      await prisma.prospect.update({
        where: { id: existente.id },
        data: { status: "ABORDADO", updatedAt: new Date() },
      });
    }
    return existente.id;
  }

  // Tenta vincular à empresa/pessoa já existente no CRM
  const pessoa = await prisma.pessoa.findFirst({
    where: { OR: [{ whatsapp: telefone }, { telefone }] },
    select: { id: true, empresaId: true },
  });

  const novo = await prisma.prospect.create({
    data: {
      status: "ABORDADO",
      agente: "joao-villa",
      telefone,
      nomeContato,
      origem: origem ?? "manual",
      campanhaId: campanhaId ?? null,
      pessoaId: pessoa?.id ?? null,
      empresaId: pessoa?.empresaId ?? null,
    },
    select: { id: true },
  });

  return novo.id;
}

/**
 * Registra uma interação (mensagem enviada, resposta recebida, sinal de interesse etc.).
 * Atualiza o status do prospect conforme a interação.
 */
export async function registrarInteracaoJoao({
  prospectId,
  tipo,
  canal,
  conteudo,
  novoStatus,
}: {
  prospectId: string;
  tipo:
    | "WHATSAPP_ENVIADO"
    | "WHATSAPP_ENTREGUE"
    | "WHATSAPP_LIDO"
    | "WHATSAPP_RESPONDIDO"
    | "EMAIL_ENVIADO"
    | "EMAIL_ENTREGUE"
    | "EMAIL_ABERTO"
    | "EMAIL_CLICADO"
    | "EMAIL_RESPONDIDO"
    | "LIGACAO_REALIZADA"
    | "INTERESSE_REGISTRADO"
    | "QUALIFICADO_MANUAL"
    | "DESCARTADO";
  canal: "WHATSAPP" | "EMAIL" | "LIGACAO";
  conteudo?: string;
  novoStatus?:
    | "PROSPECTADO"
    | "ABORDADO"
    | "RESPONDEU"
    | "INTERESSADO"
    | "QUALIFICADO"
    | "OPORTUNIDADE_CRIADA"
    | "DESCARTADO";
}) {
  await prisma.prospectInteracao.create({
    data: {
      prospectId,
      tipo,
      canal,
      conteudo: conteudo ?? null,
      instancia: "joao-villa",
      criadoPorIA: true,
    },
  });

  if (novoStatus) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: novoStatus, updatedAt: new Date() },
    });
  }
}

/**
 * Processa a chegada de uma resposta do cliente para o João.
 * - Garante que existe um prospect para esse telefone
 * - Registra a interação WHATSAPP_RESPONDIDO
 * - Se houver sinal de interesse, muda para INTERESSADO (mas NÃO cria oportunidade)
 */
export async function processarRespostaJoao({
  telefone,
  nomeContato,
  textoCiente,
  textoJoao,
  interesse,
}: {
  telefone: string;
  nomeContato: string;
  textoCiente: string;
  textoJoao: string;
  interesse: boolean;
}) {
  // Garante que existe um prospect (pode ter recebido resposta sem cadastro prévio)
  const prospectId = await encontrarOuCriarProspect({ telefone, nomeContato });

  // Registra a mensagem recebida do cliente
  await registrarInteracaoJoao({
    prospectId,
    tipo: "WHATSAPP_RESPONDIDO",
    canal: "WHATSAPP",
    conteudo: `[Cliente] ${textoCiente}`,
    novoStatus: interesse ? "INTERESSADO" : "RESPONDEU",
  });

  // Registra a resposta do João
  await registrarInteracaoJoao({
    prospectId,
    tipo: "WHATSAPP_ENVIADO",
    canal: "WHATSAPP",
    conteudo: `[João] ${textoJoao}`,
  });

  // Se há interesse, registra também a interação de interesse
  if (interesse) {
    await registrarInteracaoJoao({
      prospectId,
      tipo: "INTERESSE_REGISTRADO",
      canal: "WHATSAPP",
      conteudo: "Sinal de interesse detectado pela IA",
    });
  }

  return { prospectId, interesse };
}
