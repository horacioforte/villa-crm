import { describe, expect, it } from "vitest";
import { limiteBuscasPorGrupo, limiteMensalUsd, pesquisaIaAtiva, provedorConfigurado } from "./pesquisa-ia-config";

describe("pesquisaIaAtiva — desligado por padrão", () => {
  it("sem nenhuma variável, fica desligado", () => {
    expect(pesquisaIaAtiva({})).toBe(false);
  });
  it("ATIVA=true sem provedor configurado continua desligado", () => {
    expect(pesquisaIaAtiva({ JOAO_PESQUISA_IA_ATIVA: "true" })).toBe(false);
  });
  it("ATIVA com valor diferente de \"true\" fica desligado, mesmo com provedor", () => {
    expect(pesquisaIaAtiva({ JOAO_PESQUISA_IA_ATIVA: "1", JOAO_PESQUISA_IA_PROVEDOR: "claude" })).toBe(false);
  });
  it("ATIVA=true + provedor válido liga o módulo", () => {
    expect(pesquisaIaAtiva({ JOAO_PESQUISA_IA_ATIVA: "true", JOAO_PESQUISA_IA_PROVEDOR: "claude" })).toBe(true);
    expect(pesquisaIaAtiva({ JOAO_PESQUISA_IA_ATIVA: "true", JOAO_PESQUISA_IA_PROVEDOR: "openai" })).toBe(true);
  });
  it("provedor inválido não liga", () => {
    expect(pesquisaIaAtiva({ JOAO_PESQUISA_IA_ATIVA: "true", JOAO_PESQUISA_IA_PROVEDOR: "gemini" })).toBe(false);
  });
});

describe("provedorConfigurado", () => {
  it("só aceita claude ou openai", () => {
    expect(provedorConfigurado({ JOAO_PESQUISA_IA_PROVEDOR: "claude" })).toBe("claude");
    expect(provedorConfigurado({ JOAO_PESQUISA_IA_PROVEDOR: "openai" })).toBe("openai");
    expect(provedorConfigurado({ JOAO_PESQUISA_IA_PROVEDOR: "gpt4" })).toBeNull();
    expect(provedorConfigurado({})).toBeNull();
  });
});

describe("limites", () => {
  it("limiteMensalUsd tem padrão de 50 e aceita override", () => {
    expect(limiteMensalUsd({})).toBe(50);
    expect(limiteMensalUsd({ JOAO_PESQUISA_IA_LIMITE_MENSAL_USD: "120" })).toBe(120);
    expect(limiteMensalUsd({ JOAO_PESQUISA_IA_LIMITE_MENSAL_USD: "-5" })).toBe(50);
    expect(limiteMensalUsd({ JOAO_PESQUISA_IA_LIMITE_MENSAL_USD: "abc" })).toBe(50);
  });
  it("limiteBuscasPorGrupo tem padrão de 1 (nunca repete) e aceita override inteiro", () => {
    expect(limiteBuscasPorGrupo({})).toBe(1);
    expect(limiteBuscasPorGrupo({ JOAO_PESQUISA_IA_LIMITE_POR_GRUPO: "3" })).toBe(3);
    expect(limiteBuscasPorGrupo({ JOAO_PESQUISA_IA_LIMITE_POR_GRUPO: "2.7" })).toBe(2);
    expect(limiteBuscasPorGrupo({ JOAO_PESQUISA_IA_LIMITE_POR_GRUPO: "0" })).toBe(1);
  });
});
