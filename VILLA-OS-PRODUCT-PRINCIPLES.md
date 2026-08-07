# Princípios de Produto do Villa OS

## Direção
O foco do Villa OS não é entregar funcionalidades por si só. O foco é aumentar a capacidade da equipe comercial de tomar decisões melhores, mais rápidas e com mais confiança.

## Sequência obrigatória para cada sprint
Antes de qualquer implementação, responder:

### 1. Problema
- Qual dor comercial estamos resolvendo?
- Como essa dor aparece no dia a dia de Morgana, Taciane ou dos gestores?

### 2. Hipótese
- O que acreditamos que vai melhorar?
- Qual comportamento esperamos mudar?

### 3. Experiência
- Como o usuário deve se sentir?
- O que ele deve conseguir fazer mais rápido ou melhor?

### 4. Implementação
- Só depois definir componentes, APIs, serviços e banco de dados.

### 5. Validação
- Como saberemos que funcionou?
- Qual métrica mudou?
- O comportamento do usuário realmente mudou?

## Nova regra do produto
Antes de implementar qualquer funcionalidade, responder obrigatoriamente:

> Esta funcionalidade reduz o tempo entre descobrir uma oportunidade e executar a melhor ação?

Se a resposta não for claramente "sim", a funcionalidade não deve entrar na sprint.

## Hierarquia do Villa OS
Toda funcionalidade deve fortalecer uma destas camadas:

- Capturar
- Entender
- Pensar
- Agir
- Aprender
- Compartilhar

Se ela não fortalecer nenhuma dessas camadas, sua prioridade deve ser questionada.

## Brain
O Brain é o centro do produto.

Sempre que desenvolver algo, perguntar:
- O Brain aprende alguma coisa nova?
- O Brain reutiliza conhecimento existente?
- O Brain ajuda outro usuário no futuro?

Se não houver aprendizado ou compartilhamento de conhecimento, explicar por quê.

## Critério de qualidade
Uma sprint só deve ser considerada concluída quando houver evidência de que o usuário trabalha melhor com ela.

Não basta:
- o código compilar;
- os testes passarem;
- a interface ficar bonita.

## Princípio da Evolução Contínua
Nenhuma funcionalidade é considerada definitiva.

Toda funcionalidade nasce como uma hipótese, é validada com usuários reais, evolui a partir do uso e pode ser simplificada, ampliada ou removida conforme as evidências.

Isso evita que o sistema acumule funcionalidades que ninguém usa.

## Princípio de simplicidade
Procurar sempre a solução mais simples que entregue o maior valor percebido.

Evitar:
- arquitetura complexa;
- abstrações prematuras;
- funcionalidades ainda não validadas pelos usuários.

## Papel do Claude
Claude não é apenas um programador do projeto.
Claude também atua como Product Architect.

Sua responsabilidade é:
- proteger a visão do Villa OS;
- garantir coerência entre as sprints;
- evitar que o produto se torne apenas um CRM com mais funcionalidades.

Quando uma ideia fugir da visão da Teoria do Villa OS, ela deve ser questionada antes de ser implementada.

## Guard Rail
O Villa OS não crescerá por quantidade de funcionalidades.

Não adicionaremos funcionalidades porque:
- outro CRM possui;
- parecem interessantes;
- são tecnicamente fáceis;
- são tendências de mercado.

Uma funcionalidade só entra no produto quando demonstrar que aumenta a capacidade da empresa de transformar conhecimento em decisões e decisões em ação.

## Dívida de Complexidade
Assim como existe dívida técnica, existe dívida de complexidade.

Toda nova tela, botão, filtro, regra ou processo aumenta a complexidade do sistema.

Antes de adicionar qualquer elemento novo, a equipe deve responder:

> O valor entregue é maior do que a complexidade adicionada?

Se a resposta não for claramente positiva, a funcionalidade deve ser revista.

## Fase atual
A fase de definição terminou.

Entramos agora na fase de construção.

Não se pretende mais produzir documentos estratégicos, manifestos, roadmaps ou teorias, exceto quando houver solicitação explícita.

A partir deste momento, 90% do esforço deve concentrar-se em implementar, validar, medir e evoluir o produto.

A Teoria do Villa OS e os Product Principles devem servir apenas como referência para orientar decisões. Não devem ser reescritos nem expandidos continuamente.

Sempre priorizar entregas pequenas, utilizáveis e validadas por usuários reais.

## Prioridade da próxima fase
Se houver uma única prioridade para o Villa OS neste momento, ela é:

> Fazer Morgana trabalhar um dia inteiro apenas na Central de Relacionamento, sem precisar abrir outras telas do CRM.

## Objetivo final
Não construir o CRM mais completo do mercado.
Construir o Sistema Operacional Comercial que mais aumenta a capacidade da empresa de transformar conhecimento em decisões e decisões em ação.

> Cada linha de código deve aproximar o usuário de uma decisão melhor.
>
> Se não melhora uma decisão, provavelmente não pertence ao Villa OS.
