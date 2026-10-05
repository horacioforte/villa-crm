import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cnpjValido } from "../../lib/base-nacional/cnpj";

// Importar o script executaria main(); por isso a função é reimplementada a partir do
// mesmo algoritmo e o código-fonte é verificado estaticamente.
const fonte = readFileSync(path.join(__dirname, "demo-dados-branch.ts"), "utf8");

describe("dados de demonstração", () => {
  it("só aceita o endpoint exato do branch autorizado", () => {
    expect(fonte).toContain('export const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";');
    expect(fonte).toMatch(/if \(amb\.endpoint !== ENDPOINT_AUTORIZADO\) \{\s*throw new Error/);
  });

  it("nomes são claramente fictícios e ids têm prefixo próprio", () => {
    const razoes = [...fonte.matchAll(/razao: "([^"]+)"/g)].map(m => m[1]);
    expect(razoes.length).toBeGreaterThanOrEqual(12);
    for (const r of razoes) expect(r).toMatch(/^DEMO — .*FICT[IÍ]CI/);
    expect(fonte).toContain('const P = "demo-bn-";');
  });

  it("grava apenas em tabelas novas", () => {
    const alvos = [...fonte.matchAll(/(?:INSERT INTO|UPDATE|DELETE FROM) "(\w+)"/g)].map(m => m[1]);
    const novas = new Set(["ReceitaCompetencia", "ConcreteiraCandidata", "ConcreteiraCandidataUnidade", "ReceitaEstabelecimento", "ReceitaMudanca",
      "ConcreteiraEvidencia", "ConcreteiraValidacaoHistorico", "EmpresaUnidade", "RelatorioConcreteirasGerado",
      // v4 (05/10/2026)
      "ConcreteiraPotencialEquipamento", "ConcreteiraCandidataContato", "ConcreteiraCandidataPessoa"]);
    expect(alvos.length).toBeGreaterThan(0);
    for (const a of alvos) expect(novas.has(a)).toBe(true);
  });

  it("v4: Empresa e Usuario são apenas consultados (SELECT), nunca gravados", () => {
    expect(fonte).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM) "(?:Empresa|Usuario|Pessoa|DossieComercial|DossieCarteira|Oportunidade|Tarefa)"/);
  });

  it("v4: contatos e pessoas de demonstração são fictícios (números 0000 e domínio .invalid)", () => {
    const emails = [...fonte.matchAll(/"([^"\s]+@[^"\s]+)"/g)].map(m => m[1]);
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e).toMatch(/\.invalid$/);
    const fones = [...fonte.matchAll(/"\((\d{2})\) (9?0000-\d{4})"/g)];
    expect(fones.length).toBeGreaterThan(0);
  });

  it("CNPJs fictícios têm dígito verificador inválido", () => {
    const dv = (b: string) => {
      const calc = (x: string, p: number[]) => { const r = x.split("").reduce((a, n, i) => a + Number(n) * p[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
      const d1 = calc(b, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
      return `${d1}${calc(b + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])}`;
    };
    for (const base of ["900000010001", "900000010002", "900000600001"]) {
      const d = dv(base);
      const ficticio = base + `${d[0]}${(Number(d[1]) + 1) % 10}`;
      expect(cnpjValido(base + d)).toBe(true);
      expect(cnpjValido(ficticio)).toBe(false);
    }
  });
});
