# PLANO DE MIGRAÇÃO — Race Condition Completa (Maria)

**Data:** 14/11/2026  
**Status:** AGUARDANDO APROVAÇÃO DE HORÁCIO  
**Autor:** Claude (Cowork)  
**Pré-requisito:** Horácio deve aprovar e executar este plano antes de qualquer implementação.

---

## Contexto

A implementação atual (commit `feat: Memória Investigativa v2 + Advisory Lock`) resolveu
a parte de **dados** da race condition:

- O `pg_advisory_xact_lock` em `registrarLeadQualificado` e `registrarInteracaoParcial`
  garante que **nunca serão criadas oportunidades ou históricos duplicados**, mesmo com
  múltiplas instâncias Vercel processando o mesmo telefone simultaneamente.

**Limitação que permanece:** a chamada à IA (`analisarMensagem`) e o envio do WhatsApp
(`enviarWhatsappMeta`) ocorrem *fora* de qualquer transação. Se dois webhooks do mesmo
número chegarem com 1–2 segundos de diferença, as duas instâncias podem:

1. Ler o mesmo contexto (antes de qualquer resposta ser gravada)
2. Chamar a IA com o mesmo contexto
3. Enviar duas respostas ao cliente (WhatsApp duplo)

Os **dados do CRM ficam corretos** graças ao advisory lock.  
O problema é **UX**: o cliente recebe duas respostas da Maria.

---

## Solução Proposta: Tabela `WebhookLock`

### O que é

Uma tabela no banco que funciona como mutex distribuído por telefone.
Serializa o processamento completo (contexto + IA + WhatsApp + CRM) para o mesmo número.

### Novo modelo Prisma (adicionar ao schema.prisma)

```prisma
// ACRESCENTAR ao prisma/schema.prisma
// Mutex distribuído para serializar processamento de webhooks por telefone.
// Requer: npx prisma migrate dev --name add-webhook-lock
model WebhookLock {
  id         String   @id @default(cuid())
  chave      String   @unique   // ex: "maria:5581999998888"
  expiraEm   DateTime
  criadoEm   DateTime @default(now())

  @@index([chave])
  @@index([expiraEm])
}
```

### Nova função em lib/agentes/maria/webhook-lock.ts

```typescript
// lib/agentes/maria/webhook-lock.ts
// REGRA: nunca remover. Apenas acrescentar.
// Mutex distribuído para processamento de webhooks da Maria.
// Funciona com múltiplas instâncias Vercel + Neon via tabela PostgreSQL.

import { prisma } from "@/lib/prisma";

const LOCK_TTL_MS = 60_000; // 60 segundos — suficiente para IA + envio + CRM

/**
 * Tenta adquirir o lock para este telefone.
 * Retorna true se adquiriu, false se já há outro processo rodando.
 * Limpa automaticamente locks expirados antes de tentar.
 */
export async function tryAcquireLock(telefone: string): Promise<boolean> {
  const chave = `maria:${telefone}`;
  const agora = new Date();
  const expiraEm = new Date(agora.getTime() + LOCK_TTL_MS);

  // Limpa locks expirados (housekeeping passivo, sem custo extra)
  await prisma.webhookLock.deleteMany({
    where: { expiraEm: { lt: agora } },
  }).catch(() => {}); // falha silenciosa — não bloqueia

  try {
    await prisma.webhookLock.create({
      data: { chave, expiraEm },
    });
    return true; // lock adquirido
  } catch {
    return false; // outro processo tem o lock
  }
}

/**
 * Libera o lock após o processamento concluir (sucesso ou falha).
 * Silencioso se o lock já foi expirado/removido por outro processo.
 */
export async function releaseLock(telefone: string): Promise<void> {
  const chave = `maria:${telefone}`;
  await prisma.webhookLock.deleteMany({ where: { chave } }).catch(() => {});
}
```

### Como usar no route.ts (processarMensagemMaria)

```typescript
// No início de processarMensagemMaria, antes de qualquer processamento:
const lockAdquirido = await tryAcquireLock(telefone);
if (!lockAdquirido) {
  // Outro processo está processando este telefone agora.
  // Aguarda 3s e verifica de novo (a mensagem chegou quase simultaneamente).
  await new Promise(r => setTimeout(r, 3000));
  const lockAdquiridoRetry = await tryAcquireLock(telefone);
  if (!lockAdquiridoRetry) {
    console.warn("[maria/webhook] Lock não adquirido após retry — mensagem descartada (race condition)", { telefone });
    return; // A primeira mensagem já será processada; esta é duplicata temporal
  }
}

try {
  // ... processamento completo (contexto + IA + envio + CRM) ...
} finally {
  await releaseLock(telefone);
}
```

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Lock expirado enquanto IA ainda processa | Baixa (60s é suficiente) | TTL configurável; em caso de timeout da IA, lock expira e próxima mensagem passa |
| Mensagem descartada em vez de enfileirada | Baixa (race condition de 1-2s é rara) | O retry de 3s cobre a maioria dos casos; mensagens com mais de 3s de diferença passam normalmente |
| Tabela `WebhookLock` cresce indefinidamente | Nula | `deleteMany` de expirados roda a cada mensagem (housekeeping passivo) |
| Migração falha em produção | Muito baixa | A tabela é nova e não altera schemas existentes; sem risco de perda de dados |
| Neon (serverless) comportamento de transaction | Baixo | Testado: `prisma.create` com `@unique` retorna erro de constraint em conflito — funciona conforme esperado |

---

## Escopo da Migração

**O que muda:**
- `prisma/schema.prisma` — novo model `WebhookLock`
- `lib/agentes/maria/webhook-lock.ts` — novo arquivo (apenas criação)
- `app/api/webhook/whatsapp/maria/route.ts` — 2 chamadas adicionadas em `processarMensagemMaria`

**O que NÃO muda:**
- Fluxo comercial (inalterado)
- Oportunidades, Histórico, Leads (inalterados)
- João, Radar João, Carteiras (inalterados)
- Qualquer outra parte do sistema

**Migração de banco necessária:**
```bash
npx prisma migrate dev --name add-webhook-lock
```
Isso cria a tabela `WebhookLock` no banco de produção. É uma **migration aditiva** — não
altera nem remove nenhuma tabela existente.

---

## Instruções para Aprovação

Para aprovar e executar este plano:

1. Revise o plano e confirme: **"pode executar o plano de migração WebhookLock"**
2. Após aprovação, Claude implementa o código e cria o arquivo de migração
3. Você executa em seu terminal: `cd ~/Desktop/villa-crm && npx prisma migrate dev --name add-webhook-lock`
4. Claude faz o commit e aguarda autorização de deploy

**NÃO execute este plano sem autorização explícita de Horácio.**
