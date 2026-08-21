import { describe, expect, it } from "vitest";

import { can } from "./permissions";

describe("permissions — midias_sociais", () => {
  it("ADMIN tem acesso completo (configura conexão/credenciais)", () => {
    expect(can("ADMIN", "midias_sociais", "read")).toBe(true);
    expect(can("ADMIN", "midias_sociais", "create")).toBe(true);
    expect(can("ADMIN", "midias_sociais", "update")).toBe(true);
    expect(can("ADMIN", "midias_sociais", "delete")).toBe(true);
  });

  it("GERENTE só visualiza o cockpit", () => {
    expect(can("GERENTE", "midias_sociais", "read")).toBe(true);
    expect(can("GERENTE", "midias_sociais", "create")).toBe(false);
    expect(can("GERENTE", "midias_sociais", "update")).toBe(false);
    expect(can("GERENTE", "midias_sociais", "delete")).toBe(false);
  });

  it("COMERCIAL só visualiza (leads/oportunidades vindos do marketing)", () => {
    expect(can("COMERCIAL", "midias_sociais", "read")).toBe(true);
    expect(can("COMERCIAL", "midias_sociais", "create")).toBe(false);
    expect(can("COMERCIAL", "midias_sociais", "update")).toBe(false);
    expect(can("COMERCIAL", "midias_sociais", "delete")).toBe(false);
  });

  it("OPERACIONAL não tem acesso (fora do escopo do papel)", () => {
    expect(can("OPERACIONAL", "midias_sociais", "read")).toBe(false);
    expect(can("OPERACIONAL", "midias_sociais", "create")).toBe(false);
    expect(can("OPERACIONAL", "midias_sociais", "update")).toBe(false);
    expect(can("OPERACIONAL", "midias_sociais", "delete")).toBe(false);
  });
});

describe("permissions — contratos (regressão)", () => {
  it("matriz de contratos permanece inalterada após a adição de midias_sociais", () => {
    expect(can("ADMIN", "contratos", "delete")).toBe(true);
    expect(can("GERENTE", "contratos", "delete")).toBe(true);
    expect(can("COMERCIAL", "contratos", "read")).toBe(true);
    expect(can("COMERCIAL", "contratos", "create")).toBe(true);
    expect(can("COMERCIAL", "contratos", "delete")).toBe(false);
    expect(can("OPERACIONAL", "contratos", "read")).toBe(true);
    expect(can("OPERACIONAL", "contratos", "create")).toBe(false);
  });
});
