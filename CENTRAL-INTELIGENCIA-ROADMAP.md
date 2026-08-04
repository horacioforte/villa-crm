# Central de Inteligência — Roadmap de Evolução
_Decisões tomadas em 13/07/2026_

---

## Visão Geral

A Central de Inteligência passa a ter **três módulos** na barra lateral, cada um representando um modo de operação do João Hunter IA.

---

## Módulo 1 — Radar

**O que é:** varredura automática da web em busca de obras, projetos e oportunidades em todo o Brasil.

**Como funciona hoje:** João roda toda segunda-feira (duas tarefas agendadas) e cria Dossiês Comerciais na Central de Inteligência.

**Ao clicar no sidebar:** abre a tela que já existe hoje — lista de dossiês com filtros, scores e status de investigação.

**Novidade aprovada:** a partir de um dossiê específico, o usuário pode solicitar manualmente que João envie um email para o decisor cadastrado — escolhendo o template (OBRA, PRE_MOLDADO ou personalizado). João executa via Brevo. Ação humana explícita, não automática.

---

## Módulo 2 — LinkedIn

**O que é:** monitoramento diário de movimentações de pessoas e empresas no LinkedIn — mudanças de cargo, expansões, contratações de engenharia.

**Como funciona hoje:** João roda todo dia útil (radar-joao-linkedin-diario) e enriquece dossiês com decisores e sinais estratégicos.

**Ao clicar no sidebar:** abre tela dedicada com as descobertas do LinkedIn — pessoas identificadas, empresas monitoradas, movimentações recentes.

**Novidade aprovada:** a partir de uma descoberta do LinkedIn (ex: João identificou o Diretor de Obras da Bracell), o usuário pode solicitar que João envie um email personalizado para aquela pessoa específica. Contextual, ligado à descoberta. Ação humana explícita.

---

## Módulo 3 — Campanhas

**O que é:** módulo independente de disparo de campanhas. Sem vínculo com dossiês nem com as investigações 1 e 2. O usuário traz a lista e define o tipo de abordagem.

**Tipos de campanha:**

| Tipo | Canal | Descrição |
|------|-------|-----------|
| Email pré-moldados | Email (Brevo) | Template específico para fábricas de pré-moldados |
| Email concreteiras | Email (Brevo) | Template para concreteiras e centrais de concreto |
| Email genérico OBRA | Email (Brevo) | Abordagem para obras e construtoras |
| WhatsApp lista | WhatsApp (Evolution API) | Broadcast para lista de clientes especiais |
| WhatsApp individual | WhatsApp (Evolution API) | Mensagem personalizada para contato específico |

**Fluxo de uso:**
1. Usuário escolhe o tipo de campanha
2. Cola ou importa a lista de destinatários (nome, email/telefone, empresa)
3. Revisa e edita o template se quiser
4. Clica "Disparar" — João executa
5. Vê o resultado: enviados, erros, bounces

**Importante:** este módulo é standalone. Não depende de nenhum dossiê existente. É para prospecção por lista, não por inteligência prévia.

---

## Resumo da Arquitetura

```
Central de Inteligência
├── Sidebar
│   ├── 📡 Radar          → lista de dossiês (tela atual) + email sob demanda
│   ├── 💼 LinkedIn       → descobertas do LinkedIn + email sob demanda
│   └── 📣 Campanhas      → disparador standalone (email + WhatsApp)
│
└── Dossiê [id]
    ├── Seção Investigação (Radar + LinkedIn)
    ├── Seção Decisores
    └── Seção Campanhas Enviadas (histórico)
```

---

## Próximos Passos (ordem sugerida)

1. **Sidebar com 3 abas** — estrutura de navegação da Central
2. **Módulo Campanhas** — tela de disparo standalone (email + WhatsApp)
3. **Botão "Enviar Email" no dossiê** — ação humana sobre descoberta do Radar
4. **Botão "Enviar Email" na descoberta LinkedIn** — ação humana sobre descoberta do LinkedIn
