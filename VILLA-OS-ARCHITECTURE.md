# Villa OS — Sistema Operacional Comercial

## Visão central

O CRM da Villa não deve ser tratado como um repositório de dados. Ele deve funcionar como um Sistema Operacional Comercial: um ambiente vivo que observa o negócio, entende o contexto, prioriza ações e trabalha ativamente para a equipe comercial.

A ideia central é simples:

- o sistema não espera que o usuário peça tudo
- o sistema percebe, organiza, prioriza e sugere
- cada módulo publica eventos para o ecossistema inteiro
- todas as decisões comerciais passam a ser coordenadas por um motor operacional único

O objetivo é transformar o CRM em uma máquina de execução comercial, e não apenas em um banco de dados de relacionamento.

---

## 1. O que é Villa OS

Villa OS é a camada operacional do CRM da Villa. Ele conecta:

- comunicação
- relacionamento comercial
- IA
- automação
- contexto do negócio
- execução de tarefas
- visão executiva

Ele funciona como um sistema operacional porque:

- organiza múltiplos fluxos simultaneamente
- orquestra ações entre módulos
- publica mudanças para todos os componentes relevantes
- aprende com o comportamento comercial
- prioriza o que merece atenção agora

### Princípios de Villa OS

1. O negócio é um fluxo contínuo, não uma coleção de telas
2. Cada módulo tem uma função específica, mas não vive isolado
3. A informação deve circular automaticamente
4. A IA não é um recurso adicional; é uma camada operacional
5. O sistema deve agir antes de o usuário pedir
6. O usuário deve trabalhar no fluxo, não em busca manual de dados

---

## 2. Como os módulos se conectam

Abaixo está a arquitetura funcional do sistema, pensada em fluxos de trabalho e não em páginas.

### Módulos principais

- João
- Maria
- Central de Relacionamento
- Timeline Inteligente
- Feed Inteligente
- Empresas
- Pessoas
- Oportunidades
- Campanhas
- Dossiês
- Radar
- IA
- Dashboard Executivo

### Visão geral da conexão

Cada módulo tem dois papéis:

- produzir contexto
- consumir contexto

Ou seja, um módulo nunca é apenas um “cadastro”. Ele também é um agente de informação para o sistema inteiro.

---

## 3. Mapa de circulação da informação

### Fluxo 1 — Conversa para negócio

Quando uma conversa entra no sistema:

1. A Central de Relacionamento recebe a mensagem
2. O sistema identifica o contato e a empresa
3. A conversa é vinculada a uma pessoa, empresa e possível oportunidade
4. A IA analisa intenção, urgência e contexto
5. O evento é publicado para:
   - Timeline da Empresa
   - Timeline Global
   - Feed Inteligente
   - Dashboard
   - IA

Isso faz com que a conversa não fique isolada. Ela passa a influenciar o negócio inteiro.

### Fluxo 2 — Empresa para oportunidade

Quando uma empresa ou pessoa ganha novo contexto:

1. O módulo de Empresas ou Pessoas atualiza o registro
2. O sistema identifica se há oportunidade comercial associada
3. O estado do relacionamento é atualizado
4. O evento é propagado para o feed e o dashboard
5. A IA pode sugerir uma ação comercial

### Fluxo 3 — Campanha para relacionamento

Quando uma campanha gera leads ou engajamentos:

1. a campanha publica um evento de entrada
2. o sistema cria ou atualiza a relação com a empresa/pessoa
3. a Central de Relacionamento passa a acompanhar o envolvimento
4. a IA pode criar uma próxima ação ou uma oportunidade

### Fluxo 4 — Dossiê para decisão

Quando um dossiê é atualizado:

1. o sistema registra o novo estado comercial
2. a IA recebe contexto adicional
3. o feed mostra a mudança relevante
4. o dashboard executivo recalcula prioridades

### Fluxo 5 — Radar para atenção

Quando o Radar identifica algo relevante:

1. o evento entra no sistema como sinal de oportunidade ou risco
2. a IA prioriza a conversa ou o lead
3. o feed e a timeline mostram a novidade
4. o usuário recebe um alerta contextual

---

## 4. Arquitetura funcional de Villa OS

### Camada 1 — Fonte de eventos

São os módulos que geram fatos do negócio:

- João
- Maria
- Central de Relacionamento
- Empresas
- Pessoas
- Oportunidades
- Campanhas
- Dossiês
- Radar
- IA

Esses módulos publicam eventos sempre que algo muda.

### Camada 2 — Motor de eventos

É o cérebro operacional do sistema.

Ele recebe eventos, os classifica e os distribui para os módulos interessados.

Funções principais:

- normalizar eventos
- enriquecer o contexto
- decidir onde publicar
- priorizar por urgência ou impacto
- acionar IA quando necessário
- disparar workflows automáticos

### Camada 3 — Publicadores de contexto

São os destinos que recebem e organizam o evento:

- Timeline da Empresa
- Timeline Global
- Feed Inteligente
- Dashboard
- IA

### Camada 4 — Ação operacional

Com base no evento, o sistema pode:

- criar uma tarefa
- atualizar uma oportunidade
- sugerir resposta
- criar um dossiê
- levantar prioridade
- sinalizar risco
- enviar notificação
- gerar resumo executivo

---

## 5. Modelo de eventos do Villa OS

A arquitetura deve ser baseada em eventos, e não em telas.

### Exemplo de evento

Evento: conversa_recebida

Campos conceituais:
- tipo de evento
- módulo origem
- entidade relacionada
- identidade do cliente
- prioridade inferida
- contexto comercial
- risco ou oportunidade detectada
- ação sugerida

### Tipos de eventos

- conversa_recebida
- conversa_respondida
- oportunidade_criada
- oportunidade_atualizada
- proposta_enviada
- proposta_respondida
- tarefa_criada
- tarefa_vencendo
- lead_qualificado
- sinal_de_risco
- sinal_de_urgencia
- empresa_atualizada
- pessoa_atualizada
- campanha_impactada
- dossie_atualizado
- radar_novo_sinal
- ia_sugestao_gerada

### Regras de publicação

Todo evento importante deve ser publicado automaticamente para:

- Timeline da Empresa
- Timeline Global
- Feed Inteligente
- Dashboard
- IA

Mesmo que o usuário não tenha pedido isso.

---

## 6. Como a informação circula entre os módulos

### Exemplo A — Conversa vira oportunidade

1. João recebe uma mensagem do cliente
2. A Central de Relacionamento registra a conversa
3. A IA identifica intenção de compra
4. O sistema cria ou atualiza uma oportunidade
5. O evento vai para a timeline da empresa e para o feed inteligente
6. O dashboard mostra o novo sinal comercial
7. A IA sugere a próxima ação

### Exemplo B — Proposta parada vira alerta

1. Uma proposta fica sem resposta por muito tempo
2. O sistema observa o tempo de inatividade
3. A IA detecta risco de esfriamento
4. O evento é publicado para a timeline e para o feed
5. O dashboard mostra um alerta de risco
6. O usuário recebe uma recomendação de follow-up

### Exemplo C — Empresa ganha contexto novo

1. O Radar identifica uma notícia relevante sobre a empresa
2. O sistema publica esse contexto
3. A IA relaciona isso à oportunidade ativa
4. O feed mostra a novidade para o time
5. O dashboard executive destaca o impacto comercial

### Exemplo D — Campanha gera engajamento

1. A campanha recebe resposta ou clique
2. O sistema cria um lead ou atualiza um relacionamento existente
3. O feed e a timeline mostram o novo movimento
4. A IA sugere a próxima ação de outreach

---

## 7. O papel de cada módulo no Villa OS

### João

João atua como um agente de relacionamento ativo. Ele pode:

- receber mensagens
- interpretar intenção
- priorizar conversas
- produzir ações comerciais
- estimular a equipe a agir

### Maria

Maria funciona como um agente de operação e acompanhamento. Ela pode:

- organizar filas
- acompanhar SLA
- garantir follow-up
- identificar paradas e riscos
- apoiar o time comercial com automação operacional

### Central de Relacionamento

É o núcleo operacional da experiência. Ela orquestra:

- conversas
- contexto
- mensagens
- respostas
- transferência
- acompanhamento

### Timeline Inteligente

É o histórico vivo do relacionamento. Ela mostra:

- evolução do negócio
- eventos importantes
- ações da equipe
- sinais da IA
- status de oportunidades e propostas

### Feed Inteligente

É o painel de atenção do sistema. Ele traz:

- o que precisa ser visto agora
- o que mudou recentemente
- o que merece ação imediata
- o que caiu em risco

### Empresas e Pessoas

São os ativos centrais do relacionamento. Eles alimentam:

- contexto comercial
- histórico de interações
- vínculos com oportunidades
- inteligência sobre maturidade e relacionamento

### Oportunidades

São o motor de avanço comercial. Elas transformam conversa em pipeline.

### Campanhas

São o motor de entrada de relacionamento. Elas alimentam o sistema com novos leads e sinais de interesse.

### Dossiês

São o contexto estratégico do relacionamento. Eles enriquecem a trajetória do cliente e ajudam a IA a tomar decisões melhor informadas.

### Radar

É a camada de percepção externa. Ele traz sinais do mercado, do cliente e do ambiente comercial.

### IA

É a camada de decisão e execução. Ela:

- interpreta contexto
- sugere ações
- cria tarefas
- prioriza negócios
- gera insights
- melhora o tempo de resposta

### Dashboard Executivo

É a visão do negócio. Ele mostra:

- volume
- risco
- andamento
- produtividade
- oportunidades prioritárias
- saúde do pipeline

---

## 8. Arquitetura do ciclo de trabalho

O sistema deve ser pensado em ciclos contínuos.

### Ciclo 1 — Captura

O sistema recebe um evento do mundo real ou do ambiente interno.

### Ciclo 2 — Compreensão

A IA e os módulos interpretam o contexto.

### Ciclo 3 — Prioridade

O sistema decide o impacto do evento.

### Ciclo 4 — Ação

O sistema sugere, cria ou executa a próxima ação.

### Ciclo 5 — Registro

Tudo é registrado na timeline, no feed e no dashboard.

### Ciclo 6 — Aprendizado

O sistema aprende com o que aconteceu e melhora a recomendação futura.

---

## 9. Arquitetura de publicação para o ecossistema

Qualquer novo módulo do CRM deve poder publicar eventos automaticamente para cinco destinos principais.

### Destino 1 — Timeline da Empresa

Útil para mostrar a história do relacionamento com uma empresa específica.

Exemplos:
- mensagem recebida
- proposta enviada
- tarefa criada
- risco detectado
- oportunidade atualizada

### Destino 2 — Timeline Global

Útil para mostrar o movimento do sistema como um todo.

Exemplos:
- nova conversa recebida
- nova oportunidade criada
- campanha com alto engajamento
- alerta comercial importante

### Destino 3 — Feed Inteligente

Útil para priorizar atenção e ação.

Exemplos:
- conversa urgente
- oportunidade em risco
- proposta sem resposta
- follow-up recomendado

### Destino 4 — Dashboard

Útil para transformar eventos em métricas e visão executiva.

Exemplos:
- volume de mensagens
- oportunidades criadas
- conversas urgentes
- produtividade da equipe

### Destino 5 — IA

Útil para dar contexto à inteligência do sistema.

Exemplos:
- intenção detectada
- risco comercial
- oportunidade de upsell
- recomendação de próxima ação

---

## 10. Regras de publicação do sistema

Para que o Villa OS funcione bem, todo módulo novo deve seguir regras claras.

### Regra 1 — Publicar eventos de mudança, não apenas de estado

O módulo não deve apenas salvar dados. Ele deve comunicar o que mudou.

### Regra 2 — Publicar em formato padronizado

Cada evento deve ter:
- tipo
- origem
- entidade envolvida
- contexto relevante
- impacto estimado
- sugestão de ação

### Regra 3 — Enriquecer o evento com contexto comercial

O evento deve trazer dados úteis para o sistema inteiro.

### Regra 4 — Não depender de tela para existir

A informação deve circular mesmo se o usuário não abrir uma determinada tela.

### Regra 5 — A IA deve ser um consumidor obrigatório

Todo evento importante deve poder alimentar a camada de inteligência.

---

## 11. O que isso muda na cultura do produto

Este modelo muda a forma como o CRM é percebido.

De um sistema de armazenamento, ele vira:

- um sistema orientado a ação
- um sistema orientado a decisão
- um sistema orientado a oportunidade
- um sistema orientado a execução comercial

Isso significa que o usuário não precisa “ir buscar informação”.

O sistema vai até ele com o que importa agora.

---

## 12. O futuro do CRM Villa

O futuro do Villa CRM não é apenas ter mais módulos.

O futuro é ter um motor operacional que faça os módulos trabalharem juntos.

Se isso for bem feito, o CRM Vila deixa de ser uma ferramenta de registro e passa a ser:

- uma central de relacionamento
- uma máquina de inteligência comercial
- um sistema operacional para a operação comercial inteira

Esse é o verdadeiro salto de produto.

---

## Resumo executivo

A arquitetura ideal para o CRM Villa é uma arquitetura de fluxo operacional, não de telas.

O sistema deve:

- conectar todos os módulos por eventos
- publicar mudanças automaticamente
- alimentar timeline, feed, dashboard e IA
- agir de forma proativa
- ajudar o usuário a decidir e executar

Essa é a base para transformar o Villa CRM em um verdadeiro Sistema Operacional Comercial.
