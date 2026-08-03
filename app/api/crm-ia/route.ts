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
  gerarRelatorio,
  buscarUsuarioPorEmail,
  buscarPessoas,
  buscarAtividades,
  atualizarEtapaOportunidade,
  alterarResponsavel,
  agendarVisita,
  criarLembrete,
  buscarDossies,
  criarDossie,
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
    description: "Busca oportunidades no CRM. Aceita id direto de uma oportunidade específica, ou filtros por status, temperatura (QUENTE/MEDIA/FRIA), canal de origem e tipo de serviço. Use temperatura='QUENTE' quando o usuário perguntar por oportunidades quentes. Use id quando o contexto de navegação indicar um ID específico e o usuário usar pronomes como 'essa oportunidade', 'ela', 'isso'.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID direto de uma oportunidade específica. Use quando o contexto de página indicar um ID e o usuário se referir a 'essa oportunidade' ou usar pronomes.",
        },
        status: {
          type: "string",
          enum: ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHA", "PERDIDA"],
          description: "Status da oportunidade",
        },
        temperatura: {
          type: "string",
          enum: ["QUENTE", "MEDIA", "FRIA"],
          description: "Temperatura da oportunidade: QUENTE = alta prioridade, MEDIA = interesse claro, FRIA = baixa urgência",
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
    description: "Busca propostas comerciais com campos ricos: valor, validade, dias parada, contato, responsável. Use para follow-up de propostas ou análise de pipeline de propostas.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["RASCUNHO", "AGUARDANDO_APROVACAO", "ENVIADA", "APROVADA", "ACEITA", "REJEITADA", "VENCIDA", "CANCELADA"],
          description: "Status da proposta",
        },
        diasParadaMinima: {
          type: "number",
          description: "Retorna apenas propostas sem atualização há pelo menos N dias",
        },
        limite: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "buscar_pessoas",
    description: "Busca contatos/pessoas cadastradas no CRM com telefone, e-mail, cargo, empresa vinculada e último contato. Use quando o usuário perguntar sobre contatos, decisores, responsáveis de obra ou qualquer pessoa.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome parcial da pessoa" },
        empresaNome: { type: "string", description: "Nome parcial da empresa vinculada" },
        cargo: { type: "string", description: "Cargo ou função" },
        telefone: { type: "string", description: "Número de telefone ou WhatsApp" },
        limite: { type: "number", description: "Número máximo de resultados" },
      },
      required: [],
    },
  },
  {
    name: "buscar_atividades",
    description: "Histórico de atividades: ligações, WhatsApp, e-mails, visitas, reuniões e observações. Use para ver o histórico de relacionamento com um cliente ou oportunidade.",
    input_schema: {
      type: "object",
      properties: {
        empresaId: { type: "string", description: "ID da empresa no CRM" },
        oportunidadeId: { type: "string", description: "ID da oportunidade" },
        pessoaId: { type: "string", description: "ID do contato" },
        tipo: {
          type: "string",
          enum: ["LIGACAO", "WHATSAPP", "EMAIL", "VISITA", "REUNIAO", "REUNIAO_ONLINE", "PROPOSTA", "OUTRO"],
          description: "Filtrar por tipo de atividade",
        },
        diasAtras: { type: "number", description: "Buscar atividades dos últimos N dias (padrão: 30)" },
        limite: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "atualizar_etapa_oportunidade",
    description: "Avança ou recua o status de uma oportunidade no pipeline. Confirme com o usuário antes de usar.",
    input_schema: {
      type: "object",
      properties: {
        oportunidadeId: { type: "string", description: "ID da oportunidade no CRM" },
        novoStatus: {
          type: "string",
          enum: ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHA", "PERDIDA"],
          description: "Novo status da oportunidade",
        },
        motivo: { type: "string", description: "Motivo (obrigatório quando status = PERDIDA)" },
      },
      required: ["oportunidadeId", "novoStatus"],
    },
  },
  {
    name: "alterar_responsavel",
    description: "Transfere uma oportunidade para outro vendedor/responsável. Confirme com o usuário antes de usar.",
    input_schema: {
      type: "object",
      properties: {
        oportunidadeId: { type: "string", description: "ID da oportunidade" },
        responsavelId: { type: "string", description: "ID do novo responsável (usuário no CRM)" },
      },
      required: ["oportunidadeId", "responsavelId"],
    },
  },
  {
    name: "agendar_visita",
    description: "Agenda uma visita comercial criando uma tarefa do tipo VISITA com alta prioridade. Confirme data e empresa antes de usar.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título da visita" },
        descricao: { type: "string", description: "Detalhes da visita" },
        dataHora: { type: "string", description: "Data e hora no formato ISO 8601 (ex: 2026-07-10T14:00:00)" },
        empresaId: { type: "string", description: "ID da empresa a visitar" },
        oportunidadeId: { type: "string", description: "ID da oportunidade relacionada" },
        pessoaId: { type: "string", description: "ID do contato a visitar" },
      },
      required: ["titulo", "dataHora"],
    },
  },
  {
    name: "criar_lembrete",
    description: "Cria um lembrete para o usuário sobre qualquer assunto, com data e hora.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título do lembrete" },
        descricao: { type: "string", description: "Detalhes do lembrete" },
        dataHora: { type: "string", description: "Data e hora no formato ISO 8601" },
        empresaId: { type: "string", description: "ID da empresa relacionada (opcional)" },
        oportunidadeId: { type: "string", description: "ID da oportunidade relacionada (opcional)" },
      },
      required: ["titulo", "dataHora"],
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
    name: "gerar_relatorio",
    description: "Gera dados para relatório visual. Suporta PDF com gráfico, planilha Excel (.xlsx) e apresentação PowerPoint (.pptx). Use SEMPRE quando o usuário pedir gráfico, PDF, Excel, planilha, PowerPoint, apresentação ou exportação de dados.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: [
            "oportunidades_por_status",
            "oportunidades_por_valor",
            "oportunidades_quentes",
            "oportunidades_por_etapa",
            "pipeline",
            "origem_leads",
            "propostas_por_status",
            "equipamentos_por_status",
            "tarefas_pendentes",
            "propostas_paradas",
            "clientes_sem_contato",
            "resumo_executivo",
            "lista_contatos",
            "dossies_inteligencia",
          ],
          description: "Tipo de relatório. Use 'oportunidades_por_etapa' quando o usuário pedir lista de oportunidades de uma etapa específica do pipeline (ex: 'oportunidades com proposta enviada', 'lista de negociação', 'quem está em atendimento') — combine com filtro_status. Use 'oportunidades_quentes' para hot leads / prioridade de fechamento. Use 'dossies_inteligencia' para relatório do João Hunter IA. Use 'lista_contatos' para exportar contatos. Use 'resumo_executivo' para BI completo, 'propostas_paradas' para follow-up, 'clientes_sem_contato' para reengajamento.",
        },
        filtro_status: {
          type: "string",
          enum: ["NOVA", "PRE_QUALIFICADA", "EM_ATENDIMENTO", "PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHA", "PERDIDA"],
          description: "Filtra por etapa do pipeline — use junto com tipo 'oportunidades_por_etapa'. Ex: PROPOSTA_ENVIADA para listar todas as oportunidades com proposta enviada.",
        },
        titulo: {
          type: "string",
          description: "Título customizado do relatório (opcional)",
        },
        tipo_saida: {
          type: "string",
          enum: ["pdf", "excel", "powerpoint"],
          description: "Formato de saída: 'pdf' para gráfico em PDF (padrão), 'excel' para planilha .xlsx, 'powerpoint' para apresentação .pptx",
        },
      },
      required: ["tipo"],
    },
  },
  {
    name: "buscar_dossies",
    description: "Consulta os dossiês da Central de Inteligência Comercial gerados pelo João Hunter IA. Use OBRIGATORIAMENTE quando o usuário perguntar: 'o que o João fez', 'relatório do João', 'o que João encontrou esta semana', 'obras que João mapeou', 'leads do João', 'radar do João', 'LinkedIn do João', ou qualquer variação sobre atividade do agente João Hunter IA. João Hunter IA NÃO é um vendedor humano — suas atividades são os dossiês da Central de Inteligência, não histórico de contatos comerciais. Também use para investigações, obras mapeadas, empresas sendo investigadas, dossiês prontos para assumir.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["INVESTIGANDO", "AGUARDANDO_VALIDACAO", "EM_ANALISE", "PEDIR_MAIS_PESQUISA", "PRONTO_PARA_ASSUMIR", "ASSUMIDO", "ARQUIVADO"],
          description: "Filtrar por status do dossiê",
        },
        prioridade: {
          type: "string",
          enum: ["ALTA", "MEDIA", "BAIXA"],
          description: "Filtrar por prioridade",
        },
        segmento: { type: "string", description: "Filtrar por segmento da obra/empresa (ex: Celulose, Saneamento, Energia)" },
        cidade: { type: "string", description: "Filtrar por cidade" },
        estado: { type: "string", description: "Filtrar por estado (UF, ex: SP, PE, RS)" },
        prontos: {
          type: "boolean",
          description: "Se true, retorna apenas os dossiês com status PRONTO_PARA_ASSUMIR",
        },
        fonteLinkedin: {
          type: "boolean",
          description: "Se true, retorna APENAS dossiês descobertos via LinkedIn pelo João Hunter IA (aba LinkedIn da Central de Inteligência). Use quando o usuário perguntar sobre descobertas do LinkedIn, leads do LinkedIn, o que João encontrou no LinkedIn, movimentações de pessoal via LinkedIn, ou pedir a aba/módulo LinkedIn.",
        },
        limite: { type: "number", description: "Número máximo de resultados (padrão 20)" },
      },
      required: [],
    },
  },
  {
    name: "criar_dossie",
    description: "Cria um novo dossiê na Central de Inteligência para o João Hunter IA investigar. Use quando a equipe quiser solicitar investigação de uma obra, empresa ou lead específico. Confirme os dados com o usuário antes de criar.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Nome da obra, empresa ou lead. Ex: 'Refinaria RNEST — Petrobras Suape/PE'" },
        tipo: { type: "string", enum: ["OBRA", "EMPRESA", "MOVIMENTO_ESTRATEGICO", "LICENCIAMENTO", "LEAD"] },
        segmento: { type: "string", description: "Segmento. Ex: Petroquímica, Saneamento, Energia" },
        cidade: { type: "string" },
        estado: { type: "string", description: "UF. Ex: PE, SP, RS" },
        clienteFinal: { type: "string", description: "Contratante da obra" },
        resumo: { type: "string", description: "O que a equipe já sabe" },
        missaoInicial: { type: "string", description: "O que o João deve descobrir primeiro" },
        prioridade: { type: "string", enum: ["ALTA", "MEDIA", "BAIXA"] },
      },
      required: ["titulo"],
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

async function executarFerramenta(
  nome: string,
  input: Record<string, any>,
  ctx: { usuarioId?: string; papel?: string } = {}
): Promise<any> {
  // Filtragem por permissão: COMERCIAL só vê sua carteira
  const filtroCarteira = ctx.papel === "COMERCIAL" ? { responsavelId: ctx.usuarioId } : {};

  switch (nome) {
    case "resumo_geral":
      return await resumoGeral();
    case "buscar_oportunidades":
      return await buscarOportunidades({ ...filtroCarteira, ...input });
    case "buscar_pipeline":
      return await buscarPipeline();
    case "buscar_empresas":
      return await buscarEmpresas(input);
    case "buscar_tarefas":
      return await buscarTarefas({ ...filtroCarteira, ...input });
    case "buscar_propostas":
      return await buscarPropostas(input);
    case "buscar_pessoas":
      return await buscarPessoas(input);
    case "buscar_atividades":
      return await buscarAtividades(input);
    case "buscar_origem_leads":
      return await buscarOrigemLeads();
    case "buscar_equipamentos":
      return await buscarEquipamentos(input);
    case "gerar_relatorio":
      return await gerarRelatorio({
        tipo: input.tipo,
        titulo: input.titulo,
        tipoSaida: input.tipo_saida ?? input.tipoSaida,
        filtroStatus: input.filtro_status ?? input.filtroStatus,
      });
    case "criar_tarefa":
      return await criarTarefa({ ...input, responsavelId: input.responsavelId ?? ctx.usuarioId } as any);
    case "atualizar_etapa_oportunidade":
      return await atualizarEtapaOportunidade({ ...input, usuarioId: ctx.usuarioId } as any);
    case "alterar_responsavel":
      return await alterarResponsavel({ ...input, usuarioId: ctx.usuarioId } as any);
    case "agendar_visita":
      return await agendarVisita({ ...input, responsavelId: ctx.usuarioId } as any);
    case "criar_lembrete":
      return await criarLembrete(input as any);
    case "buscar_dossies":
      return await buscarDossies(input as any);
    case "criar_dossie":
      return await criarDossie({ ...input, usuarioId: ctx.usuarioId } as any);
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

  // Contexto do usuário para permissões
  const usuarioDB = session.user.email
    ? await buscarUsuarioPorEmail(session.user.email)
    : null;
  const ctx = {
    usuarioId: usuarioDB?.id,
    papel: usuarioDB?.papel ?? "COMERCIAL",
    nomeUsuario: usuarioDB?.nome ?? session.user.name ?? "Usuário",
  };

  let body: { mensagem: string; historico?: Array<{ role: string; content: string }>; paginaAtual?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { mensagem, historico = [], paginaAtual } = body;
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
    let relatorioData: any = null;

    // Agentic loop — Claude pode chamar múltiplas ferramentas
    while (continuar) {
      // Interpreta a página atual para fornecer contexto à IA
      let contextoDeNavegacao = "";
      if (paginaAtual) {
        const [pathname, qs] = paginaAtual.split("?");
        const params = new URLSearchParams(qs ?? "");
        const id = params.get("id");

        const mapa: Record<string, string> = {
          "/oportunidades": "Pipeline de oportunidades (kanban)",
          "/empresas": "Listagem de empresas",
          "/contatos": "Listagem de contatos/pessoas",
          "/tarefas": "Listagem de tarefas",
          "/propostas": "Listagem de propostas",
          "/inteligencia": "Central de Inteligência (dossiês do João Hunter IA)",
          "/saude-comercial": "Saúde Comercial (indicadores e métricas)",
          "/agenda": "Agenda de atividades",
          "/dashboard": "Dashboard principal",
        };

        const nomePagina = mapa[pathname] ?? pathname;
        contextoDeNavegacao = `\nPÁGINA ATUAL DO USUÁRIO: ${nomePagina}${id ? `\nID da entidade em foco: ${id} — se o usuário disser "essa oportunidade", "essa empresa", "esse contato" ou usar pronomes como "ela/ele/isso", refira-se a este ID sem pedir confirmação. Use a ferramenta adequada para buscar os dados deste ID.` : ""}`;
      }

      const systemPromptComContexto = `${CRM_IA_SYSTEM_PROMPT}

---
CONTEXTO DO USUÁRIO ATUAL:
Nome: ${ctx.nomeUsuario}
Papel: ${ctx.papel}
ID: ${ctx.usuarioId ?? "desconhecido"}
${ctx.papel === "COMERCIAL" ? "ATENÇÃO: Este usuário é COMERCIAL — mostre apenas dados da carteira dele." : ""}
${ctx.papel === "GERENTE" ? "Este usuário é GERENTE — pode ver todos os dados comerciais." : ""}
${ctx.papel === "ADMIN" ? "Este usuário é ADMIN — acesso total a todos os dados." : ""}${contextoDeNavegacao}
---`;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: systemPromptComContexto,
        tools: ferramentas as any,
        messages,
      });

      if (response.stop_reason === "tool_use") {
        // Processa todas as chamadas de ferramenta
        const toolUseBlocks = response.content.filter((b: any) => b.type === "tool_use");
        const toolResults: any[] = [];

        for (const block of toolUseBlocks as any[]) {
          const resultado = await executarFerramenta(block.name, block.input, ctx);
          // Captura dados de relatório para retornar ao frontend
          if (block.name === "gerar_relatorio") {
            relatorioData = resultado;
          }
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

    return NextResponse.json({
      resposta,
      ...(relatorioData ? { relatorio: relatorioData } : {}),
    });
  } catch (error) {
    console.error("[CRM IA] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao processar mensagem.", detalhe: String(error) },
      { status: 500 },
    );
  }
}
