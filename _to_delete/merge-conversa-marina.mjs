// Script avulso e temporário — NÃO faz parte do CRM, só serve para juntar as duas
// conversas duplicadas da Marina no canal da Taciane (telefone contendo 5159223).
//
// Rode no SEU terminal (não no sandbox), dentro da pasta villa-crm, com:
//   node _to_delete/merge-conversa-marina.mjs
// Por padrão só MOSTRA o que vai fazer (modo dry-run). Para aplicar de verdade:
//   CONFIRM=yes node _to_delete/merge-conversa-marina.mjs
//
// O que faz: acha as duas conversas do canal da Taciane com esse telefone, escolhe a
// mais ANTIGA como a "principal" (a que já tem a mensagem do modelo que você mandou),
// move a(s) mensagem(ns) da mais nova (a duplicada, criada pela resposta da Marina)
// para dentro da principal, atualiza o nome e o telefone da principal com os dados
// reais que vieram da resposta dela, e deixa a duplicada vazia (sem mensagens) — não
// apaga nenhuma linha do banco.

import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf-8");
const m = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
if (!m) throw new Error("DATABASE_URL não encontrada no .env");

const client = new pg.Client({ connectionString: m[1] });
await client.connect();

const { rows: convs } = await client.query(
  `SELECT id, telefone, "nomeContato", "canalWhatsappId", "oportunidadeId", "pessoaId",
          "atendidoPorId", status, "createdAt"
   FROM "Conversa"
   WHERE "instanceName" = 'taciane-villa' AND telefone LIKE '%5159223%'
   ORDER BY "createdAt" ASC`
);

if (convs.length !== 2) {
  console.log(`Esperava encontrar exatamente 2 conversas, encontrei ${convs.length}. Nada será feito. Resultado:`);
  console.log(JSON.stringify(convs, null, 2));
  await client.end();
  process.exit(1);
}

const [principal, duplicada] = convs;

const { rows: msgsDuplicada } = await client.query(
  `SELECT id, conteudo, direcao, autor, "createdAt" FROM "Mensagem" WHERE "conversaId" = $1 ORDER BY "createdAt" ASC`,
  [duplicada.id]
);

console.log("Conversa PRINCIPAL (vai ficar com tudo):", JSON.stringify(principal, null, 2));
console.log("Conversa DUPLICADA (vai ficar vazia):", JSON.stringify(duplicada, null, 2));
console.log(`Mensagens a mover da duplicada -> principal: ${msgsDuplicada.length}`);
console.log(JSON.stringify(msgsDuplicada, null, 2));

const aplicar = process.env.CONFIRM === "yes";
if (!aplicar) {
  console.log("\n(Modo dry-run — nada foi alterado. Rode com CONFIRM=yes para aplicar de verdade.)");
  await client.end();
  process.exit(0);
}

await client.query("BEGIN");
try {
  await client.query(`UPDATE "Mensagem" SET "conversaId" = $1 WHERE "conversaId" = $2`, [principal.id, duplicada.id]);
  await client.query(
    `UPDATE "Conversa"
     SET "nomeContato" = COALESCE("nomeContato", $2),
         telefone = $3,
         "ultimaMensagemEm" = now()
     WHERE id = $1`,
    [principal.id, duplicada.nomeContato, duplicada.telefone]
  );
  await client.query("COMMIT");
  console.log("\nPronto — mensagens movidas e conversa principal atualizada.");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Deu erro, nada foi alterado:", err);
  process.exit(1);
}

await client.end();
