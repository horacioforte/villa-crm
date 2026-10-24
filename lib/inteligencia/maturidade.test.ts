import { describe, expect, it } from "vitest";
import { calcularNivelInvestigacao } from "./maturidade";

const DOSSIE_PRONTO = {
  cidade: "Abreu e Lima", estado: "PE",
  clienteFinal: "Petrobras", construtora: "Construtora X",
  completude: 85, totalDecisores: 1,
};
const DECISORES = [{ nome: "Fulano", telefone: "81999999999" }];

describe("calcularNivelInvestigacao — gate de oportunidade anterior perdida", () => {
  it("sem oportunidades relacionadas, vai pra Pronto normalmente", () => {
    const r = calcularNivelInvestigacao(DOSSIE_PRONTO, DECISORES, []);
    expect(r.statusDb).toBe("PRONTO_PARA_ASSUMIR");
  });

  it("oportunidade PERDIDA de confiança ALTA bloqueia o Pronto (caso real RNEST)", () => {
    const r = calcularNivelInvestigacao(DOSSIE_PRONTO, DECISORES, [
      { id: "op-1", titulo: "RNEST Expansão Abreu e Lima / PE", status: "PERDIDA", motivoPerda: "Início da obra para 2029", confianca: "alta" },
    ]);
    expect(r.statusDb).toBe("EM_ANALISE");
    expect(r.gatesFaltantes.some(g => g.includes("perdida"))).toBe(true);
    expect(r.motivo).toContain("RNEST Expansão Abreu e Lima / PE");
  });

  it("oportunidade PERDIDA de confiança MEDIA (match fraco de título) NÃO bloqueia o Pronto", () => {
    const r = calcularNivelInvestigacao(DOSSIE_PRONTO, DECISORES, [
      { id: "op-2", titulo: "Data Center não relacionado", status: "PERDIDA", motivoPerda: "Sem interesse", confianca: "media" },
    ]);
    expect(r.statusDb).toBe("PRONTO_PARA_ASSUMIR");
  });

  it("oportunidade em aberto (não perdida) não bloqueia o Pronto", () => {
    const r = calcularNivelInvestigacao(DOSSIE_PRONTO, DECISORES, [
      { id: "op-3", titulo: "Mesma obra em negociação", status: "NEGOCIACAO", confianca: "alta" },
    ]);
    expect(r.statusDb).toBe("PRONTO_PARA_ASSUMIR");
  });
});
