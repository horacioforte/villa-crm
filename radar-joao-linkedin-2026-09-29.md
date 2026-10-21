# RADAR JOÃO — LINKEDIN INTELLIGENCE
Data: 29/09/2026

⚠️ **Alerta de acesso:** o Claude in Chrome não estava conectado nesta execução (2 tentativas). Nenhuma navegação no LinkedIn logado foi feita, então não houve risco para a conta. A cobertura se limitou a busca web pública (os resultados `site:linkedin.com` vieram fracos: só perfis estáticos, sem feed, posts, fotos ou engajamento). As obras abaixo vieram de notícias públicas, não de posts do LinkedIn.

**Passo 0:** o GET em `/api/agent/dossies` funcionou (HTTP 200, 1.376 dossiês). O POST também funcionou, sem bloqueio de allowlist.

## Resumo
- Novas obras encontradas: 4 (Brasil) | 3 (São Paulo, PRIORIDADE VILLA SP)
- Movimentações de pessoal detectadas: 0 novas (sem feed; a única achada é antiga, veja abaixo)
- Novos diretores / engenheiros / compradores: 0 / 0 / 0
- Empresas contratando: sem dados (feed indisponível)
- Empresas que iniciaram obra: Construtora Tripoloni (Contorno Sul Maringá), Yanmar (Indaiatuba), Nestlé (Araras), HUSF (Bragança Paulista)
- Publicações estratégicas analisadas: 0 (feed indisponível)
- Dossiês criados na Central de Inteligência: **4** | Pulados por duplicata: 0 | Descartados por já estarem no CRM: Hitachi Pindamonhangaba, SANY Campinas, Coca-Cola Caçapava, Arauco Sucuriú, Terranova Campinas, Sabará

## Dossiês criados
| Score | Prioridade | Obra | Fase | Link CRM |
|---|---|---|---|---|
| 81 | ALTA | Contorno Sul de Maringá/PR: duplicação em concreto, 17 viadutos, 1 ponte. R$443mi. Construtora Tripoloni + HDO Engenharia. Ordem de serviço assinada em 16/09 | Mobilização | [abrir](https://villa-crm.vercel.app/inteligencia/cmumom1zg000204jqmyxkq21j) |
| 75 | ALTA · SP | Yanmar: nova fábrica de 140 mil m² em Indaiatuba/SP. R$280mi. Estrutura prevista até jun/27 | Obras em andamento | [abrir](https://villa-crm.vercel.app/inteligencia/cmumom2ly000504jqd8v1syuq) |
| 71 | ALTA · SP | Nestlé: nova torre de extração em Araras/SP. R$1bi (2025–28). Obras iniciadas em mar/26 | Obras em andamento | [abrir](https://villa-crm.vercel.app/inteligencia/cmumom39u000804jq6kfi2hz7) |
| 58 | MÉDIA · SP | Hospital Santa Clara (HUSF) em Bragança Paulista/SP: 7.331 m², térreo + 5 pavimentos. R$60mi. 1ª fase prevista para fim de 2026 | Estrutura | [abrir](https://villa-crm.vercel.app/inteligencia/cmumom3sj000b04jque8wnmpi) |

Em observação, sem dossiê: data center da Aurea Finvest em Sumaré/SP (800 MW, R$5bi). Ainda está em autorizações e o início das obras não foi confirmado.

## Leads sugeridos (convite manual)
- **Rodrigo Penha**, Diretor de Obras e Engenharia da HM Engenharia (SP), [perfil](https://br.linkedin.com/in/rodrigo-penha-3568a6158). A HM é grande usuária de parede de concreto, com alto consumo de bomba e betoneira. A mudança de cargo dele é de 2024, então não é novidade, mas ele é um decisor de ALTA prioridade. A empresa já está no CRM ("HM Engenharia SP"). Verificar se o contato dele está cadastrado.
  - Convite: "Rodrigo, acompanho o trabalho da HM com parede de concreto aqui em SP. Sou da Villa (bombeamento e transporte de concreto) e gostaria de ter você na minha rede."
- **Contorno Sul de Maringá:** achar no LinkedIn o gerente de contrato ou engenheiro residente da Tripoloni. É o decisor mais quente do dia.

## Mensagens sugeridas (envio manual)
- **Tripoloni (obra nova de infraestrutura):** "Parabéns pela ordem de serviço do Contorno Sul. Com 17 viadutos e a ponte, a Villa pode apoiar com bomba lança e betoneiras desde a fundação. Podemos conversar sobre o cronograma de concretagem?"
- **Yanmar / Nestlé (obra industrial em SP):** "Vi que a obra da nova planta em [cidade] está avançando. A Villa SP atende a região com bomba lança, estacionária e betoneira. Quem conduz a parte civil aí?"
- **HUSF (hospital em SP):** "Soube do alvará do Hospital Santa Clara. Se a estrutura estiver para começar, a Villa SP pode ajudar nas concretagens. Com quem posso falar sobre a obra?"

## Próximas ações comerciais
1. **Tripoloni / Contorno Sul (URGENTE comercialmente):** o comercial deve ligar ou mandar e-mail para a Tripoloni em Maringá esta semana. A obra está em mobilização.
2. **Yanmar e Nestlé:** descobrir a construtora ou EPC responsável. Buscar manualmente no LinkedIn por "Yanmar Indaiatuba obra" e "Nestlé Araras obra torre de extração".
3. **HUSF Bragança:** ligar para a engenharia ou facilities do hospital e perguntar pela construtora.
4. **Reconectar o Claude in Chrome** (extensão + login) para que a próxima rodada leia o feed de verdade.

## Fontes
- [Maringá Post: ordem de serviço do Contorno Sul](https://maringapost.com.br/2026/09/16/prefeitura-assina-ordem-de-servico-para-duplicacao-do-contorno-sul/) · [Maringá Mais: Tripoloni vencedora](https://www.maringamais.com.br/2026/08/31/tripoloni-e-vencedora-de-licitacao-de-r-4429-milhoes-para-duplicacao-do-contorno-sul/)
- [Prefeitura de Indaiatuba: Yanmar](https://www.indaiatuba.sp.gov.br/comunicacao/imprensa/noticias/35832/)
- [Nestlé Brasil: R$1bi em Araras](https://www.nestle.com.br/media/pressreleases/allpressreleases/nestle-investira-r-1-bi-para-modernizar-e-ampliar-fabrica-de-cafes-soluveis)
- [Jornal + Bragança: alvará do Hospital Santa Clara](https://jornalmaisbraganca.com.br/2026/06/16/hospital-santa-clara-recebe-alvara-e-esta-autorizado-a-iniciar-obras-em-braganca-paulista/)
- [DCD: Aurea Finvest em Sumaré](https://www.datacenterdynamics.com/br/not%C3%ADcias/plano-de-data-center-de-ate-800-mw-e-r-5-bilhoes-em-sumare-sao-paulo/)
- [HM Blog: Rodrigo Penha](https://maishm.com.br/blog/rodrigo-penha-e-o-novo-diretor-de-obras-da-hm-engenharia/)
