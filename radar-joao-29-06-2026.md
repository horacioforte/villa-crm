# RESUMO DA SEMANA — RADAR JOÃO
**Data:** 29/06/2026 (segunda-feira)
**Agente:** João — Hunter & Inteligência Comercial — Villa Empreendimentos

---

## SUMÁRIO EXECUTIVO

| Pilar | Oportunidades encontradas | Qualificadas (≥50) | QUENTES | MÉDIAS |
|-------|--------------------------|---------------------|---------|--------|
| 1 — Obras | 10 | 9 | 7 | 2 |
| 2 — Empresas | 3 | 1 | 0 | 1 |
| 3 — Movim. Estratégicas | 4 | 2 | 0 | 2 |
| 4 — Pessoas | 2 | 0 | 0 | 0 |
| **TOTAL** | **19** | **12** | **7** | **5** |

> ⚠️ **Nota técnica:** A rede do ambiente de execução bloqueia chamadas diretas a domínios externos não autorizados. Os 12 leads qualificados estão detalhados abaixo com payloads JSON prontos para POST em `https://villa-crm.vercel.app/api/agent`. Recomenda-se disparar via webhook ou executor de scripts com acesso à internet.

---

## TOP 3 OPORTUNIDADES DA SEMANA

### 🥇 1. Ada Infrastructure GRU10 — Guarulhos/SP — Score: 96/100
Data center campus de **300 MW** em construção ativa em Guarulhos/SP. Investimento de **R$ 2,7 bilhões**, 18 a 24 meses de obras, mobilizando até 1.000 trabalhadores no canteiro. Consumo massivo de concreto para fundações e lajes. Filial Villa SP pode atender diretamente. Equipamentos indicados: **Bomba Lança 36–52m + Bomba Estacionária**.

### 🥈 2. Private Log — Serra/ES — Score: 95/100
Maior condomínio logístico do Brasil: **620.000 m² de ABL**, R$ 2,5 bilhões de investimento total. Primeira fase de 190.000 m² com entrega prevista em **2026** — obra em andamento. Obra civil de enorme escala com alto consumo de concreto. Equipamento indicado: **Bomba Lança 36–52m + Bomba Estacionária**.

### 🥉 3. GLP Guarulhos III — Guarulhos/SP — Score: 93/100
Terceiro parque logístico da GLP em Guarulhos: **252.000 m²**, parte do ciclo de R$ 2,1 bilhões anunciado para o Brasil. Obras iniciadas, todas as naves com previsão de conclusão **ao longo de 2026**. Filial Villa SP a poucos quilômetros. Equipamento indicado: **Bomba Lança + Bomba Estacionária**.

---

## PILAR 1 — OBRAS

### Lead 1.1 — Ada Infrastructure GRU10 | Guarulhos/SP | Score: 96 | 🔴 QUENTE
**Empresa:** Ada Infrastructure  
**Projeto:** Campus GRU10 — data center 300 MW, R$ 2,7 bilhões  
**Status:** Obras iniciadas em 2026, 18–24 meses de construção, 1.000 operários  
**Local:** Rod. Edgard Máximo Zambotto, km 42,5 — Guarulhos/SP  
**Fonte:** Data Center Dynamics, Telesíntese, EPowerBay  
**Equipamento indicado:** Bomba Lança 36–52m + Bomba Estacionária  
**Potencial estimado:** R$ 2.500.000

```json
{
  "empresa": {
    "razaoSocial": "Ada Infrastructure",
    "cnpj": "",
    "segmento": "Tecnologia / Data Center",
    "cidade": "Guarulhos",
    "estado": "SP",
    "observacoes": "Fonte: Data Center Dynamics / Telesíntese. Campus GRU10 em construção ativa, R$ 2,7 bilhões, 300 MW de capacidade total, 1.000 trabalhadores no canteiro, 18-24 meses de obra. Pilar: 1. Score: 96/100."
  },
  "obra": {
    "nome": "Campus GRU10 — Ada Infrastructure",
    "descricao": "Data center campus de 300MW em Guarulhos/SP. Obras iniciadas em 2026 com 2 subestações dedicadas. Altíssimo consumo de concreto para fundações, lajes e estruturas. Investimento total de R$ 2,7 bilhões.",
    "cidade": "Guarulhos",
    "estado": "SP",
    "volumeEstimado": 50000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] Ada Infrastructure GRU10 / SP",
    "descricao": "Data center de 300MW em Guarulhos, R$ 2,7bi, 1.000 operários na obra. Consumo massivo de concreto — fundações e lajes. Filial Villa SP pode atender. Bomba Lança 36-52m + Bomba Estacionária. Score: 96/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 2500000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.2 — Private Log (Brookfield / LogCP) | Serra/ES | Score: 95 | 🔴 QUENTE
**Empresa:** Brookfield / LogCP (operação "Private Log")  
**Projeto:** Maior condomínio logístico do Brasil — 620.000 m² ABL, R$ 2,5 bilhões  
**Status:** 1ª fase (190.000 m²) com entrega prevista 2026 — obra em andamento  
**Local:** Serra/ES (acesso BR-101 — portos do Sudeste)  
**Fonte:** Mundo Logística, ABECE, Click Petróleo e Gás  
**Equipamento indicado:** Bomba Lança 36–52m + Bomba Estacionária  
**Potencial estimado:** R$ 2.000.000

```json
{
  "empresa": {
    "razaoSocial": "Brookfield Asset Management / LogCP",
    "cnpj": "",
    "segmento": "Logística / Condomínio Industrial",
    "cidade": "Serra",
    "estado": "ES",
    "observacoes": "Fonte: Mundo Logística, ABECE. 'Private Log' — maior condomínio logístico do Brasil. 620.000 m² ABL total, R$ 2,5 bilhões em 4 fases, 1ª fase (190k m²) entrega 2026. Pilar: 1. Score: 95/100."
  },
  "obra": {
    "nome": "Private Log — Condomínio Logístico Serra",
    "descricao": "Maior condomínio logístico do Brasil. 620.000 m² de ABL, R$ 2,5 bilhões em 4 fases. 1ª fase com 190.000 m² com previsão de entrega em 2026. Enorme consumo de concreto para galpões, vias e infraestrutura.",
    "cidade": "Serra",
    "estado": "ES",
    "volumeEstimado": 80000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] Private Log — Maior Condomínio Logístico BR / ES",
    "descricao": "620.000 m² ABL total, R$2,5bi, obra ativa em Serra/ES. 1ª fase entrega 2026. Volume de concreto excepcional para galpões e fundações. Bomba Lança + Estacionária. Score: 95/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 2000000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.3 — GLP (Guarulhos III) | Guarulhos/SP | Score: 93 | 🔴 QUENTE
**Empresa:** GLP (Global Logistic Properties)  
**Projeto:** Terceiro parque logístico em Guarulhos — 252.000 m², R$ 2,1 bilhões no Brasil  
**Status:** Obra em andamento, conclusão prevista ao longo de 2026  
**Local:** Guarulhos/SP  
**Fonte:** Metro Quadrado, ABOL  
**Equipamento indicado:** Bomba Lança 36–52m + Bomba Estacionária  
**Potencial estimado:** R$ 1.800.000

```json
{
  "empresa": {
    "razaoSocial": "GLP Brasil (Global Logistic Properties)",
    "cnpj": "",
    "segmento": "Logística / Condomínio Industrial",
    "cidade": "Guarulhos",
    "estado": "SP",
    "observacoes": "Fonte: Metro Quadrado, ABOL. 3º parque logístico GLP em Guarulhos, 252.000 m², parte de ciclo de R$2,1bi. Obra ativa com conclusão ao longo de 2026. Maior developer de galpões do Brasil. Pilar: 1. Score: 93/100."
  },
  "obra": {
    "nome": "GLP Guarulhos III — Parque Logístico",
    "descricao": "Terceiro parque logístico da GLP em Guarulhos/SP. 252.000 m² de área, obras ativas com entrega prevista ao longo de 2026. Parte do ciclo de R$ 2,1 bilhões da GLP no Brasil.",
    "cidade": "Guarulhos",
    "estado": "SP",
    "volumeEstimado": 35000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] GLP Guarulhos III — Parque Logístico / SP",
    "descricao": "252.000 m² em construção ativa, GLP maior developer do Brasil. Filial Villa SP próxima. Bomba Lança + Estacionária para lajes e estruturas dos galpões. Score: 93/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 1800000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.4 — Data Center Omnia DC | Pecém/CE | Score: 92 | 🔴 QUENTE
**Empresa:** Omnia DC  
**Projeto:** Data center no Complexo do Pecém — 200 MW inicial, expansão a 1 GW  
**Status:** Obras iniciadas (visitado pelo prefeito de Caucaia em 2026), 15.000 empregos  
**Local:** Pecém — Caucaia/CE  
**Fonte:** Leias Sempre Brasil, EAD Intec, CBIC  
**Equipamento indicado:** Bomba Lança + Bomba Estacionária  
**Potencial estimado:** R$ 2.000.000

```json
{
  "empresa": {
    "razaoSocial": "Omnia DC",
    "cnpj": "",
    "segmento": "Tecnologia / Data Center",
    "cidade": "Caucaia",
    "estado": "CE",
    "observacoes": "Fonte: Leias Sempre Brasil. Data center no Complexo do Pecém, 200MW inicial com expansão a 1GW. Obras iniciadas em 2026, 15.000 empregos diretos e indiretos. Maior investimento privado do Brasil. Pilar: 1. Score: 92/100."
  },
  "obra": {
    "nome": "Data Center Omnia DC — Complexo do Pecém",
    "descricao": "Data center de 200MW inicial (expansão a 1GW) no Complexo Industrial e Portuário do Pecém, Caucaia/CE. Obras iniciadas em 2026, potencial de 15.000 empregos. Consumo altíssimo de concreto para fundações e estruturas.",
    "cidade": "Caucaia",
    "estado": "CE",
    "volumeEstimado": 60000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] Data Center Omnia DC — Pecém / CE",
    "descricao": "200MW inicial, expansão a 1GW, maior investimento privado do Brasil em 2026. Obras ativas no Pecém/CE. Bomba Lança + Estacionária para estruturas. Villa Recife (sede) pode liderar atendimento. Score: 92/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 2000000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.5 — Transnordestina Ferroviária | CE/PI/PE | Score: 92 | 🔴 QUENTE
**Empresa:** Infra S.A. / Consórcio Transnordestina  
**Projeto:** Ferrovia Transnordestina — ~800 km, R$ 3,6 bilhões novo financiamento 2026  
**Status:** Obras ativas — 280 km em execução no CE, 75% concluído, 800 equipamentos amarelos, 2.500 operários  
**Local:** Ceará / Piauí / Pernambuco  
**Fonte:** Agência Gov, Gazeta do Povo, Click Petróleo e Gás  
**Equipamento indicado:** Bomba Estacionária + Central In Loco (pontes e viadutos)  
**Potencial estimado:** R$ 1.500.000

```json
{
  "empresa": {
    "razaoSocial": "Infra S.A. / Consórcio Transnordestina Logística",
    "cnpj": "",
    "segmento": "Infraestrutura / Ferrovia",
    "cidade": "Fortaleza",
    "estado": "CE",
    "observacoes": "Fonte: Agência Gov, Gazeta do Povo. Ferrovia Transnordestina em obras ativas, 280km no CE, R$3,6bi financiamento novo, 2.500 operários, dezenas de pontes e viadutos em concreto. Pilar: 1. Score: 92/100."
  },
  "obra": {
    "nome": "Ferrovia Transnordestina — Trecho CE/PI/PE",
    "descricao": "Maior ferrovia em construção no Brasil. ~800 km totais, 75% concluído. R$3,6bi de financiamento aprovado. 280 km em obras no CE com dezenas de pontes e viadutos de concreto. 800 equipamentos de terraplenagem e 2.500 operários.",
    "cidade": "Fortaleza",
    "estado": "CE",
    "volumeEstimado": 120000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] Transnordestina Ferroviária / CE-PI-PE",
    "descricao": "Dezenas de pontes e viadutos de concreto em obras ativas. Nordeste — região de base da Villa. Bomba Estacionária e Central In Loco indicadas para estruturas. Score: 92/100.",
    "tipoServico": "BOMBA_ESTACIONARIA",
    "potencialOportunidade": 1500000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.6 — RT-One Data Center | Uberlândia/MG | Score: 90 | 🔴 QUENTE
**Empresa:** RT-One  
**Projeto:** Data center — R$ 6 bilhões de investimento inicial  
**Status:** Início de obras previsto para 2026 (aguardando licenças), rodovia MGC-497  
**Local:** Uberlândia/MG  
**Fonte:** Olhar Digital, CBIC ENIC 2026  
**Equipamento indicado:** Bomba Lança + Bomba Estacionária  
**Potencial estimado:** R$ 2.500.000

```json
{
  "empresa": {
    "razaoSocial": "RT-One",
    "cnpj": "",
    "segmento": "Tecnologia / Data Center",
    "cidade": "Uberlândia",
    "estado": "MG",
    "observacoes": "Fonte: Olhar Digital. Data center R$6bi, início de obras 2026 na MGC-497. Maior investimento privado em data center em MG. Pilar: 1. Score: 90/100."
  },
  "obra": {
    "nome": "RT-One Data Center — Uberlândia/MG",
    "descricao": "Data center com investimento inicial de R$ 6 bilhões localizado na rodovia MGC-497, Uberlândia/MG. Início de obras previsto para 2026. Consumo elevadíssimo de concreto para fundações e estruturas.",
    "cidade": "Uberlândia",
    "estado": "MG",
    "volumeEstimado": 70000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] RT-One Data Center R$6bi / MG",
    "descricao": "R$6 bilhões investidos, data center Uberlândia/MG, obras em 2026. Filial Villa BH pode atender. Bomba Lança + Estacionária para fundações e estruturas. Score: 90/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 2500000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.7 — Concessão Metrô do Recife (CBTU) | Recife/PE | Score: 87 | 🔴 QUENTE
**Empresa:** CBTU / Futuro Concessionário  
**Projeto:** Concessão + obras do Metrô — R$ 4 bilhões, 22 novos trens, reforma de 37 estações  
**Status:** Leilão previsto para dezembro 2026; obras de reforma e substituição de infraestrutura já em andamento  
**Local:** Recife/PE (região de base da Villa)  
**Fonte:** Metrô CPTM, Jamildo, Agência Gov, PPI  
**Equipamento indicado:** Bomba Estacionária + Bomba Lança  
**Potencial estimado:** R$ 1.200.000

```json
{
  "empresa": {
    "razaoSocial": "CBTU / Governo do Estado de Pernambuco",
    "cnpj": "",
    "segmento": "Transporte / Mobilidade Urbana",
    "cidade": "Recife",
    "estado": "PE",
    "observacoes": "Fonte: Metrô CPTM, PPI. R$4bi investimento federal, leilão concessão dezembro 2026, 37 estações a reformar, 22 trens novos. Obras de infraestrutura já em andamento. Sede Villa = Recife. Pilar: 1. Score: 87/100."
  },
  "obra": {
    "nome": "Metrô do Recife — Concessão CBTU + Obras",
    "descricao": "R$ 4 bilhões investidos no Metrô do Recife pelo Governo Federal. 22 novos trens, reforma de 37 estações, substituição de dormentes de concreto (R$ 53mi já licitados). Leilão de concessão previsto para dezembro 2026, com obras se intensificando pós-concessão.",
    "cidade": "Recife",
    "estado": "PE",
    "volumeEstimado": 30000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] Metrô do Recife CBTU / PE",
    "descricao": "R$4bi em obras. Recife — base da Villa. Reforma de 37 estações + infraestrutura. Bomba Estacionária + Lança para concretagem. Score: 87/100.",
    "tipoServico": "BOMBA_ESTACIONARIA",
    "potencialOportunidade": 1200000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.8 — Scala Data Centers | Eldorado do Sul/RS | Score: 81 | 🔴 QUENTE
**Empresa:** Scala Data Centers  
**Projeto:** Maior complexo de infraestrutura digital da América Latina  
**Status:** Em preparação para construção em Eldorado do Sul/RS  
**Local:** Eldorado do Sul/RS  
**Fonte:** EAD Intec, CBIC  
**Equipamento indicado:** Bomba Lança + Bomba Estacionária  
**Potencial estimado:** R$ 1.500.000

```json
{
  "empresa": {
    "razaoSocial": "Scala Data Centers",
    "cnpj": "",
    "segmento": "Tecnologia / Data Center",
    "cidade": "Eldorado do Sul",
    "estado": "RS",
    "observacoes": "Fonte: EAD Intec. Complexo de data centers em Eldorado do Sul/RS — previsto como maior complexo de infraestrutura digital da América Latina. Em preparação para construção. Pilar: 1. Score: 81/100."
  },
  "obra": {
    "nome": "Scala Data Centers — Eldorado do Sul/RS",
    "descricao": "Complexo de data centers projetado como o maior de infraestrutura digital da América Latina, localizado em Eldorado do Sul/RS. Em fase de preparação para construção em 2026.",
    "cidade": "Eldorado do Sul",
    "estado": "RS",
    "volumeEstimado": 40000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] Scala Data Centers — América Latina / RS",
    "descricao": "Maior complexo de data centers da América Latina em construção, Eldorado do Sul/RS. Bomba Lança + Estacionária. Score: 81/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 1500000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 1.9 — Cyrela Grand Vivaz | São Paulo/SP | Score: 81 | 🔴 QUENTE
**Empresa:** Cyrela  
**Projeto:** Grand Vivaz — 3 condomínios, 10 torres, 3.000 apartamentos — VGV R$ 800 milhões  
**Status:** Lançamento/obras em andamento, bairro Penha, SP  
**Local:** Penha — São Paulo/SP  
**Fonte:** CNN Brasil, Portas  
**Equipamento indicado:** Bomba Lança 36–52m  
**Potencial estimado:** R$ 900.000

```json
{
  "empresa": {
    "razaoSocial": "Cyrela Brazil Realty",
    "cnpj": "73.178.600/0001-18",
    "segmento": "Incorporação Imobiliária",
    "cidade": "São Paulo",
    "estado": "SP",
    "observacoes": "Fonte: CNN Brasil. Grand Vivaz — Penha, 3 condomínios, 10 torres, 3.000 aptos, VGV R$800mi. Obra de grande escala em SP. Pilar: 1. Score: 81/100."
  },
  "obra": {
    "nome": "Cyrela Grand Vivaz — Penha",
    "descricao": "Empreendimento de 3 condomínios, 10 torres e 3.000 apartamentos no bairro Penha, São Paulo. VGV de R$ 800 milhões. Próximo à futura Estação Gabriela Mistral do Metrô. Alto consumo de concreto.",
    "cidade": "São Paulo",
    "estado": "SP",
    "volumeEstimado": 25000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 1] Cyrela Grand Vivaz 10 Torres / SP",
    "descricao": "10 torres, 3.000 aptos, VGV R$800mi na Penha/SP. Obra de grande porte. Bomba Lança 36-52m para lançamento de concreto em altura. Score: 81/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 900000,
    "temperatura": "QUENTE"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

## PILAR 2 — EMPRESAS

### Lead 2.1 — Log CP | Campo Grande/MS | Score: 67 | 🟡 MÉDIA
**Empresa:** Log CP  
**Projeto:** Condomínio logístico — R$ 100 milhões, +40.000 m² ABL  
**Status:** Obras em andamento, 750 empregos previstos  
**Local:** Campo Grande/MS  
**Fonte:** Mercado e Consumo, Voe News, Rede News MS  
**Equipamento indicado:** Bomba Estacionária  
**Potencial estimado:** R$ 400.000

```json
{
  "empresa": {
    "razaoSocial": "Log CP",
    "cnpj": "",
    "segmento": "Logística / Condomínio Industrial",
    "cidade": "Campo Grande",
    "estado": "MS",
    "observacoes": "Fonte: Mercado e Consumo. Log investe R$100mi em condomínio logístico em Campo Grande, +40.000 m² ABL, 750 empregos. Obras em andamento. Pilar: 2. Score: 67/100."
  },
  "obra": {
    "nome": "Log CP — Condomínio Logístico Campo Grande",
    "descricao": "Novo condomínio logístico em Campo Grande/MS, R$ 100 milhões de investimento, mais de 40.000 m² de ABL. 750 empregos previstos.",
    "cidade": "Campo Grande",
    "estado": "MS",
    "volumeEstimado": 8000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 2] Log CP Condomínio Logístico / MS",
    "descricao": "R$100mi, 40.000 m² em Campo Grande/MS. Bomba Estacionária para lajes de piso. Score: 67/100.",
    "tipoServico": "BOMBA_ESTACIONARIA",
    "potencialOportunidade": 400000,
    "temperatura": "MEDIA"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

## PILAR 3 — MOVIMENTAÇÕES ESTRATÉGICAS

### Lead 3.1 — Concessão BR-116/PR/SC — Rota Planalto Sul | PR/SC | Score: 78 | 🟡 MÉDIA
**Empresa:** Futuro Concessionário (leilão setembro 2026)  
**Projeto:** Otimização Rota Planalto Sul — concessão rodoviária federal  
**Status:** TCU aprovado, leilão previsto setembro 2026 — obras de duplicação/melhorias pós-concessão  
**Local:** Paraná / Santa Catarina  
**Fonte:** PPI.gov.br  
**Equipamento indicado:** Bomba Estacionária + Bomba Lança  
**Potencial estimado:** R$ 800.000

```json
{
  "empresa": {
    "razaoSocial": "Futuro Concessionário BR-116/PR/SC",
    "cnpj": "",
    "segmento": "Infraestrutura Rodoviária",
    "cidade": "Curitiba",
    "estado": "PR",
    "observacoes": "Fonte: PPI.gov.br. Concessão BR-116/PR/SC (Rota Planalto Sul) — leilão previsto setembro 2026. Obras de duplicação e melhorias ao longo da rodovia em PR e SC. Pilar: 3. Score: 78/100."
  },
  "obra": {
    "nome": "BR-116/PR/SC — Otimização Rota Planalto Sul",
    "descricao": "Concessão rodoviária federal BR-116 no trecho PR/SC. Leilão previsto setembro 2026 após aprovação do TCU. Obras de duplicação, OAEs (obras de arte especiais) e melhorias ao longo de centenas de km.",
    "cidade": "Curitiba",
    "estado": "PR",
    "volumeEstimado": 20000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 3] Concessão BR-116 Rota Planalto Sul / PR-SC",
    "descricao": "Concessão federal, leilão set/2026. Obras de OAEs, pavimentação e duplicação. Bomba Estacionária + Lança para viadutos e estruturas. Score: 78/100.",
    "tipoServico": "BOMBA_ESTACIONARIA",
    "potencialOportunidade": 800000,
    "temperatura": "MEDIA"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

### Lead 3.2 — Leilão Aeroporto de Brasília + 10 Regionais | DF + Nacional | Score: 71 | 🟡 MÉDIA
**Empresa:** ANAC / INFRAERO / Futuro Concessionário  
**Projeto:** Leilão Aeroporto BSB + 10 aeroportos regionais  
**Status:** Consulta pública 23/jun–7/ago/2026; leilão previsto 2º semestre 2026  
**Local:** Brasília/DF + diversas UFs  
**Fonte:** Gov.br Portos e Aeroportos, PanRotas  
**Equipamento indicado:** Bomba Lança + Bomba Estacionária  
**Potencial estimado:** R$ 600.000

```json
{
  "empresa": {
    "razaoSocial": "ANAC / Futuro Concessionário Aeroporto Brasília",
    "cnpj": "",
    "segmento": "Infraestrutura Aeroportuária",
    "cidade": "Brasília",
    "estado": "DF",
    "observacoes": "Fonte: Gov.br. Leilão Aeroporto de Brasília + 10 regionais. Consulta pública jun-ago/2026, leilão no 2º semestre. Obras de ampliação e reforma pós-concessão. Pilar: 3. Score: 71/100."
  },
  "obra": {
    "nome": "Concessão Aeroporto de Brasília + 10 Aeroportos Regionais",
    "descricao": "Leilão do Aeroporto Internacional de Brasília com inclusão de 10 aeroportos regionais. Consulta pública entre 23/jun e 7/ago de 2026. Obras de expansão e modernização pós-concessão. Oportunidade para concretagem de pistas, terminais e estruturas.",
    "cidade": "Brasília",
    "estado": "DF",
    "volumeEstimado": 15000
  },
  "oportunidade": {
    "titulo": "Radar João — [Pilar 3] Concessão Aeroporto BSB + 10 Regionais / DF",
    "descricao": "Leilão 2º sem./2026, ampliação e reforma de pistas e terminais. Bomba Lança + Estacionária. Score: 71/100.",
    "tipoServico": "BOMBA_LANCA",
    "potencialOportunidade": 600000,
    "temperatura": "MEDIA"
  },
  "origemRadar": "Radar João — 4 Pilares — Brasil completo — semana de 29/06/2026"
}
```

---

## PILAR 4 — PESSOAS

Nesta rodada não foram identificadas mudanças específicas de cargo (nomeações / transições) de decisores com dado público suficiente para qualificação. A busca retornou principalmente vagas em aberto e informações salariais, sem notícias jornalísticas de nomeações relevantes.

**Ação sugerida:** Monitorar o LinkedIn de decisores de construtoras vinculadas aos leads acima — especialmente nas obras de data centers e logística — para identificar contatos diretos.

---

## RESULTADO CONSOLIDADO

| # | Lead | Cidade/UF | Score | Temp. | Potencial |
|---|------|-----------|-------|-------|-----------|
| 1 | Ada Infrastructure GRU10 | Guarulhos/SP | 96 | QUENTE | R$ 2.500.000 |
| 2 | Private Log | Serra/ES | 95 | QUENTE | R$ 2.000.000 |
| 3 | GLP Guarulhos III | Guarulhos/SP | 93 | QUENTE | R$ 1.800.000 |
| 4 | Data Center Omnia DC | Pecém/CE | 92 | QUENTE | R$ 2.000.000 |
| 5 | Transnordestina | CE/PI/PE | 92 | QUENTE | R$ 1.500.000 |
| 6 | RT-One Data Center | Uberlândia/MG | 90 | QUENTE | R$ 2.500.000 |
| 7 | Metrô do Recife CBTU | Recife/PE | 87 | QUENTE | R$ 1.200.000 |
| 8 | Scala Data Centers | Eldorado do Sul/RS | 81 | QUENTE | R$ 1.500.000 |
| 9 | Cyrela Grand Vivaz | São Paulo/SP | 81 | QUENTE | R$ 900.000 |
| 10 | Log CP Campo Grande | Campo Grande/MS | 67 | MÉDIA | R$ 400.000 |
| 11 | Concessão BR-116 PR/SC | Curitiba/PR | 78 | MÉDIA | R$ 800.000 |
| 12 | Aeroporto BSB + 10 | Brasília/DF | 71 | MÉDIA | R$ 600.000 |

**Total de leads:** 12 (9 QUENTES + 3 MÉDIAS)  
**Valor potencial total estimado: R$ 17.700.000**

---

## REGIÕES COM MAIOR ATIVIDADE

1. **São Paulo / Guarulhos (SP)** — 3 leads (data center Ada GRU10, GLP III, Cyrela)
2. **Nordeste (PE, CE)** — 3 leads (Omnia DC Pecém, Transnordestina, Metrô Recife)
3. **Minas Gerais (MG)** — 1 lead QUENTE (RT-One Uberlândia)
4. **Espírito Santo (ES)** — 1 lead QUENTE (Private Log Serra)
5. **Rio Grande do Sul (RS)** — 1 lead QUENTE (Scala Data Centers)

---

## PRÓXIMAS AÇÕES SUGERIDAS

1. **URGENTE — Ligar hoje para Ada Infrastructure (Guarulhos):** obra de data center 300MW em andamento, filial Villa SP a poucos km. Perguntar por Diretor de Obras ou Gerente de Canteiro.

2. **URGENTE — Prospectar Private Log em Serra/ES:** 1ª fase de 190.000 m² em entrega 2026. Identificar construtora executora para oferta direta.

3. **URGENTE — Acionar equipe Recife para Omnia DC (Pecém/CE):** 200MW de data center — maior investimento privado do Brasil. Contato com gestora de obras no complexo industrial do Pecém.

4. **Esta semana — Transnordestina:** Acionar contatos na Infra S.A. e consórcio executores. 280 km em obra no CE com dezenas de pontes de concreto. Oportunidade de contrato de longo prazo.

5. **Esta semana — RT-One Data Center Uberlândia:** R$ 6 bilhões — ligar para a RT-One e filial BH para pré-posicionamento antes do início das obras.

6. **Próxima semana — Cyrela (SP):** Grand Vivaz com 10 torres — acionar equipe SP para visita ao stand e identificar engenheiro de obras.

7. **Monitorar:** Leilão BR-116/PR/SC (setembro/2026) e Aeroporto BSB (2º semestre/2026) para qualificação dos concessionários vencedores como futuros clientes.

---

*Relatório gerado automaticamente por João — Agente Hunter Villa Empreendimentos | 29/06/2026*
