# Robô gratuito + fila de verificação humana (Base Nacional)

Criado em 08/10/2026. Somente branch Neon `base-nacional-concreteiras` (endpoint `ep-gentle-king-ajo60u4q`) e branch Git `feature/base-nacional-concreteiras`.

## O que o robô faz (custo zero)

1. **Triagem v2** com os dados da Receita já carregados (CNAE, nome, porte, natureza, unidades, interior/capital).
2. **Vínculos** entre candidatas por telefone, e-mail, domínio, endereço e raiz de CNPJ. Chave compartilhada por muitas empresas (escritório de contabilidade) vira vínculo fraco. O vínculo é só indício: nunca copia classificação.
3. **Site próprio**: usa o domínio do e-mail da Receita (ignora Gmail, Hotmail etc. e órgãos públicos). Lê a página inicial e até 3 páginas internas (empresa, serviços, produtos, contato).
   - Respeita robots.txt.
   - Não contorna 401/403/429 nem CAPTCHA.
   - Não faz login nem envia formulário.
   - Usa um cache de 30 dias por página: nenhuma URL é visitada duas vezes no prazo.
4. **Evidências** com URL, data, trecho curto e origem (`agente = robo-gratuito`).
5. **Decisão do robô**:
   - Se o site oficial cita concreto, a empresa vira **Provável** e vai para a fila para uma pessoa confirmar. O robô nunca confirma.
   - Se o site mostra outra atividade, isso fica só como sugestão. O robô nunca marca "não é concreteira".
   - Sem resultado, a empresa continua **Pendente**: segue para a fila (se a triagem pedir verificação) ou fica dispensada.
6. **Empresas já processadas não são repetidas.** Use `reprocessar` só com motivo.
7. Não usa Google, Maps, redes sociais, API paga nem Claude.

Busca fora da base (CNAEs vizinhos): `scripts/base-nacional/robo-cnaes-vizinhos.py` lê os arquivos abertos da Receita e lista empresas ativas sem o CNAE 2330-3/05 cujo nome indica concreto, bombas ou betoneira. Gera CSV e JSON. **Não importa nada**: incluir essas empresas na base depende de autorização.

## Como usar (sem terminal)

1. Abra **Base Nacional → Fila de verificação** (`/comercial/concreteiras/base/fila`).
2. **Administrador**: no quadro amarelo, escolha o estado e clique em **Rodar até terminar o estado** (ou **Rodar 1 lote**). Nesta etapa só PE está liberado.
3. Filtre por estado, prioridade A/B, interior/capital, triagem, potencial ou "Prováveis pelo site (confirmar)".
4. Clique em **Começar revisão**. A empresa fica reservada para você por 20 minutos, para ninguém revisar a mesma ao mesmo tempo.
5. Use os botões **Google, Google Maps, Site, Instagram, Facebook, LinkedIn e CNPJ**. Eles só abrem novas abas.
6. Escolha a decisão. O formulário exige o que cada uma pede:
   - **Confirmada** e **Provável**: confiança, justificativa e link.
   - **Não é concreteira**: link que mostre a outra atividade.
   - **Em verificação**: justificativa.
   - **Sem evidência**: justificativa dizendo onde procurou.

   Responsável e data são gravados automaticamente.
7. Registre também o **potencial para compra de usados**, os equipamentos de interesse, a prioridade de abordagem e a observação comercial.
8. **Gravar e próxima** salva e já abre a próxima empresa livre. **Pular** libera a reserva.
9. **Excel**, **PDF** e **Imprimir** exportam o andamento.

## Travas

- A rota do robô só roda quando o banco configurado é o branch autorizado, e só para ADMIN.
- Toda decisão grava histórico (`FILA_VERIFICACAO`), e o executor só aceita tabelas da Base Nacional.
- Nada cria Empresa, Pessoa, Dossiê, Carteira, Oportunidade ou Tarefa. Nada envia mensagem. Nada é agendado (sem cron).
