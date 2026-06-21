/**
 * VILLA KNOWLEDGE BASE — lib/villa-kb.ts
 * Base de conhecimento compartilhada entre Maria (receptiva) e João (hunter).
 * REGRA: nunca remover conteúdo deste arquivo. Apenas acrescentar.
 * Versão: 1.0 — 21/06/2026
 */

// ─── EMPRESA ─────────────────────────────────────────────────────────────────

export const VILLA_EMPRESA = `
A Villa Empreendimentos foi fundada em 2007 na cidade de Recife, Pernambuco.
É uma das maiores empresas do Brasil na locação e venda de equipamentos para
bombeamento e transporte de concreto, atendendo obras de todos os portes em
todo o território nacional.

Pilares da empresa: credibilidade, confiança e alto desempenho.
Metodologia: Relacionar → Entender a Necessidade → Apresentar a Solução → Iniciar o Projeto.

Site: villaempreendimentos.com.br
`.trim();

// ─── UNIDADES ────────────────────────────────────────────────────────────────

export const VILLA_UNIDADES = `
- Matriz: Pina, Recife – PE | (81) 3325-1144
- Base Operacional: Bezerros – PE | (81) 3325-1144
- Filial: Sion, Belo Horizonte – MG | (81) 3325-1144
- Filial: Barra Funda, São Paulo – SP | (11) 3392-3287
Cobertura: todo o Brasil, com representantes em todas as regiões.
`.trim();

// ─── EQUIPAMENTOS ─────────────────────────────────────────────────────────────

export const VILLA_EQUIPAMENTOS = `
Equipamentos disponíveis para locação e venda:

1. BOMBA LANÇA (Auto Bomba de Concreto)
   - Alcance: 28 a 58 metros (vertical e horizontal)
   - Modelos: ABL 28 / 32 / 36 / 38 / 40 / 42-43 / 56-58
   - Uso: obras que exigem alcance em altura ou distância horizontal
   - Contrato fora de SP: mínimo 3 meses, modalidade mensal

2. BOMBA ESTACIONÁRIA
   - Modelos: ABE SP 2000 / SP 3000
   - Uso: grandes volumes, pisos industriais, obras de infraestrutura

3. CAMINHÃO BETONEIRA
   - Capacidade: 8 m³
   - Opções: com operador ou sem operador
   - Uso: transporte e mistura de concreto in loco

4. TELEBELT (TB130)
   - Uso: obras com acesso restrito ou difícil alcance
   - Distribui concreto por correias transportadoras

5. MASTRO HIDRÁULICO DE DISTRIBUIÇÃO (SPB 32)
   - Uso: obras verticais de médio porte

6. CENTRAL DE CONCRETO IN LOCO
   - Uso: obras com volume mínimo de 1.500 m³/mês e prazo de implantação ≥ 30 dias
   - Perfil ideal SP: qualquer volume (resposta imediata)
   - Perfil ideal fora de SP: volume total acima de 5.000 m³

VENDA DE USADOS:
   A Villa renova periodicamente sua frota e disponibiliza equipamentos usados para venda.
   Público-alvo principal: fábricas de pré-moldado de concreto (CNAE 2330-3),
   concreteiras e empresas de artefatos de concreto.
`.trim();

// ─── REGRAS COMERCIAIS ────────────────────────────────────────────────────────

export const VILLA_REGRAS_COMERCIAIS = `
REGRA ABSOLUTA — PREÇOS:
Nunca informar preços, valores, descontos ou condições comerciais.
Se perguntarem preço, responder exatamente:
"Os valores dependem das características técnicas e operacionais da obra.
Nossa equipe comercial irá analisar sua necessidade e encaminhar uma proposta personalizada."
Qualquer negociação ou exceção vai para a equipe comercial.

REGRA — TOM:
Sempre humano e caloroso. Nunca robótico.
Uma pergunta por mensagem.
Responder a pergunta do cliente antes de fazer a própria pergunta.
Nunca repetir o que o cliente já respondeu.

REGRA — SP:
Clientes de São Paulo são tratados com agilidade máxima — resposta imediata,
independente de volume ou porte da obra.

REGRA — FORA DE SP (bomba):
Contrato mensal, mínimo 3 meses. Informar em tom afirmativo como regra da Villa,
não negociar com o cliente.

REGRA — PREÇO NÃO SE APLICA A BETONEIRA:
Betoneira não exige volume mínimo — usa quantidade de caminhões, operador e prazo.
`.trim();

// ─── QUALIFICAÇÃO DE LEADS ────────────────────────────────────────────────────

export const VILLA_QUALIFICACAO = `
TEMPERATURA — QUENTE (score 80–100):
- Cliente de São Paulo (qualquer porte/volume)
- Volume total > 10.000 m³ fora de SP
- Prazo de início < 30 dias com data confirmada
- Mencionou urgência ou obra parada
- Pediu preço ou condições comerciais
- Infraestrutura pesada: rodovias, pontes, metrô, aeroporto, porto, ferrovia
- Grande construtora nacional ou cliente estratégico da Villa
- Data center, energia solar/eólica, condomínio logístico de grande porte
- Captou recursos recentemente (debêntures, IPO, follow-on)

TEMPERATURA — MÉDIA (score 50–79):
- Fora de SP com interesse claro mas sem volume/prazo definido
- Volume entre 500 e 10.000 m³ fora de SP
- Edifícios residenciais/comerciais de médio porte
- Pediu informações gerais sem urgência
- Contato promissor com dados insuficientes

TEMPERATURA — FRIA (score 0–49):
- Volume < 500 m³ fora de SP
- Sem dados de obra/cidade/volume
- Prazo indefinido
- Contato genérico sem relação clara com concreto

DESCARTAR:
- Spam, newsletters, marketing
- Fornecedores ou concorrentes
- Sem relação com concreto, bombeamento ou equipamentos
`.trim();

// ─── SISTEMA DE SCORING (0–100) ───────────────────────────────────────────────

export const VILLA_SCORING = `
Sistema de pontuação para qualificação de oportunidades (0 a 100):

| Critério                          | Peso máximo |
|-----------------------------------|-------------|
| Potencial financeiro da obra      | 25 pts      |
| Volume estimado de concreto       | 20 pts      |
| Prazo para início                 | 20 pts      |
| Tipo de cliente / segmento        | 15 pts      |
| Região / cobertura da Villa       | 10 pts      |
| Facilidade de contato             | 10 pts      |

Classificação final:
- 80 a 100 → QUENTE → Entra no CRM automaticamente (prioridade URGENTE)
- 50 a 79  → MÉDIA  → Entra no CRM automaticamente (prioridade ALTA)
- 0 a 49   → FRIA   → Não entra no CRM (descartado nesta rodada)
`.trim();

// ─── SEGMENTOS ESTRATÉGICOS ───────────────────────────────────────────────────

export const VILLA_SEGMENTOS = `
Segmentos com maior potencial para Villa Empreendimentos:

LOCAÇÃO DE EQUIPAMENTOS:
- Infraestrutura pesada (rodovias, ferrovias, pontes, viadutos, metrô, aeroportos, portos)
- Energia (usinas solares, eólicas, hidrelétricas, subestações)
- Logística (condomínios logísticos, galpões, centros de distribuição)
- Indústria (fábricas, data centers, plantas industriais)
- Residencial de grande porte (empreendimentos, condomínios)
- Saneamento (estações de tratamento, adutoras)
- Obras públicas (prefeituras, governos estaduais, federais via PNCP)

VENDA DE USADOS:
- Fábricas de pré-moldado de concreto (CNAE 2330-3)
- Concreteiras (CNAE 2330-3/05)
- Empresas de artefatos de concreto
- Pequenas construtoras em início de operação
`.trim();

// ─── CLIENTES ESTRATÉGICOS (exemplos conhecidos) ──────────────────────────────

export const VILLA_CLIENTES_ESTRATEGICOS = `
Classificar automaticamente como POTENCIAL MUITO ALTO se o cliente/empresa
pertencer a grupos como: Andrade Gutierrez, Queiroz Galvão, Odebrecht/Novonor,
Passarelli, Afonso França, OAS, Tegma, MRV, Cyrela, JHSF, Tegma, LOG,
GWI, Pátria Investimentos, ou qualquer grande construtora nacional.
`.trim();

// ─── FONTES DE INTELIGÊNCIA COMERCIAL (João) ─────────────────────────────────

export const JOAO_FONTES = `
Pilar 1 — OBRAS:
- PNCP (pncp.gov.br) — contratos e licitações públicas
- PPI (ppi.gov.br) — projetos de parceria e investimento
- DNIT — rodovias e infraestrutura federal
- ANTT — concessões rodoviárias e ferroviárias
- Ministérios — comunicados e PAC
- Portais de licitação estaduais e municipais
- Notícias de infraestrutura (Google News, InfoMoney, CNN Brasil)

Pilar 2 — EMPRESAS:
- Receita Federal — abertura de filiais, CNPJs ativos
- Juntas Comerciais — registros de novas empresas
- LinkedIn — expansão regional, novas unidades
- Google News — abertura de plantas, crescimento operacional

Pilar 3 — MOVIMENTAÇÕES ESTRATÉGICAS:
- CVM (cvm.gov.br) — debêntures, captações, IPO, follow-on
- B3 — movimentações de capital
- Cartórios — compra de terrenos
- Notícias corporativas — aquisições, concessões

Pilar 4 — PESSOAS:
- LinkedIn — mudanças de cargo (Diretor de Engenharia, Diretor de Obras,
  Gerente de Equipamentos, Gerente de Suprimentos)
- Notícias e releases corporativos
`.trim();

// ─── EXPORT CONSOLIDADO ──────────────────────────────────────────────────────

/**
 * Retorna o conhecimento completo da Villa formatado para uso em prompts de IA.
 * Usado por Maria (inbound) e João (hunter).
 */
export function getVillaKnowledgeBase(): string {
  return [
    "# VILLA EMPREENDIMENTOS — BASE DE CONHECIMENTO OFICIAL",
    "",
    "## Empresa",
    VILLA_EMPRESA,
    "",
    "## Unidades",
    VILLA_UNIDADES,
    "",
    "## Equipamentos",
    VILLA_EQUIPAMENTOS,
    "",
    "## Regras Comerciais",
    VILLA_REGRAS_COMERCIAIS,
    "",
    "## Qualificação de Leads",
    VILLA_QUALIFICACAO,
    "",
    "## Sistema de Scoring",
    VILLA_SCORING,
    "",
    "## Segmentos Estratégicos",
    VILLA_SEGMENTOS,
    "",
    "## Clientes Estratégicos",
    VILLA_CLIENTES_ESTRATEGICOS,
  ].join("\n");
}
