import { describe, expect, it } from "vitest";
import { rotuloCampoHistorico, traduzirCodigos, valoresHistorico } from "./historico";

describe("histórico em linguagem simples", () => {
  it("traduz campos técnicos", () => {
    expect(rotuloCampoHistorico("contato:TELEFONE")).toBe("Contato (Telefone)");
    expect(rotuloCampoHistorico("situacao:EMAIL")).toBe("Verificação do contato (E-mail)");
    expect(rotuloCampoHistorico("inativacao:pessoa")).toBe("Inativação de pessoa");
    expect(rotuloCampoHistorico("BOMBA_LANCA (geral)")).toBe("Bomba-lança (geral)");
  });
  it("traduz códigos nos valores", () => {
    expect(traduzirCodigos("Venda: ALTO · Locação: MEDIO")).toBe("Venda: Alto · Locação: Médio");
    expect(valoresHistorico({ campo: "situacao:TELEFONE", valorAnterior: "NAO_VERIFICADO", valorNovo: "VERIFICADO" })).toEqual({ antes: "Não verificado", depois: "Verificado" });
    expect(valoresHistorico({ campo: "prioridadeComercial", valorAnterior: null, valorNovo: "ALTA" }).depois).toBe("Alta");
    expect(valoresHistorico({ campo: "empresaId", valorAnterior: "abc", valorNovo: null })).toEqual({ antes: "vinculada", depois: "sem vínculo" });
  });
  it("não altera texto comum nem valores mascarados", () => {
    expect(traduzirCodigos("(81) ****-1111")).toBe("(81) ****-1111");
    expect(traduzirCodigos("Pessoa Fictícia E2E — COMPRADOR")).toBe("Pessoa Fictícia E2E — Comprador");
  });
});
