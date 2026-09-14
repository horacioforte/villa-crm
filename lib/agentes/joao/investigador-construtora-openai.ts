// ARQUIVO: lib/agentes/joao/investigador-construtora-openai.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Investigador GPT-4o para a carteira CONSTRUTORA_BRASIL.
// Interface idêntica ao investigador-construtora.ts (Claude Haiku) para uso combinado.
// Inclui busca explícita no LinkedIn para identificação de decisores.

import type { DossieParaInvestigacao } from "./investigador";
import type { ResultadoInvestigacaoConstrutora, ObraConstrutora } from "./investigador-construtora";

function buildSistemaOpenAI(): string {
  return `Você é João, agente de inteligência comercial da Villa Empreendimentos.

Villa Empreendimentos: maior empresa do Brasil em locação de bombas de concreto e betoneiras. Equipamentos: bomba lança (28–58m), bomba estacionária, caminhão betoneira, Telebelt, central de concreto in loco.

Sua tarefa: investigar uma CONSTRUTORA específica e identificar obras reais em execução, contratadas, anunciadas ou prestes a iniciar que possam consumir equipamentos de bombeamento de concreto.

INSTRUÇÕES DE BUSCA:
- Buscas SEMPRE direcionadas ao nome da empresa. Nunca genéricas.
- Correto: "[Empresa] obra 2026", "[Empresa] licença IBAMA", "[Empresa] nova unidade"
- Máximo 3 buscas. Priorize a missão descrita.
- BUSCA OBRIGATÓRIA DE DECISORES: sempre faça uma busca no LinkedIn:
  site:linkedin.com "[Empresa]" ("Diretor de Obras" OR "Gerente de Obras" OR "Diretor de Engenharia" OR "Comprador" OR "Gerente de Suprimentos")
  Registre qualquer decisor encontrado com cargo, nome e URL do perfil LinkedIn.

PARA CADA OBRA:
- Exija fonte verificável (URL, nome do portal, publicação oficial)
- Exija evidência textual (trecho de texto que confirma o fato)
- Exija fase comprovada — não suponha
- Nunca invente obras, fases, contatos ou valores não confirmados

FASES ACEITAS:
licenciamento | mobilizacao | terraplenagem | fundacao | concretagem | estrutura | execucao | anunciada | planejada | concluida

CONFIANÇA:
- CONFIRMADA: fonte oficial
- FORTE: mídia especializada com link verificável
- PROVAVEL: múltiplas menções sem URL
- SINAL: menção única sem verificação

RETORNE APENAS UM JSON VÁLIDO (sem markdown):
{
  "achou": true,
  "camposDossie": {
    "faseObra": "fase mais avançada",
    "valorEstimado": 0,
    "cronograma": "se encontrado",
    "fonteInformacao": "nome da fonte",
    "linkFonte": "url"
  },
  "obras": [
    {
      "nome": "Nome da obra",
      "cidade": "Cidade",
      "estado": "UF",
      "tipo": "tipo",
      "clienteFinal": "se identificado",
      "valor": 0,
      "fase": "fase_aceita",
      "cronograma": "data ou prazo",
      "fonteNome": "nome da fonte",
      "url": "url",
      "dataInformacao": "2026-08-01",
      "confianca": "FORTE",
      "evidenciaTextual": "Trecho exato que prova o fato."
    }
  ],
  "decisor": {
    "nome": "Nome completo",
    "cargo": "Cargo",
    "empresa": "Empresa",
    "linkedin": "url do linkedin",
    "fonte": "origem"
  },
  "noticias": [
    { "titulo": "...", "conteudo": "...", "fonte": "...", "link": "..." }
  ],
  "proximaMissao": "Próxima investigação recomendada.",
  "resumoInvestigacao": "O que foi buscado e encontrado."
}

REGRAS:
- Omita campos não encontrados
- decisor=null se não encontrado
- achou=false, obras=[], camposDossie={}, decisor=null se nada encontrado
- valor e valorEstimado são números em reais
- evidenciaTextual é OBRIGATÓRIO para cada obra`;
}

function buildUsuarioOpenAI(dossie: DossieParaInvestigacao): string {
  const obrasConhecidas = dossie.faseObra
    ? `Última fase conhecida: ${dossie.faseObra}`
    : "Nenhuma obra registrada ainda.";
  const decisoresConhecidos =
    dossie.decisores
      ?.filter((d) => d.nome)
      .map((d) => `${d.nome}${d.cargo ? ` (${d.cargo})` : ""}`)
      .join(", ") || "Nenhum encontrado ainda";

  return `CONSTRUTORA A INVESTIGAR:
Nome: ${dossie.titulo}
Cidade/Estado base: ${dossie.cidade ?? "?"}/${dossie.estado ?? "?"}
Segmento: ${dossie.segmento ?? "Construtora"}
Resumo: ${dossie.resumo ?? "sem resumo"}
${obrasConhecidas}
Decisores já mapeados: ${decisoresConhecidos}

MISSÃO ATUAL:
${dossie.missaoAtual ?? "Identificar obras em execução ou anunciadas e principais decisores desta construtora. Buscar decisores no LinkedIn."}

Pesquise agora. Retorne apenas o JSON.`;
}

function tentarParsearJSON(texto: string): Record<string, unknown> | null {
  let limpo = texto.trim();
  const mdMatch = limpo.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) limpo = mdMatch[1].trim();
  const jsonMatch = limpo.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]) as Record<string, unknown>; } catch { /* continua */ }
  let pos = jsonMatch[0].lastIndexOf("}");
  while (pos > 0) {
    try { return JSON.parse(jsonMatch[0].slice(0, pos + 1)) as Record<string, unknown>; } catch { /* continua */ }
    pos = jsonMatch[0].lastIndexOf("}", pos - 1);
  }
  return null;
}

export async function investigarConstutoraOpenAI(
  dossie: DossieParaInvestigacao,
): Promise<ResultadoInvestigacaoConstrutora> {
  const resultado: ResultadoInvestigacaoConstrutora = {
    dossieId: dossie.id,
    achou: false,
    camposDossie: {},
    obras: [],
    decisor: null,
    noticias: [],
    proximaMissao: "",
    resumoInvestigacao: "Investigação GPT-4o não concluída.",
  };

  try {
    if (!process.env.OPENAI_API_KEY) {
      resultado.resumoInvestigacao = "OPENAI_API_KEY não configurada.";
      resultado.erro = "OPENAI_API_KEY ausente";
      return resultado;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client as any).responses.create(
        {
          model: "gpt-4o",
          tools: [{ type: "web_search_preview" }],
          instructions: buildSistemaOpenAI(),
          input: buildUsuarioOpenAI(dossie),
        },
        { signal: controller.signal },
      );
      clearTimeout(timeout);

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

      resultado.achou = parsed.achou === true;
      resultado.camposDossie =
        (parsed.camposDossie as ResultadoInvestigacaoConstrutora["camposDossie"]) ?? {};
      resultado.obras = Array.isArray(parsed.obras)
        ? (parsed.obras as ObraConstrutora[]).filter(
            (o: ObraConstrutora) => o?.nome?.trim() && o?.evidenciaTextual?.trim(),
          )
        : [];
      resultado.decisor =
        (parsed.decisor as ResultadoInvestigacaoConstrutora["decisor"]) ?? null;
      resultado.noticias = Array.isArray(parsed.noticias)
        ? (parsed.noticias as ResultadoInvestigacaoConstrutora["noticias"])
        : [];
      resultado.proximaMissao =
        typeof parsed.proximaMissao === "string" ? parsed.proximaMissao : "";
      resultado.resumoInvestigacao =
        typeof parsed.resumoInvestigacao === "string"
          ? parsed.resumoInvestigacao
          : "GPT-4o concluiu investigação.";

    } catch (innerErr) {
      clearTimeout(timeout);
      throw innerErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[investigador-construtora-openai] Erro ao investigar ${dossie.id}:`, msg);
    resultado.erro = msg;
    resultado.resumoInvestigacao = `GPT-4o — Erro: ${msg}`;
  }

  return resultado;
}
