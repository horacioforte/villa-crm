// ARQUIVO: lib/agentes/joao/investigador-contato.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Investigador de CONTATO para carteiras de campanha:
//   CONCRETEIRAS | PRE_MOLDADOS | MCMV | REVENDAS_CAMINHOES
//
// Objetivo: encontrar decisor (nome, cargo, telefone, WhatsApp, email, LinkedIn)
// para que a equipe comercial da Villa possa fazer campanha direta.
// NÃO foca em obras — foca em QUEM COMPRA ou LOCA equipamentos de concreto.

import Anthropic from "@anthropic-ai/sdk";
import type { DossieParaInvestigacao } from "./investigador";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CarteiraContato =
  | "CONCRETEIRAS"
  | "PRE_MOLDADOS"
  | "MCMV"
  | "REVENDAS_CAMINHOES";

export interface ContatoEncontrado {
  nome: string;
  cargo?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  linkedin?: string;
  fonte?: string;
}

export interface ResultadoInvestigacaoContato {
  dossieId: string;
  achou: boolean;
  /** Decisor principal — quem decide compra/locação de equipamentos. */
  decisor: ContatoEncontrado | null;
  /** Outros contatos úteis encontrados. */
  contatosAdicionais: ContatoEncontrado[];
  /** Resumo breve da empresa (porte, produtos, localização). */
  perfilEmpresa: string;
  /** Próxima missão para esta empresa. */
  proximaMissao: string;
  resumoInvestigacao: string;
  erro?: string;
}

// ─── Cargos por segmento ──────────────────────────────────────────────────────

function cargosAlvo(carteira: CarteiraContato): string {
  switch (carteira) {
    case "CONCRETEIRAS":
      return "Proprietário, Sócio, Diretor Geral, Gerente de Operações, Gerente Comercial, Gerente de Produção";
    case "PRE_MOLDADOS":
      return "Proprietário, Sócio, Diretor Industrial, Gerente de Produção, Diretor Comercial, Gerente de Vendas";
    case "MCMV":
      return "Diretor de Obras, Gerente de Obras, Diretor de Suprimentos, Comprador, Proprietário, Sócio";
    case "REVENDAS_CAMINHOES":
      return "Proprietário, Sócio, Diretor Comercial, Gerente de Vendas, Gerente de Parcerias";
  }
}

function labelCarteira(carteira: CarteiraContato): string {
  switch (carteira) {
    case "CONCRETEIRAS":      return "central de concreto usinado";
    case "PRE_MOLDADOS":      return "fabricante de elementos pré-moldados de concreto";
    case "MCMV":              return "construtora do programa Minha Casa Minha Vida";
    case "REVENDAS_CAMINHOES": return "revenda / concessionária de caminhões";
  }
}

function objetivoCarteira(carteira: CarteiraContato): string {
  switch (carteira) {
    case "CONCRETEIRAS":
      return "A Villa quer oferecer locação de bombas de concreto e betoneiras, e também venda de equipamentos usados (bombas, betoneiras, centrais). O decisor é quem autoriza compra ou locação de equipamentos.";
    case "PRE_MOLDADOS":
      return "A Villa quer oferecer venda de equipamentos usados (bombas estacionárias, betoneiras) para a fábrica. O decisor é quem autoriza investimentos em equipamentos de produção.";
    case "MCMV":
      return "A Villa quer oferecer locação de central de concreto in loco, caminhão betoneira e bomba de concreto, além de venda de usados. O decisor é quem contrata locação de equipamentos para a obra.";
    case "REVENDAS_CAMINHOES":
      return "A Villa quer propor parceria comercial: a revenda representa e vende equipamentos usados da Villa (betoneiras e bombas usadas). O decisor é quem decide parcerias comerciais na revenda.";
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildSistema(carteira: CarteiraContato): string {
  return `Você é João, agente de inteligência comercial da Villa Empreendimentos.

Villa Empreendimentos: maior empresa do Brasil em locação de bombas de concreto e betoneiras. Também vende equipamentos usados (bombas, betoneiras, centrais de concreto).

Você está investigando uma empresa do segmento: ${labelCarteira(carteira)}.

OBJETIVO DESTA INVESTIGAÇÃO:
${objetivoCarteira(carteira)}

INSTRUÇÕES DE BUSCA:
- Faça até 3 buscas, SEMPRE direcionadas ao nome da empresa.
- Busca 1: Perfil geral — "[Empresa] [cidade/estado] contato telefone"
- Busca 2: LinkedIn — site:linkedin.com "[Empresa]" (${cargosAlvo(carteira)})
- Busca 3: Site oficial ou redes sociais — "[Empresa] site oficial Instagram Facebook"
- Nunca faça buscas genéricas sobre o segmento.

DECISOR — QUEM PROCURAR:
Cargos prioritários: ${cargosAlvo(carteira)}
- Prefira o mais alto na hierarquia que tiver contato disponível.
- Telefone/WhatsApp é mais valioso que email.
- LinkedIn com URL do perfil é muito valioso.
- Nunca invente contatos — só registre o que encontrar.

PERFIL DA EMPRESA:
Registre brevemente: porte estimado (pequena/média/grande), produtos/serviços, localização de plantas ou filiais, presença digital.

RETORNE APENAS UM JSON VÁLIDO (sem markdown, sem texto antes ou depois):
{
  "achou": true,
  "decisor": {
    "nome": "Nome completo",
    "cargo": "Cargo",
    "telefone": "11 99999-9999",
    "whatsapp": "11 99999-9999",
    "email": "email@empresa.com",
    "linkedin": "https://linkedin.com/in/...",
    "fonte": "LinkedIn / site oficial / Google"
  },
  "contatosAdicionais": [
    {
      "nome": "Outro nome",
      "cargo": "Cargo",
      "telefone": "...",
      "email": "...",
      "linkedin": "..."
    }
  ],
  "perfilEmpresa": "Breve perfil: porte, produtos, localização.",
  "proximaMissao": "O que investigar na próxima rodada para esta empresa.",
  "resumoInvestigacao": "O que foi buscado e o que foi encontrado."
}

REGRAS CRÍTICAS:
- Omita campos não encontrados (não coloque null nem string vazia).
- Se decisor não encontrado: "decisor": null.
- contatosAdicionais pode ser array vazio [].
- Só registre contatos CONFIRMADOS — nunca invente telefone ou email.
- Se não encontrou nada: achou=false, decisor=null, contatosAdicionais=[].`;
}

function buildUsuario(dossie: DossieParaInvestigacao): string {
  const decisoresConhecidos =
    dossie.decisores
      ?.filter((d) => d.nome)
      .map((d) => `${d.nome}${d.cargo ? ` (${d.cargo})` : ""}`)
      .join(", ") || "Nenhum encontrado ainda";

  return `EMPRESA A INVESTIGAR:
Nome: ${dossie.titulo}
Cidade/Estado: ${dossie.cidade ?? "?"}/${dossie.estado ?? "?"}
Segmento: ${dossie.segmento ?? "não informado"}
Resumo: ${dossie.resumo ?? "sem resumo"}
Decisores já mapeados: ${decisoresConhecidos}
Fonte anterior: ${dossie.fonteInformacao ?? "nenhuma"}

MISSÃO ATUAL:
${dossie.missaoAtual ?? "Identificar o decisor que autoriza compra ou locação de equipamentos de concreto. Buscar telefone, WhatsApp, email e LinkedIn."}

Pesquise agora. Retorne apenas o JSON.`;
}

// ─── investigarContato (Claude Haiku) ─────────────────────────────────────────

/**
 * Investiga contato de empresa de campanha com Claude Haiku + web_search.
 * Foco em encontrar decisor, telefone, WhatsApp, email, LinkedIn.
 * NÃO persiste nada — persistência feita pelo cron.
 */
export async function investigarContato(
  dossie: DossieParaInvestigacao,
  carteira: CarteiraContato,
): Promise<ResultadoInvestigacaoContato> {
  const resultado: ResultadoInvestigacaoContato = {
    dossieId: dossie.id,
    achou: false,
    decisor: null,
    contatosAdicionais: [],
    perfilEmpresa: "",
    proximaMissao: "",
    resumoInvestigacao: "Investigação não concluída.",
  };

  try {
    const Anthropic_ = (await import("@anthropic-ai/sdk")).default as typeof Anthropic;
    const client = new Anthropic_({ apiKey: process.env.ANTHROPIC_API_KEY });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client as any).beta.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          betas: ["web-search-2025-03-05"],
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
          system: buildSistema(carteira),
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
        resultado.resumoInvestigacao = "JSON inválido.";
        return resultado;
      }

      resultado.achou              = parsed.achou === true;
      resultado.decisor            = (parsed.decisor as ContatoEncontrado) ?? null;
      resultado.contatosAdicionais = Array.isArray(parsed.contatosAdicionais)
        ? (parsed.contatosAdicionais as ContatoEncontrado[]).filter((c) => c?.nome?.trim())
        : [];
      resultado.perfilEmpresa      = typeof parsed.perfilEmpresa === "string" ? parsed.perfilEmpresa : "";
      resultado.proximaMissao      = typeof parsed.proximaMissao === "string" ? parsed.proximaMissao : "";
      resultado.resumoInvestigacao = typeof parsed.resumoInvestigacao === "string"
        ? parsed.resumoInvestigacao : "Investigação concluída.";

    } catch (innerErr) {
      clearTimeout(timeout);
      throw innerErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[investigador-contato] Erro ao investigar ${dossie.id}:`, msg);
    resultado.erro = msg;
    resultado.resumoInvestigacao = `Erro: ${msg}`;
  }

  return resultado;
}

// ─── investigarContatoCombinado ───────────────────────────────────────────────

/**
 * Roda Claude Haiku + GPT-4o em paralelo para encontrar contato de empresa de campanha.
 * GPT-4o tem busca LinkedIn explícita.
 * Mescla resultados: melhor decisor, contatos adicionais combinados.
 * NÃO persiste nada — persistência feita pelo cron.
 */
export async function investigarContatoCombinado(
  dossie: DossieParaInvestigacao,
  carteira: CarteiraContato,
): Promise<ResultadoInvestigacaoContato> {
  const { investigarContatoOpenAI } = await import("./investigador-contato-openai");

  const [claudeRes, openaiRes] = await Promise.allSettled([
    investigarContato(dossie, carteira),
    investigarContatoOpenAI(dossie, carteira),
  ]);

  const claude = claudeRes.status === "fulfilled" ? claudeRes.value : null;
  const openai = openaiRes.status === "fulfilled" ? openaiRes.value : null;

  if (!claude && !openai) {
    return {
      dossieId: dossie.id,
      achou: false,
      decisor: null,
      contatosAdicionais: [],
      perfilEmpresa: "",
      proximaMissao: "",
      resumoInvestigacao: "Ambos investigadores falharam.",
      erro: "Claude e GPT-4o retornaram erro.",
    };
  }

  // Decisor: prefere quem tem mais campos preenchidos (LinkedIn > telefone > só nome)
  const scoreContato = (c: ContatoEncontrado | null): number => {
    if (!c) return 0;
    return (c.linkedin ? 4 : 0) + (c.telefone || c.whatsapp ? 3 : 0) + (c.email ? 2 : 0) + (c.nome ? 1 : 0);
  };
  const decisorClaude = claude?.decisor ?? null;
  const decisorOpenai = openai?.decisor ?? null;
  const decisorFinal = scoreContato(decisorOpenai) >= scoreContato(decisorClaude)
    ? decisorOpenai
    : decisorClaude;

  // Contatos adicionais — combina sem duplicar por nome
  const adicionaisClaude = claude?.contatosAdicionais ?? [];
  const adicionaisOpenai = openai?.contatosAdicionais ?? [];
  const nomesBase = new Set(adicionaisClaude.map((c) => c.nome?.trim().toLowerCase()));
  const adicionaisExtras = adicionaisOpenai.filter(
    (c) => !nomesBase.has(c.nome?.trim().toLowerCase()),
  );
  const adicionaisFinal = [...adicionaisClaude, ...adicionaisExtras];

  // perfilEmpresa: prefere o mais longo
  const perfilFinal = (claude?.perfilEmpresa?.length ?? 0) >= (openai?.perfilEmpresa?.length ?? 0)
    ? (claude?.perfilEmpresa ?? openai?.perfilEmpresa ?? "")
    : (openai?.perfilEmpresa ?? "");

  const proximaMissao = claude?.proximaMissao || openai?.proximaMissao || "";

  const resumos: string[] = [];
  if (claude?.resumoInvestigacao) resumos.push(`[Claude] ${claude.resumoInvestigacao}`);
  if (openai?.resumoInvestigacao) resumos.push(`[GPT-4o] ${openai.resumoInvestigacao}`);

  return {
    dossieId: dossie.id,
    achou: (claude?.achou ?? false) || (openai?.achou ?? false),
    decisor: decisorFinal,
    contatosAdicionais: adicionaisFinal,
    perfilEmpresa: perfilFinal,
    proximaMissao,
    resumoInvestigacao: resumos.join(" | "),
    ...(claude?.erro && openai?.erro
      ? { erro: `Claude: ${claude.erro} | GPT-4o: ${openai.erro}` }
      : {}),
  };
}
