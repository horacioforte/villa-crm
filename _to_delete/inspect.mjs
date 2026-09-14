import pg from "pg";
import fs from "fs";

const env = fs.readFileSync(".env", "utf-8");
const m = env.match(/^DATABASE_URL="?([^"\n]+)"?/m);
const client = new pg.Client({ connectionString: m[1] });
await client.connect();

const convs = await client.query(
  `SELECT id, telefone, "nomeContato", "canalWhatsappId", "oportunidadeId", "pessoaId", "atendidoPorId", status, "createdAt", "updatedAt"
   FROM "Conversa" WHERE "instanceName" = 'taciane-villa' AND telefone LIKE '%5159223%' ORDER BY "createdAt" ASC`
);
console.log("CONVERSAS:", JSON.stringify(convs.rows, null, 2));

for (const c of convs.rows) {
  const msgs = await client.query(
    `SELECT id, conteudo, direcao, autor, status, "externalMessageId", "waMessageId", "createdAt" FROM "Mensagem" WHERE "conversaId" = $1 ORDER BY "createdAt" ASC`,
    [c.id]
  );
  console.log(`MENSAGENS de ${c.id}:`, JSON.stringify(msgs.rows, null, 2));
}

await client.end();
