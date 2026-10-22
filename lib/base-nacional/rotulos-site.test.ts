import { describe, expect, it } from "vitest";
import { rotuloConclusaoSite } from "./rotulos-site";

describe("rotuloConclusaoSite — selo em português do que o robô achou no site provável", () => {
  it("CONCRETO_NO_SITE → site confirma concreto (verde)", () => {
    expect(rotuloConclusaoSite("CONCRETO_NO_SITE", ["https://exemplo.invalid/"])).toEqual({
      chave: "CONCRETO_NO_SITE", texto: "site confirma concreto", cor: "bg-emerald-100 text-emerald-700",
    });
  });
  it("CONCRETO_FRACO_NO_SITE → site cita concreto (fraco) (amarelo)", () => {
    expect(rotuloConclusaoSite("CONCRETO_FRACO_NO_SITE", ["https://exemplo.invalid/"])).toMatchObject({
      texto: "site cita concreto (fraco)", cor: "bg-amber-100 text-amber-700",
    });
  });
  it("OUTRA_ATIVIDADE_NO_SITE → site mostra outra atividade (cinza)", () => {
    expect(rotuloConclusaoSite("OUTRA_ATIVIDADE_NO_SITE", ["https://exemplo.invalid/"])).toMatchObject({
      texto: "site mostra outra atividade", cor: "bg-slate-100 text-slate-600",
    });
  });
  it("SITE_DE_TERCEIRO → parece site de contador/terceiro (vermelho)", () => {
    expect(rotuloConclusaoSite("SITE_DE_TERCEIRO", ["https://exemplo.invalid/"])).toMatchObject({
      texto: "parece site de contador/terceiro", cor: "bg-red-100 text-red-700",
    });
  });
  it("SEM_CONCLUSAO com paginas vazias → site vazio ou fora do ar (vermelho) — caso real: CONCRELAGOS/concretoapolo.com.br", () => {
    expect(rotuloConclusaoSite("SEM_CONCLUSAO", [])).toEqual({
      chave: "SEM_CONCLUSAO_VAZIO", texto: "site vazio ou fora do ar", cor: "bg-red-100 text-red-700",
    });
    expect(rotuloConclusaoSite("SEM_CONCLUSAO", null)).toMatchObject({ texto: "site vazio ou fora do ar" });
    expect(rotuloConclusaoSite("SEM_CONCLUSAO", undefined)).toMatchObject({ texto: "site vazio ou fora do ar" });
  });
  it("SEM_CONCLUSAO com páginas lidas → site sem conclusão (cinza)", () => {
    expect(rotuloConclusaoSite("SEM_CONCLUSAO", ["https://exemplo.invalid/", "https://exemplo.invalid/contato"])).toEqual({
      chave: "SEM_CONCLUSAO", texto: "site sem conclusão", cor: "bg-slate-100 text-slate-600",
    });
  });
  it("NAO_VISITADO → robô ainda não visitou (cinza)", () => {
    expect(rotuloConclusaoSite("NAO_VISITADO", [])).toMatchObject({ texto: "robô ainda não visitou" });
  });
  it("SEM_DOMINIO → robô ainda não visitou (cinza) — não há o que visitar", () => {
    expect(rotuloConclusaoSite("SEM_DOMINIO", [])).toMatchObject({ texto: "robô ainda não visitou" });
  });
  it("sem dado (robô nunca rodou) → robô ainda não visitou", () => {
    expect(rotuloConclusaoSite(null, null)).toMatchObject({ chave: "NAO_VISITADO", texto: "robô ainda não visitou" });
    expect(rotuloConclusaoSite(undefined, undefined)).toMatchObject({ chave: "NAO_VISITADO", texto: "robô ainda não visitou" });
    expect(rotuloConclusaoSite("", [])).toMatchObject({ chave: "NAO_VISITADO" });
  });
  it("valor desconhecido/inválido nunca quebra — cai em não visitou", () => {
    expect(rotuloConclusaoSite("ALGO_NOVO_QUE_NAO_EXISTE_AINDA", [])).toMatchObject({ chave: "NAO_VISITADO", texto: "robô ainda não visitou" });
  });
});
