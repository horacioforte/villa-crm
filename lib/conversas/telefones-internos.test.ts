import { describe, expect, it } from "vitest";
import { ehTelefoneInterno } from "./telefones-internos";

describe("ehTelefoneInterno", () => {
  const internos = new Set(["558194903673", "5581994903673"]);

  it("reconhece o telefone da equipe com ou sem nono dígito", () => {
    expect(ehTelefoneInterno(internos, "558194903673")).toBe(true);
    expect(ehTelefoneInterno(internos, "5581994903673")).toBe(true);
  });

  it("cliente comum não é interno", () => {
    expect(ehTelefoneInterno(internos, "5511942377413")).toBe(false);
  });

  it("sem telefone ou sem internos cadastrados, nunca é interno", () => {
    expect(ehTelefoneInterno(internos, null)).toBe(false);
    expect(ehTelefoneInterno(new Set(), "558194903673")).toBe(false);
  });
});
