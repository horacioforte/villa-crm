// ARQUIVO: lib/agentes/joao/investigador.ts
// REGRA: nunca remover. Apenas acrescentar.
// Loop de Investigação Contínua — João investiga dossiês ativos com base na missaoAtual.
// Usa Claude com web_search para buscar informações e retorna achados estruturados.

import Anthropic from "@anthropic-ai/sdk";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DossieParaInvestigacao {
  id: string;
  titulo: string;
  resumo?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  estado?: string | null;
  clienteFinal?: string | null;
  construtora?: string | null;
  epc?: string | null;
  epcm?: string | null;
  faseObra?: string | null;
  cronograma?: string | null;
  valorEstimado?: unknown;
  volumeConcreto?: unknown;
  concorrentes?: string | null;
  missaoAtual?: string | null;
  fonteInformacao?: string | null;
  decisores?: { nome: string | null; cargo?: string | null }[];
}

export interface ResultadoInvestigacao {
  dossieId: string;
  achou: boolean;
  campos: Record<string, unknown>;         // campos para PATCH no dossiê
  decisor: {                               // null se missão não é descobrir decisor
    nome: string;
    cargo?: string;
    empresa?: string;
    linkedin?: string;
    telefone?: string;
    email?: string;
    fonte?: string;
  } | null;
  noticias: {
    titulo: string;
    conteudo: string;
    fonte?: string;
    link?: string;
  }[];
  resumoInvestigacao: string;
  erro?: string;
}

// ─── Prompt do Investigador ───────────────────────────────────────────────────

function buildPromptSistema(): string {
  return `Você é João, agente de inteligência comercial da Villa Empreendimentos — maior empresa do Brasil em locação de bombas de concreto e betoneiras.

Sua tarefa: investigar um dossiê comercial específico e cumprir a missão descrita.

INSTRUÇÕES DE BUSCA:
- Use buscas SEMPRE direcionadas ao nome da empresa/projeto, nunca genéricas.
- Exemplos corretos: "[Empresa] construtora EPC 2026", "[Projeto] valor obra licença"
- Exemplos errados: "obras celulose Brasil", "construtoras grandes"
- Faça no máximo 3 buscas, priorizando a missão principal.
- Se encontrar informação relevante além da missão, registre como notícia.

CAMPOS QUE PODE ATUALIZAR:
- construtora: nome da construtora responsável
- epc: empresa EPC contratada
- epcm: empresa EPCM contratada
- faseObra: fase atual (licenciamento, licitação, mobilização, execução, etc.)
- cronograma: datas/prazo de início e conclusão
- valorEstimado: valor numérico em reais (ex: 1500000000 para R$1,5bi)
- volumeConcreto: estimativa (ex: "15.000 m³")
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
    "volumeConcreto": "...",
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
- valorEstimado deve ser número (sem R$, sem "bi", sem "mi").`;
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

// ─── investigarDossie ─────────────────────────────────────────────────────────

export async function investigarDossie(
  dossie: DossieParaInvestigacao,
): Promise<ResultadoInvestigacao> {
  const resultado: ResultadoInvestigacao = {
    dossieId: dossie.id,
    achou: false,
    campos: {},
    decisor: null,
    noticias: [],
    resumoInvestigacao: "Investigação não concluída.",
  };

  try {
    const Anthropic_ = (await import("@anthropic-ai/sdk")).default as typeof Anthropic;
    const client = new Anthropic_({ apiKey: process.env.ANTHROPIC_API_KEY });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000); // 50s timeout

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client as any).beta.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          betas: ["web-search-2025-03-05"],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 3,
            },
          ],
          system: buildPromptSistema(),
          messages: [
            {
              role: "user",
              content: buildPromptUsuario(dossie),
            },
          ],
        },
        { signal: controller.signal },
      );

      clearTimeout(timeout);

      // Extrai o último bloco de texto da resposta
      const blocos = Array.isArray(response.content) ? response.content : [];
      const textoFinal = blocos
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");

      if (!textoFinal.trim()) {
        resultado.resumoInvestigacao = "Claude não retornou texto na investigação.";
        return resultado;
      }

      // Parse do JSON — remove markdown fences se presentes
      let textoJson = textoFinal.trim();
      const mdMatch = textoJson.match(/```(?:json)?\s*([\s\S]*?)```/s);
      if (mdMatch) textoJson = mdMatch[1].trim();

      const jsonMatch = textoJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        resultado.resumoInvestigacao = "Resposta sem JSON válido.";
        return resultado;
      }

      // Tenta parsear; se falhar por truncamento, busca o último } válido
      const tentarParsear = (texto: string): Record<string, unknown> | null => {
        try { return JSON.parse(texto) as Record<string, unknown>; } catch { /* continua */ }
        let pos = texto.lastIndexOf("}");
        while (pos > 0) {
          try { return JSON.parse(texto.slice(0, pos + 1)) as Record<string, unknown>; } catch { /* continua */ }
          pos = texto.lastIndexOf("}", pos - 1);
        }
        return null;
      };

      const parsed = tentarParsear(jsonMatch[0]);
      if (!parsed) {
        resultado.resumoInvestigacao = "JSON inválido mesmo após tentativa de recuperação.";
        return resultado;
      }

      resultado.achou               = parsed.achou === true;
      resultado.campos              = parsed.campos  ?? {};
      resultado.decisor             = parsed.decisor ?? null;
      resultado.noticias            = Array.isArray(parsed.noticias) ? parsed.noticias : [];
      resultado.resumoInvestigacao  = parsed.resumoInvestigacao ?? "Investigação concluída.";

    } catch (innerErr) {
      clearTimeout(timeout);
      throw innerErr;
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[investigador] Erro ao investigar dossiê ${dossie.id}:`, msg);
    resultado.erro = msg;
    resultado.resumoInvestigacao = `Erro durante investigação: ${msg}`;
  }

  return resultado;
}
