const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 8000,
    query_timeout: 8000,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const types = await client.query(
    `SELECT typname FROM pg_type WHERE typname IN ('RedeSocialTipo','RedeSocialStatusConexao') ORDER BY typname;`
  );
  const table = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'RedeSocialConta';`
  );
  const migrationsTableExists = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations';`
  );

  let migrations = [];
  if (migrationsTableExists.rowCount > 0) {
    const res = await client.query(
      `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at ASC;`
    );
    migrations = res.rows;
  }

  console.log("=== RESULT (read-only) ===");
  console.log("RedeSocialTipo:", types.rows.some((r) => r.typname === "RedeSocialTipo") ? "EXISTE" : "NAO EXISTE");
  console.log("RedeSocialStatusConexao:", types.rows.some((r) => r.typname === "RedeSocialStatusConexao") ? "EXISTE" : "NAO EXISTE");
  console.log("RedeSocialConta (tabela):", table.rowCount > 0 ? "EXISTE" : "NAO EXISTE");
  console.log("");
  console.log("=== _prisma_migrations ===");
  console.log("tabela de controle existe:", migrationsTableExists.rowCount > 0 ? "SIM" : "NAO");
  console.log("total de linhas:", migrations.length);
  for (const m of migrations) {
    console.log(
      `- ${m.migration_name} | finished_at=${m.finished_at ? m.finished_at.toISOString() : "NULL(pendente/falhou)"} | rolled_back_at=${m.rolled_back_at ? m.rolled_back_at.toISOString() : "null"}`
    );
  }

  await client.end();
}

main().catch((err) => {
  console.error("ERRO (conexao ou query):", err.message);
  process.exit(1);
});
