// ARQUIVO: lib/agentes/joao/investigador-construtora.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Investigador específico para a carteira CONSTRUTORA_BRASIL.
// A CONSTRUTORA é a conta monitorada — não uma obra avulsa.
// O investigador descobre obras, fases e decisores vinculados a essa empresa.
//
// Diferença em relação ao investigador.ts (obra-cêntrico):
//   investigador.ts   → missão de obra específica (construtora, EPC, valor, volume)
//   este arquivo      → missão de empresa (descobrir obras que ela está executando)
//
// Scores são calculados deterministicamente fora do LLM, via joao-estrutura.ts.
// O LLM extrai e estrutura FATOS — nunca opina sobre potencialVilla ou prioridadeJoao.

import Anthropic from "@anthropic-ai/sdk";
import type { DossieParaInvestigacao } from "./investigador";

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Uma obra específica encontrada para a construtora investigada. */
export interface ObraConstrutora {
  nome: string;
  cidade?: string;
  estado?: string;
  tipo?: string; // "residencial" | "industrial" | "rodovia" | "porto" | "energia" | etc.
  clienteFinal?: string;
  valor?: number; // em reais, sem formatação
  fase: string;   // "licenciamento" | "mobilizacao" | "terraplenagem" | "fundacao" | "concretagem" | "estrutura" | "execucao" | "anunciada" | "planejada"
  cronograma?: string;
  fonteNome: string;
  url?: string;
  dataInformacao?: string; // ISO date: "2026-08-01"
  confianca: "CONFIRMADA" | "FORTE" | "PROVAVEL" | "SINAL";
  evidenciaTextual: string; // trecho exato que comprova o fato — obrigatório
}

/** Resultado da investigação de uma construtora. */
export interface ResultadoInvestigacaoConstrutora {
  dossieId: string;
  achou: boolean;
  /** Campos para PATCH no DossieComercial (fase mais relevante, valor, cronograma, fonte). */
  camposDossie: {
    faseObra?: string;
    valorEstimado?: number;
    cronograma?: string;
    fonteInformacao?: string;
    linkFonte?: string;
  };
  obras: ObraConstrutora[];
  decisor: {
    nome: string;
    cargo?: string;
    empresa?: string;
    linkedin?: string;
    telefone?: string;
    email?: string;
    fonte?: string;
  } | null;
  noticias: { titulo: string; conteudo: string; fonte?: string; link?: string }[];
  /** Próxima investigação recomendada — gravada em DossieComercial.missaoAtual e DossieCarteira.proximaAcao. */
  proximaMissao: string;
  resumoInvestigacao: string;
  erro?: string;
}

// ─── Mapeamento de fase → TipoEvidencia ──────────────────────────────────────

/**
 * Mapeia a fase retornada pelo LLM para o enum TipoEvidencia do schema.
 * Mantido aqui (não no cron) para facilitar testes unitários.
 */
export function faseParaTipoEvidencia(fase: string): string {
  const f = fase.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (/licenci/.test(f)) return "LICENCIAMENTO";
  if (/mobiliz/.test(f)) return "MOBILIZACAO";
  if (/terraplen/.test(f)) return "TERRAPLENAGEM";
  if (/fundac/.test(f)) return "FUNDACAO";
  if (/concretag/.test(f)) return "CONCRETAGEM";
  if (/estrutura/.test(f)) return "ESTRUTURA";
  if (/expansao|expans/.test(f)) return "EXPANSAO";
  return "NOVA_OBRA";
}

/**
 * Mapeia a fase retornada pelo LLM para o enum TipoMovimentacao do schema.
 */
export function faseParaTipoMovimentacao(fase: string): string {
  const f = fase.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (/licenci/.test(f)) return "LICENCIAMENTO_EM_ANDAMENTO";
  if (/mobiliz/.test(f)) return "MOBILIZACAO_INICIADA";
  if (/terraplen/.test(f)) return "TERRAPLENAGEM";
  if (/fundac/.test(f)) return "FUNDACAO_INICIADA";
  if (/concretag/.test(f)) return "CONCRETAGEM";
  if (/estrutura/.test(f)) return "ESTRUTURA_EM_ANDAMENTO";
  if (/expansao|expans/.test(f)) return "EXPANSAO";
  return "OBRA_DETECTADA";
}

/**
 * Retorna true se a fase representa um evento temporal real (não apenas "anunciada" ou "planejada").
 * Somente fases com evidência temporal real geram DossieMovimentacao.
 */
export function fasePossuiEvidenciaTemporal(fase: string): boolean {
  const f = fase.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  return /(licenci|mobiliz|terraplen|fundac|concretag|estrutura|execuc|execu|expansao|andament)/.test(f);
}

/**
 * Calcula o novo status da DossieCarteira com base no resultado da investigação.
 * REGRA: não avança status por potencial — só por evidência real.
 * REGRA: PRONTO_PARA_ABORDAR e acima nunca são avançados automaticamente.
 */
export function calcularNovoStatusCarteira(
  statusAtual: string,
  obrasEncontradas: number,
  decisorEncontrado: boolean,
): string {
  const ORDEM = [
    "MONITORANDO",
    "SINAL_DETECTADO",
    "EM_INVESTIGACAO",
    "DECISOR_ENCONTRADO",
    "PRONTO_PARA_ABORDAR",
    "EM_CAMPANHA",
    "RESPONDEU",
    "INTERESSADO",
  ];
  const idx = ORDEM.indexOf(statusAtual);
  if (idx === -1) return statusAtual; // status desconhecido — não mexe
  if (idx >= 4) return statusAtual;  // PRONTO_PARA_ABORDAR e acima — nunca auto-avança

  let novoIdx = idx;

  // Usa idx (status ORIGINAL) para evitar que as regras disparem em cascata.
  // 1ª detecção (MONITORANDO + obras) → SINAL_DETECTADO
  if (obrasEncontradas > 0 && idx < 1) novoIdx = 1;
  // 2ª+ investigação confirmada (SINAL_DETECTADO + obras) → EM_INVESTIGACAO
  else if (obrasEncontradas > 0 && idx === 1) novoIdx = 2;

  // Decisor encontrado → DECISOR_ENCONTRADO (nunca regride)
  if (decisorEncontrado && novoIdx < 3) novoIdx = 3;

  return ORDEM[novoIdx];
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildSistema(): string {
  return `Você é João, agente de inteligência comercial da Villa Empreendimentos.

Villa Empreendimentos: maior empresa do Brasil em locação de bombas de concreto e betoneiras. Equipamentos: bomba lança (28–58m), bomba estacionária, caminhão betoneira, Telebelt, central de concreto in loco.

Sua tarefa nesta missão: investigar uma CONSTRUTORA específica e identificar obras reais em execução, contratadas, anunciadas ou prestes a iniciar que possam consumir equipamentos de bombeamento de concreto.

INSTRUÇÕES DE BUSCA:
- Buscas SEMPRE direcionadas ao nome da empresa. Nunca genéricas.
- Correto: "[Empresa] obra 2026", "[Empresa] licença IBAMA", "[Empresa] nova unidade"
- Errado: "construtoras grandes Brasil", "obras construção civil nordeste"
- Máximo 3 buscas. Priorize a missão descrita.
- Se obras já são conhecidas no contexto, foque em confirmar fase atual e buscar novidades.

PARA CADA OBRA:
- Exija fonte verificável (URL, nome do portal, publicação oficial)
- Exija evidência textual (trecho de texto que confirma o fato)
- Exija fase comprovada — não suponha
- Nunca invente obras, fases, contatos ou valores não confirmados

FASES ACEITAS (use exatamente um destes valores):
licenciamento | mobilizacao | terraplenagem | fundacao | concretagem | estrutura | execucao | anunciada | planejada | concluida

CONFIANÇA:
- CONFIRMADA: fonte oficial (IBAMA, ANTT, governo, edital público, CVM)
- FORTE: mídia especializada com link verificável
- PROVAVEL: múltiplas menções sem URL, ou notícia regional
- SINAL: menção única sem verificação completa

DECISORES (somente públicos e verificáveis):
- Cargos aceitos: Diretor de Obras, Gerente de Obras, Diretor de Engenharia, Comprador, Gerente de Suprimentos
- Nunca invente cargo, telefone, e-mail ou LinkedIn não confirmados

RETORNE APENAS UM JSON VÁLIDO (sem markdown, sem texto antes ou depois):
{
  "achou": true,
  "camposDossie": {
    "faseObra": "fase mais avançada encontrada em qualquer obra",
    "valorEstimado": 0,
    "cronograma": "se encontrado",
    "fonteInformacao": "nome da fonte principal",
    "linkFonte": "url da fonte principal"
  },
  "obras": [
    {
      "nome": "Nome da obra ou empreendimento",
      "cidade": "Cidade",
      "estado": "UF",
      "tipo": "tipo da obra",
      "clienteFinal": "se identificado",
      "valor": 0,
      "fase": "fase_aceita",
      "cronograma": "data ou prazo se disponível",
      "fonteNome": "nome da fonte",
      "url": "url da fonte",
      "dataInformacao": "2026-08-01",
      "confianca": "FORTE",
      "evidenciaTextual": "Trecho exato de texto que prova o fato desta obra."
    }
  ],
  "decisor": {
    "nome": "Nome completo",
    "cargo": "Cargo",
    "empresa": "Empresa",
    "linkedin": "url do linkedin se encontrado",
    "fonte": "origem da informação"
  },
  "noticias": [
    { "titulo": "...", "conteudo": "...", "fonte": "...", "link": "..." }
  ],
  "proximaMissao": "Próxima investigação específica recomendada para esta construtora.",
  "resumoInvestigacao": "O que foi buscado e o que foi encontrado."
}

REGRAS CRÍTICAS:
- Omita campos opcionais não encontrados (não coloque null nem string vazia)
- Se decisor não encontrado: coloque "decisor": null
- Se nada encontrado: achou=false, obras=[], camposDossie={}, decisor=null
- valor e valorEstimado devem ser números em reais (sem R$, sem bi, sem mi)
- dataInformacao deve ser ISO: "2026-08-15"
- evidenciaTextual é OBRIGATÓRIO para cada obra`;
}

function buildUsuario(dossie: DossieParaInvestigacao): string {
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
Fonte anterior: ${dossie.fonteInformacao ?? "nenhuma"}

MISSÃO ATUAL:
${dossie.missaoAtual ?? "Identificar obras em execução ou anunciadas e principais decisores desta construtora."}

Pesquise agora. Retorne apenas o JSON.`;
}

// ─── investigarConstrutora ────────────────────────────────────────────────────

/**
 * Investiga uma construtora com Claude Haiku + web_search.
 * Retorna obras, campos para PATCH no dossiê, decisor e próxima missão.
 * NÃO persiste nada — persistência é feita pelo cron (salvarResultadoConstrutora).
 */
export async function investigarConstrutora(
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
    resumoInvestigacao: "Investigação não concluída.",
  };

  try {
    const Anthropic_ = (await import("@anthropic-ai/sdk"))
      .default as typeof Anthropic;
    const client = new Anthropic_({ apiKey: process.env.ANTHROPIC_API_KEY });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client as any).beta.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 3500,
          betas: ["web-search-2025-03-05"],
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 3,
            },
          ],
          system: buildSistema(),
          messages: [{ role: "user", content: buildUsuario(dossie) }],
        },
        { signal: controller.signal },
      );

      clearTimeout(timeout);

      const blocos = Array.isArray(response.content) ? response.content : [];
      const textoFinal = blocos
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");

      if (!textoFinal.trim()) {
        resultado.resumoInvestigacao = "Claude não retornou texto.";
        return resultado;
      }

      let textoJson = textoFinal.trim();
      const mdMatch = textoJson.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) textoJson = mdMatch[1].trim();

      const jsonMatch = textoJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        resultado.resumoInvestigacao = "Resposta sem JSON válido.";
        return resultado;
      }

      const tentarParsear = (texto: string): Record<string, unknown> | null => {
        try {
          return JSON.parse(texto) as Record<string, unknown>;
        } catch {
          /* continua */
        }
        let pos = texto.lastIndexOf("}");
        while (pos > 0) {
          try {
            return JSON.parse(texto.slice(0, pos + 1)) as Record<
              string,
              unknown
            >;
          } catch {
            /* continua */
          }
          pos = texto.lastIndexOf("}", pos - 1);
        }
        return null;
      };

      const parsed = tentarParsear(jsonMatch[0]);
      if (!parsed) {
        resultado.resumoInvestigacao = "JSON inválido mesmo após recuperação.";
        return resultado;
      }

      resultado.achou = parsed.achou === true;
      resultado.camposDossie =
        (parsed.camposDossie as ResultadoInvestigacaoConstrutora["camposDossie"]) ??
        {};
      resultado.obras = Array.isArray(parsed.obras)
        ? (parsed.obras as ObraConstrutora[]).filter(
            (o) => o?.nome?.trim() && o?.evidenciaTextual?.trim(),
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
          : "Investigação concluída.";
    } catch (innerErr) {
      clearTimeout(timeout);
      throw innerErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[investigador-construtora] Erro ao investigar ${dossie.id}:`,
      msg,
    );
    resultado.erro = msg;
    resultado.resumoInvestigacao = `Erro: ${msg}`;
  }

  return resultado;
}
