import { describe, expect, it } from "vitest";

import {
  analisarDossieEstrutura,
  deduplicarEvidencias,
  deduplicarMovimentacoes,
  exportarScoresJoaoParaPersistencia,
  gerarHashEvidencia,
  gerarHashMovimentacao,
  normalizarUrlParaHash,
  upsertAtualizacaoDossie,
  upsertDossieEvidencia,
  upsertDossieEvidenciaPersistida,
  upsertDossieMovimentacaoPersistida,
} from "./joao-estrutura";

describe("estrutura de inteligência João", () => {
  it("atribui prioridade alta somente quando há evidência consistente da obra", () => {
    const resultado = analisarDossieEstrutura({
      clienteFinal: "Residencial Porto Verde",
      construtora: "Construtora Norte",
      epc: "EPC Horizonte",
      valorEstimado: 4200000,
      volumeConcreto: 18000,
      faseObra: "Licenciamento",
      licenciamento: "Licença em trâmite junto ao município",
      cronograma: "Mobilização em 90 dias",
      cidade: "Recife",
      estado: "PE",
      segmento: "MCMV - residencial",
      equipamentosSugeridos: "Bomba de concreto, betoneira e central",
      campanhasSugerida: "Campanha de mobilização",
      concorrentes: "Outras empresas da região",
    });

    expect(resultado.potencialVilla).toBeGreaterThanOrEqual(75);
    expect(resultado.prioridadeJoao).toBeGreaterThanOrEqual(70);
    expect(resultado.prioridadeMcmv).toBeGreaterThanOrEqual(60);
    expect(resultado.motivoPrioridade).toMatch(/obra|sinal|acompanhamento/i);
  });

  it("expõe os scores do João em formato persistível no banco", () => {
    const resultado = analisarDossieEstrutura({
      clienteFinal: "Residencial Porto Verde",
      construtora: "Construtora Norte",
      epc: "EPC Horizonte",
      valorEstimado: 4200000,
      volumeConcreto: 18000,
      faseObra: "Licenciamento",
      licenciamento: "Licença em trâmite junto ao município",
      cronograma: "Mobilização em 90 dias",
      cidade: "Recife",
      estado: "PE",
      segmento: "MCMV - residencial",
    });

    const persistivel = exportarScoresJoaoParaPersistencia({
      clienteFinal: "Residencial Porto Verde",
      construtora: "Construtora Norte",
      epc: "EPC Horizonte",
      valorEstimado: 4200000,
      volumeConcreto: 18000,
      faseObra: "Licenciamento",
      licenciamento: "Licença em trâmite junto ao município",
      cronograma: "Mobilização em 90 dias",
      cidade: "Recife",
      estado: "PE",
      segmento: "MCMV - residencial",
    });

    expect(Object.keys(persistivel)).toEqual(expect.arrayContaining([
      "potencialVilla",
      "momentoVilla",
      "prontidao",
      "prioridadeJoao",
      "potencialMcmv",
      "momentoMcmv",
      "prioridadeMcmv",
      "motivoPrioridade",
    ]));
    expect(resultado.potencialVilla).toBeGreaterThan(0);
    expect(persistivel.momentoVilla).not.toBeNull();
    expect(persistivel.prioridadeJoao).not.toBeNull();
  });

  it("preserva a diferença entre ausência de dado e score zerado", () => {
    const semDados = analisarDossieEstrutura({});
    const semAderencia = analisarDossieEstrutura({
      segmento: "Comércio",
      faseObra: "TERRENO",
      cidade: "São Paulo",
      estado: "SP",
    });

    expect(semDados.potencialVilla).toBe(0);
    expect(semDados.momentoVilla).toBeNull();
    expect(semDados.prioridadeJoao).toBeNull();
    expect(semAderencia.potencialVilla).toBeGreaterThanOrEqual(0);
    expect(semAderencia.momentoVilla).toBeNull();
    expect(semAderencia.prioridadeJoao).toBeNull();
  });

  it("mantém momento e prioridade nulos quando não há evidência temporal real", () => {
    const resultado = analisarDossieEstrutura({
      clienteFinal: "Residencial Porto Verde",
      construtora: "Construtora Norte",
      epc: "EPC Horizonte",
      valorEstimado: 4200000,
      volumeConcreto: 18000,
      cidade: "Recife",
      estado: "PE",
      segmento: "MCMV - residencial",
    });

    expect(resultado.potencialVilla).toBeGreaterThan(70);
    expect(resultado.momentoVilla).toBeNull();
    expect(resultado.prioridadeJoao).toBeNull();
    expect(resultado.motivoPrioridade).toMatch(/tempo|cronograma|evidência temporal/i);
  });

  it("aceita momento e prioridade apenas quando existe sinal temporal explícito", () => {
    const resultado = analisarDossieEstrutura({
      clienteFinal: "Residencial Porto Verde",
      construtora: "Construtora Norte",
      epc: "EPC Horizonte",
      valorEstimado: 4200000,
      volumeConcreto: 18000,
      faseObra: "Licenciamento",
      licenciamento: "Licença em trâmite junto ao município",
      cronograma: "Mobilização em 90 dias",
      cidade: "Recife",
      estado: "PE",
      segmento: "MCMV - residencial",
    });

    expect(resultado.momentoVilla).not.toBeNull();
    expect(resultado.momentoVilla).toBeGreaterThan(0);
    expect(resultado.prioridadeJoao).not.toBeNull();
    expect(resultado.prioridadeJoao).toBeGreaterThan(0);
  });

  it("deduplica evidências por URL normalizada e ignora tracking params", () => {
    const evidencias = [
      { dossieId: "d1", tipo: "LICENCIAMENTO", titulo: "Licença aprovada", descricao: "A obra ganhou licença", url: "https://example.com/obra?utm_source=crm&utm_campaign=joao#top" },
      { dossieId: "d1", tipo: "LICENCIAMENTO", titulo: "Licença aprovada", descricao: "A obra ganhou licença", url: "https://example.com/obra/" },
      { dossieId: "d1", tipo: "LICENCIAMENTO", titulo: "Licença aprovada", descricao: "A obra ganhou licença", url: "https://example.com/obra-diferente" },
    ];

    expect(normalizarUrlParaHash(evidencias[0].url)).toBe(normalizarUrlParaHash(evidencias[1].url));
    expect(deduplicarEvidencias(evidencias)).toHaveLength(2);
  });

  it("deduplica evidências sem URL pelo conteúdo normalizado e distingue fatos distintos", () => {
    const base = { dossieId: "d1", tipo: "MOBILIZACAO", titulo: "Mobilização iniciada" };
    const igual = { ...base, descricao: "A obra começou a mobilização para a fundação." };
    const diferente = { ...base, descricao: "A obra iniciou a fase de fundação." };

    expect(gerarHashEvidencia(igual)).toBe(gerarHashEvidencia({ ...igual }));
    expect(gerarHashEvidencia(igual)).not.toBe(gerarHashEvidencia(diferente));
    expect(deduplicarEvidencias([igual, { ...igual }, diferente])).toHaveLength(2);
  });

  it("mantém duas evidências distintas e consolida em uma única movimentação", () => {
    const evidencias = [
      { dossieId: "d1", tipo: "FUNDACAO", titulo: "Fundação iniciou", descricao: "A estrutura começou em abril" },
      { dossieId: "d1", tipo: "FUNDACAO", titulo: "Fundação iniciada", descricao: "A estrutura começou em abril" },
    ];

    const movimentacoes = [
      { dossieId: "d1", tipo: "FUNDACAO_INICIADA", titulo: "Fundação iniciada", descricao: "A estrutura começou em abril", momento: "2026-08-05T00:00:00.000Z" },
    ];

    expect(deduplicarEvidencias(evidencias)).toHaveLength(2);
    expect(gerarHashMovimentacao(movimentacoes[0])).toBe(gerarHashMovimentacao({ ...movimentacoes[0] }));
    expect(deduplicarMovimentacoes([movimentacoes[0], { ...movimentacoes[0] }])).toHaveLength(1);
    expect(deduplicarMovimentacoes([movimentacoes[0], { ...movimentacoes[0], titulo: "Fundação em andamento" }])).toHaveLength(2);
  });

  it("faz upsert idempotente de evidência por dossiê e hash normalizado", () => {
    const base = {
      dossieId: "dossiê-1",
      tipo: "LICENCIAMENTO",
      titulo: "Licença aprovada",
      descricao: "A obra ganhou licença.",
      url: "https://example.com/obra?utm_source=crm&utm_campaign=joao#top",
      dataInformacao: "2026-08-05T00:00:00.000Z",
    };

    const persistidas: Array<typeof base> = [];

    const a = upsertDossieEvidencia(persistidas, base);
    const b = upsertDossieEvidencia(a, { ...base, url: "https://example.com/obra/" });
    const c = upsertDossieEvidencia(b, { ...base, url: "https://example.com/obra/?utm_source=ads" });
    const d = upsertDossieEvidencia(c, { ...base, url: "https://example.com/obra/#fragmento" });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(c).toHaveLength(1);
    expect(d).toHaveLength(1);

    const outra = {
      dossieId: "dossiê-1",
      tipo: "LICENCIAMENTO",
      titulo: "Licença aprovada em outra obra",
      descricao: "Um fato distinto da obra principal.",
      url: "https://example.com/obra-diferente",
      dataInformacao: "2026-08-05T00:00:00.000Z",
    };

    const e = upsertDossieEvidencia(d, outra);
    expect(e).toHaveLength(2);
  });

  it("faz upsert idempotente de atualização por assinatura lógica do fato", () => {
    const registros: Array<{ dossieId: string; tipo: string; titulo: string; conteudo: string; agente?: string | null; fonte?: string | null; link?: string | null; }> = [];
    const payload = {
      dossieId: "dossiê-1",
      tipo: "CAMPO_ATUALIZADO",
      titulo: "Loop investigação — faseObra",
      conteudo: "João atualizou automaticamente: faseObra.\n\nFonte: site oficial",
      agente: "joao-investigador",
      fonte: "Site oficial",
      link: null,
    };

    const a = upsertAtualizacaoDossie(registros, payload);
    const b = upsertAtualizacaoDossie(a, payload);
    const c = upsertAtualizacaoDossie(b, { ...payload, link: "https://example.com/novo" });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(c).toHaveLength(2);
  });

  it("mantém uma única evidência persistida para o mesmo fato em dossiê, mesmo com URL canônica equivalente", async () => {
    const store: any[] = [];
    const prismaFake = {
      dossieEvidencia: {
        findFirst: async ({ where }: any) => {
          const candidate = where?.OR ?? [];
          return store.find((item) => candidate.some((rule: any) => item.dossieId === where.dossieId && (rule.hashUrl ? item.hashUrl === rule.hashUrl : item.hashConteudo === rule.hashConteudo)));
        },
        create: async ({ data }: any) => {
          const row = { id: `ev-${store.length + 1}`, ...data };
          store.push(row);
          return row;
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = store.find((item) => item.id === where.id) ?? create;
          const merged = { ...existing, ...update };
          const idx = store.findIndex((item) => item.id === where.id);
          if (idx >= 0) store[idx] = merged;
          else store.push(merged);
          return merged;
        },
      },
    };

    const primeiro = await upsertDossieEvidenciaPersistida("d1", {
      tipo: "LICENCIAMENTO",
      titulo: "Porto do Recife",
      descricao: "Empresa anunciou expansão do porto marítimo.",
      url: "https://example.com/porto?utm_source=crm#top",
      dataInformacao: "2026-08-11T12:00:00.000Z",
    }, prismaFake as any);

    const segundo = await upsertDossieEvidenciaPersistida("d1", {
      tipo: "LICENCIAMENTO",
      titulo: "Porto do Recife",
      descricao: "Empresa anunciou expansão do porto marítimo.",
      url: "https://example.com/porto/",
      dataInformacao: "2026-08-11T12:00:00.000Z",
    }, prismaFake as any);

    expect(primeiro.id).toBeDefined();
    expect(segundo.id).toBe(primeiro.id);
  });

  it("mantém uma única evidência persistida mesmo quando o registro legado usou hash antigo do conteúdo e da URL", async () => {
    const store: any[] = [{
      id: "ev-legacy",
      dossieId: "d1",
      tipo: "LICENCIAMENTO",
      titulo: "Porto do Recife",
      descricao: "Empresa anunciou expansão do porto marítimo.",
      url: "https://example.com/porto/",
      dataInformacao: "2026-08-11T12:00:00.000Z",
      hashUrl: "https://example.com/porto",
      hashConteudo: "porto do recife empresa anunciou expansao do porto maritimo",
      createdAt: new Date("2026-08-11T12:00:00.000Z"),
    }];

    const prismaFake = {
      dossieEvidencia: {
        findFirst: async ({ where }: any) => {
          const ruleList = where?.OR ?? [];
          return store.find((item) => ruleList.some((rule: any) => item.dossieId === where.dossieId && ((rule.hashUrl && item.hashUrl === rule.hashUrl) || (rule.hashConteudo && item.hashConteudo === rule.hashConteudo)))) ?? null;
        },
        findMany: async ({ where }: any) => {
          return store.filter((item) => item.dossieId === where.dossieId);
        },
        create: async ({ data }: any) => {
          const row = { id: `ev-${store.length + 1}`, ...data };
          store.push(row);
          return row;
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = store.find((item) => item.id === where.id) ?? create;
          const merged = { ...existing, ...update };
          const idx = store.findIndex((item) => item.id === where.id);
          if (idx >= 0) store[idx] = merged;
          else store.push(merged);
          return merged;
        },
      },
    };

    const resultado = await upsertDossieEvidenciaPersistida("d1", {
      tipo: "LICENCIAMENTO",
      titulo: "Porto do Recife",
      descricao: "Empresa anunciou expansão do porto marítimo.",
      url: "https://example.com/porto?utm_source=crm#top",
      dataInformacao: "2026-08-11T12:00:00.000Z",
    }, prismaFake as any);

    expect(resultado.id).toBe("ev-legacy");
  });

  it("mantém uma única movimentação persistida mesmo quando o registro legado usou hash antigo do fato", async () => {
    const store: any[] = [{
      id: "mv-legacy",
      dossieId: "d1",
      tipo: "LICENCIAMENTO_APROVADO",
      titulo: "Porto do Recife",
      descricao: "A obra recebeu licenciamento principal.",
      momento: "2026-08-11T12:00:00.000Z",
      hashUnico: "LEGACY_HASH_DO_PORTO",
      createdAt: new Date("2026-08-11T12:00:00.000Z"),
    }];

    const prismaFake = {
      dossieMovimentacao: {
        findFirst: async ({ where }: any) => {
          return store.find((item) => item.dossieId === where.dossieId && item.hashUnico === where.hashUnico) ?? null;
        },
        findMany: async ({ where }: any) => {
          return store.filter((item) => item.dossieId === where.dossieId);
        },
        create: async ({ data }: any) => {
          const row = { id: `mv-${store.length + 1}`, ...data };
          store.push(row);
          return row;
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = store.find((item) => item.id === where.id) ?? create;
          const merged = { ...existing, ...update };
          const idx = store.findIndex((item) => item.id === where.id);
          if (idx >= 0) store[idx] = merged;
          else store.push(merged);
          return merged;
        },
      },
    };

    const resultado = await upsertDossieMovimentacaoPersistida({
      dossieId: "d1",
      tipo: "LICENCIAMENTO_APROVADO",
      titulo: "Porto do Recife",
      descricao: "A obra recebeu licenciamento principal.",
      momento: "2026-08-11T12:00:00.000Z",
    }, prismaFake as any);

    expect(resultado.id).toBe("mv-legacy");
  });

  it("mantém uma única movimentação persistida para o mesmo fato em dossiê, mesmo em reprocessamento", async () => {
    const store: any[] = [];
    const prismaFake = {
      dossieMovimentacao: {
        findFirst: async ({ where }: any) => {
          return store.find((item) => item.dossieId === where.dossieId && item.hashUnico === where.hashUnico) ?? null;
        },
        create: async ({ data }: any) => {
          const row = { id: `mv-${store.length + 1}`, ...data };
          store.push(row);
          return row;
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = store.find((item) => item.id === where.id) ?? create;
          const merged = { ...existing, ...update };
          const idx = store.findIndex((item) => item.id === where.id);
          if (idx >= 0) store[idx] = merged;
          else store.push(merged);
          return merged;
        },
      },
    };

    const primeiro = await upsertDossieMovimentacaoPersistida({
      dossieId: "d1",
      tipo: "LICENCIAMENTO_APROVADO",
      titulo: "Porto do Recife",
      descricao: "A obra recebeu licenciamento principal.",
      momento: "2026-08-11T12:00:00.000Z",
    }, prismaFake as any);

    const segundo = await upsertDossieMovimentacaoPersistida({
      dossieId: "d1",
      tipo: "LICENCIAMENTO_APROVADO",
      titulo: "Porto do Recife",
      descricao: "A obra recebeu licenciamento principal.",
      momento: "2026-08-11T12:00:00.000Z",
    }, prismaFake as any);

    expect(primeiro.id).toBeDefined();
    expect(segundo.id).toBe(primeiro.id);
  });

  it("reconhece o mesmo fato quando o mesmo título e momento são mantidos e a descrição varia levemente", async () => {
    const store: any[] = [{
      id: "mv-legacy",
      dossieId: "d1",
      tipo: "LICENCIAMENTO_EM_ANDAMENTO",
      titulo: "Calendário de licitação e contratação do Porto do Recife em 2026",
      descricao: "O Porto do Recife publicou e manteve editais e licitações em 2026, com processos em andamento e prazos de proposta e abertura de sessões públicas, evidenciando continuidade de investimentos e contratação.",
      momento: "2026-06-17T00:00:00.000Z",
      hashUnico: "LEGACY_HASH_DO_PORTO",
      createdAt: new Date("2026-08-12T00:00:00.000Z"),
    }];

    const prismaFake = {
      dossieMovimentacao: {
        findFirst: async ({ where }: any) => {
          return store.find((item) => item.dossieId === where.dossieId && item.hashUnico === where.hashUnico) ?? null;
        },
        findMany: async ({ where }: any) => {
          return store.filter((item) => item.dossieId === where.dossieId);
        },
        create: async ({ data }: any) => {
          const row = { id: `mv-${store.length + 1}`, ...data };
          store.push(row);
          return row;
        },
        upsert: async ({ where, update, create }: any) => {
          const existing = store.find((item) => item.id === where.id) ?? create;
          const merged = { ...existing, ...update };
          const idx = store.findIndex((item) => item.id === where.id);
          if (idx >= 0) store[idx] = merged;
          else store.push(merged);
          return merged;
        },
      },
    };

    const resultado = await upsertDossieMovimentacaoPersistida({
      dossieId: "d1",
      tipo: "LICENCIAMENTO_EM_ANDAMENTO",
      titulo: "Calendário de licitação e contratação do Porto do Recife em 2026",
      descricao: "O Porto do Recife publicou e manteve editais e licitações em 2026, com processos em andamento e prazos de proposta e abertura de sessões publicas, evidenciando continuidade de investimentos e contratação.",
      momento: "2026-06-17T00:00:00.000Z",
    }, prismaFake as any);

    expect(resultado.id).toBe("mv-legacy");
  });
});
