// ARQUIVO: lib/base-nacional/joao/pesquisa-ia.ts
// REGRA: nunca remover. Apenas acrescentar.
// Núcleo (funções puras) do módulo de pesquisa assistida por IA da fila comercial do João
// — grupos B e C (decisor com contato fraco, ou grande grupo precisando achar quem cuida de
// operações/frota/manutenção/compras). Entrada: nome, cidade/UF, domínio do grupo.
// Saída no MESMO formato que scripts/base-nacional/joao-enriquecer.ts --importar-web espera
// (nome, cargo, fonteUrl, trecho, confiança), reaproveitando as MESMAS validações daquele
// script (homônimo, domínio, URL obrigatória) — nunca duplicadas, sempre importadas de validar.ts.
//
// Este arquivo NUNCA chama a internet nem o banco. Quem busca de verdade é um ClienteBuscaIA
// injetado (ver pesquisa-ia-provedores.ts); os testes usam um cliente simulado (mock).
// O resultado SEMPRE vai para revisão humana (mesmo fluxo manual de hoje: revisar e rodar
// `joao-enriquecer.ts --importar-web`) — este módulo nunca grava pessoa/contato sozinho.

import { classificarCargo, nomePessoaPlausivel, normalizarLinkedinPessoa, textoCitaEmpresa, tokensDistintivos } from "./validar";

export type EntradaPesquisaIA = {
  /** Nome ou razão social da empresa/grupo a pesquisar. */
  nome: string;
  cidadeUf: string;
  /** Domínio próprio conhecido do grupo (site), se houver — ajuda o provedor a focar a busca. */
  dominio: string | null;
};

/** Um achado bruto devolvido pelo provedor de IA, antes da validação. */
export type AchadoBrutoPesquisaIA = {
  nome: string;
  cargo: string;
  linkedinUrl?: string | null;
  fonteUrl: string;
  trecho: string;
};

/** Mesma forma de AchadoWeb em joao-enriquecer.ts (nome, cargo, fonteUrl, trecho, confiança). */
export type AchadoPesquisaIA = {
  nome: string;
  cargo: string;
  linkedinUrl: string | null;
  fonteUrl: string;
  trecho: string;
  confianca: "ALTA" | "MEDIA" | "BAIXA";
};

export type RespostaClienteBuscaIA = {
  achados: AchadoBrutoPesquisaIA[];
  tokensEstimados: number;
  custoUsd: number;
};

/** Interface que um provedor de IA (Claude ou OpenAI) implementa. Testes injetam um cliente simulado. */
export interface ClienteBuscaIA {
  readonly provedor: "claude" | "openai";
  buscar(entrada: EntradaPesquisaIA, prompt: string): Promise<RespostaClienteBuscaIA>;
}

/** Prompt enviado ao provedor — função pura, testável sem rede. */
/** Versão das instruções — entra na chave do cache: mudar as instruções permite nova busca. */
export const VERSAO_PROMPT_PESQUISA_IA = "v2-2026-10-14";

export function montarPromptPesquisaIA(entrada: EntradaPesquisaIA): string {
  const linhas = [
    `Pesquise na web quem, na empresa "${entrada.nome}" (${entrada.cidadeUf}), cuida de compras, frota, manutenção ou operações de equipamentos — NÃO busque sócios ou diretores já conhecidos pela Receita Federal.`,
    entrada.dominio ? `O site oficial da empresa é ${entrada.dominio}; priorize fontes que citem esse domínio ou o nome da empresa.` : "Não há site próprio conhecido; use apenas fontes que citem claramente o nome da empresa (evite homônimos).",
    `Para cada pessoa encontrada, retorne em JSON: nome, cargo (como descrito na fonte), linkedinUrl (se houver, perfil pessoal /in/), fonteUrl (link http(s) da página onde encontrou, OBRIGATÓRIO), trecho (até 240 caracteres citando a empresa).`,
    // 14/10/2026 (piloto): o modelo descartava pessoas encontradas em páginas de perfil corporativo. A URL do resultado de busca
    // onde o nome aparece É a fonte; a confiança e a revisão humana tratam o resto.
    `A fonteUrl é a URL da página (resultado de busca) onde o nome e o cargo aparecem junto com o nome da empresa — vale LinkedIn, site da empresa, notícia, vaga ou páginas de perfil corporativo (ZoomInfo, Datanyze, Econodata etc.). Não exija outra comprovação: uma pessoa revisará tudo.`,
    `Nunca invente nome, cargo ou link. Sem fonte com link, não inclua a pessoa. Responda só com um array JSON, sem texto fora dele.`,
  ];
  return linhas.join("\n");
}

export type RejeicaoPesquisaIA = { nome: string; motivo: string };

export type ResultadoValidacaoPesquisaIA = {
  achados: AchadoPesquisaIA[];
  rejeitados: RejeicaoPesquisaIA[];
};

/**
 * Valida os achados brutos do provedor com as MESMAS regras de --importar-web:
 * URL de fonte obrigatória (https://), nome de pessoa plausível, trecho precisa citar a
 * empresa (nunca aceita por homônimo), cargo fora do público-alvo (prioridade > 7, ver
 * classificarCargo) é rejeitado. Confiança: ALTA se tem LinkedIn pessoal, senão MEDIA.
 */
export function validarAchadosPesquisaIA(achadosBrutos: AchadoBrutoPesquisaIA[], nomesEmpresa: string[]): ResultadoValidacaoPesquisaIA {
  const tokens = tokensDistintivos(...nomesEmpresa);
  const achados: AchadoPesquisaIA[] = [];
  const rejeitados: RejeicaoPesquisaIA[] = [];
  for (const a of achadosBrutos) {
    if (!/^https:\/\//.test(a.fonteUrl ?? "")) { rejeitados.push({ nome: a.nome, motivo: "sem URL de fonte (https obrigatório)" }); continue; }
    if (!nomePessoaPlausivel(a.nome)) { rejeitados.push({ nome: a.nome, motivo: "nome não plausível" }); continue; }
    if (!textoCitaEmpresa(`${a.trecho} ${a.cargo}`, tokens)) { rejeitados.push({ nome: a.nome, motivo: "trecho não cita a empresa (risco de homônimo)" }); continue; }
    const c = classificarCargo(a.cargo);
    if (c.prioridade > 7) { rejeitados.push({ nome: a.nome, motivo: `cargo fora do público (${a.cargo || "sem cargo"})` }); continue; }
    const linkedinUrl = a.linkedinUrl ? normalizarLinkedinPessoa(a.linkedinUrl) : null;
    achados.push({ nome: a.nome, cargo: a.cargo, linkedinUrl, fonteUrl: a.fonteUrl, trecho: a.trecho.slice(0, 240), confianca: linkedinUrl ? "ALTA" : "MEDIA" });
  }
  return { achados, rejeitados };
}

/** Formato pronto para `joao-enriquecer.ts --importar-web=<arquivo.json>` (um array com esta forma). */
export type EntradaImportarWeb = { grupoChave: string; consultas: string[]; tokensEstimados?: number; achados: AchadoPesquisaIA[] };

export function montarEntradaImportarWeb(args: { grupoChave: string; entrada: EntradaPesquisaIA; achados: AchadoPesquisaIA[]; tokensEstimados: number }): EntradaImportarWeb {
  return {
    grupoChave: args.grupoChave,
    consultas: [`${args.entrada.nome} (${args.entrada.cidadeUf}) — compras, frota, manutenção, operações`],
    tokensEstimados: args.tokensEstimados,
    achados: args.achados,
  };
}
