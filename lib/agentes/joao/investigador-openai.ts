// ARQUIVO: lib/agentes/joao/investigador-openai.ts
// REGRA: nunca remover. Apenas acrescentar.
// Investigador do João usando GPT-4o (OpenAI) com web search.
// Interface idêntica ao investigador-claude.ts para uso combinado.

import type { DossieParaInvestigacao, ResultadoInvestigacao } from "./investigador";

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPromptSistema(): string {
  return `Você é João, agente de inteligência comercial da Villa Empreendimentos — maior empresa do Brasil em locação de bombas de concreto e betoneiras.

Sua tarefa: investigar um dossiê comercial específico e cumprir a missão descrita.

INSTRUÇÕES DE BUSCA:
- Use buscas SEMPRE direcionadas ao nome da empresa/projeto, nunca genéricas.
- Exemplos corretos: "[Empresa] construtora EPC 2026", "[Projeto] valor obra licença"
- Faça no máximo 3 buscas, priorizando a missão principal.
- Se encontrar informação relevante além da missão, registre como notícia.

CAMPOS QUE PODE ATUALIZAR:
- construtora: nome da construtora responsável
- epc: empresa EPC contratada
- epcm: empresa EPCM contratada
- faseObra: fase atual (licenciamento, licitação, mobilização, execução, etc.)
- cronograma: datas/prazo de início e conclusão
- valorEstimado: valor numérico em reais (ex: 1500000000 para R$1,5bi)
- volumeConcreto: estimativa em m³ (somente o número, ex: 15000)
- concorrentes: concorrentes identificados na obra
- fonteInformacao: nome da fonte principal usada
- linkFonte: URL da fonte principal

RETORNE APENAS UM JSON NO FORMATO ABAIXO (sem markdown, sem explicação):
{
  "achou": true ou false,
  "campos": {
    "construtora": "Nome SA",
    "epc": "...",
    "faseObra": "...",
    "cronograma": "...",
    "valorEstimado": 1500000000,
    "volumeConcreto": 15000,
    "concorrentes": "...",
    "fonteInformacao": "...",
    "linkFonte": "..."
  },
  "decisor": {
    "nome": "...",
    "cargo": "...",
    "empresa": "...",
    "linkedin": "...",
    "telefone": "...",
    "email": "...",
    "fonte": "..."
  },
  "noticias": [
    {
      "titulo": "...",
      "conteudo": "...",
      "fonte": "...",
      "link": "..."
    }
  ],
  "resumoInvestigacao": "Breve descrição do que foi buscado e encontrado."
}

REGRAS CRÍTICAS:
- Só preencha campos com informação CONFIRMADA pela busca. Não invente.
- Omita campos que não encontrou (não coloque null nem vazio).
- Se missão não é sobre decisor: omita o campo "decisor" (ou coloque null).
- Se não encontrou nada: achou=false, campos={}, decisor=null, noticias=[].
- valorEstimado e volumeConcreto devem ser números (sem R$, sem "bi", sem "m³").`;
}

function buildPromptUsuario(dossie: DossieParaInvestigacao): string {
  const decisoresConhecidos = dossie.decisores
    ?.filter(d => d.nome)
    .map(d => `${d.nome}${d.cargo ? ` (${d.cargo})` : ""}`)
    .join(", ") || "Nenhum encontrado ainda";

  return `DOSSIÊ A INVESTIGAR:
Título: ${dossie.titulo}
Segmento: ${dossie.segmento ?? "não informado"}
Cidade/Estado: ${dossie.cidade ?? "?"}/${dossie.estado ?? "?"}
Cliente Final: ${dossie.clienteFinal ?? "desconhecido"}
Construtora conhecida: ${dossie.construtora ?? "desconhecida"}
EPC/EPCM conhecido: ${dossie.epc ?? dossie.epcm ?? "desconhecido"}
Fase atual: ${dossie.faseObra ?? "desconhecida"}
Decisores já mapeados: ${decisoresConhecidos}
Resumo: ${dossie.resumo ?? "sem resumo"}

MISSÃO ATUAL (o que precisa descobrir):
${dossie.missaoAtual ?? "Aprofundar monitoramento geral."}

Pesquise agora para cumprir essa missão. Retorne o JSON conforme instruído.`;
}

// ─── tentarParsearJSON ────────────────────────────────────────────────────────

function tentarParsearJSON(texto: string): Record<string, unknown> | null {
  // Remove markdown fences
  let limpo = texto.trim();
  const mdMatch = limpo.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) limpo = mdMatch[1].trim();

  const jsonMatch = limpo.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try { return JSON.parse(jsonMatch[0]) as Record<string, unknown>; } catch { /* continua */ }

  // Tenta truncamento — busca último } válido
  let pos = jsonMatch[0].lastIndexOf("}");
  while (pos > 0) {
    try { return JSON.parse(jsonMatch[0].slice(0, pos + 1)) as Record<string, unknown>; } catch { /* continua */ }
    pos = jsonMatch[0].lastIndexOf("}", pos - 1);
  }
  return null;
}

// ─── investigarDossieOpenAI ───────────────────────────────────────────────────

export async function investigarDossieOpenAI(
  dossie: DossieParaInvestigacao,
): Promise<ResultadoInvestigacao> {
  const resultado: ResultadoInvestigacao = {
    dossieId: dossie.id,
    achou: false,
    campos: {},
    decisor: null,
    noticias: [],
    resumoInvestigacao: "Investigação GPT-4o não concluída.",
  };

  try {
    if (!process.env.OPENAI_API_KEY) {
      resultado.resumoInvestigacao = "OPENAI_API_KEY não configurada.";
      resultado.erro = "OPENAI_API_KEY ausente";
      return resultado;
    }

    // Importação dinâmica para não quebrar build se pacote não instalado
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000); // 55s timeout

    try {
      // Responses API com web search
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client as any).responses.create(
        {
          model: "gpt-4o",
          tools: [{ type: "web_search_preview" }],
          instructions: buildPromptSistema(),
          input: buildPromptUsuario(dossie),
        },
        { signal: controller.signal },
      );

      clearTimeout(timeout);

      // Extrai texto da resposta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textoFinal: string = (response as any).output_text ?? "";

      if (!textoFinal.trim()) {
        resultado.resumoInvestigacao = "GPT-4o não retornou texto.";
        return resultado;
      }

      const parsed = tentarParsearJSON(textoFinal);
      if (!parsed) {
        resultado.resumoInvestigacao = "GPT-4o retornou JSON inválido.";
        resultado.erro = `JSON inválido: ${textoFinal.slice(0, 200)}`;
        return resultado;
      }

      resultado.achou              = parsed.achou === true;
      resultado.campos             = (parsed.campos as Record<string, unknown>) ?? {};
      resultado.decisor            = (parsed.decisor as ResultadoInvestigacao["decisor"]) ?? null;
      resultado.noticias           = Array.isArray(parsed.noticias)
        ? (parsed.noticias as ResultadoInvestigacao["noticias"])
        : [];
      resultado.resumoInvestigacao = typeof parsed.resumoInvestigacao === "string"
        ? parsed.resumoInvestigacao
        : "GPT-4o concluiu investigação.";

    } catch (innerErr) {
      clearTimeout(timeout);
      throw innerErr;
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[investigador-openai] Erro ao investigar dossiê ${dossie.id}:`, msg);
    resultado.erro = msg;
    resultado.resumoInvestigacao = `GPT-4o — Erro: ${msg}`;
  }

  return resultado;
}
