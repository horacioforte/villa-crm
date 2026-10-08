// ARQUIVO: lib/base-nacional/triagem.test.ts
// REGRA: nunca remover. Apenas acrescentar.
import { describe, expect, it } from "vitest";
import { ehInterior, triar, type UnidadeTriagem } from "./triagem";

const un = (cnae: string, sec: string[] = [], alvo = cnae === "2330305", cidade = "CARUARU"): UnidadeTriagem =>
  ({ ativa: true, cnaePrincipal: cnae, cnaesSecundarios: sec, cnaeAlvoComoPrincipal: alvo, municipioNome: cidade, uf: "PE" });

describe("triagem v2", () => {
  it("Lè Mix (descrição do CNAE na razão social) vai para verificação — falso negativo da v1", () => {
    const r = triar({ razaoSocial: "LE MIX PREPARACAO DE MASSA DE CONCRETO LTDA", nomeFantasia: "LE MIX", unidades: [un("2330305")] }, "PE");
    expect(r.paraVerificar).toBe(true);
    expect(r.classificacao).toBe("FORTE_INDICIO_CONCRETEIRA");
  });
  it("nome com concreto e argamassa vai para verificação", () => {
    const r = triar({ razaoSocial: "LE MIX BRASIL PREPARACAO DE MASSA, ARGAMASSA E CONCRETO", unidades: [un("2330305")] });
    expect(r.paraVerificar).toBe(true);
  });
  it("Prioridade A com nome de argamassa vai para verificação, salvo CNAE principal de cal/gesso/cimento", () => {
    expect(triar({ razaoSocial: "ELLOFORTE ARGAMASSA COMERCIO E INDUSTRIA", unidades: [un("2330305")] }).classificacao).toBe("POSSIVEL_CONCRETEIRA");
    expect(triar({ razaoSocial: "GESSO NUNES INDUSTRIA", unidades: [un("2392300", ["2330305"]), un("2330305", [], true)] }).paraVerificar).toBe(false);
  });
  it("concreteira pelo nome forte", () => {
    expect(triar({ razaoSocial: "CONCRETEIRA PINGUIM LTDA", unidades: [un("2330302", ["2330305"])] }).classificacao).toBe("FORTE_INDICIO_CONCRETEIRA");
  });
  it("artefatos de concreto não contam como concreto no nome", () => {
    const r = triar({ razaoSocial: "DWG ARTEFATOS DE CONCRETO LTDA", unidades: [un("2330302", ["2330305"])] });
    expect(r.classificacao).toBe("PROVAVEL_NAO_CONCRETEIRA");
  });
  it("construtora com 2330-3/05 secundário é dispensada (não é marcada como não concreteira)", () => {
    const r = triar({ razaoSocial: "CONSTRUTORA REGIO LTDA", unidades: [un("4120400", ["2330305"])] });
    expect(r.classificacao).toBe("PROVAVEL_CONSTRUTORA");
    expect(r.paraVerificar).toBe(false);
  });
  it("locadora de máquinas é possível (potencial compradora)", () => {
    expect(triar({ razaoSocial: "JM LOCADORA", unidades: [un("7732201", ["2330305"])] }).classificacao).toBe("POSSIVEL_CONCRETEIRA");
  });
  it("pontuação nunca vira NaN e prioriza A + interior", () => {
    const a = triar({ razaoSocial: "X CONCRETO", porte: "05", capitalSocial: 1_000_000, unidades: [un("2330305")] }, "PE");
    const b = triar({ razaoSocial: "Y SERVICOS", porte: "01", unidades: [un("4120400", ["2330305"], false, "RECIFE")] }, "PE");
    expect(Number.isFinite(a.pontuacao)).toBe(true);
    expect(a.pontuacao).toBeGreaterThan(b.pontuacao);
    expect(a.prioridadeReceita).toBe("A");
  });
  it("interior x capital/RM", () => {
    expect(ehInterior("Recife", "PE")).toBe(false);
    expect(ehInterior("Jaboatão dos Guararapes", "PE")).toBe(false);
    expect(ehInterior("Petrolina", "PE")).toBe(true);
    expect(ehInterior("Goiânia", "GO")).toBe(false);
  });
});
