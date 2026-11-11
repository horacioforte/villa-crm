// ARQUIVO: lib/agentes/joao/__tests__/construtora-invariantes.vitest.test.ts
// REGRA: nunca remover. Apenas acrescentar.
// Wrapper vitest do script standalone construtora-invariantes.test.ts (que usa
// console.log/process.exit e não tem describe/it). Roda o script com tsx e exige exit code 0.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("construtora-invariantes (script tsx)", () => {
  it("todas as invariantes do radar de construtoras passam (exit code 0)", () => {
    const script = path.resolve(__dirname, "construtora-invariantes.test.ts");
    const saida = execFileSync(process.execPath, ["--import", "tsx", script], {
      encoding: "utf8",
      cwd: path.resolve(__dirname, "../../../.."),
    });
    expect(saida).toContain("Todos os testes passaram.");
  }, 60_000);
});
