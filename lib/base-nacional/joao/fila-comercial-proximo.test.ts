import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { joaoEnriquecimentoGrupo: { findMany: vi.fn() }, concreteiraCandidata: { findMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { escolherProximoPendente, proximoGrupoPendente } = await import("./fila-comercial");

const g = (chave: string, decisaoComercial: string | null = null) => ({ chave, decisaoComercial });

describe("escolherProximoPendente", () => {
  it("devolve o próximo pendente depois do atual", () => {
    expect(escolherProximoPendente([g("a"), g("b"), g("c")], "a")).toBe("b");
  });

  it("pula os grupos já decididos", () => {
    expect(escolherProximoPendente([g("a"), g("b", "APROVADO_ABORDAGEM"), g("c", "ADIAR"), g("d")], "a")).toBe("d");
  });

  it("volta ao início quando não há pendente adiante", () => {
    expect(escolherProximoPendente([g("a"), g("b", "ADIAR"), g("c")], "c")).toBe("a");
  });

  it("devolve null quando o atual é o único pendente", () => {
    expect(escolherProximoPendente([g("a", "ADIAR"), g("b"), g("c", "ADIAR")], "b")).toBeNull();
  });

  it("devolve null quando não há nenhum pendente", () => {
    expect(escolherProximoPendente([g("a", "ADIAR"), g("b", "ADIAR")], "a")).toBeNull();
    expect(escolherProximoPendente([], "a")).toBeNull();
  });

  it("começa do início quando o atual não está na lista filtrada", () => {
    expect(escolherProximoPendente([g("x", "ADIAR"), g("y")], "fora")).toBe("y");
  });
});

describe("proximoGrupoPendente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.concreteiraCandidata.findMany.mockResolvedValue([]);
  });

  const grupo = (chave: string, decisaoComercial: string | null) => ({
    chave, nome: chave, candidataIds: [], raizes: [], categoriaComercial: "A", categoriaMotivo: "", indicadores: {},
    decisaoComercial, decisaoEm: null, decisaoObservacao: null, decisaoPor: null, ordem: 1,
  });

  it("usa a lista filtrada na ordem da fila", async () => {
    prismaMock.joaoEnriquecimentoGrupo.findMany.mockResolvedValue([grupo("a", null), grupo("b", "ADIAR"), grupo("c", null)]);
    expect(await proximoGrupoPendente("a", { categoria: "A", revisao: "AGUARDANDO" })).toBe("c");
  });
});
