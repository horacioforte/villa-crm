# Central de Atendimento Villa CRM

## 1. Visão geral

A Central de Atendimento do Villa CRM será o centro operacional do relacionamento comercial com clientes e leads. Ela substituirá o uso de ferramentas externas para atendimento e reunirá, em uma única experiência, comunicação, contexto comercial, automação, IA e produtividade.

### Objetivo principal

Permitir que um atendente comercial trabalhe o dia inteiro dentro do CRM, sem precisar abrir WhatsApp, Chatwoot, Meta, Evolution ou outras ferramentas.

### Princípios de produto

- Atendimento nativo dentro do CRM
- Experiência semelhante a um inbox moderno, mas mais poderosa
- IA como copiloto operando em segundo plano
- Contexto comercial sempre visível na mesma tela
- Tempo real em toda a jornada
- Processo comercial integrado a oportunidades, propostas, tarefas e dossiês

### Proposta de valor

A Central de Atendimento não será apenas um canal de mensagens. Será a camada operacional do relacionamento comercial da Villa, combinando:

- comunicação com clientes
- contexto do CRM
- automação com IA
- acompanhamento de vendas
- gestão de SLA e filas
- produtividade para equipe comercial

---

## 2. Wireframe textual da tela

A interface principal será dividida em três colunas.

### Coluna 1 — Lista de conversas

Localizada à esquerda. Função: navegar rapidamente entre conversas e priorizar atendimento.

Elementos:
- foto do contato
- nome
- empresa
- última mensagem
- horário
- indicador de mensagens não lidas
- responsável da conversa
- origem da resposta: IA ou humano
- prioridade
- canal
- status
- cor por prioridade

Filtros disponíveis:
- João
- Maria
- Morgana
- Taciane
- Todos
- não lidas
- aguardando cliente
- aguardando equipe
- IA
- humano
- propostas
- oportunidades
- urgentes

### Coluna 2 — Conversa

Localizada no centro. Função: conduzir o atendimento como uma conversa moderna de WhatsApp, porém com contexto e automação integrada.

Recursos:
- mensagens de texto
- emojis
- áudio
- imagem
- vídeo
- documento
- PDF
- localização
- contato
- templates
- respostas rápidas
- arrastar arquivos
- colar imagem
- responder a mensagem específica
- editar mensagem antes do envio
- histórico completo
- estado de entrega e leitura

### Coluna 3 — Painel inteligente do CRM

Localizada à direita. Função: mostrar o contexto comercial completo da conversa.

Itens principais:
- empresa
- contato
- oportunidade
- valor estimado
- etapa do funil
- última proposta
- último orçamento
- tarefas
- dossiê
- Radar João
- resumo da IA
- probabilidade de fechamento
- próxima ação sugerida
- humor do cliente
- lead score
- maturidade comercial
- histórico comercial completo

---

## 3. Componentes necessários

### A. Componentes de navegação e estrutura

- Header de atendimento
- Barra de filtros de conversas
- Indicador de fila e SLA
- Switch de modo: IA ativa / IA pausada
- Botões de ação: transferir, assumir, pausar IA, retomar IA

### B. Componentes da lista de conversas

- Card de conversa
- Badge de prioridade
- Badge de status
- Badge de canal
- Badge de mensagens não lidas
- Avatar e nome
- Meta da última mensagem

### C. Componentes da conversa

- Bolha de mensagem recebida
- Bolha de mensagem enviada
- Indicador de digitação
- Indicador de entrega, leitura e erro
- Composer com suporte a texto, mídia e templates
- Lista de anexos e documentos
- Histórico de conversa com agrupamento temporal
- Seletor de resposta rápida
- Seletor de template

### D. Componentes do painel inteligente

- Card de empresa
- Card de contato
- Card de oportunidade
- Card de proposta
- Card de tarefas
- Card de IA e sugestões
- Card de dossiê comercial
- Card de status e próximas ações

### E. Componentes de operação humana

- Modal de transferência
- Modal de assumir conversa
- Drawer de comentários internos
- Drawer de notas internas
- Histórico de transferência
- Painel de SLA e tempo médio

---

## 4. Fluxo de atendimento

### Fluxo principal

1. Uma mensagem chega pelo canal WhatsApp Meta Cloud API.
2. O sistema identifica o canal, a conversa e o contato.
3. O CRM cria ou atualiza a conversa e registra a mensagem.
4. A IA analisa o contexto e sugere uma próxima ação.
5. O atendente visualiza a conversa e o painel inteligente.
6. O atendente responde dentro do CRM.
7. A resposta é enviada para o cliente via WhatsApp.
8. O sistema registra o histórico completo e atualiza o contexto comercial.

### Regras operacionais

- toda mensagem deve ser registrada no CRM
- toda resposta deve nascer no CRM
- a conversa deve permanecer centralizada no CRM
- a IA não substitui o atendimento humano, mas o acelera

---

## 5. Fluxo IA → humano

A IA atuará como copiloto e agente assistente no atendimento.

### Funções da IA

- resumir a conversa
- sugerir resposta
- sugerir próxima ação
- criar tarefa
- criar oportunidade
- criar empresa
- detectar urgência
- detectar reclamação
- detectar oportunidade perdida
- detectar intenção de compra
- detectar proposta parada
- sugerir follow-up
- sugerir ligar para o cliente

### Fluxo de decisão

1. A IA recebe a mensagem e o contexto da conversa.
2. Ela analisa intenção, sentimento, urgência e contexto comercial.
3. Ela gera uma sugestão para o usuário.
4. O atendente pode aceitar, editar ou descartar.
5. Se a sugestão for aceita, o sistema executa a ação no CRM.

### Exemplo de ação assistida

- Uma mensagem de cliente pede orçamento urgente.
- A IA detecta intenção de compra e cria uma oportunidade.
- Ela sugere um follow-up em 24 horas.
- O atendente confirma e o CRM registra a ação.

---

## 6. Fluxo humano → IA

O atendimento humano deve poder interagir com a IA de forma simples e transparente.

### Interações possíveis

- pedir para resumir a conversa
- pedir uma sugestão de resposta
- pedir uma próxima ação recomendada
- pedir para criar uma tarefa
- pedir para registrar uma oportunidade
- pedir para atualizar o dossiê
- pedir para classificar urgência

### Regras de uso

- a IA nunca substitui a decisão final do humano
- o humano pode pausar ou retomar a IA a qualquer momento
- o sistema registra todas as ações da IA e a aprovação do humano

---

## 7. Estrutura das páginas

### Página principal de atendimento

- /atendimento
- visão unificada da fila e das conversas

### Página de conversa específica

- /atendimento/[conversaId]
- exibe conversa, contexto CRM e IA em uma única tela

### Página de filas e SLA

- /atendimento/filas
- visão de queue, tempo médio, SLA e produtividade

### Página de histórico e auditoria

- /atendimento/historico
- registro completo de mensagens, transferências, notas e ações

### Página de analytics operacional

- /atendimento/analytics
- métricas de atendimento, tempo médio, produtividade, volume e resposta

---

## 8. Componentes React necessários

Os componentes abaixo devem ser pensados como blocos de interface reutilizáveis.

### Interface principal

- AtendimentoShell
- ConversaListPanel
- ConversaThreadPanel
- CRMInsightPanel
- AtendimentoHeader
- AtendimentoFiltersBar

### Conversa

- ConversaMessageBubble
- MessageComposer
- MessageAttachmentPicker
- QuickReplyBar
- TemplatePicker
- TypingIndicator
- DeliveryStatusBadge

### CRM contextual

- EmpresaCard
- ContatoCard
- OportunidadeCard
- PropostaCard
- TaskListCard
- DossieCard
- RadarJoaoCard
- IAInsightCard
- NextActionCard

### Operação humana

- TransferConversationModal
- AssignConversationModal
- InternalCommentDrawer
- InternalNotePanel
- SLAStatusWidget
- QueueStatusWidget

---

## 9. Serviços necessários

### 1. Ingestão de mensagens

Responsável por receber mensagens do WhatsApp Meta Cloud API e normalizar eventos para o modelo interno do CRM.

### 2. Orquestração de conversa

Responsável por manter o estado da conversa, associar contexto, aplicar regras e disparar automações.

### 3. Serviço de IA

Responsável por:
- classificar intenção
- resumir conversa
- sugerir resposta
- sugerir próxima ação
- detectar urgência
- produzir insights comerciais

### 4. Serviço de contexto comercial

Responsável por enriquecer a conversa com dados do CRM: empresa, contato, oportunidade, proposta, tarefas e histórico.

### 5. Serviço de notificações

Responsável por enviar notificações desktop, som, badge e notificações internas em tempo real.

### 6. Serviço de fila e SLA

Responsável por gerenciar fila, tempo médio, prioridade, escalonamento e status operacional.

### 7. Serviço de arquivos e mídia

Responsável por receber, armazenar, associar e disponibilizar anexos, imagens, PDF e documentos.

### 8. Serviço de auditoria

Responsável por registrar eventos, transferências, mudanças de status, ações da IA e histórico operacional.

---

## 10. Eventos em tempo real

A Central de Atendimento precisa funcionar em tempo real e sem refresh.

### Eventos principais

- nova mensagem recebida
- mensagem enviada com status de entrega
- mensagem lida
- digitação em andamento
- conversa atribuída
- conversa transferida
- comentário interno adicionado
- nota interna criada
- sugestão de IA atualizada
- tarefa criada automaticamente
- oportunidade criada automaticamente
- status de fila alterado
- SLA alterado

### Indicadores em tempo real

- digitando
- online
- última visualização
- enviada
- entregue
- lida
- erro

### Requisitos de experiência

- atualização instantânea da lista de conversas
- atualização instantânea da thread
- atualização instantânea do painel direito
- notificações sem recarregar a página

---

## 11. Banco de dados necessário

O modelo precisa ser expandido para suportar o novo centro operacional.

### Entidades principais

- CanalWhatsapp
- Conversa
- Mensagem
- Atendente
- FilaAtendimento
- TransferenciaConversa
- ComentarioInterno
- NotaInterna
- TemplateResposta
- TemplateMensagem
- EventoAtendimento
- Tarefa
- Empresa
- Pessoa
- Oportunidade
- PropostaComercial
- DossieComercial
- RelatorioIA

### Relações importantes

- Conversa pertence a um canal e a um atendente
- Mensagem pertence a uma conversa
- Transferência registra histórico de mudança de responsável
- Comentários e notas pertencem a uma conversa ou a um ticket operacional
- IA pode gerar tarefas, oportunidades, insights e próximos passos vinculados à conversa

### Dados críticos para suporte operacional

- status da conversa
- responsável atual
- prioridade
- tempo de resposta
- tempo de resolução
- última interação
- mensagens não lidas
- origem da mensagem
- contexto comercial associado

---

## 12. APIs necessárias

### APIs de entrada

- webhook de entrada do WhatsApp Meta
- webhook de status de entrega e leitura
- webhook para eventos de mídia

### APIs de atendimento

- listar conversas
- buscar conversa por ID
- enviar mensagem
- enviar mídia
- responder mensagem específica
- transferir conversa
- assumir conversa
- pausar/retomar IA
- criar comentário interno
- criar nota interna
- buscar histórico completo

### APIs de contexto CRM

- obter empresa vinculada
- obter contato vinculado
- buscar oportunidade
- buscar proposta
- buscar tarefas
- buscar dossiê
- buscar Radar João

### APIs de IA

- resumir conversa
- sugerir resposta
- sugerir próxima ação
- classificar urgência
- classificar intenção
- criar tarefa/operação

### APIs de tempo real

- subscriptions para eventos de mensagem e status
- broadcast de presença e atividade
- notificações internas

---

## 13. Roadmap de implementação por Sprints

### Sprint 1 — Fundação da Central

Objetivos:
- definir estrutura da tela principal em 3 colunas
- criar fluxo básico de conversas
- integrar recebimento de mensagens do WhatsApp Meta
- criar persistência de conversa e mensagem

Entregáveis:
- primeira versão da interface de atendimento
- mensagens chegando no CRM
- histórico básico de conversa

### Sprint 2 — Atendimento humano básico

Objetivos:
- permitir resposta de texto
- mostrar status de envio, entrega e leitura
- criar fila de conversas
- implementar transferência e atribuição

Entregáveis:
- atendimento humano funcional dentro do CRM
- fluxo operacional simples

### Sprint 3 — Contexto comercial

Objetivos:
- integrar painel de empresa, contato, oportunidade e proposta
- mostrar histórico comercial na lateral
- criar vínculo com CRM existente

Entregáveis:
- tela de atendimento com contexto comercial completo

### Sprint 4 — IA assistente

Objetivos:
- implementar resumo de conversa
- sugerir resposta
- sugerir próxima ação
- detectar urgência e intenção de compra

Entregáveis:
- copiloto IA com sugestões úteis

### Sprint 5 — Automação operacional

Objetivos:
- criar tarefas automaticamente
- criar oportunidades automaticamente
- sugerir follow-up
- registrar notas internas e comentários

Entregáveis:
- automações operacionais de primeira geração

### Sprint 6 — Tempo real avançado

Objetivos:
- presença online
- digitação em tempo real
- notificações desktop e internas
- atualização automática de filas

Entregáveis:
- experiência de atendimento quase instantânea

### Sprint 7 — SLA, filas e produtividade

Objetivos:
- métricas de tempo médio
- SLA e priorização
- gestão por responsável
- painel operacional para supervisão

Entregáveis:
- gestão profissional de atendimento

### Sprint 8 — Excelência comercial

Objetivos:
- IA com recomendação comercial mais avançada
- integração completa com Radar João, dossiê e maturidade comercial
- melhor experiência para equipe comercial

Entregáveis:
- central de atendimento completa, superior ao Chatwoot e integrada ao CRM Villa

---

## Conclusão

A Central de Atendimento do Villa CRM deve ser construída como uma plataforma operacional completa, não como um simples inbox de mensagens. Ela deve concentrar comunicação, contexto comercial, automação, IA e produtividade em uma única experiência.

O diferencial estratégico não é apenas atender melhor. É transformar o CRM em o centro do relacionamento comercial da empresa, com o cliente sempre no fluxo do negócio e a equipe comercial operando com mais velocidade, mais contexto e mais previsibilidade.
