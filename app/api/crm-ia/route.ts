// ARQUIVO: app/api/crm-ia/route.ts
// REGRA: nunca remover. Apenas acrescentar.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { CRM_IA_SYSTEM_PROMPT } from "@/lib/agentes/crm-ia/prompt";
import { resumoGeral, buscarOportunidades, buscarPipeline, buscarEmpresas, buscarTarefas, buscarPropostas, buscarOrigemLeads, buscarEquipamentos, criarTarefa, buscarBriefingDiario } from "@/lib/agentes/crm-ia/dados";

const ferramentas = [
  { name: "resumo_geral", description: "Resumo geral do CRM: empresas, oportunidades, propostas, tarefas.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "buscar_oportunidades", description: "Busca oportunidades com filtros por status, canal e tipo de serviço.", input_schema: { type: "object", properties: { status: { type: "string", enum: ["NOVA","PRE_QUALIFICADA","EM_ATENDIMENTO","PROPOSTA_ENVIADA","NEGOCIACAO","GANHA","PERDIDA"] }, canalOrigem: { type: "string" }, tipoServico: { type: "string" }, limite: { type: "number" } }, required: [] } },
  { name: "buscar_pipeline", description: "Quantidade de oportunidades por status (pipeline/funil).", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "buscar_empresas", description: "Busca empresas por estado e segmento.", input_schema: { type: "object", properties: { estado: { type: "string" }, segmento: { type: "string" }, limite: { type: "number" } }, required: [] } },
  { name: "buscar_tarefas", description: "Busca tarefas pendentes, em andamento ou atrasadas.", input_schema: { type: "object", properties: { status: { type: "string", enum: ["PENDENTE","EM_ANDAMENTO","ATRASADA","CONCLUIDA","CANCELADA"] }, limite: { type: "number" } }, required: [] } },
  { name: "buscar_propostas", description: "Busca propostas com filtro por status.", input_schema: { type: "object", properties: { status: { type: "string", enum: ["RASCUNHO","AGUARDANDO_APROVACAO","ENVIADA","APROVADA","ACEITA","REJEITADA","VENCIDA","CANCELADA"] }, limite: { type: "number" } }, required: [] } },
  { name: "buscar_origem_leads", description: "Oportunidades agrupadas por canal de origem.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "buscar_equipamentos", description: "Equipamentos da frota com filtros por status e tipo.", input_schema: { type: "object", properties: { status: { type: "string", enum: ["DISPONIVEL","LOCADO","MANUTENCAO","VENDIDO","INATIVO"] }, tipo: { type: "string", enum: ["BOMBA_CONCRETO","BETONEIRA","OUTRO"] } }, required: [] } },
  { name: "buscar_briefing_diario", description: "Dados para o briefing diário: tarefas atrasadas, propostas sem retorno, oportunidades paradas.", input_schema: { type: "object", properties: {}, required: [] } },
  { name: "criar_tarefa", description: "Cria uma tarefa no CRM. Confirme com o usuário antes.", input_schema: { type: "object", properties: { titulo: { type: "string" }, descricao: { type: "string" }, tipo: { type: "string", enum: ["LIGACAO","WHATSAPP","EMAIL","VISITA","REUNIAO","REUNIAO_ONLINE","PROPOSTA","TAREFA_INTERNA","OUTRO"] }, prioridade: { type: "string", enum: ["BAIXA","MEDIA","ALTA","URGENTE"] }, dataVencimento: { type: "string" }, empresaId: { type: "string" }, oportunidadeId: { type: "string" }, pessoaId: { type: "string" } }, required: ["titulo","tipo"] } },
];

async function executarFerramenta(nome: string, input: Record<string, any>): Promise<any> {
  switch (nome) {
    case "resumo_geral": return await resumoGeral();
    case "buscar_oportunidades": return await buscarOportunidades(input);
    case "buscar_pipeline": return await buscarPipeline();
    case "buscar_empresas": return await buscarEmpresas(input);
    case "buscar_tarefas": return await buscarTarefas(input);
    case "buscar_propostas": return await buscarPropostas(input);
    case "buscar_origem_leads": return await buscarOrigemLeads();
    case "buscar_equipamentos": return await buscarEquipamentos(input);
    case "buscar_briefing_diario": return await buscarBriefingDiario();
    case "criar_tarefa": return await criarTarefa(input);
    default: return { erro: "Ferramenta desconhecida: " + nome };
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: { mensagem: string; historico?: Array<{ role: string; content: string }>; modo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Payload inválido." }, { status: 400 }); }

  const { mensagem, historico = [], modo } = body;
  if (!mensagem?.trim()) return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });

  const nomeUsuario = (session.user as any)?.name?.split(" ")[0] ?? "usuário";
  const systemPrompt = modo === "briefing"
    ? CRM_IA_SYSTEM_PROMPT + "\n\nMODO BRIEFING ATIVO: Faça agora o briefing diário completo para " + nomeUsuario + ". Use buscar_briefing_diario e buscar_tarefas para obter os dados antes de responder."
    : CRM_IA_SYSTEM_PROMPT;

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: any[] = [...historico.map(h => ({ role: h.role, content: h.content })), { role: "user", content: mensagem }];
    let resposta = "";
    let continuar = true;

    while (continuar) {
      const response = await client.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 1024, system: systemPrompt, tools: ferramentas as any, messages });
      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter((b: any) => b.type === "tool_use");
        const toolResults: any[] = [];
        for (const block of toolUseBlocks as any[]) {
          const resultado = await executarFerramenta(block.name, block.input);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(resultado) });
        }
        messages.push({ role: "assistant", content: response.content });
        messages.push({ role: "user", content: toolResults });
      } else {
        const textBlock = response.content.find((b: any) => b.type === "text");
        resposta = textBlock?.text ?? "Desculpe, não consegui processar.";
        continuar = false;
      }
    }
    return NextResponse.json({ resposta });
  } catch (error) {
    console.error("[CRM IA] Erro:", error);
    return NextResponse.json({ error: "Erro interno.", detalhe: String(error) }, { status: 500 });
  }
}
