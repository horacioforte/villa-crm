// ARQUIVO: lib/agentes/joao/crm.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ações no CRM do João (outbound).
// REGRA ATUALIZADA (23/06/2026): João cria oportunidade outbound automaticamente
// quando confidence_score >= 70. Oportunidade criada com origem "João", tipo "Outbound",
// status "Pré-qualificada por IA". Critério mais exigente que inbound (Maria cria na
// primeira intenção; João exige sinal real de negócio).
// REGRA ATUALIZADA (08/07/2026 — NOVA REGRA CENTRAL DE INTELIGÊNCIA):
// João não cria mais Oportunidade diretamente em nenhum fluxo.
// Tudo vai para a Central de Inteligência como DossieComercial (origem: JOAO_OUTBOUND).
// processarRespostaJoao agora chama criarDossieOutbound() em vez de criarOportunidadeOutbound().
// criarOportunidadeOutbound() mantida como legado (regra: nunca remover).

import { prisma } from "@/lib/prisma";
import { recalcularDossie } from "@/lib/inteligencia/completude";

// ─── Envio de WhatsApp (Meta Cloud API) ──────────────────────────────────────

export async function enviarWhatsappJoao({ telefone, texto }: { telefone: string; texto: string }) {
  const phoneNumberId = process.env.META_JOAO_PHONE_NUMBER_ID;
  const accessToken = process.env.META_JOAO_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error("META_JOAO_PHONE_NUMBER_ID ou META_JOAO_ACCESS_TOKEN não configurados.");
  }

  // Garante formato internacional sem '+' (ex: 5581999990000)
  const numero = telefone.replace(/\D/g, "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: numero,
          type: "text",
          text: { body: texto },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[joao/crm] Meta Cloud API sendText falhou", {
        status: response.status,
        body: errorText,
        telefone: numero,
      });
      throw new Error(`Erro Meta API ${response.status}: ${errorText || response.statusText}`);
    }
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
 * NOVA REGRA (08/07/2026) — Central de Inteligência.
 * Cria um DossieComercial (origem: JOAO_OUTBOUND) para um prospect qualificado.
 * Substitui criarOportunidadeOutbound() no fluxo ativo do João.
 * Chamada automaticamente quando confidence_score >= 70 em processarRespostaJoao().
 */
export async function criarDossieOutbound({
  prospectId,
  telefone,
  nomeContato,
  gatilho,
  confidenceScore,
  resumoConversa,
}: {
  prospectId: string;
  telefone: string;
  nomeContato: string;
  gatilho: string;
  confidenceScore: number;
  resumoConversa?: string;
}): Promise<string | null> {
  try {
    // Tenta vincular à pessoa e empresa já existentes no CRM pelo telefone
    const pessoa = await prisma.pessoa.findFirst({
      where: { OR: [{ whatsapp: telefone }, { telefone }] },
      select: { id: true, empresaId: true, nome: true, cargo: true, empresa: { select: { razaoSocial: true, segmento: true, cidade: true, estado: true } } },
    });

    const titulo = `[João Outbound] ${nomeContato} — ${gatilho}`;

    // Verifica duplicata
    const jaExiste = await prisma.dossieComercial.findFirst({
      where: { titulo: { equals: titulo, mode: "insensitive" } },
      select: { id: true },
    });
    if (jaExiste) {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { status: "QUALIFICADO", updatedAt: new Date() },
      });
      return jaExiste.id;
    }

    const resumo = resumoConversa
      ?? `Prospect ${nomeContato} qualificado pelo João via prospecção ativa. Gatilho: ${gatilho}. Score de confiança: ${confidenceScore}/100. Telefone: ${telefone}.`;

    const dadosParaCalculo = {
      titulo,
      resumo,
      segmento:     pessoa?.empresa?.segmento ?? null,
      cidade:       pessoa?.empresa?.cidade   ?? null,
      estado:       pessoa?.empresa?.estado   ?? null,
      clienteFinal: pessoa?.empresa?.razaoSocial ?? null,
      fonteInformacao: "João Outbound (WhatsApp)",
    };

    const { completude, missaoAtual } = recalcularDossie(dadosParaCalculo, pessoa ? [{ nome: pessoa.nome, telefone, email: null, linkedin: null }] : []);

    const dossie = await prisma.dossieComercial.create({
      data: {
        titulo,
        resumo,
        origem:          "JOAO_OUTBOUND",
        tipo:            "LEAD",
        segmento:        pessoa?.empresa?.segmento ?? null,
        cidade:          pessoa?.empresa?.cidade   ?? null,
        estado:          pessoa?.empresa?.estado   ?? null,
        clienteFinal:    pessoa?.empresa?.razaoSocial ?? null,
        fonteInformacao: "João Outbound (WhatsApp)",
        score:           confidenceScore,
        prioridade:      confidenceScore >= 85 ? "URGENTE" : confidenceScore >= 70 ? "ALTA" : "MEDIA",
        completude,
        missaoAtual,
        criadoPorAgente: "joao-outbound",
        ultimaAtividade: new Date(),
        empresaId:       pessoa?.empresaId ?? null,
        totalDecisores:  pessoa ? 1 : 0,
      },
      select: { id: true },
    });

    // Log de criação
    await prisma.atualizacaoDossie.create({
      data: {
        dossieId: dossie.id,
        tipo:     "CRIACAO",
        titulo:   "Dossiê criado pelo João Outbound",
        conteudo: `Prospect qualificado via WhatsApp.\nGatilho: ${gatilho}\nScore: ${confidenceScore}/100\nTelefone: ${telefone}`,
        agente:   "joao-outbound",
        fonte:    "João Outbound (WhatsApp)",
      },
    });

    // Cria decisor inicial se tiver pessoa vinculada
    if (pessoa) {
      await prisma.decisorDossie.create({
        data: {
          dossieId:  dossie.id,
          nome:      pessoa.nome,
          cargo:     pessoa.cargo ?? null,
          telefone,
          confianca: confidenceScore,
          fonte:     "João Outbound (WhatsApp)",
        },
      });
    }

    // Atualiza prospect: qualificado, vinculado ao dossiê
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { status: "QUALIFICADO", updatedAt: new Date() },
    });

    await prisma.prospectInteracao.create({
      data: {
        prospectId,
        tipo:       "INTERESSE_REGISTRADO",
        canal:      "WHATSAPP",
        conteudo:   `[João] Dossiê criado na Central de Inteligência. Gatilho: ${gatilho} | Score: ${confidenceScore}/100 | Dossiê: ${dossie.id}`,
        instancia:  "joao-villa",
        criadoPorIA: true,
      },
    });

    return dossie.id;
  } catch (err) {
    console.error("[joao/crm] Erro ao criar dossiê outbound:", err);
    return null;
  }
}

/**
 * @deprecated Mantida como legado (regra: nunca remover).
 * João não cria mais Oportunidade diretamente — use criarDossieOutbound().
 * Substituída em 08/07/2026 pela nova regra da Central de Inteligência.
 */

/**
 * Salva as mensagens da conversa na tabela Conversa/Mensagem
 * para que o contexto do João funcione corretamente entre turnos.
 * ACRESCENTADO: histórico de conversa para João via Cloud API Meta.
 */
export async function salvarMensagensJoao({
  telefone,
  nomeContato,
  textoCliente,
  textoJoao,
}: {
  telefone: string;
  nomeContato: string;
  textoCliente: string;
  textoJoao: string;
}) {
  try {
    // Encontra ou cria a conversa para esse telefone
    let conversa = await prisma.conversa.findFirst({
      where: { telefone, instanceName: "joao-villa" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (!conversa) {
      conversa = await prisma.conversa.create({
        data: {
          instanceName: "joao-villa",
          telefone,
          nomeContato,
        },
        select: { id: true },
      });
    } else {
      // Atualiza timestamp e nome se mudou
      await prisma.conversa.update({
        where: { id: conversa.id },
        data: { updatedAt: new Date(), nomeContato },
      });
    }

    // Salva mensagem do cliente (ENTRADA) e resposta do João (SAIDA)
    await prisma.mensagem.createMany({
      data: [
        {
          conversaId: conversa.id,
          conteudo: textoCliente,
          direcao: "ENTRADA",
          autor: "HUMANO",
        },
        {
          conversaId: conversa.id,
          conteudo: textoJoao,
          direcao: "SAIDA",
          autor: "IA",
        },
      ],
    });
  } catch (err) {
    console.error("[joao/crm] Erro ao salvar mensagens na conversa:", err);
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
  salvarMensagens = true,
}: {
  telefone: string;
  nomeContato: string;
  textoCiente: string;
  textoJoao: string;
  interesse: boolean;
  confidenceScore?: number;
  gatilho?: string;
  /**
   * ACRESCENTADO (Fase 2 — fluxo V2): quando false, pula salvarMensagensJoao().
   * Usado pelo webhook V2, que já persiste a mensagem de entrada e saída via
   * lib/whatsapp/meta-client.ts com canalWhatsappId/externalMessageId corretos —
   * chamar salvarMensagensJoao() também duplicaria o histórico. O fluxo V1 (padrão,
   * sem passar este parâmetro) continua salvando exatamente como antes.
   */
  salvarMensagens?: boolean;
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

  // NOVA REGRA (08/07/2026): se há sinal forte (score >= 70), cria dossiê na Central de Inteligência
  let oportunidadeId: string | null = null; // mantido por compatibilidade de interface
  if (confidenceScore >= 70) {
    oportunidadeId = await criarDossieOutbound({
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

  // Salva na tabela Conversa/Mensagem para o contexto funcionar (fluxo V1).
  // Fluxo V2 já persiste isso via lib/whatsapp/meta-client.ts — ver salvarMensagens acima.
  if (salvarMensagens) {
    await salvarMensagensJoao({ telefone, nomeContato, textoCliente: textoCiente, textoJoao });
  }

  return { prospectId, interesse, confidenceScore, oportunidadeId };
}
