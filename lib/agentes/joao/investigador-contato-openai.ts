// ARQUIVO: lib/agentes/joao/investigador-contato-openai.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Investigador GPT-4o para carteiras de campanha (CONCRETEIRAS, PRE_MOLDADOS, MCMV, REVENDAS_CAMINHOES).
// Foco em LinkedIn para encontrar decisor com cargo, telefone e URL de perfil.
// Interface idêntica ao investigador-contato.ts para uso combinado.

import type { DossieParaInvestigacao } from "./investigador";
import type { CarteiraContato, ContatoEncontrado, ResultadoInvestigacaoContato } from "./investigador-contato";

// ─── Helpers (importados do investigador-contato para evitar duplicação) ───────

function cargosAlvo(carteira: CarteiraContato): string {
  switch (carteira) {
    case "CONCRETEIRAS":       return "Proprietário, Sócio, Diretor Geral, Gerente de Operações, Gerente Comercial, Gerente de Produção";
    case "PRE_MOLDADOS":       return "Proprietário, Sócio, Diretor Industrial, Gerente de Produção, Diretor Comercial, Gerente de Vendas";
    case "MCMV":               return "Diretor de Obras, Gerente de Obras, Diretor de Suprimentos, Comprador, Proprietário, Sócio";
    case "REVENDAS_CAMINHOES": return "Proprietário, Sócio, Diretor Comercial, Gerente de Vendas, Gerente de Parcerias";
  }
}

function labelCarteira(carteira: CarteiraContato): string {
  switch (carteira) {
    case "CONCRETEIRAS":       return "central de concreto usinado";
    case "PRE_MOLDADOS":       return "fabricante de elementos pré-moldados de concreto";
    case "MCMV":               return "construtora do programa Minha Casa Minha Vida";
    case "REVENDAS_CAMINHOES": return "revenda / concessionária de caminhões";
  }
}

function objetivoCarteira(carteira: CarteiraContato): string {
  switch (carteira) {
    case "CONCRETEIRAS":
      return "A Villa quer oferecer locação de bombas de concreto e betoneiras, e também venda de equipamentos usados. O decisor é quem autoriza compra ou locação de equipamentos.";
    case "PRE_MOLDADOS":
      return "A Villa quer oferecer venda de equipamentos usados (bombas estacionárias, betoneiras). O decisor é quem autoriza investimentos em equipamentos de produção.";
    case "MCMV":
      return "A Villa quer oferecer locação de central de concreto in loco, caminhão betoneira e bomba, além de venda de usados. O decisor é quem contrata locação de equipamentos para a obra.";
    case "REVENDAS_CAMINHOES":
      return "A Villa quer propor parceria: a revenda representa e vende equipamentos usados da Villa. O decisor é quem decide parcerias comerciais.";
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildSistemaOpenAI(carteira: CarteiraContato): string {
  return `Você é João, agente de inteligência comercial da Villa Empreendimentos.

Villa Empreendimentos: maior empresa do Brasil em locação de bombas de concreto e betoneiras. Também vende equipamentos usados.

Você está investigando uma empresa do segmento: ${labelCarteira(carteira)}.

OBJETIVO:
${objetivoCarteira(carteira)}

INSTRUÇÕES DE BUSCA:
- Faça até 3 buscas SEMPRE direcionadas ao nome da empresa.
- BUSCA OBRIGATÓRIA 1 (LinkedIn): site:linkedin.com "${`[EMPRESA]`}" (${cargosAlvo(carteira)})
  → Substitua [EMPRESA] pelo nome real da empresa investigada.
  → Registre nome completo, cargo e URL do perfil LinkedIn de cada decisor encontrado.
- BUSCA 2: "[Empresa] [cidade] contato telefone WhatsApp"
- BUSCA 3: "[Empresa] site oficial" — para confirmar porte, produtos e presença digital.

DECISOR — PRIORIDADE:
1. LinkedIn com URL verificável
2. Telefone ou WhatsApp no site
3. Email no site ou CNPJ
Cargos prioritários: ${cargosAlvo(carteira)}

RETORNE APENAS UM JSON VÁLIDO (sem markdown):
{
  "achou": true,
  "decisor": {
    "nome": "Nome completo",
    "cargo": "Cargo exato",
    "telefone": "XX XXXXX-XXXX",
    "whatsapp": "XX XXXXX-XXXX",
    "email": "email@empresa.com",
    "linkedin": "https://linkedin.com/in/perfil",
    "fonte": "LinkedIn / site oficial / Google"
  },
  "contatosAdicionais": [
    { "nome": "...", "cargo": "...", "linkedin": "...", "telefone": "..." }
  ],
  "perfilEmpresa": "Porte estimado, produtos, localização de plantas ou filiais.",
  "proximaMissao": "O que investigar na próxima rodada.",
  "resumoInvestigacao": "O que foi buscado e o que foi encontrado."
}

REGRAS:
- Omita campos não encontrados (não coloque null nem vazio).
- decisor=null se não encontrou.
- contatosAdicionais=[] se não encontrou outros.
- Nunca invente telefone, email ou LinkedIn.`;
}

function buildUsuarioOpenAI(dossie: DossieParaInvestigacao): string {
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
${dossie.missaoAtual ?? "Identificar decisor via LinkedIn. Buscar telefone, WhatsApp, email e URL do perfil LinkedIn."}

Pesquise agora. Retorne apenas o JSON.`;
}

// ─── tentarParsearJSON ────────────────────────────────────────────────────────

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

// ─── investigarContatoOpenAI ──────────────────────────────────────────────────

/**
 * Investiga contato de empresa de campanha com GPT-4o + LinkedIn search.
 * Retorna ResultadoInvestigacaoContato — mesma interface do Claude Haiku.
 * NÃO persiste nada — persistência feita pelo cron.
 */
export async function investigarContatoOpenAI(
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
          instructions: buildSistemaOpenAI(carteira),
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

      resultado.achou              = parsed.achou === true;
      resultado.decisor            = (parsed.decisor as ContatoEncontrado) ?? null;
      resultado.contatosAdicionais = Array.isArray(parsed.contatosAdicionais)
        ? (parsed.contatosAdicionais as ContatoEncontrado[]).filter((c) => c?.nome?.trim())
        : [];
      resultado.perfilEmpresa      = typeof parsed.perfilEmpresa === "string" ? parsed.perfilEmpresa : "";
      resultado.proximaMissao      = typeof parsed.proximaMissao === "string" ? parsed.proximaMissao : "";
      resultado.resumoInvestigacao = typeof parsed.resumoInvestigacao === "string"
        ? parsed.resumoInvestigacao : "GPT-4o concluiu investigação.";

    } catch (innerErr) {
      clearTimeout(timeout);
      throw innerErr;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[investigador-contato-openai] Erro ao investigar ${dossie.id}:`, msg);
    resultado.erro = msg;
    resultado.resumoInvestigacao = `GPT-4o — Erro: ${msg}`;
  }

  return resultado;
}
