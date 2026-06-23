// ARQUIVO: lib/agentes/joao/crm.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ações no CRM do João (outbound).
// REGRA ATUALIZADA (23/06/2026): João cria oportunidade outbound automaticamente
// quando confidence_score >= 70. Oportunidade criada com origem "João", tipo "Outbound",
// status "Pré-qualificada por IA". Critério mais exigente que inbound (Maria cria na
// primeira intenção; João exige sinal real de negócio).

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
 * Cria uma oportunidade outbound para um prospect do João.
 * Chamada automaticamente quando confidence_score >= 70.
 * - Se o prospect já tem empresa vinculada no CRM: cria oportunidade com status PRE_QUALIFICADA
 * - Se não tem empresa: marca prospect como QUALIFICADO para revisão manual do comercial
 */
export async function criarOportunidadeOutbound({
  prospectId,
  telefone,
  nomeContato,
  gatilho,
  confidenceScore,
}: {
  prospectId: string;
  telefone: string;
  nomeContato: string;
  gatilho: string;
  confidenceScore: number;
}): Promise<string | null> {
  try {
    // Tenta vincular à pessoa e empresa já existentes no CRM pelo telefone
    const pessoa = await prisma.pessoa.findFirst({
      where: { OR: [{ whatsapp: telefone }, { telefone }] },
      select: { id: true, empresaId: true, nome: true },
    });

    const empresaId = pessoa?.empresaId ?? null;

    if (!empresaId) {
      // Sem empresa no CRM: só avança status para QUALIFICADO, comercial cria manualmente
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: "QUALIFICADO", updatedAt: new Date() },
      });
      await prisma.prospectInteracao.create({
        data: {
          prospectId,
          tipo: "QUALIFICADO_MANUAL",
          canal: "WHATSAPP",
          conteudo: `[João] Score ${confidenceScore} — gatilho: ${gatilho}. Prospect qualificado, aguardando comercial criar oportunidade (empresa não encontrada no CRM).`,
          instancia: "joao-villa",
          criadoPorIA: true,
        },
      });
      return null;
    }

    // Com empresa: cria oportunidade com status PRE_QUALIFICADA e canalOrigem JOAO_OUTBOUND
    const oportunidade = await prisma.oportunidade.create({
      data: {
        titulo: `[João] ${nomeContato} — ${gatilho}`,
        status: "PRE_QUALIFICADA",
        canalOrigem: "JOAO_OUTBOUND",
        descricao: `Oportunidade gerada automaticamente pelo João via prospecção ativa.\nGatilho: ${gatilho}\nScore de confiança: ${confidenceScore}/100\nTelefone: ${telefone}`,
        pessoaId: pessoa?.id ?? null,
        empresaId,
      },
      select: { id: true },
    });

    // Vincula o prospect à oportunidade e atualiza status
    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        status: "OPORTUNIDADE_CRIADA",
        oportunidadeId: oportunidade.id,
        updatedAt: new Date(),
      },
    });

    // Registra interação
    await prisma.prospectInteracao.create({
      data: {
        prospectId,
        tipo: "INTERESSE_REGISTRADO",
        canal: "WHATSAPP",
        conteudo: `[João] Oportunidade outbound criada automaticamente. Gatilho: ${gatilho} | Score: ${confidenceScore}/100 | Oportunidade: ${oportunidade.id}`,
        instancia: "joao-villa",
        criadoPorIA: true,
      },
    });

    return oportunidade.id;
  } catch (err) {
    console.error("[joao/crm] Erro ao criar oportunidade outbound:", err);
    return null;
  }
}

/**
 * Processa a chegada de uma resposta do cliente para o João.
 * - Garante que existe um prospect para esse telefone
 * - Registra a interação WHATSAPP_RESPONDIDO
 * - Se confidence_score >= 70, cria oportunidade outbound automaticamente
 */
export async function processarRespostaJoao({
  telefone,
  nomeContato,
  textoCiente,
  textoJoao,
  interesse,
  confidenceScore = 0,
  gatilho = "nenhum",
}: {
  telefone: string;
  nomeContato: string;
  textoCiente: string;
  textoJoao: string;
  interesse: boolean;
  confidenceScore?: number;
  gatilho?: string;
}) {
  // Garante que existe um prospect (pode ter recebido resposta sem cadastro prévio)
  const prospectId = await encontrarOuCriarProspect({ telefone, nomeContato });

  // Define novo status baseado no confidence_score
  let novoStatus: "RESPONDEU" | "INTERESSADO" | "QUALIFICADO" | "OPORTUNIDADE_CRIADA" = "RESPONDEU";
  if (confidenceScore >= 70) novoStatus = "QUALIFICADO";
  else if (interesse) novoStatus = "INTERESSADO";

  // Registra a mensagem recebida do cliente
  await registrarInteracaoJoao({
    prospectId,
    tipo: "WHATSAPP_RESPONDIDO",
    canal: "WHATSAPP",
    conteudo: `[Cliente] ${textoCiente}`,
    novoStatus,
  });

  // Registra a resposta do João
  await registrarInteracaoJoao({
    prospectId,
    tipo: "WHATSAPP_ENVIADO",
    canal: "WHATSAPP",
    conteudo: `[João] ${textoJoao}`,
  });

  // Se há sinal forte (score >= 70), cria oportunidade outbound automaticamente
  let oportunidadeId: string | null = null;
  if (confidenceScore >= 70) {
    oportunidadeId = await criarOportunidadeOutbound({
      prospectId,
      telefone,
      nomeContato,
      gatilho,
      confidenceScore,
    });
  } else if (interesse) {
    // Score moderado: apenas registra interesse, comercial decide manualmente
    await registrarInteracaoJoao({
      prospectId,
      tipo: "INTERESSE_REGISTRADO",
      canal: "WHATSAPP",
      conteudo: `Sinal de interesse detectado pela IA (score: ${confidenceScore})`,
    });
  }

  return { prospectId, interesse, confidenceScore, oportunidadeId };
}
