// ARQUIVO: lib/agentes/maria/crm.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ações no CRM disparadas pela Maria: envio de WhatsApp, registro de leads e interações.

import { prisma } from "@/lib/prisma";
import {
  CanalOrigem,
  InfluenciaDecisao,
  NivelRelacionamento,
  PrioridadeTarefa,
  StatusOportunidade,
  StatusTarefa,
  TemperaturaOportunidade,
  TipoAtividade,
  TipoContato,
  TipoOperacao,
  TipoPessoa,
} from "@/app/generated/prisma/client";
import {
  MariaResponse,
  cleanNullable,
  buildResumoOportunidade,
  getTipoServico,
  getTaskDueDate,
} from "./handler";

// ─── Envio de WhatsApp ────────────────────────────────────────────────────────

export async function enviarWhatsapp({
  telefone,
  texto,
  instanceName,
  instanceApiKey,
}: {
  telefone: string;
  texto: string;
  instanceName?: string;
  instanceApiKey?: string;
}) {
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = instanceApiKey ?? process.env.EVOLUTION_API_KEY;
  const instance = instanceName ?? process.env.EVOLUTION_INSTANCE;

  if (!apiUrl || !apiKey || !instance) {
    throw new Error("Variaveis da Evolution API nao configuradas.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: telefone,
        text: texto,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Erro Evolution ${response.status}: ${errorText}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Registro de interação parcial (lead em qualificação) ─────────────────────

export async function registrarInteracaoParcial({
  dados,
  nomeContato,
  telefone,
  texto,
}: {
  dados: MariaResponse;
  nomeContato: string;
  telefone: string;
  texto: string;
}) {
  const cidade = cleanNullable(dados.cidade);
  const resumo = buildResumoOportunidade(dados);

  await prisma.$transaction(async (tx) => {
    let pessoa = await tx.pessoa.findFirst({
      where: {
        OR: [{ whatsapp: telefone }, { telefone }],
      },
      include: {
        empresa: true,
      },
    });

    let empresa =
      pessoa?.empresa ??
      (await tx.empresa.findFirst({
        where: {
          OR: [
            { telefone },
            { razaoSocial: { equals: nomeContato, mode: "insensitive" } },
          ],
        },
      }));

    if (!empresa) {
      empresa = await tx.empresa.create({
        data: {
          razaoSocial: nomeContato,
          telefone,
          segmento: "Lead WhatsApp",
          cidade,
          observacoes: `Origem: WhatsApp\nLead ainda em qualificacao.`,
          ativa: true,
        },
      });
    }

    if (!pessoa) {
      pessoa = await tx.pessoa.create({
        data: {
          nome: nomeContato,
          telefone,
          whatsapp: telefone,
          tipo: TipoPessoa.CONTATO,
          influenciaDecisao: InfluenciaDecisao.INFLUENCIADOR,
          nivelRelacionamento: NivelRelacionamento.NEUTRO,
          empresaId: empresa.id,
          ativa: true,
        },
        include: {
          empresa: true,
        },
      });
    }

    await tx.historicoContato.create({
      data: {
        tipo: TipoContato.WHATSAPP,
        resumo: `WhatsApp em qualificacao de ${nomeContato} (${telefone})`,
        detalhes: [
          `Mensagem: ${texto}`,
          `Resposta Maria: ${dados.resposta}`,
          "--- Resumo da oportunidade (em qualificação) ---",
          ...resumo.resumo,
        ]
          .filter(Boolean)
          .join("\n"),
        empresaId: empresa.id,
        pessoaId: pessoa.id,
      },
    });
  });
}

// ─── Registro de lead qualificado ─────────────────────────────────────────────

export async function registrarLeadQualificado({
  dados,
  nomeContato,
  telefone,
  texto,
  classificacaoInterna,
}: {
  dados: MariaResponse;
  nomeContato: string;
  telefone: string;
  texto: string;
  classificacaoInterna?: {
    aderencia?: string | null;
    potencialEstrategico?: string | null;
    potencialMotivo?: string | null;
  };
}) {
  const tipoServico = getTipoServico(dados.tipoServico);
  const cidade = cleanNullable(dados.cidade);
  const resumo = buildResumoOportunidade(dados, classificacaoInterna);
  const temperatura = dados.temperatura as TemperaturaOportunidade;
  const temperaturaMotivo =
    cleanNullable(dados.temperaturaMotivo) ??
    (dados.urgente
      ? "Lead WhatsApp com urgencia informada."
      : "Lead WhatsApp qualificado pela Maria.");
  const dataVencimento = getTaskDueDate(dados.urgente);

  if (!tipoServico || !cidade) {
    return { oportunidadeId: null, criada: false };
  }

  return prisma.$transaction(async (tx) => {
    let pessoa = await tx.pessoa.findFirst({
      where: {
        OR: [{ whatsapp: telefone }, { telefone }],
      },
      include: {
        empresa: true,
      },
    });

    let empresa =
      pessoa?.empresa ??
      (await tx.empresa.findFirst({
        where: {
          OR: [
            { telefone },
            { razaoSocial: { equals: nomeContato, mode: "insensitive" } },
          ],
        },
      }));

    if (!empresa) {
      empresa = await tx.empresa.create({
        data: {
          razaoSocial: nomeContato,
          telefone,
          segmento: "Lead WhatsApp",
          cidade,
          observacoes: `Origem: WhatsApp\nMensagem inicial: ${texto}`,
          ativa: true,
        },
      });
    }

    if (!pessoa) {
      pessoa = await tx.pessoa.create({
        data: {
          nome: nomeContato,
          telefone,
          whatsapp: telefone,
          tipo: TipoPessoa.CONTATO,
          influenciaDecisao: InfluenciaDecisao.INFLUENCIADOR,
          nivelRelacionamento: NivelRelacionamento.NEUTRO,
          empresaId: empresa.id,
          ativa: true,
        },
        include: {
          empresa: true,
        },
      });
    }

    const oportunidadeAberta = await tx.oportunidade.findFirst({
      where: {
        pessoaId: pessoa.id,
        ativa: true,
        status: {
          notIn: [StatusOportunidade.GANHA, StatusOportunidade.PERDIDA],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const descricao = [
      `Lead recebido via WhatsApp.`,
      "--- Resumo da oportunidade ---",
      ...resumo.resumo,
      `Telefone: ${telefone}`,
      ...(resumo.interno.length ? ["--- Classificação interna (não exibir ao cliente) ---", ...resumo.interno] : []),
    ]
      .filter(Boolean)
      .join("\n");

    const oportunidade = oportunidadeAberta
      ? await tx.oportunidade.update({
          where: {
            id: oportunidadeAberta.id,
          },
          data: {
            tipoServico: oportunidadeAberta.tipoServico ?? tipoServico,
            temperatura,
            temperaturaMotivo,
          },
        })
      : await tx.oportunidade.create({
          data: {
            titulo: `WhatsApp - ${nomeContato}${cidade ? ` / ${cidade}` : ""}`,
            descricao,
            tipo: TipoOperacao.LOCACAO,
            tipoServico,
            canalOrigem: CanalOrigem.OUTROS,
            status: StatusOportunidade.NOVA,
            temperatura,
            temperaturaMotivo,
            empresaId: empresa.id,
            pessoaId: pessoa.id,
            ativa: true,
          },
        });

    await tx.historicoContato.create({
      data: {
        tipo: TipoContato.WHATSAPP,
        resumo: `WhatsApp de ${nomeContato} (${telefone})`,
        detalhes: [
          `Mensagem: ${texto}`,
          `Resposta Maria: ${dados.resposta}`,
          "--- Resumo da oportunidade ---",
          ...resumo.resumo,
          ...(resumo.interno.length ? ["--- Classificação interna (não exibir ao cliente) ---", ...resumo.interno] : []),
        ]
          .filter(Boolean)
          .join("\n"),
        oportunidadeId: oportunidade.id,
        empresaId: empresa.id,
        pessoaId: pessoa.id,
      },
    });

    const tarefaExistente = await tx.tarefa.findFirst({
      where: {
        oportunidadeId: oportunidade.id,
        tipo: TipoAtividade.WHATSAPP,
        status: {
          in: [StatusTarefa.PENDENTE, StatusTarefa.EM_ANDAMENTO],
        },
      },
      select: {
        id: true,
      },
    });

    if (!tarefaExistente) {
      await tx.tarefa.create({
        data: {
          titulo: `Retornar WhatsApp: ${nomeContato} (${telefone})`,
          descricao,
          tipo: TipoAtividade.WHATSAPP,
          prioridade: dados.urgente ? PrioridadeTarefa.URGENTE : PrioridadeTarefa.ALTA,
          status: StatusTarefa.PENDENTE,
          dataVencimento,
          horaVencimento: dataVencimento.toTimeString().slice(0, 5),
          oportunidadeId: oportunidade.id,
          empresaId: empresa.id,
          pessoaId: pessoa.id,
        },
      });
    }

    return {
      oportunidadeId: oportunidade.id,
      criada: !oportunidadeAberta,
    };
  });
}
