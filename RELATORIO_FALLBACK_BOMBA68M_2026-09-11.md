# RELATÓRIO — FALLBACK BOMBA 68M
## Camadas 1 e 2 — Implementação e Testes
**Data:** 11/09/2026 | **Commit:** `56acece`

---

## Arquivos alterados

| Arquivo | Tipo de alteração |
|---------|------------------|
| `app/api/contato-bomba/route.ts` | Modificado (+167 linhas, -19 linhas) |

Nenhum schema, migration, enum ou outro arquivo foi alterado.

---

## Identificação da Morgana

| Campo | Valor |
|-------|-------|
| **Método de busca** | `prisma.usuario.findFirst({ where: { email: MORGANA_EMAIL, ativo: true } })` |
| **Email usado** | `comercial@villaempreendimentos.com.br` (constante `MORGANA_EMAIL`) |
| **ID encontrado em produção** | `cmptq79yl0003q7qkc1gmiexn` |
| **Nome** | Morgana |
| **Papel** | GERENTE |
| **ID hardcoded?** | Não — buscado por email a cada request |

Se o email mudar, o sistema loga um aviso (`console.warn`) e cria a Tarefa sem responsável — o lead não é perdido.

---

## Camada 1 — Tarefa atribuída à Morgana

**O que foi implementado:**
- Antes da transaction, busca `responsavelId` da Morgana via email
- `tarefa.create` passa `responsavelId: morganaId`
- Se Morgana não encontrada: Tarefa criada sem responsável (fallback seguro)

**Campo usado:** `responsavelId` (não `usuarioId` — TypeScript confirmou o campo correto)

---

## Camada 2 — HistoricoContato de status do WhatsApp

**O que foi implementado:**
- `dispararWhatsApp()` agora retorna `WhatsAppDispatchResult { ok, templateOk, contextoOk, telefone, erro? }`
- `enviarTemplateBomba68m()` e `enviarMensagemContextoMaria()` retornam `boolean`
- Após tentativa, cria um segundo `HistoricoContato` com status real

**Se sucesso (`wapp.ok = true`):**
- `resumo: "[Bomba 68m] WhatsApp disparado ✅"`
- `detalhes`: nome, empresa, telefone E.164, template, data/hora — sem credenciais
- Título da Tarefa: inalterado (`[Bomba 68m] Lead: ...`)

**Se falha (`wapp.ok = false`):**
- `resumo: "[Bomba 68m] WhatsApp falhou — contato manual necessário ⚠️"`
- `detalhes`: nome, empresa, telefone E.164, erro retornado, orientação de contato — sem credenciais
- Título da Tarefa atualizado para `⚠️ CONTATO MANUAL — Lead Bomba 68m: {nome} ({empresa})`
- `prioridade: URGENTE` (mantida)

---

## Cenário B — Falha simulada do WhatsApp (testado)

**Payload enviado:**
```json
{
  "nome": "TESTE CENARIO B",
  "empresa": "CONSTRUTORA FALLBACK TEST LTDA",
  "telefone": "81988887777",
  "cidade": "Recife", "uf": "PE",
  "score": 97, "temperatura": "QUENTE",
  "classificacao": "Alto potencial",
  "utm_source": "teste_cenario_b"
}
```

**Resultado HTTP:** `200 { success: true }`

### Registros criados

| Item | Resultado |
|------|-----------|
| Empresa | ✅ CONSTRUTORA FALLBACK TEST LTDA — Recife/PE |
| oportunidades | ✅ 0 |
| observacoes | ✅ null |
| Pessoa | ✅ TESTE CENARIO B |
| HistoricoContato #1 | ✅ Diagnóstico completo (score 97/100, classificação Alto potencial) |
| HistoricoContato #2 | ✅ `[Bomba 68m] WhatsApp falhou — contato manual necessário ⚠️` |
| Tarefa título | ✅ `⚠️ CONTATO MANUAL — Lead Bomba 68m: TESTE CENARIO B (CONSTRUTORA FALLBACK TEST LTDA)` |
| Tarefa prioridade | ✅ URGENTE |
| Tarefa responsável | ✅ **Morgana** |
| Tarefa status | ✅ PENDENTE |
| Oportunidade | ✅ Não criada |

### HistoricoContato #1 (diagnóstico)
```
resumo: "Diagnóstico Bomba 68m recebido | origem: landing-bomba-68m | canal: LANDING_BOMBA_68M
         | produto: BOMBA_LANCA — CONSTRUTORA FALLBACK TEST LTDA — Recife/PE — Score: 97/100 | Alto potencial"
createdAt: 2026-09-11T18:08:28.877Z
```

### HistoricoContato #2 (status WhatsApp)
```
resumo: "[Bomba 68m] WhatsApp falhou — contato manual necessário ⚠️"
createdAt: 2026-09-11T18:08:29.631Z
detalhes:
  ⚠️ FALHA NO DISPARO DO WHATSAPP — CONTATO MANUAL NECESSÁRIO
  Empresa: CONSTRUTORA FALLBACK TEST LTDA
  Contato: TESTE CENARIO B
  Telefone (normalizado E.164): 5581988887777
  Template tentado: villa_bomba_68m
  Data/hora da tentativa: 2026-09-11T18:08:29.xxx
  Erro retornado: Meta API recusou o template (template não aprovado ou número inválido)
  AÇÃO NECESSÁRIA: Entrar em contato manualmente pelo WhatsApp do lead.
  PRIORIDADE: URGENTE
  OBSERVAÇÃO: Nenhuma credencial ou token está registrada neste log.
```

---

## Cenário A — WhatsApp com sucesso (não testável até template aprovado)

O código está implementado e verificado. Quando `wapp.ok = true`:
- HistoricoContato criado com `resumo: "[Bomba 68m] WhatsApp disparado ✅"`
- Tarefa mantém título original `[Bomba 68m] Lead: ...`
- Tarefa mantém responsável: Morgana

**Será testado assim que o template `villa_bomba_68m` for aprovado pela Meta.**

---

## Confirmações finais

| Item | Status |
|------|--------|
| Migration criada? | ❌ Não — zero alterações de schema |
| Enum novo criado? | ❌ Não |
| Oportunidade criada? | ❌ Não (oportunidades: 0 confirmado) |
| Central de Concreto afetada? | ❌ Não — arquivo não tocado |
| Token/credencial gravada em log? | ❌ Não — `buildDetalhesWhatsAppFalha()` omite explicitamente |
| TypeScript errors? | ✅ Zero (`tsc --noEmit` limpo antes do commit) |
| Lead perdido em caso de falha? | ✅ Não — Empresa + Pessoa + HC + Tarefa (Morgana) sempre criados |

---

## Próximos passos

1. **Submeter template `villa_bomba_68m`** para Meta (ver guia no relatório de auditoria)
2. **Após aprovação**: testar Cenário A com número real
3. **Remover dados de teste** manualmente: "CONSTRUTORA FALLBACK TEST LTDA" e "CONSTRUTORA TESTE AUDITORIA BOMBA 68M"

*Relatório gerado automaticamente em 11/09/2026 após implementação e testes das Camadas 1 e 2.*
