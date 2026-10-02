// Valida a trava dos scripts legados SEM executá-los.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPTS = [
  "seed-concreteiras-brasil.ts",
  "seed-cnpj-concreteiras.ts",
  "seed-construtoras-brasil.ts",
  "seed-pre-moldados-brasil.ts",
  "seed-mcmv-brasil.ts",
  "seed-revendas-caminhoes.ts",
  "classificar-carteiras.ts",
];

describe("trava dos scripts legados", () => {
  it("a função de autorização só aceita o valor exato", async () => {
    process.env.PERMITIR_SCRIPT_LEGADO = "SIM-AUTORIZADO-HORACIO"; // evita process.exit ao importar o módulo no teste
    const m = await import("./guarda-script-legado");
    delete process.env.PERMITIR_SCRIPT_LEGADO;
    expect(m.scriptLegadoAutorizado({})).toBe(false);
    expect(m.scriptLegadoAutorizado({ PERMITIR_SCRIPT_LEGADO: "sim" })).toBe(false);
    expect(m.scriptLegadoAutorizado({ PERMITIR_SCRIPT_LEGADO: "1" })).toBe(false);
    expect(m.scriptLegadoAutorizado({ PERMITIR_SCRIPT_LEGADO: "SIM-AUTORIZADO-HORACIO" })).toBe(true);
    expect(m.mensagemBloqueioScriptLegado("x.ts")).toMatch(/GRAVA em Dossiê Comercial .* Carteira/);
  });

  it("a trava encerra o processo quando não há autorização", () => {
    const fonte = readFileSync(path.join(__dirname, "guarda-script-legado.ts"), "utf8");
    expect(fonte).toMatch(/if \(!scriptLegadoAutorizado\(process\.env\)\) \{[\s\S]*process\.exit\(1\);/);
  });

  for (const script of SCRIPTS) {
    it(`${script}: a trava é o primeiro import, antes de env, pg ou prisma`, () => {
      const linhas = readFileSync(path.join(__dirname, script), "utf8").split("\n");
      const imports = linhas.filter(l => /^import\s/.test(l));
      expect(imports[0]).toMatch(/^import "\.\/guarda-script-legado";/);
      const iTrava = linhas.findIndex(l => l.startsWith('import "./guarda-script-legado"'));
      const iPerigo = linhas.findIndex(l => /from "pg"|@\/lib\/prisma|"\.\/env"/.test(l));
      expect(iPerigo).toBeGreaterThan(iTrava);
      // Nenhum código executável antes da trava (só comentários/linhas vazias)
      expect(linhas.slice(0, iTrava).every(l => l.trim() === "" || l.trim().startsWith("//"))).toBe(true);
    });
  }
});
