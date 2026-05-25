<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
<!-- BEGIN:villa-crm -->
# Villa CRM — Contexto do Projeto

## EMPRESA
Villa Empreendimentos — locação e venda de bombas de concreto e betoneiras.
Site: villaempreendimentos.com.br
Cores: azul escuro #1A2E5A, azul médio #1E4FAB, fundo #F4F6FA
Fontes: Montserrat (títulos), Open Sans (corpo)

## STACK
Next.js 14, TypeScript, Tailwind, shadcn/ui, Prisma, PostgreSQL, NextAuth v5, Zod, Sonner

## HIERARQUIA
Filial → Empresa → Pessoa → Obra → Oportunidade → HistoricoContato

## PIPELINE
LEAD(24h) → PRIMEIRO_CONTATO(48h) → VISITA_TECNICA(72h) → PROPOSTA_ENVIADA(48h) → NEGOCIACAO(72h) → FECHADO → PERDIDO

## REGRAS
- Obra obrigatória em toda oportunidade
- Motivo de perda obrigatório ao mover para PERDIDO
- COMERCIAL vê só as próprias oportunidades
- Histórico imutável — só adiciona, nunca edita
- Temperatura automática: Quente <3d, Morna 3-7d, Fria >7d

## SPRINTS
- ✅ Sprint 1: Login + Empresas (CONCLUÍDO)
- 🔄 Sprint 2: Obras + Contatos (EM ANDAMENTO)
- Sprint 3: Pipeline Kanban + Oportunidades
- Sprint 4: Histórico + Alertas + Importação Excel
- Sprint 5: Dashboard + Go-live
<!-- END:villa-crm -->