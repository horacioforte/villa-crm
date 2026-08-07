# Regras Operacionais do Villa OS

## Fase atual
A fase de concepção do Villa OS está encerrada.

A partir deste momento, a missão é construir o produto em uso real.

## Constituição do Villa OS
Os documentos abaixo são a referência permanente do projeto:

- THEORIA-VILLA-OS.md
- VILLA-OS-PRODUCT-PRINCIPLES.md
- VILLA-OS-EXECUTION-MODE.md
- MASTER-ROADMAP-VILLA-OS.md
- SPRINT-SCORECARD.md
- SPRINT-VALIDATION-TEMPLATE.md
- PRODUCT-JOURNAL.md
- RELEASE-NOTES.md

Esses documentos são a Constituição do Villa OS.

A partir deste momento, não devem ser criados novos documentos estratégicos, teorias ou manifestos, salvo solicitação explícita.

## Missão principal
A missão agora é construir o Villa OS.

O sucesso é medido pela evolução do produto em uso real, e não pela quantidade de código ou documentação produzida.

## Primeiro objetivo
Transformar a Central de Relacionamento no principal ambiente de trabalho da equipe comercial.

O objetivo é que Morgana e Taciane consigam trabalhar praticamente o dia inteiro dentro dessa tela, sem depender de outras áreas do CRM.

## Forma de trabalho
Trabalhar em ciclos curtos.

### 1. Diagnóstico
Antes de programar:
- analisar o estado atual do código;
- identificar o que já existe;
- identificar o que falta para cumprir o objetivo da sprint;
- propor o menor conjunto de mudanças possível.

### 2. Plano
Apresentar apenas:
- problema que será resolvido;
- hipótese;
- impacto esperado;
- arquivos que serão alterados;
- riscos;
- critérios de aceite.

Aguardar aprovação quando houver mudanças arquiteturais relevantes.

### 3. Execução
Durante a implementação:
- reutilizar componentes existentes;
- preservar o padrão atual do projeto;
- evitar duplicação;
- manter baixo acoplamento;
- manter alta legibilidade.

Implementar apenas o escopo da sprint.

### 4. Validação
Ao concluir:
- executar testes;
- validar tipos;
- validar lint;
- confirmar ausência de regressões;
- descrever exatamente o que mudou.

### 5. Entrega
Ao final de cada sprint entregar apenas:
- O que foi implementado;
- Qual problema foi resolvido;
- Como isso melhora o trabalho de Morgana e Taciane;
- O que precisa ser validado pelos usuários;
- Qual será a próxima sprint recomendada.

## Regras obrigatórias
Antes de qualquer implementação responder:

> Esta funcionalidade reduz o tempo entre descobrir uma oportunidade e executar a melhor ação?

Se não reduzir, explicar por que ela ainda merece entrar.

Toda funcionalidade deve fortalecer pelo menos uma etapa do ciclo:
- Capturar
- Entender
- Pensar
- Agir
- Aprender
- Compartilhar

Toda implementação deve responder também:
- O Brain aprende algo novo?
- O Brain reutiliza conhecimento?
- O Brain aumenta o conhecimento coletivo da empresa?

## O que não fazer
- não criar documentação estratégica nova;
- não criar funcionalidades sem validação de valor;
- não aumentar a complexidade sem justificativa;
- não desenvolver funcionalidades apenas porque outros CRMs possuem;
- não perder tempo com arquitetura futurista quando uma solução simples atende ao problema atual.

## Prioridade absoluta
Até nova orientação, todo o esforço deve estar concentrado em transformar a Central de Relacionamento em um verdadeiro Workspace Comercial, onde o vendedor:
- entende o cliente em segundos;
- recebe contexto automaticamente;
- sabe qual é a melhor próxima ação;
- executa essa ação sem trocar de tela.

## Meta da primeira entrega
A meta da primeira grande etapa é fazer Morgana dizer espontaneamente:

> "Agora eu consigo trabalhar praticamente o dia inteiro dentro desta tela."

Essa será a principal medida de sucesso da primeira etapa do Villa OS.
