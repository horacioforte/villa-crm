// ─────────────────────────────────────────────────────────────────────────────
// Base de conhecimento do Analisador de Contratos da Villa Empreendimentos.
// Portada 1:1 do app standalone `villa-contratos` (src/App.jsx) — mesmo texto das
// 21 Regras de Ouro e das propostas padrão. Não alterar o conteúdo sem validar
// com o time comercial/jurídico da Villa.
// ─────────────────────────────────────────────────────────────────────────────

import type { TipoContrato } from "@/app/generated/prisma/client";

import { TIPO_CONTRATO_LABELS } from "@/lib/validations/contrato";

export const GOLDEN_RULES = `
REGRAS DE OURO DA VILLA EMPREENDIMENTOS (INEGOCIÁVEIS):
1. FERIADOS/PARADOS: Não será concedido NENHUM desconto por dias parados devido a feriados, recessos ou períodos festivos indicados pela Contratante.
2. DIÁRIAS GEOGRÁFICAS: Diárias apenas em São Paulo até 30km da base de Barra Funda–SP. Acima de 30km precisa de autorização prévia da Villa.
3. MOBILIZAÇÃO/DESMOBILIZAÇÃO: Devem ser cobradas OBRIGATORIAMENTE na primeira fatura/medição.
4. PROPOSTA ANEXADA: A proposta deve SEMPRE ser anexada ao contrato.
5. CONCRETO PERDIDO: A Villa NÃO paga em hipótese alguma por concreto perdido (slump, traço, vencido, desagregado, etc.).
6. DISTÂNCIA >30KM: Acima de 30km sem ser mobilização/desmobilização, responsabilidade é do cliente.
7. SUL/CENTRO-OESTE: Verificar se mobilização sai de Barra Funda-SP ou Bezerros-PE (o que for mais barato).
8. CUSTOS DO OPERADOR: A Villa NÃO se responsabiliza por hospedagem, alimentação e transporte dos operadores — são custos adicionais do cliente.
9. PRAZO DE CONSERTO: Prazo mínimo de 48h a 72h para consertos nos equipamentos que são de responsabilidade da Villa.
10. MAPAS DIÁRIOS: Obrigatório mapas diários do trabalho dos operadores/motoristas, assinados diariamente pelo cliente.
11. CONCLUSÃO DIÁRIA: Serviços concluídos após lavagem do equipamento (~1h após o término).
12. INTERVALO INTERJORNADA: Horários de trabalho devem respeitar 11h de descanso entre jornadas (lei vigente).
13. MÊS = 30 DIAS: Para cálculo proporcional, mês é sempre 30 dias corridos, independente do calendário.
14. INÍCIO DO CONTRATO: Contrato começa na chegada do equipamento na obra, mesmo que fique parado aguardando trâmites do cliente.
15. DURAÇÃO MÍNIMA: Locação mínima de 90 dias (3 meses). SEM EXCEÇÃO.
16. MULTA POR DEVOLUÇÃO ANTECIPADA: Devolução antes de 3 meses = pagar mensalidades restantes integralmente sem abatimento.
17. AVISO PRÉVIO DESMOBILIZAÇÃO: Mínimo de 10 a 15 dias de antecedência para aviso de desmobilização.
18. FATURAMENTO 90/10: Modelo padrão: 90% equipamento (fatura) + 10% pessoas (NF). Exceção: CBSO é 100% fatura de locação.
19. PRAZO DE PAGAMENTO: Cliente tem 15 a 30 dias para pagamento após medição enviada.
20. APROVAÇÃO TÁCITA: Cliente tem 5 dias para aprovar a medição. Se não aprovar, faturamento ocorre automaticamente (tácito).
21. REAJUSTE: Reajuste anual pelo IPCA (referência FGV para construção civil).
`;

export const PROPOSALS_BY_TIPO: Record<TipoContrato, string> = {
  CAMINHAO_BETONEIRA: `
PROPOSTA CAMINHÃO BETONEIRA COM OPERADOR (CBCO):
- Equipamento: Caminhão betoneira 8m³ VW 26.280 ou similar, ano 2020-2024, AR condicionado
- Horas garantidas: 200h/mês; hora extra: R$ 225,00/h
- Mensalidade unitária: R$ 45.000,00
- Mobilização: R$ 14,00/km (Bezerros-PE ou Barra Funda-SP), pago antecipadamente
- Turno padrão: Seg-Qui 07h-17h, Sex 07h-16h (1h intervalo); sáb/dom/feriado = extra
- Faturamento: 90% equipamento (fatura) + 10% mão de obra (NF)
- Prazo aprovação medição: 5 dias corridos (faturamento tácito após)
- Pagamento: boleto, até 15º dia corrido após fechamento de medição
- Reajuste: semestral pelo IPCA/FGV
- Prazo mínimo: 3 meses; devolução antecipada = pagar mensalidades restantes integralmente
- Aviso desmobilização: mínimo 15 dias
- Responsabilidade da Contratante: combustível/insumos, hospedagem/alimentação/transporte do operador, local de lavagem, guarda e segurança, mapas diários assinados

PROPOSTA CAMINHÃO BETONEIRA SEM OPERADOR (CBSO):
- Equipamento: Caminhão betoneira 8m³ VW/Mercedes/Volvo, ano 2019-2025, AR condicionado
- Horas garantidas: 180h/mês (horímetro); hora extra: R$ 166,67/h
- Mensalidade unitária: R$ 30.000,00
- Mobilização/desmobilização: por conta da Locatária (retirada e devolução na sede em Bezerros-PE)
- Faturamento: 100% fatura de locação de equipamento (sem split 90/10)
- Pagamento: boleto, até 25 dias após aprovação da medição
- Reajuste: semestral pelo IPCA/FGV
- Prazo mínimo: 3 meses; devolução antecipada = multa equivalente ao valor de 3 meses de franquia
- Aviso desmobilização: mínimo 15 dias
- Responsabilidade da Locatária: operação, combustível/insumos, manutenção corretiva, guarda e segurança, tacógrafo, mapas diários, devolução na sede
`,
  AUTO_BOMBA: `
PROPOSTA AUTO BOMBA COM LANÇA (ABL) — COM OPERADOR:
- Equipamento: Auto bomba com lança Schwing ou similar (32m, 36m, 38m, 42/43m, 56/58m)
- Mobilização/desmobilização: R$ 14,00/km, cobrada na 1ª fatura, saindo de Bezerros-PE ou Barra Funda-SP
- Mensalidade: 32m=R$99.000 (1.800m³ mín), 36m/38m=R$110.000 (2.000m³ mín), 42/43m=R$121.000 (2.200m³ mín), 56/58m=R$227.500 (3.500m³ mín)
- Valor m³: R$ 55,00 (exceto 56/58m = R$ 65,00)
- Hora extra: R$ 350,00/h (32-42m), R$ 450,00/h (56/58m)
- Turno padrão: Seg-Qui 07h-17h, Sex 07h-16h (1h intervalo)
- Faturamento: 90% equipamento (fatura) + 10% mão de obra (NF)
- Prazo aprovação medição: 5 dias (faturamento tácito após)
- Pagamento: boleto, até 15º dia corrido do fechamento de medição
- Reajuste: anual pelo IPCA/FGV
- Prazo mínimo: 3 meses; devolução antecipada = pagar mensalidades restantes integralmente
- Responsabilidade da Contratante: hospedagem/alimentação/transporte do operador, combustível/insumos, local de lavagem, guarda e segurança, mapas diários

PROPOSTA AUTO BOMBA ESTACIONÁRIA COM OPERADOR (ABE):
- Equipamento: Auto bomba estacionária Schwing ou similar, com operador
- Volume mínimo mensal: 1.200 m³; valor por m³: R$ 50,00
- Mobilização/desmobilização: R$ 14,00/km, pago antecipadamente, saindo de Bezerros-PE ou Barra Funda-SP
- Hora extra: R$ 350,00/h
- Turno padrão: Seg-Qui 07h-17h, Sex 07h-16h (1h intervalo)
- Faturamento: 90% equipamento (fatura) + 10% mão de obra (NF)
- Pagamento: boleto, até 15º dia corrido do fechamento de medição
- Reajuste: semestral pelo IPCA/FGV
- Prazo mínimo: 3 meses; devolução antecipada = pagar mensalidades restantes integralmente
- Equipamentos >30km: obrigatório contratar seguro total + taxa adicional por km excedente
- Responsabilidade da Contratante: hospedagem/alimentação/transporte do operador, combustível/insumos, local de lavagem, guarda e segurança, mapas diários
`,
  USINA_CONCRETO: `Não há proposta padrão de Usina de Concreto cadastrada. Analise com base nas Regras de Ouro gerais.`,
  GERAL_OUTRO: `Analise com base exclusivamente nas Regras de Ouro gerais da Villa Empreendimentos.`,
};

export function buildAnalisePrompt(tipoContrato: TipoContrato) {
  const label = TIPO_CONTRATO_LABELS[tipoContrato];

  return `Você é especialista jurídico-comercial da Villa Empreendimentos, empresa de locação de equipamentos para bombeamento e transporte de concreto. Analise o contrato enviado pelo cliente comparando com os parâmetros da Villa.

=== REGRAS DE OURO (INEGOCIÁVEIS) ===
${GOLDEN_RULES}

=== PROPOSTA PADRÃO VILLA — TIPO: ${label} ===
${PROPOSALS_BY_TIPO[tipoContrato]}

Retorne SOMENTE JSON válido sem markdown:
{
  "tipoDetectado": "tipo identificado",
  "partes": ["Parte 1","Parte 2"],
  "prazo": "prazo identificado",
  "valor": "valor/mensalidade",
  "reajuste": "índice/periodicidade",
  "riscoGeral": "Baixo" ou "Médio" ou "Alto",
  "resumo": "2-3 frases sobre o contrato",
  "conformes": [{"regra":"nome","detalhe":"como está no contrato"}],
  "conflitos": [{"regra":"item","contratoCliente":"o que diz","villaEspera":"o que a Villa exige","gravidade":"Alta" ou "Média" ou "Baixa"}],
  "violacoesRegrasDeOuro": [{"numero":1,"regra":"texto","problema":"como viola"}],
  "clausulasFaltando": [{"clausula":"nome","importancia":"Alta" ou "Média","descricao":"por que é importante"}],
  "recomendacoes": [{"acao":"ação recomendada","prioridade":"Alta" ou "Média" ou "Baixa"}]
}
Seja rigoroso. Qualquer desvio das Regras de Ouro é uma violação. Cite trechos do contrato quando possível.`;
}
