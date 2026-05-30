<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:villa-crm -->
# Villa CRM — Contexto Completo do Projeto

## EMPRESA
Villa Empreendimentos — locação e venda de bombas de concreto e betoneiras.
Site: villaempreendimentos.com.br
Produção: https://villa-crm.vercel.app

## IDENTIDADE VISUAL
- Azul escuro: `#1A2E5A` (títulos, sidebar, cabeçalhos)
- Azul médio: `#1E4FAB` (botões primários, links, ícones)
- Azul claro: `#E8EEFB` (badges, fundos leves)
- Fundo cinza: `#F4F6FA`
- Borda: `#D7DEEA`
- Texto secundário: `#667085`
- Border-radius padrão: `rounded-3xl` nos cards, `rounded-2xl` nos botões menores
- Botão primário: `bg-[#1E4FAB] text-white hover:bg-[#1A2E5A]`

## STACK
- **Framework**: Next.js 14 App Router, TypeScript
- **UI**: Tailwind CSS + shadcn/ui (Button, Badge, Card, Dialog, Sheet, Select, Input, Textarea, Table, Sonner)
- **Auth**: Auth.js v5 (NextAuth) com JWT, sessions via `lib/auth/session.ts`
- **Banco**: Prisma 7 + PostgreSQL (Neon) — client gerado em `app/generated/prisma/`
- **Validação**: Zod (schemas em `lib/validations/`)
- **Drag-and-drop**: @dnd-kit/core + @dnd-kit/utilities (Kanban)
- **Toast**: Sonner
- **Datas**: date-fns + ptBR

## ESTRUTURA DE PASTAS
```
app/
  api/
    empresas/[id]/          GET, PATCH, DELETE
    empresas/               GET, POST
    contatos/[id]/          GET, PATCH, DELETE
    contatos/               GET, POST
    obras/[id]/             GET, PATCH, DELETE
    obras/                  GET, POST
    equipamentos/[id]/      GET, PATCH, DELETE
    equipamentos/           GET, POST
    oportunidades/[id]/     GET, PATCH, DELETE
    oportunidades/[id]/propostas/     GET, POST
    oportunidades/[id]/temperatura/   POST (Claude AI)
    oportunidades/          GET, POST
    propostas/[id]/         GET, PATCH, DELETE
    propostas/[id]/enviar/  POST
    propostas/[id]/pdf/     GET
    propostas/[id]/excecoes/                    GET, POST
    propostas/[id]/excecoes/[excecaoId]/        PATCH
    usuarios/[id]/          GET, PATCH, DELETE
    usuarios/[id]/reativar/ POST
    usuarios/[id]/reset-senha/ POST
    usuarios/               GET, POST
  empresas/[id]/page.tsx
  empresas/nova/page.tsx
  empresas/page.tsx
  contatos/[id]/page.tsx
  contatos/novo/page.tsx
  contatos/page.tsx
  obras/[id]/page.tsx
  obras/nova/page.tsx
  obras/page.tsx
  oportunidades/page.tsx    (Kanban com DnD)
  equipamentos/page.tsx
  propostas/[id]/page.tsx
  usuarios/page.tsx
  page.tsx                  (Dashboard — Server Component)
  layout.tsx
  login/page.tsx

components/
  auth/LoginForm.tsx, LogoutButton.tsx
  dashboard/ProposalQuickActions.tsx
  kanban/OportunidadeDetalhe.tsx, OportunidadeModal.tsx
  layout/PageNavigation.tsx
  propostas/PropostaModal.tsx, PropostaPageClient.tsx, PropostaPreview.tsx, PropostasList.tsx
  usuarios/ResetSenhaDialog.tsx, UsuarioFormDialog.tsx, UsuariosClient.tsx
  ui/   (shadcn/ui — NAO EDITAR)

lib/
  auth/permissions.ts       (RBAC: Resource + Action por papel)
  auth/session.ts           (requirePermission, getCurrentUser)
  propostas/
    render.ts               (renderPropostaHtml — HTML completo da proposta)
    service.ts              (buildPropostaBlocosSnapshot, buildPropostaHtmlSnapshot, propostaInclude)
    templates.ts            (PROPOSTA_TEMPLATES, PROPOSTA_VARIAVEIS, buildTemplateBlocosSnapshot)
    pdf.tsx                 (geracao de PDF via React)
  validations/
    oportunidade.ts, proposta.ts, empresa.ts, obra.ts, contato.ts, equipamento.ts, usuario.ts
  audit.ts, prisma.ts, utils.ts

prisma/schema.prisma
```

## HIERARQUIA DE DADOS
```
Filial → Empresa → Pessoa → Obra → Oportunidade → HistoricoContato
                                               ↘ PropostaComercial → PropostaBloco
                                                                   → PropostaExcecaoAprovacao
                                                                   → PropostaAuditoriaCampo
```

## MODELOS PRISMA (campos principais)

### Oportunidade
```
id, titulo, descricao, tipo (LOCACAO|VENDA), status (StatusOportunidade),
valor, probabilidade, origem, motivoPerda, previsaoFechamento, fechadaEm, ativa,
temperatura (TemperaturaOportunidade? — FRIA|MEDIA|QUENTE), temperaturaMotivo,
empresaId (obrigatorio), pessoaId, obraId (obrigatorio), responsavelId, equipamentoId
relations: historicos[], propostas[]
```

### PropostaComercial
```
id, numeroProposta, versao, status (StatusPropostaComercial), templateUtilizado,
valorTotal (Decimal), validadeProposta, prazoExecucao, observacoesComerciais,
observacoesTecnicas, condicoesPagamento, horaExtra (Decimal?),
pdfUrl, wordUrl, htmlSnapshot (Text), oportunidadeId
relations: blocos[], excecoes[], auditorias[]
```

### Enums
```
StatusOportunidade:       NOVA | EM_ATENDIMENTO | PROPOSTA_ENVIADA | NEGOCIACAO | GANHA | PERDIDA
TemperaturaOportunidade:  FRIA | MEDIA | QUENTE
StatusPropostaComercial:  RASCUNHO | AGUARDANDO_APROVACAO | APROVADA | ENVIADA | ACEITA | REJEITADA | VENCIDA | CANCELADA
TipoBlocoProposta:        BLOQUEADO | EDITAVEL | EDITAVEL_COM_APROVACAO
StatusExcecaoProposta:    PENDENTE | APROVADA | REJEITADA
PapelUsuario:             ADMIN | GERENTE | COMERCIAL | OPERACIONAL
TipoOperacao:             LOCACAO | VENDA
```

## AUTENTICACAO E PERMISSOES

Em toda rota de API:
```ts
const authResult = await requirePermission("resource", "action", request);
if (authResult instanceof NextResponse) return authResult;
// authResult.id = userId, authResult.papel = PapelUsuario
```

COMERCIAL so ve oportunidades onde e `responsavelId` OU `createdById`.
Usar `getOportunidadeAccessWhere(id, authResult)` de `lib/propostas/service.ts`.

Permissoes (definidas em `lib/auth/permissions.ts`):
- ADMIN/GERENTE: tudo em todos os recursos
- COMERCIAL: read+create+update em empresas/obras/contatos/oportunidades/propostas; read em equipamentos
- OPERACIONAL: read em tudo

## SISTEMA DE PROPOSTAS

### Template disponivel
- `CBSO` — Caminhao Betoneira com Operador (`disponivel: true`)
- `CBCO` e `ABL` — ainda nao disponiveis

### Variaveis de template (todas em `PROPOSTA_VARIAVEIS`)
`{{cliente}}`, `{{obra}}`, `{{telefone}}`, `{{email}}`, `{{cidade}}`, `{{estado}}`,
`{{tipo_servico}}`, `{{quantidade}}`, `{{descricao_comercial}}`, `{{horas_garantidas}}`,
`{{preco_unitario}}`, `{{valor}}`, `{{hora_extra}}`, `{{prazo}}`, `{{validade}}`,
`{{responsavel}}`, `{{data}}`, `{{numero_proposta}}`, `{{observacoes_comerciais}}`

### Fluxo de criacao de proposta
1. `POST /api/oportunidades/[id]/propostas` com `propostaCreateSchema`
2. API valida: empresa + obra obrigatorios, `valorTotal == quantidade x precoUnitario`
3. `buildNumeroProposta(oportunidadeId)` → `VILLA-{ano}-{ultimos6doId}`
4. `buildPropostaBlocosSnapshot()` substitui variaveis nos blocos do template
5. `buildPropostaHtmlSnapshot()` gera HTML completo e salva em `htmlSnapshot`
6. Persiste com `propostaInclude`, retorna 201

### HTML da proposta (`lib/propostas/render.ts`)
`renderPropostaHtml(data)` gera HTML completo com:
- Banner azul `.prop-header` (#1A2E5A) + numero da proposta
- Barra de cliente `.prop-client-bar`
- Secoes com borda esquerda azul `.section`
- Tabela de precos `.ptab`
- Rodape azul `.prop-footer`

### Governanca de blocos
- `BLOQUEADO`: nao pode editar
- `EDITAVEL`: pode editar diretamente via PATCH
- `EDITAVEL_COM_APROVACAO`: edicao cria `PropostaExcecaoAprovacao` que precisa aprovacao de GERENTE/ADMIN

## TEMPERATURA DE OPORTUNIDADES (IA)

`POST /api/oportunidades/[id]/temperatura`
- Chama Claude API (`claude-haiku-4-5-20251001`) via fetch com contexto da oportunidade
- Requer `ANTHROPIC_API_KEY` no `.env.local`
- Salva `temperatura` (FRIA/MEDIA/QUENTE) e `temperaturaMotivo`
- Kanban: badge 🟢🟡🔴 no card + botao ✨ para classificar sem reload

## KANBAN (app/oportunidades/page.tsx)

- 6 colunas: NOVA, EM_ATENDIMENTO, PROPOSTA_ENVIADA, NEGOCIACAO, GANHA, PERDIDA
- DnD via @dnd-kit — `useDraggable` nos cards, `useDroppable` nas colunas
- PATCH ao soltar o card com optimistic update + rollback em caso de erro
- `OportunidadeDetalhe` (Sheet lateral) abre ao clicar no card
- `OportunidadeModal` para criar/editar oportunidade

## DASHBOARD (app/page.tsx — Server Component)

Dados buscados diretamente via Prisma no servidor:
- Oportunidades abertas (excluindo GANHA/PERDIDA)
- Propostas pendentes com breakdown por status
- Equipamentos disponiveis
- Proximo follow-up (HistoricoContato com proximoContato)
- Ultimas 5 propostas + propostas aguardando aprovacao

## PADROES DE CODIGO

### API Routes
```ts
// params sao Promise no Next.js App Router — sempre await
const { id } = await context.params;

// Erros Zod
if (error instanceof ZodError) {
  return NextResponse.json(
    { message: error.issues[0]?.message ?? "Dados invalidos.", errors: error.flatten().fieldErrors },
    { status: 400 }
  );
}

// Audit log em operacoes de escrita
await auditLog({ action: "ENTITY_CREATED", entity: "EntityName", entityId: record.id, before, after, userId: authResult.id, request });
```

### Validacoes Zod (padroes existentes em `lib/validations/`)
- `optionalText`: string|null → trim, null se vazio
- `requiredDecimal`: string|number → parse BR (virgula como separador decimal)
- `optionalDecimal`: idem mas nullable
- `requiredPositiveInteger`: retorna string (nao number)
- `optionalRelationId`: `"__none__"` vira null

### Importacoes Prisma
```ts
// SEMPRE importar de:
import { ... } from "@/app/generated/prisma/client";
// NUNCA de "@prisma/client"
```

### Componentes Client
```tsx
"use client";
// Fetch com tratamento de erro padrao
const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
if (!response.ok) {
  const payload = await response.json().catch(() => null);
  throw new Error(payload?.message ?? "Mensagem padrao");
}
toast.success("Salvo com sucesso.");
```

## O QUE NAO FAZER

- Nao criar variaveis de template fora de `PROPOSTA_VARIAVEIS` em `templates.ts`
- Nao editar arquivos em `components/ui/` (shadcn gerado automaticamente)
- Nao usar `params.id` diretamente — sempre `const { id } = await context.params`
- Nao rodar `prisma migrate` no codigo — so no terminal localmente
- Nao usar `localStorage` em server components
- Nao importar Prisma client de outro lugar que nao `@/app/generated/prisma/client`

## MIGRACOES (rodar no terminal dentro de /villa-crm)

```bash
npx prisma migrate dev --name nome_da_migracao
npx prisma generate
npx tsc --noEmit   # verificar se nao ha erros de tipo
```

### Status das migracoes
- `add_hora_extra_proposta` — `horaExtra Decimal?` em PropostaComercial ✅
- `add_temperatura_oportunidade` — enum `TemperaturaOportunidade` + campos `temperatura` e `temperaturaMotivo` em Oportunidade (rodar se ainda nao rodou)

## VARIAVEIS DE AMBIENTE NECESSARIAS (.env.local)

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
```
<!-- END:villa-crm -->
