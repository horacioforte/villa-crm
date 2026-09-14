# PROJETO: Proteção do CRM — Villa Empreendimentos

## Contexto

CRM da Villa Empreendimentos em produção em `villa-crm.vercel.app`.
Stack: Next.js App Router + Prisma + PostgreSQL (Neon) + Vercel.
Repositório: `github.com/horacioforte/villa-crm` (branch `main` → auto-deploy no Vercel).

Regra absoluta vigente em todo o sistema:
**NUNCA excluir, desativar ou cancelar qualquer código, configuração, instância de IA,
variável de ambiente, arquivo, inbox, regra ou "cérebro" das IAs sem autorização
explícita de Horácio. Acrescentar e criar é sempre permitido sem autorização.**

---

## 1. BACKUPS DO BANCO (Neon)

### Situação atual
- Banco: PostgreSQL hospedado no Neon (`ep-aged-shadow-ajf1ygiz-pooler.c-3.us-east-2.aws.neon.tech`)
- Neon mantém histórico automático (point-in-time restore) por período configurável
- Não existe rotina de backup externo automatizada ainda

### O que construir
- [ ] Verificar período de retenção atual no Neon Console → Settings → Point-in-time restore
- [ ] Criar script `scripts/backup-banco.ts` que exporta snapshot das tabelas críticas para arquivo `.json` na pasta `/backups/`
- [ ] Agendar execução semanal automática via tarefa agendada no Cowork
- [ ] Documentar no CLAUDE.md como fazer restore via Neon Console

### Tabelas críticas (prioridade de backup)
- `DossieComercial` — dossiês comerciais (coração do sistema)
- `DossieCarteira` — vínculos com carteiras estratégicas
- `DecisorDossie` — decisores identificados pelo João
- `AtualizacaoDossie` — log completo de atividade
- `EmpresaDossie` — empresas mapeadas
- `Oportunidade` — oportunidades assumidas pelo comercial

---

## 2. AUDITORIA DE MUDANÇAS

### Situação atual
- `AtualizacaoDossie` registra todas as alterações de conteúdo nos dossiês (quem, quando, o quê)
- Git registra todas as mudanças de código com autor, data e mensagem de commit
- Não existe painel unificado de auditoria ainda

### O que construir
- [ ] Página `/admin/auditoria` que exibe:
  - Últimas 100 entradas de `AtualizacaoDossie` com filtro por agente/tipo/data
  - Tabela com: data, agente, dossiê afetado, tipo de mudança, conteúdo resumido
- [ ] Endpoint `GET /api/admin/auditoria` com paginação e filtros
- [ ] Relatório semanal por e-mail: resumo do que João e Morgana fizeram na semana

### Agentes registrados no sistema
- `joao-radar` — varredura semanal de obras
- `joao-hunter` — investigação de dossiês
- `morgana` — análise e validação
- `comercial` / `manual` — equipe Villa
- `sistema` / `webhook` — automações

---

## 3. REGRAS DE SEGURANÇA

### Regras vigentes (documentadas e em vigor)

**R1 — Nunca cancelar**
Nunca excluir, desativar ou cancelar qualquer código, configuração, instância de IA,
variável de ambiente, arquivo, inbox, regra ou "cérebro" das IAs sem autorização
explícita de Horácio.

**R2 — CONSTRUTORAS é READ ONLY**
Não alterar `investigador-construtora.ts`, `investigador-contato.ts`, cron,
scores, semântica de estados, `vercel.json`. Apenas apresentação.

**R3 — Sem criação automática de oportunidades**
Não criar oportunidades, prospects, campanhas ou mensagens automaticamente.

**R4 — Sem informar preços**
Nunca informar preços. Sempre redirecionar para equipe comercial.

**R5 — Momento = null quando sem evidência temporal**
Não preencher `momentoVilla` para aumentar maturidade artificialmente.

**R6 — Status nunca regride**
Um dossiê nunca volta a um status anterior durante reclassificação automática.

**R7 — Separação Radar × Carteiras**
Dossiês do Radar João (sem `DossieCarteira`) não se misturam com
Carteiras Estratégicas (com `DossieCarteira`) no Kanban.

### O que construir
- [ ] Página `/admin/seguranca` que exibe todas as regras acima de forma legível
- [ ] Checklist de compliance: verificar automaticamente se as regras estão sendo respeitadas no banco
- [ ] Alerta se algum dossiê de Carteira aparecer em query de Radar (sanity check)

---

## 4. MONITORAMENTO

### Situação atual
- Nenhum alerta automatizado configurado
- Falhas só são descobertas quando alguém acessa o sistema

### O que construir
- [ ] Health check `GET /api/health` que verifica:
  - Conexão com o banco (Neon)
  - Última execução do João (verificar `AtualizacaoDossie` mais recente de `joao-radar`)
  - Build status (via Vercel API ou webhook)
- [ ] Tarefa agendada diária: rodar health check e enviar alerta por e-mail se algo falhar
- [ ] Alerta se João ficar mais de 7 dias sem criar nenhuma `AtualizacaoDossie`
- [ ] Alerta se o build no Vercel falhar (webhook Vercel → e-mail)

---

## 5. ACESSO E CREDENCIAIS

### Inventário (preencher e manter atualizado)

| Serviço | Onde fica | Quem tem acesso |
|---|---|---|
| Banco Neon | console.neon.tech | Horácio |
| Vercel (deploy) | vercel.com/horacioforte | Horácio |
| GitHub (código) | github.com/horacioforte/villa-crm | Horácio |
| DATABASE_URL | `.env.local` na máquina + Vercel env vars | Horácio |
| Chaves de API dos agentes IA | Vercel env vars | Horácio |

### O que construir
- [ ] Documentar todas as variáveis de ambiente usadas no sistema (sem os valores)
- [ ] Checklist de rotação de credenciais (a cada 90 dias)
- [ ] Política de acesso: quem pode fazer o quê no CRM por papel
  - `ADMIN` → tudo
  - `GERENTE` → pode assumir dossiês, ver carteiras, não pode alterar configs
  - `USUARIO` → leitura + ações comerciais básicas

---

## Ordem de execução sugerida

1. **Agora (rápido):** Verificar período de retenção no Neon Console
2. **Semana 1:** Script de backup semanal + health check endpoint
3. **Semana 2:** Página `/admin/auditoria`
4. **Semana 3:** Página `/admin/seguranca` + alertas automáticos
5. **Semana 4:** Documentar credenciais + política de acesso

---

## Para usar este briefing

Cole este documento no início de uma nova conversa no Claude com a instrução:

> "Vamos trabalhar no Projeto de Proteção do CRM da Villa. O briefing está acima.
> Quero começar pela tarefa [X]. O repositório está em `/Users/horacioforte/Desktop/villa-crm`."
