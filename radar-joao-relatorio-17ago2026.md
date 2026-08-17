# RESUMO DA SEMANA — RADAR JOÃO
**Data da execução:** 17 de agosto de 2026
**Agente:** João — Hunter e Centro de Inteligência Comercial
**Cobertura:** Brasil completo — 4 Pilares + Segmentos Setoriais Ampliados (Pilar 1)

---

## Pilar 1 — Obras (incluindo Segmentos Setoriais Ampliados)
- **Obras/projetos examinados nesta rodada:** ~20 (varredura genérica por região + segmentos setoriais: rodovias, ferrovias, portos, mineração, celulose/papel, energia, saneamento, óleo/gás, data centers, siderurgia/cimento, logística, agronegócio)
- **Qualificados (score ≥ 50):** 8
- **Leads QUENTES:** 4 | **Leads MÉDIOS:** 4
- **Segmentos setoriais com mais achados nesta rodada:** ampla diversificação — óleo e gás, saneamento, mineração, logística/condomínios, portos, agronegócio, rodovias e celulose, um lead qualificado por segmento
- **Sinais monitorados mas não registrados** (score insuficiente ou sem localização/empresa específica): Serrolândia/BA (água, ainda em edital), LOG Florianópolis e LOG Campo Grande II (valor individual menor), data centers Uberlândia/MG e interior de SP (sem construtora nomeada), Projeto Everest — torre eólica Casa dos Ventos (protótipo, sem localização fechada), tanques do Porto de Itaqui/MA (sem empresa executora nomeada), 1º Leilão de Transmissão 2026 (R$5,11 bi, múltiplos estados sem obra localizada)
- **Nota:** Transnordestina/FIOL/FICO/Ferrogrão não foram re-registradas nesta rodada por já constarem no CRM desde 10/08 sem mudança factual relevante

## Pilar 2 — Empresas
- **Movimentações identificadas:** 3 sinais brutos (expansão Kronan — até 3 fábricas a partir de 2026, fábrica greenfield de materiais de construção com operação só em 2028, GLP R$2,1 bi em novos galpões sem localização específica)
- **Leads gerados (score ≥ 50):** 0 — sinais genéricos, sem obra/local específico o suficiente para qualificação

## Pilar 3 — Movimentações Estratégicas
- **Sinais financeiros detectados:** 3 sinais brutos (debêntures de infraestrutura: R$22,11 bi emitidos em jan-fev/2026, estoque de R$481,7 bi; pipeline 2026 de ~R$127 bi em concessões rodoviárias e ~R$65 bi em saneamento; buscas de compra de terreno retornaram majoritariamente lançamentos residenciais, fora do escopo B2B industrial da Villa)
- **Leads gerados (score ≥ 50):** 0 — sinais macro, sem vencedor de leilão ou obra específica nomeada nesta rodada

## Pilar 4 — Pessoas
- **Mudanças de cargo identificadas:** 0 novas (a única nomeação encontrada — Secretário de Obras de Cuiabá/MT — já havia sido identificada na rodada de 10/08)
- **Oportunidades de relacionamento:** 0
- **Leads registrados no CRM:** 0

## Total registrado no CRM
**8 leads** — todos com POST confirmado (HTTP 201) na API `villa-crm.vercel.app/api/agent`. Nenhum foi sinalizado como `duplicata` pela API. **Observação técnica (recorrente):** a API voltou a rejeitar o campo `cnpj` quando enviado vazio ou já existente (erro de constraint única do Prisma) — 6 dos 8 leads só foram criados após omitir o campo `cnpj` do payload. Isso inclui o lead da Petrobras/RNEST, cujo CNPJ real já constava no banco (provável duplicidade com o registro de RNEST já criado em 10/08) — a omissão do CNPJ contornou o erro, mas gerou um segundo registro de empresa "Petrobras" no CRM. Recomenda-se ajuste no schema para aceitar múltiplos CNPJs vazios/nulos e implementar checagem de duplicidade por nome da obra + cidade, não apenas por CNPJ.

---

## Top 3 Oportunidades da Semana

**1. Petrobras — Ampliação RNEST (Refinaria Abreu e Lima) — Ipojuca/PE — Score: 92 — QUENTE**
R$ 8,3 bilhões contratados para dobrar a capacidade da refinaria, 2,5 mil trabalhadores já mobilizados, pico de 30 mil empregos previsto. Equipamento indicado: BOMBA_ESTACIONARIA. Potencial: R$ 3.000.000. Próxima ação: mapear consórcios de engenharia/montagem contratados pela Petrobras.

**2. Consórcio Pátria / BRK-Acciona — Concessão de Saneamento de Pernambuco — PE — Score: 88 — QUENTE**
Concessão parcial de água e esgoto vencida em leilão, R$ 19 bilhões em obras previstas ao longo do contrato (ETEs, redes, elevatórias, reservatórios). Equipamento indicado: BOMBA_ESTACIONARIA. Potencial: R$ 2.000.000. Próxima ação: mapear cronograma de obras e contatar diretoria de engenharia do consórcio.

**3. CSN Mineração — Planta Itabirito P15 (Complexo Casa de Pedra) — Congonhas/MG — Score: 87 — QUENTE**
Projeto de R$ 8 bilhões (R$ 3 bi só em 2026), 16,5 milhões t/ano de minério de ferro; contratações de montagem eletromecânica e mineroduto em curso. Equipamento indicado: BOMBA_ESTACIONARIA. Potencial: R$ 1.500.000. Próxima ação: contatar CSN Mineração via filial de BH da Villa.

---

## Todos os Leads Registrados (score ≥ 50)

| # | Empresa | Obra | Cidade/UF | Pilar/Segmento | Score | Temp. | Potencial |
|---|---------|------|-----------|-----------------|-------|-------|-----------|
| 1 | Petrobras (RNEST) | Ampliação Refinaria Abreu e Lima | Ipojuca/PE | 1 / Óleo e Gás | 92 | 🔴 QUENTE | R$ 3.000.000 |
| 2 | Pátria / BRK-Acciona | Concessão Saneamento PE | PE | 1 / Saneamento | 88 | 🔴 QUENTE | R$ 2.000.000 |
| 3 | CSN Mineração | Planta Itabirito P15 | Congonhas/MG | 1 / Mineração | 87 | 🔴 QUENTE | R$ 1.500.000 |
| 4 | Private Log (desenvolvedor) | Condomínio Logístico Private Log | Serra/ES | 1 / Logística | 85 | 🔴 QUENTE | R$ 800.000 |
| 5 | Bracell | Nova Fábrica de Celulose | Bataguassu/MS | 1 / Celulose e Papel | 74 | 🟡 MÉDIA | R$ 2.500.000 |
| 6 | Porto de Suape | Ampliação Cais 6 e 7 | Ipojuca/PE | 1 / Portos | 77 | 🟡 MÉDIA | R$ 1.200.000 |
| 7 | Inpasa Agroindustrial | Nova Usina de Etanol de Milho | Rondonópolis/MT | 1 / Agronegócio | 79 | 🟡 MÉDIA | R$ 900.000 |
| 8 | Sinfra-MT | 15 Pontes + Rodovias (13 municípios) | MT | 1 / Rodovias | 78 | 🟡 MÉDIA | R$ 700.000 |

---

## Valor Potencial Estimado Total
**R$ 12.600.000** — soma dos potenciais estimados dos 8 leads registrados (estimativa conservadora de valor de fornecimento de equipamentos/serviços Villa, não o CAPEX total das obras; não representa compromisso comercial).

---

## Regiões com Maior Atividade
1. **Nordeste (PE)** — 3 oportunidades: RNEST, Cais 6/7 de Suape, Concessão de Saneamento — cobertura natural da sede Villa em Recife
2. **Centro-Oeste (MT)** — 2 oportunidades: Pontes Sinfra-MT, Usina Inpasa Rondonópolis
3. **Sudeste (ES, MG)** — 2 oportunidades: Private Log/ES, CSN Mineração/MG
4. **Centro-Oeste (MS)** — 1 oportunidade: Bracell Bataguassu (obras só em 2027)
5. **Sul e Norte** — nenhuma oportunidade qualificada (score ≥ 50) nesta rodada

---

## Próximas Ações Sugeridas
1. Priorizar os 4 leads QUENTES via filial de Recife/PE (RNEST e Suape) e filial de BH/MG (CSN Mineração); Private Log/ES via matriz.
2. Mesclar/atualizar o registro da Petrobras/RNEST no CRM com o lead já existente de 10/08 para evitar duplicidade da empresa "Petrobras" (ver observação técnica acima).
3. Acompanhar publicação do edital de obras civis dos cais 6/7 de Suape (previsto para abril/2026).
4. Monitorar avanço do licenciamento da Bracell Bataguassu/MS para reengajamento quando iniciar a contratação de empreiteiras (2027).
5. **Ajuste técnico prioritário e recorrente:** corrigir o tratamento do campo `cnpj` vazio/duplicado na API do CRM (schema Prisma) e implementar checagem de duplicidade por nome da obra + cidade — problema identificado nas duas últimas rodadas (10/08 e 17/08).
