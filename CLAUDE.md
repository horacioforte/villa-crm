@AGENTS.md

## PENDÊNCIA — Allowlist de rede (Cowork)

Data: 10/07/2026

O domínio `villa-crm.vercel.app` está bloqueado pelo allowlist de rede do ambiente Cowork
(erro `403 blocked-by-allowlist` ao chamar `GET`/`POST` em `/api/agent/dossies` e `/api/agent/dossie`).

Isso impede o agente do Radar João (tarefa agendada "radar-joao-linkedin-diario" e o Radar
João semanal) de criar Dossiês Comerciais automaticamente na Central de Inteligência — hoje
o agente só consegue deixar os payloads prontos para lançamento manual.

O mecanismo de exibir a origem já existe no CRM: cada Dossiê Comercial tem uma seção "Fonte"
na página de detalhe (`/inteligencia/[id]`) que mostra o texto de `fonteInformacao` (ex.:
"LinkedIn — Sávio Soares") com um link "Ver fonte" para `linkFonte`. Não precisa de nenhuma
mudança no CRM — só liberar a rede.

Ação pendente (fazer manualmente): em Configurações do Cowork → Capabilities → allowlist de
rede, adicionar `villa-crm.vercel.app` (e o domínio da API, se for diferente). Depois disso, o
Radar João volta a criar os dossiês automaticamente, já com "Fonte: LinkedIn — [pessoa/empresa]"
visível em cada card, sem passar por Oportunidade direta.

**ATUALIZAÇÃO — 11/07/2026:** Na execução de hoje do Radar João (LinkedIn Intelligence), o
`GET` e o `POST` em `villa-crm.vercel.app/api/agent/dossies` e `/api/agent/dossie` funcionaram
normalmente (HTTP 200, sem erro de allowlist). Não está claro se a pendência acima foi resolvida
definitivamente ou se foi uma liberação pontual/intermitente — recomenda-se que Horácio confirme
em Configurações do Cowork → Capabilities se `villa-crm.vercel.app` já está na allowlist de forma
permanente. Enquanto isso não for confirmado, as próximas execuções do Radar João devem continuar
tentando o GET/POST normalmente (Passo 0 + criação de dossiê) e só cair no modo de payload manual
se a chamada falhar de fato.
