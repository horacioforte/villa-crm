// ARQUIVO: scripts/env.ts
// Carrega variáveis de ambiente para scripts standalone (rodados via `npx tsx`,
// fora do runtime do Next.js). O Next.js já carrega .env / .env.local sozinho em
// dev/build/produção — este helper existe só porque scripts fora do Next não passam
// por esse carregamento automático. Não altera nem interfere no comportamento do Next.
//
// Uso: import "./env"; (ou "../env" conforme a profundidade do script) no topo do arquivo,
// antes de qualquer leitura de process.env.
import { config } from "dotenv";
import path from "node:path";

const root = process.cwd();

config({ path: path.resolve(root, ".env") });
config({ path: path.resolve(root, ".env.local"), override: true });
