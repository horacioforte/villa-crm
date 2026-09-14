# RESUMO DA SEMANA — RADAR JOÃO
**Data da execução:** 31 de agosto de 2026
**Agente:** João — Hunter e Centro de Inteligência Comercial
**Cobertura:** Brasil completo — 4 Pilares + 14 Segmentos Setoriais Ampliados (Pilar 1)

---

## Nota técnica — Rede e CRM
- Consulta à API do PNCP (`pncp.gov.br/api/pncp/v1/contratacoes/publicacoes`) **bloqueada pelo allowlist de rede** (`403 blocked-by-allowlist`) — mesma pendência já registrada no CLAUDE.md. Licitações públicas foram cobertas via busca web (DNIT, PPI, notícias) como alternativa.
- `POST /api/agent` (CRM) **funcionou normalmente** (HTTP 201) para todos os 10 leads qualificados desta rodada — allowlist para `villa-crm.vercel.app` segue liberado.
- Detectado comportamento a observar no endpoint: envio de `cnpj` como string vazia (`""`) causa erro de constraint única (`Unique constraint failed on the fields: (cnpj)`) a partir do segundo registro sem CNPJ. Contorno aplicado nesta rodada: omitir o campo `cnpj` quando não disponível, em vez de enviar `""`. Recomenda-se ajuste no backend para tratar string vazia como `null`.

---

## Pilar 1 — Obras (incluindo Segmentos Setoriais Ampliados)
- **Buscas realizadas:** cobertura regional (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) + varredura dos 14 segmentos setoriais ampliados (construtoras, rodovias, ferrovias, portos, aeroportos, mineração, celulose, energia, saneamento, óleo e gás, data centers, siderurgia/cimento, grandes indústrias, agronegócio).
- **Oportunidades identificadas:** 17
- **Qualificadas (score ≥ 50):** 10
- **Leads QUENTES (≥80):** 4 — Scala AI City (RS), Private Log (ES), Duplicação BR-116/BA, Bracell Bataguassu (MS)
- **Leads MÉDIOS (50–79):** 6 — APM Terminals Suape 2ª fase (PE), Ferrovia FIOL-FICO (BA/TO), Obras Sabesp (SP), Votorantim Cimentos Xambioá (TO), Ampliação Tanques Itaqui (MA), LOG Campo Grande II (MS)
- **Segmentos com mais achados nesta rodada:** Data Centers, Condomínios Logísticos, Portos, Celulose e Papel, Ferrovias, Saneamento

## Pilar 2 — Empresas
- **Movimentações pesquisadas:** aberturas de filial/planta, expansão regional (buscas gerais + LinkedIn).
- **Leads gerados:** 0 — os resultados retornados foram majoritariamente genéricos (guias, rankings, vagas), sem um caso específico e verificável (empresa nomeada + obra + data) que atingisse score ≥ 50 nesta rodada.

## Pilar 3 — Movimentações Estratégicas
- **Sinais pesquisados:** debêntures de infraestrutura, compra de terrenos, concessões/leilões.
- **Leads gerados:** 0 — os achados desta rodada foram majoritariamente macroeconômicos (estoque total do mercado de debêntures, tendências setoriais) ou de baixo porte (aquisições pontuais de terreno urbano pequeno), sem obra de grande volume de concreto associada e verificável.
- Nota: os leilões e concessões de maior porte (ferrovias, portos, transmissão) já foram capturados e registrados via Pilar 1, evitando duplicidade.

## Pilar 4 — Pessoas
- **Buscas realizadas:** nomeações de Diretor de Obras/Engenharia em construtoras (LinkedIn e imprensa).
- **Oportunidades de relacionamento:** 0 — resultados limitados a perfis existentes no LinkedIn e vagas em aberto, sem uma nomeação recente e específica desta semana que se qualificasse como lead.

## Total registrado no CRM
**10 leads** (4 QUENTES + 6 MÉDIOS) registrados com sucesso via `POST /api/agent` (HTTP 201), todos com notificação automática enviada à Morgana via WhatsApp para aprovação.

---

## Top 3 Oportunidades da Semana

**1. Scala Data Centers — "Scala AI City" — Eldorado do Sul/RS — Score: 96 — QUENTE**
Maior projeto de infraestrutura digital da América do Sul: campus de data centers para IA em 700 hectares, investimento inicial de R$ 3 bi (potencial de R$ 300 bi no ciclo completo), até 12.000 trabalhadores no pico da obra civil. Fundações e estruturas de concreto em larga escala, múltiplas fases plurianuais.

**2. Private Log — Bairro Logístico Contorno do Mestre Álvaro — Serra/ES — Score: 89 — QUENTE**
Maior condomínio logístico do Brasil, 620 mil m² de área locável, R$ 2,5 bi de investimento, obra em execução desde jul/2025 com entrega da 1ª fase em jul/2026 e mais 3 fases ao longo de 4 anos.

**3. DNIT — Duplicação BR-116/BA — Diversos municípios/BA — Score: 84 — QUENTE**
Duplicação de 113,36 km com obras de arte especiais (pontes/viadutos), contratação integrada, prazo de execução de 810 dias. Licitação em andamento — acompanhar homologação.

**Valor potencial estimado total (10 leads):** R$ 11.950.000

---

## Todos os Leads Registrados no CRM

| # | Empresa | Título | Cidade/UF | Segmento | Score | Temperatura |
|---|---|---|---|---|---|---|
| 1 | Scala Data Centers | Scala AI City | Eldorado do Sul/RS | Data Centers | 96 | QUENTE |
| 2 | Private Log | Bairro Logístico Mestre Álvaro | Serra/ES | Condomínios Logísticos | 89 | QUENTE |
| 3 | DNIT | Duplicação BR-116/BA | Diversos/BA | Rodovias | 84 | QUENTE |
| 4 | Bracell | Fábrica de Celulose Bataguassu | Bataguassu/MS | Celulose e Papel | 80 | QUENTE |
| 5 | APM Terminals Suape | Terminal de Contêineres — 2ª fase | Ipojuca/PE | Portos | 78 | MÉDIA |
| 6 | Sabesp | ETE Parque Novo Mundo / SES Perus / ETA Melvi | SP / Praia Grande | Saneamento | 78 | MÉDIA |
| 7 | Governo Federal / Vale | Ferrovia FIOL-FICO | Diversos/BA-TO | Ferrovias | 76 | MÉDIA |
| 8 | Temape / Porto do Itaqui | Ampliação de Tanques | São Luís/MA | Portos | 69 | MÉDIA |
| 9 | LOG Commercial Properties | LOG Campo Grande — Unidade II | Campo Grande/MS | Condomínios Logísticos | 69 | MÉDIA |
| 10 | Votorantim Cimentos | Ampliação Fábrica de Cimento | Xambioá/TO | Siderurgia e Cimento | 66 | MÉDIA |

**Atenção especial — Bracell Bataguassu:** obra sofreu atrasos por pendência de licença ambiental (previsão original fev/2026; notícias recentes indicam possível início apenas em 2027). Recomenda-se monitorar liberação da licença antes de abordagem comercial direta.

---

## Regiões com Maior Atividade
1. **Nordeste (BA, PE, MA)** — 4 oportunidades: DNIT BR-116/BA, FIOL-FICO, APM Terminals Suape/PE, Ampliação Tanques Itaqui/MA.
2. **Centro-Oeste / MS** — 2 oportunidades de alto valor: Bracell Bataguassu e LOG Campo Grande II.
3. **Sul — RS** — 1 oportunidade de maior valor absoluto da rodada: Scala AI City.
4. **Sudeste — ES/SP** — 2 oportunidades: Private Log/ES e obras Sabesp/SP.
5. **Norte — TO** — 1 oportunidade: Votorantim Cimentos Xambioá.

## Próximas Ações Comerciais Sugeridas
1. Priorizar contato com as empreiteiras da fase 1 do Scala AI City (RS) e mapear consórcios responsáveis pela fase 2 do Private Log (ES) — maior potencial e obras já mobilizadas.
2. Acompanhar homologação da licitação da BR-116/BA (DNIT) para identificar a construtora vencedora assim que publicada.
3. Monitorar mensalmente o status da Licença de Instalação da Bracell em Bataguassu/MS antes de qualquer abordagem comercial.
4. Acompanhar cronograma da licitação Fico-Fiol (1º trimestre de 2026) e mapear consórcios vencedores assim que definidos.
5. Filial de São Paulo: priorizar cluster de obras Sabesp na Grande São Paulo, dado o alto número de estações em execução simultânea.
6. Investigar tecnicamente o comportamento do endpoint `/api/agent` com o campo `cnpj` vazio (ver Nota técnica) para evitar erros em lançamentos futuros.
