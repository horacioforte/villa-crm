import { describe, expect, it } from "vitest";
import { gerarPdfBase } from "./pdf";
import type { ReportColumn } from "@/lib/relatorios/export";

type LinhaFicticia = { nome: string; uf: string; unidades: number };

const colunas: ReportColumn<LinhaFicticia>[] = [
  { header: "Grupo", value: l => l.nome },
  { header: "UF", value: l => l.uf },
  { header: "Unidades", value: l => l.unidades },
  { header: "Categoria", value: () => "B" },
  { header: "Sócios", value: () => 1 },
  { header: "WhatsApp", value: () => 0 },
  { header: "E-mail corporativo", value: () => 0 },
  { header: "Telefones", value: () => 1 },
  { header: "Revisão", value: () => "Aguardando revisão" },
  { header: "Empresas", value: l => `DEMO — ${l.nome} FICTÍCIA LTDA` },
];

function linhasFicticias(n: number): LinhaFicticia[] {
  return Array.from({ length: n }, (_, i) => ({ nome: `Grupo Fictício ${i}`, uf: ["PE", "BA", "SP"][i % 3], unidades: (i % 5) + 1 }));
}

describe("gerarPdfBase — relatório da fila comercial do João (dados fictícios)", () => {
  it("gera um PDF válido com o volume real de colunas do João (10) e várias linhas", async () => {
    const buf = await gerarPdfBase({
      linhas: linhasFicticias(300),
      colunas,
      filtros: "UF: todas (teste fictício)",
      total: 300,
      relatorioId: "demo-relatorio-ficticio",
      geradoEm: new Date("2026-10-14T12:00:00Z"),
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("300 linhas × 10 colunas renderiza em tempo razoável (guarda contra regressão de performance)", async () => {
    const t0 = Date.now();
    await gerarPdfBase({ linhas: linhasFicticias(300), colunas, filtros: "teste", total: 300, relatorioId: "demo", geradoEm: new Date() });
    const ms = Date.now() - t0;
    // Limite generoso (ambiente de teste varia); o objetivo é pegar uma regressão grosseira, não cronometrar com precisão.
    expect(ms).toBeLessThan(15_000);
  });

  it("sem linhas, ainda gera um PDF válido (só cabeçalho e rodapé)", async () => {
    const buf = await gerarPdfBase({ linhas: [], colunas, filtros: "nenhum resultado (teste)", total: 0, relatorioId: "demo-vazio", geradoEm: new Date() });
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
