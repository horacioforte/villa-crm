// ARQUIVO: app/api/crm-ia/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint do CRM IA — assistente inteligente do Villa CRM.
// Autenticado via NextAuth session (usuário logado no CRM).

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { CRM_IA_SYSTEM_PROMPT } from "@/lib/agentes/crm-ia/prompt";
import {
  resumoGeral,
  buscarOportunidades,
  buscarPipeline,
  buscarEmpresas,
  buscarTarefas,
  buscarPropostas,
  buscarOrigemLeads,
  buscarEquipamentos,
  criarTarefa,
} from "@/lib/agentes/crm-ia/dados";

// ─── Definição das ferramentas disponíveis para o CRM IA ─────────────────────

const ferramentas = [
  {
    name: "resumo_geral",
    description: "Retorna um resumo geral do CRM: total de empresas, oportunidades abertas, propostas, tarefas pendentes e conversas.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "buscar_oportunidades",
    description: "Busca oportunidades no CRM com filtros opcionais por status, canal de origem e tipo de serviço.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHA", "PERDIDA"],
          description: "Status da oportunidade",
        },
        canalOrigem: {
          type: "string",
          enum: ["INDICACAO", "CLIENTE_ATUAL", "GOOGLE", "LINKEDIN", "SITE", "VISITA_COMERCIAL", "OBRA_MAPEADA", "MARKETPLACE", "OLX", "EVENTO", "JOAO_OUTBOUND", "OUTROS"],
          description: "Canal de origem da oportunidade",
        },
        tipoServico: {
          type: "string",
          enum: ["BOMBA_LANCA", "BOMBA_ESTACIONARIA", "TELEBELT", "BETONEIRA", "CENTRAL_IN_LOCO", "CONCRETO", "SERVICO_ESPECIAL"],
          description: "Tipo de serviço",
        },
        limite: {
          type: "number",
          description: "Número máximo de resultados (padrão 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "buscar_pipeline",
    description: "Retorna a quantidade de oportunidades por status (pipeline/funil de vendas).",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "buscar_empresas",
    description: "Busca empresas cadastradas no CRM com filtros por estado e segmento.",
    input_schema: {
      type: "object",
      properties: {
        estado: { type: "string", description: "UF do estado, ex: SP, PE, RJ" },
        segmento: { type: "string", description: "Segmento da empresa" },
        limite: { type: "number", description: "Número máximo de resultados" },
      },
      required: [],
    },
  },
  {
    name: "buscar_tarefas",
    description: "Busca tarefas pendentes, em andamento ou atrasadas.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["PENDENTE", "EM_ANDAMENTO", "ATRASADA", "CONCLUIDA", "CANCELADA"],
          description: "Status das tarefas",
        },
        limite: { type: "number", description: "Número máximo de resultados" },
      },
      required: [],
    },
  },
  {
    name: "buscar_propostas",
    description: "Busca propostas comerciais com filtro opcional por status.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADA", "APROVADA", "ACEITA", "REJEITADA", "VENCIDA", "CANCELADA"],
          description: "Status da proposta",
        },
        limite: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "buscar_origem_leads",
    description: "Retorna a quantidade de oportunidades agrupadas por canal de origem dos leads.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "buscar_equipamentos",
    description: "Busca equipamentos da frota com filtros por status e tipo.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["DISPONIVEL", "LOCADO", "MANUTENCAO", "VENDIDO", "INATIVO"],
        },
        tipo: {
          type: "string",
          enum: ["BOMBA_CONCRETO", "BETONEIRA", "OUTRO"],
        },
      },
      required: [],
    },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma nova tarefa no CRM. Use apenas quando o usuário confirmar explicitamente.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título da tarefa" },
        descricao: { type: "string", description: "Descrição detalhada" },
        tipo: {
          type: "string",
          enum: ["LIGACAO", "WHATSAPP", "EMAIL", "VISITA", "REUNIAO", "REUNIAO_ONLINE", "PROPOSTA", "TAREFA_INTERNA", "OUTRO"],
          description: "Tipo de atividade",
        },
        prioridade: {
          type: "string",
          enum: ["BAIXA", "MEDIA", "ALTA", "URGENTE"],
        },
        dataVencimento: {
          type: "string",
          description: "Data de vencimento no formato ISO 8601 (ex: 2026-07-10T09:00:00)",
        },
        empresaId: { type: "string", description: "ID da empresa no CRM" },
        oportunidadeId: { type: "string", description: "ID da oportunidade" },
        pessoaId: { type: "string", description: "ID do contato/pessoa" },
      },
      required: ["titulo", "tipo"],
    },
  },
];

// ─── Executor de ferramentas ──────────────────────────────────────────────────

async function executarFerramenta(nome: string, input: Record<string, any>): Promise<any> {
  switch (nome) {
    case "resumo_geral":
      return await resumoGeral();
    case "buscar_oportunidades":
      return await buscarOportunidades(input);
    case "buscar_pipeline":
      return await buscarPipeline();
    case "buscar_empresas":
      return await buscarEmpresas(input);
    case "buscar_tarefas":
      return await buscarTarefas(input);
    case "buscar_propostas":
      return await buscarPropostas(input);
    case "buscar_origem_leads":
      return await buscarOrigemLeads();
    case "buscar_equipamentos":
      return await buscarEquipamentos(input);
    case "criar_tarefa":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await criarTarefa(input as any);
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` };
  }
}

// ─── POST — processar mensagem ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Autenticação via session (Auth.js v5)
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: { mensagem: string; historico?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { mensagem, historico = [] } = body;
  if (!mensagem?.trim()) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Monta histórico + mensagem atual
    const messages: any[] = [
      ...historico.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: mensagem },
    ];

    let resposta = "";
    let continuar = true;

    // Agentic loop — Claude pode chamar múltiplas ferramentas
    while (continuar) {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: CRM_IA_SYSTEM_PROMPT,
        tools: ferramentas as any,
        messages,
      });

      if (response.stop_reason === "tool_use") {
        // Processa todas as chamadas de ferramenta
        const toolUseBlocks = response.content.filter((b: any) => b.type === "tool_use");
        const toolResults: any[] = [];

        for (const block of toolUseBlocks as any[]) {
          const resultado = await executarFerramenta(block.name, block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(resultado),
          });
        }

        // Adiciona resposta do assistant e resultados ao histórico
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });
      } else {
        // Resposta final em texto
        const textBlock = response.content.find((b) => b.type === "text");
        resposta = textBlock && "text" in textBlock
          ? (textBlock as { text: string }).text
          : "Desculpe, não consegui processar sua solicitação.";
        continuar = false;
      }
    }

    return NextResponse.json({ resposta });
  } catch (error) {
    console.error("[CRM IA] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao processar mensagem.", detalhe: String(error) },
      { status: 500 },
    );
  }
}
