# Prompt para VS Code — Auditoria da integração OpenAI no Loop de Investigação do João

Cole este prompt no GitHub Copilot Chat ou outra extensão de IA do VS Code:

---

## OBJETIVO

Auditar se a integração com a API da OpenAI (GPT-4o) está configurada e funcionando no Loop de Investigação do João no CRM Villa.

---

## PASSO 1 — Verificar OPENAI_API_KEY no ambiente local

```bash
cd ~/Desktop/villa-crm
grep -i "openai" .env.local
```

Mostre o resultado. Se aparecer `OPENAI_API_KEY=sk-...`, está configurada localmente.

---

## PASSO 2 — Verificar se o pacote OpenAI está instalado

```bash
cd ~/Desktop/villa-crm
cat package.json | grep openai
```

Se aparecer `"openai": "..."`, o pacote está instalado.

---

## PASSO 3 — Verificar qual investigador está sendo chamado no endpoint

Abra o arquivo `app/api/agent/joao/investigar/route.ts` e procure por:
- `investigarDossie` — chama apenas Claude
- `investigarDossieCombinado` — chama Claude + GPT-4o em paralelo

Mostre qual das duas funções está sendo importada e usada no handler POST.

---

## PASSO 4 — Verificar se o investigador combinado está ativo

Abra `lib/agentes/joao/investigador-combinado.ts` e confirme:
1. A função `investigarDossieCombinado` existe
2. Ela chama `investigarDossie` (Claude) e `investigarDossieOpenAI` (GPT-4o) em paralelo
3. Os resultados são mesclados (Claude tem prioridade, GPT-4o preenche lacunas)

---

## PASSO 5 — Testar a chamada ao GPT-4o diretamente

```bash
cd ~/Desktop/villa-crm
node -e "
const key = process.env.OPENAI_API_KEY || require('dotenv').config({ path: '.env.local' }) && process.env.OPENAI_API_KEY;
console.log('OPENAI_API_KEY presente:', !!key);
console.log('Primeiros 10 chars:', key ? key.slice(0, 10) + '...' : 'AUSENTE');
"
```

---

## RESULTADO ESPERADO

Me mostre:
1. `OPENAI_API_KEY` está no `.env.local`? (sim/não)
2. Pacote `openai` está no `package.json`? (sim/não, qual versão)
3. O endpoint `/api/agent/joao/investigar` usa `investigarDossie` ou `investigarDossieCombinado`?
4. Se usa o combinado: Claude + GPT-4o estão rodando em paralelo?
5. A chave OpenAI é válida (começa com `sk-`)?

Se o endpoint estiver usando apenas `investigarDossie` (só Claude), isso significa que o GPT-4o **não está ativo** mesmo existindo o código — e precisamos trocar a chamada para `investigarDossieCombinado`.

Se a `OPENAI_API_KEY` estiver ausente no Vercel, os dossiês são investigados só pelo Claude, sem o GPT-4o complementar.
