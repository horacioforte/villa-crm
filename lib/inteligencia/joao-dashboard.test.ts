import { describe, expect, it } from "vitest";
import { buildAttentionCards, buildRadarHealth, buildRecentFindings } from "./joao-dashboard";

describe("João dashboard executive metrics", () => {
  it("calcula cards de atenção a partir de dados reais", () => {
    // Datas relativas a "agora": o cálculo usa "dias desde a última atualização", então
    // datas fixas (ex.: 2026-01-10) fazem o teste quebrar com o passar do tempo.
    const diasAtras = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();
    const dossies = [
      { status: "PRONTO_PARA_ASSUMIR", updatedAt: diasAtras(2), prioridade: "ALTA" },
      { status: "INVESTIGANDO", updatedAt: diasAtras(2), prioridade: "ALTA" },
      { status: "AGUARDANDO_VALIDACAO", updatedAt: diasAtras(3), prioridade: "MEDIA" },
      { status: "INVESTIGANDO", updatedAt: diasAtras(60), prioridade: "ALTA" },
    ] as any[];

    const cards = buildAttentionCards(dossies, {
      inteligencia: { descobertas: 3, novosDecisores: 2 },
      acao: { esquecidos: 1 },
    } as any);

    expect(cards[0]).toMatchObject({ id: "prioridades", value: 2 });
    expect(cards[1]).toMatchObject({ id: "novas-descobertas", value: 3 });
    expect(cards[2]).toMatchObject({ id: "novos-decisores", value: 2 });
    expect(cards[3]).toMatchObject({ id: "sem-atualizacao", value: 1 });
  });

  it("agrega saúde do radar com os estados operacionais existentes", () => {
    const dossies = [
      { status: "INVESTIGANDO" },
      { status: "AGUARDANDO_VALIDACAO" },
      { status: "EM_ANALISE" },
      { status: "PEDIR_MAIS_PESQUISA" },
      { status: "PRONTO_PARA_ASSUMIR" },
      { status: "ASSUMIDO" },
      { status: "ARQUIVADO" },
    ] as any[];

    const health = buildRadarHealth(dossies);
    expect(health).toMatchObject({
      investigando: 1,
      aguardandoValidacao: 1,
      emAnalise: 1,
      maisPesquisa: 1,
      prontoParaAssumir: 1,
      assumido: 1,
      semAtualizacao15Dias: 0,
      emRisco: 0,
    });
  });

  it("filtra descobertas relevantes das últimas 24h sem inventar itens", () => {
    const findings = buildRecentFindings([
      { id: "a", createdAt: new Date().toISOString(), categoria: "Decisor", titulo: "Novo decisor", dossieTitulo: "Obra X" },
      { id: "b", createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), categoria: "Empresa", titulo: "Nova empresa", dossieTitulo: "Empresa Y" },
      { id: "c", createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), categoria: "Notícia", titulo: "Antiga", dossieTitulo: "Z" },
    ] as any[]);

    expect(findings).toHaveLength(2);
    expect(findings[0].id).toBe("a");
  });
});
