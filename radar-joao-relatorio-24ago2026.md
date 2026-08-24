# RESUMO DA SEMANA — RADAR JOÃO
**Data da execução:** 24 de agosto de 2026
**Agente:** João — Hunter e Centro de Inteligência Comercial
**Cobertura:** Brasil completo — 4 Pilares + 14 Segmentos Setoriais Ampliados (Pilar 1)

---

## ⚠️ ALERTA TÉCNICO — POST /api/agent/dossie fora do ar (erro 500)

Diferente da pendência de allowlist de rede já documentada no CLAUDE.md (resolvida em 11/07), esta rodada encontrou um **problema novo e distinto**:

- `GET /api/agent/dossies` → funcionou normalmente (HTTP 200, 84 dossiês carregados).
- `POST /api/agent/morgana-frias` → funcionou normalmente (HTTP 200).
- `POST /api/agent/dossie` → **retornou HTTP 500 com corpo vazio em todas as 31 tentativas**, incluindo com payloads mínimos de teste (`{"titulo":"...","score":10,"prioridade":"MEDIA","tipo":"OBRA"}`). Testado com retry após pausa — erro persistente.

Isso indica que **não é bloqueio de rede/allowlist** (a rede está liberada — GET e o outro endpoint POST funcionam), e sim um **bug no backend do endpoint `/api/agent/dossie`** (provável erro de validação/schema no servidor, já que até payloads mínimos falham). Recomenda-se investigação técnica prioritária nesse endpoint específico.

**Consequência:** os 31 dossiês qualificados desta rodada (score ≥ 50) não puderam ser criados automaticamente. Os payloads completos, prontos para lançamento manual ou reprocessamento assim que o endpoint for corrigido, estão no arquivo:
📄 `radar-joao-payloads-manuais-24ago2026.json`

**Nota de transparência:** durante o diagnóstico do problema, uma requisição de teste com dados fictícios ("Teste"/"Teste") foi enviada por engano ao endpoint `morgana-frias` antes de eu perceber que ele funcionava normalmente — um e-mail de teste com 1 lead fictícia chegou à caixa da Morgana. Peço desculpas pelo ruído; o e-mail correto com as 3 leads frias reais desta rodada foi enviado logo em seguida.

---

## Pilar 1 — Obras (incluindo Segmentos Setoriais Ampliados)
- **Obras/projetos examinados nesta rodada:** ~16 buscas direcionadas cobrindo construtoras, rodovias, ferrovias, portos, aeroportos, mineração, celulose, energia, saneamento, óleo e gás, data centers, siderurgia/cimento, grandes indústrias e agronegócio, em todas as regiões do Brasil.
- **Qualificados (score ≥ 50):** 16
- **Leads QUENTES (≥80):** 5 (CSN Mineração, Petrobras UFN-3, Omnia Data Centers, Compesa Adutora do Agreste, Rumo Malha Paulista)
- **Leads MÉDIOS/ALTA (50–79):** 11
- **Nota de deduplicação:** Bracell Bataguassu/MS obteve Licença Prévia em jul/2026 — dossiê já existe no CRM, não foi recriado; recomenda-se apenas atualizar a fase manualmente para "Licenciamento".

## Pilar 2 — Empresas
- **Movimentações identificadas:** 7 sinais de expansão/nova unidade
- **Leads gerados (score ≥ 50):** 6 (Satarem America/PR, Natville/AL, Grupo NBR/PE, Magnésio do Nordeste/CE, Tambaú Alimentos/PE, CPFL-State Grid/RN)
- **Descartado por duplicidade:** Petrobras UFN-3 (mesmo projeto encontrado com mais detalhe pelo Pilar 1 — consolidado em um único dossiê)

## Pilar 3 — Movimentações Estratégicas
- **Sinais estratégicos pré-obra detectados:** 7
- **Leads gerados (score ≥ 50):** 5 (Vale Projeto Bacaba/PA, Aena MG — 3 aeroportos, Grupo Aroeira-Biomil Etanol/MG, ANTAQ Terminal NAT01/RN, Aena Castro Pinto/PB)
- **Atualização de dossiê existente:** Bracell Bataguassu/MS — Licença Prévia concedida (ver nota no Pilar 1)
- **Descartado por duplicidade:** ANTAQ Terminal IQI-16/MA (mesmo achado do Pilar 1, consolidado)

## Pilar 4 — Pessoas
- **Mudanças de cargo identificadas:** 7
- **Oportunidades de relacionamento qualificadas (score ≥ 50):** 4 (Jeferson W. Peconick — Rota da Celulose BR-262/MS; Rodrigo Penha — HM Engenharia/SP; Arnaldo Krimberg Filho — BRZ Empreendimentos/SP; Thales Oliveira — GML Engenharia/MG)
- **Leads frias (score < 50), enviadas à Morgana:** 3 (Leandro Montes — Deerns/SP, score 45; Luiz Eduardo Osorio — Norte Energia/PA, score 38; Vinícius Benevides — CBIC/RJ, score 32)

## Total desta rodada
**31 dossiês qualificados (score ≥ 50)** identificados e preparados — **0 criados automaticamente** devido ao erro 500 do endpoint `/api/agent/dossie` (ver alerta técnico acima). Todos os payloads estão prontos em `radar-joao-payloads-manuais-24ago2026.json` para lançamento manual ou reprocessamento automático assim que o bug for corrigido.
**Email de leads frias:** ✅ Enviado para Morgana — 3 leads reais (mais 1 envio de teste indevido, ver nota de transparência acima).

---

## Top 3 Oportunidades da Semana

**1. CSN Mineração — Planta Itabirito P15 (Complexo Casa de Pedra) — Congonhas/MG — Score: 92 — QUENTE**
R$ 8 bilhões no projeto total (R$ 3 bi+ só em 2026). Nova planta de beneficiamento de minério de ferro (16,5 Mt/ano). Obra já mobilizada: drenagem, infraestrutura e concretagem de túneis de alimentação em execução agora. Próxima ação: contatar CSN Mineração via filial de BH da Villa.

**2. LEAD — Jeferson W. Peconick, Diretor de Engenharia e Operações da Rota/Caminhos da Celulose (BR-262) — MS — Score: 90 — QUENTE**
Concessão de R$10,1 bi (R$6,9 bi de CAPEX) para duplicação de 115km, 457km de acostamento, 245km de terceira faixa e 20 pontes na BR-262 entre Três Lagoas e Campo Grande/MS. Decisor técnico identificado diretamente. Próxima ação: abordagem comercial direta via contato de engenharia.

**3. Petrobras — Retomada UFN-3, Fábrica de Fertilizantes Nitrogenados — Três Lagoas/MS — Score: 88 — ALTA**
R$5 bi para retomar a maior obra industrial parada do país (81% concluída), com múltiplos consórcios EPC contratados e ~8 mil empregos na construção. Próxima ação: mapear os consórcios EPC (Coesa, Nova Engevix/PowerChina, Enfil/Carioca, Monto/Mendes Júnior) para identificar responsável por concretagem.

---

## Todos os Leads Qualificados (score ≥ 50) — pendentes de lançamento manual

| # | Empresa/Pessoa | Título | Cidade/UF | Segmento | Score | Prioridade |
|---|---|---|---|---|---|---|
| 1 | CSN Mineração | Planta Itabirito P15 | Congonhas/MG | Mineração | 92 | URGENTE |
| 2 | Rota/Caminhos da Celulose | LEAD — Jeferson W. Peconick | Três Lagoas/MS | Rodovias | 90 | URGENTE |
| 3 | Aena Brasil | Modernização Aeroportos MG | Uberlândia/MG | Aeroportos | 88 | ALTA |
| 4 | Petrobras | Retomada UFN-3 | Três Lagoas/MS | Grandes Indústrias | 88 | ALTA |
| 5 | Omnia Data Centers | Campus de IA Porto do Pecém | São Gonçalo do Amarante/CE | Data Centers | 86 | ALTA |
| 6 | Satarem America | Fábrica de SAF | Maringá/PR | Grandes Indústrias | 86 | ALTA |
| 7 | Compesa | Adutora do Agreste | Bezerros/PE | Saneamento | 87 | ALTA |
| 8 | Natville | Nova Fábrica de Laticínios | Batalha/AL | Grandes Indústrias | 81 | ALTA |
| 9 | Rumo Logística | Expansão Malha Paulista | Interior de SP | Ferrovias | 80 | ALTA |
| 10 | Grupo NBR | Fábrica Automotiva | Goiana/PE | Grandes Indústrias | 78 | ALTA |
| 11 | HM Engenharia | LEAD — Rodrigo Penha | São Paulo/SP | Construção Civil | 78 | ALTA |
| 12 | Grupo Aroeira/Biomil | Planta de Etanol de Cereais | Tupaciguara/MG | Agronegócio | 78 | ALTA |
| 13 | ANTAQ | Terminal SSB01, Porto São Sebastião | São Sebastião/SP | Portos | 76 | ALTA |
| 14 | Neoenergia PE | Subestações Arcoverde/Petrolina | Arcoverde/PE | Energia | 74 | ALTA |
| 15 | Shopping Recife | Torre MedCenter + Gourmet Park | Recife/PE | Grandes Indústrias | 73 | ALTA |
| 16 | Sanepar | 15 Obras de Grande Porte | Curitiba/PR | Saneamento | 72 | ALTA |
| 17 | Infra S.A. | FIOL Trecho II | Caetité/BA | Ferrovias | 72 | ALTA |
| 18 | Irani | Projeto Gaia XII | Santa Luzia/MG | Celulose e Papel | 71 | ALTA |
| 19 | Magnésio do Nordeste | Fábrica de Autopeças em Magnésio | Quixeramobim/CE | Grandes Indústrias | 71 | ALTA |
| 20 | Amaggi | Pacote Industrial MT | Mato Grosso/MT | Agronegócio | 68 | MEDIA |
| 21 | Vale S.A. | Projeto Bacaba (Cobre) | Canaã dos Carajás/PA | Mineração | 68 | MEDIA |
| 22 | Compesa | ETA São Francisco | Petrolina/PE | Saneamento | 67 | MEDIA |
| 23 | Rumo Logística | Terminal Dom Aquino | Rondonópolis/MT | Ferrovias | 64 | MEDIA |
| 24 | Coamo | Usina de Etanol de Milho | Campo Mourão/PR | Agronegócio | 63 | MEDIA |
| 25 | BRZ Empreendimentos | LEAD — Arnaldo Krimberg Filho | Campinas/SP | Construção Civil | 62 | MEDIA |
| 26 | ANTAQ | Terminal IQI-16, Porto do Itaqui | São Luís/MA | Portos | 58 | MEDIA |
| 27 | Tambaú Alimentos | Expansão Fabril | Custódia/PE | Grandes Indústrias | 56 | MEDIA |
| 28 | ANTAQ | Terminal NAT01, Porto de Natal | Natal/RN | Portos | 52 | MEDIA |
| 29 | GML Engenharia | LEAD — Thales Oliveira | Belo Horizonte/MG | Construção Civil | 52 | MEDIA |
| 30 | CPFL/State Grid | Projetos Solares Fotovoltaicos | Touros/RN | Energia | 50 | MEDIA |
| 31 | Aena Brasil | Expansão Aeroporto Castro Pinto | João Pessoa/PB | Aeroportos | 50 | MEDIA |

*(Detalhes completos de cada lead — resumo, fase, fonte, link, decisor — estão no arquivo `radar-joao-payloads-manuais-24ago2026.json`, no formato exato exigido pela API `/api/agent/dossie`.)*

---

## Leads Frias Enviadas à Morgana (score < 50)

| Pessoa | Empresa | Cidade/UF | Score | Motivo |
|---|---|---|---|---|
| Leandro Montes | Deerns (consultoria) | São Paulo/SP | 45 | Especificador técnico indireto, não comprador direto |
| Luiz Eduardo Osorio | Norte Energia (Belo Monte) | Altamira/PA | 38 | Fase de concretagem já concluída, agenda operacional |
| Vinícius Benevides | CBIC / Dimensional Engenharia | Rio de Janeiro/RJ | 32 | Conector institucional, não decisor de compra |

---

## Regiões com Maior Atividade
1. **Pernambuco (PE)** — 5 oportunidades: Compesa Adutora do Agreste, Grupo NBR Goiana, Shopping Recife, Neoenergia subestações, Compesa ETA Petrolina.
2. **Mato Grosso do Sul (MS)** — 2 oportunidades de altíssimo valor: Petrobras UFN-3 e Rota da Celulose BR-262 (mesma praça, Três Lagoas).
3. **Minas Gerais (MG)** — 5 oportunidades: CSN Mineração, Aena (3 aeroportos), Irani Gaia XII, Grupo Aroeira, e o lead de pessoa Thales Oliveira/GML.
4. **Mato Grosso (MT)** — 3 oportunidades: Amaggi, Rumo Dom Aquino, mais monitoramento de INPASA (já no CRM).
5. **Paraná (PR)** — 3 oportunidades: Satarem SAF, Sanepar, Coamo.
6. **Nordeste em geral (AL, CE, MA, RN, PB)** — 6 oportunidades dispersas: Natville, Magnésio do Nordeste, ANTAQ Itaqui, ANTAQ Natal, CPFL solar, Aena Castro Pinto.

## Segmentos com Mais Achados
Grandes Indústrias (7), Saneamento (3), Portos (3), Ferrovias (3), Aeroportos (2), Agronegócio (3), Mineração (2), Energia (2), Construção Civil/pessoas (3), Celulose e Papel (1), Data Centers (1).

## Próximas Ações Comerciais Sugeridas
1. **Prioridade máxima:** resolver o erro 500 do endpoint `/api/agent/dossie` — nenhum dos 31 leads desta rodada entrou automaticamente no CRM. Repassar o alerta técnico deste relatório para quem mantém a API.
2. Lançar manualmente (ou via reprocessamento do JSON) os 5 leads QUENTES no topo da tabela assim que possível — são os de maior potencial e menor janela de oportunidade (CSN Mineração e Petrobras UFN-3 já estão com obra mobilizada).
3. Abordagem comercial direta via contato de engenharia identificado: Jeferson W. Peconick (BR-262/MS) — decisor técnico nomeado, alto potencial.
4. Atualizar manualmente o dossiê existente da Bracell Bataguassu/MS para fase "Licenciamento" (Licença Prévia concedida em jul/2026).
5. Acompanhar o leilão do Terminal SSB01 (Porto de São Sebastião), repetidamente adiado — monitorar definição de data em rodadas futuras.
6. Filial de Recife: priorizar o cluster de leads pernambucanos (Compesa, Grupo NBR, Neoenergia, Shopping Recife) dado o alto número de oportunidades concentradas na região de cobertura natural.
