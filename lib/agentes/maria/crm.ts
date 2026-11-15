// ARQUIVO: lib/agentes/maria/crm.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ações no CRM disparadas pela Maria: envio de WhatsApp, registro de leads e interações.
// ACRESCENTADO (15/11/2026 — Memória de Longo Prazo v1):
//   - buildMemoriaComercial(): gera bloco estruturado de memória comercial para HistoricoContato.detalhes.
//     Permite que a Maria retome negociações após 30/90/180 dias sem depender de texto livre.

import { prisma } from "@/lib/prisma";
import { encontrarEmpresaExistente } from "@/lib/empresas/encontrar-existente";
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

// ─── Envio de WhatsApp via Meta Cloud API ────────────────────────────────────

export async function enviarWhatsappMeta({
  telefone,
  texto,
}: {
  telefone: string;
  texto: string;
}) {
  // Remove caracteres não-ASCII (ex: quebra de linha invisível copiada junto com o token)
  const phoneNumberId = process.env.MARIA_META_PHONE_NUMBER_ID?.replace(/[^\x20-\x7E]/g, "").trim();
  const accessToken = process.env.MARIA_META_ACCESS_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();

  if (!phoneNumberId || !accessToken) {
    throw new Error("Variaveis da Meta API nao configuradas (MARIA_META_PHONE_NUMBER_ID, MARIA_META_ACCESS_TOKEN).");
  }

  // Normaliza o número: remove "+", garante formato internacional sem "+"
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
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Erro Meta API ${response.status}: ${errorText}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Memória comercial estruturada ───────────────────────────────────────────
// [ACRESCENTADO 15/11/2026 — Memória de Longo Prazo v1]
// Gera um bloco estruturado de memória comercial para o campo detalhes do HistoricoContato.
// Facilita retomada de negociações após semanas/meses — a Maria extrai os dados chave
// sem precisar interpretar texto livre.
// REGRA: nunca remover. Apenas acrescentar campos novos se necessário.

function buildMemoriaComercial({
  nomeContato,
  dados,
  texto,
}: {
  nomeContato: string;
  dados: MariaResponse;
  texto: string;
}): string {
  const linhas: (string | null)[] = [
    "=== MEMÓRIA COMERCIAL ===",
    `Empresa/Contato: ${nomeContato}`,
    `Equipamento: ${dados.tipoServico ?? "não informado"}`,
    `Localização: ${dados.cidade ?? "não informada"}`,
    `Volume: ${(dados as Record<string, unknown>).volume ?? "não informado"}`,
    `Prazo: ${(dados as Record<string, unknown>).prazo ?? "não informado"}`,
    `Temperatura: ${dados.temperatura ?? "não informada"}`,
    dados.temperaturaMotivo
      ? `Objeções/Observações: ${dados.temperaturaMotivo}`
      : null,
    "Próxima ação: Retornar WhatsApp",
    "=== TRANSCRIÇÃO ===",
    `Mensagem: ${texto}`,
    `Resposta Maria: ${dados.resposta}`,
  ];
  return linhas.filter((l): l is string => l !== null).join("\n");
}

// ─── Advisory lock por telefone (PostgreSQL) ──────────────────────────────────
// ACRESCENTADO (14/11/2026 — Race Condition v1):
// Serializa operações de banco para o mesmo telefone usando pg_advisory_xact_lock.
// - Escopo: transaction-level (liberado automaticamente ao fim da transação).
// - Funciona com connection pooling/Neon (não usa session-level locks).
// - Não requer migração — usa funcionalidade nativa do PostgreSQL.
// - Bloqueia até que a transação concorrente do mesmo telefone conclua.
// - Protege contra: oportunidades duplicadas e históricos duplicados por race condition.
// LIMITAÇÃO DOCUMENTADA: o advisory lock cobre as operações de banco (read+write dentro
// da transação). A chamada à IA e o envio do WhatsApp ocorrem fora da transação — em caso
// de race condition, dois processos podem chamar a IA simultaneamente e ambos enviarem
// respostas ao cliente. Para serialização completa do ciclo, ver PLANO DE MIGRAÇÃO em
// docs/race-condition-plano.md (requer aprovação de Horácio antes de executar).
async function acquirePhoneLock(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], telefone: string): Promise<void> {
  // hashtext(text) → int4; cast para bigint (pg_advisory_xact_lock aceita bigint)
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${telefone})::bigint)`;
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
    // [ACRESCENTADO 14/11/2026] Advisory lock: serializa operações de banco para este telefone.
    // Evita HistoricoContato duplicado em caso de mensagens simultâneas do mesmo número.
    await acquirePhoneLock(tx, telefone);
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
      const existente = await encontrarEmpresaExistente({ nome: nomeContato }, tx);
      if (existente) empresa = await tx.empresa.findUnique({ where: { id: existente.id } });
    }

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
        // [ATUALIZADO 15/11/2026] Bloco de memória comercial estruturada no topo
        // seguido do resumo da oportunidade — facilita retomada após meses
        detalhes: [
          buildMemoriaComercial({ nomeContato, dados, texto }),
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
    // [ACRESCENTADO 14/11/2026] Advisory lock: serializa operações de banco para este telefone.
    // Evita oportunidades duplicadas em caso de duas mensagens qualificadoras simultâneas.
    // O lock é liberado automaticamente ao fim desta transação.
    await acquirePhoneLock(tx, telefone);

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
      const existente = await encontrarEmpresaExistente({ nome: nomeContato }, tx);
      if (existente) empresa = await tx.empresa.findUnique({ where: { id: existente.id } });
    }

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
        // [ATUALIZADO 15/11/2026] Bloco de memória comercial estruturada no topo
        // seguido do resumo da oportunidade — facilita retomada após meses
        detalhes: [
          buildMemoriaComercial({ nomeContato, dados, texto }),
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
