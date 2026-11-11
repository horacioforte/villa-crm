import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: [
      "node_modules", "app/generated", ".next", "flux-finance",
      // Script standalone (rodado com `npx tsx ...`, usa console.log/process.exit, sem describe/it):
      // o vitest o tratava como suíte vazia e marcava "No test suite found". Coberto pelo wrapper
      // construtora-invariantes.vitest.test.ts.
      "lib/agentes/joao/__tests__/construtora-invariantes.test.ts",
    ],
  },
});
