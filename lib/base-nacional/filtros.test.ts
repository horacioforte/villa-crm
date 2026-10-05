import { describe, expect, it } from "vitest";
import { descreverFiltros, lerFiltros, lerPaginacao, montarWhere, querystring, tipoRelatorio, totalPaginas } from "./filtros";

describe("base-nacional/filtros", () => {
  it("lê e higieniza filtros da URL", () => {
    const f = lerFiltros({ uf: "pe", cidade: " Recife ", status: "CONFIRMADA", tipoUnidade: "XX", confianca: "ALTA", segmento: "Concreteira", busca: "  alfa " });
    expect(f).toEqual({ uf: "PE", cidade: "Recife", status: "CONFIRMADA", tipoUnidade: undefined, confianca: "ALTA", segmento: "concreteira", busca: "alfa" });
    expect(lerFiltros({ uf: "Pernambuco", status: "DROP TABLE" })).toEqual({ uf: undefined, cidade: undefined, status: undefined, tipoUnidade: undefined, confianca: undefined, segmento: undefined, busca: undefined });
  });

  it("paginação aceita só tamanhos permitidos e página positiva", () => {
    expect(lerPaginacao({ pagina: "3", porPagina: "50" })).toEqual({ pagina: 3, porPagina: 50 });
    expect(lerPaginacao({ pagina: "-2", porPagina: "100000" })).toEqual({ pagina: 1, porPagina: 25 });
    expect(totalPaginas(0, 25)).toBe(1);
    expect(totalPaginas(51, 25)).toBe(3);
  });

  it("sem filtros gera where vazio", () => {
    expect(montarWhere({})).toEqual({});
  });

  it("filtros de local e tipo de unidade valem para qualquer unidade da candidata", () => {
    const w = montarWhere({ uf: "PE", cidade: "Recife", tipoUnidade: "CENTRAL_CONCRETO" }) as { AND: unknown[] };
    expect(w.AND).toEqual([{ unidades: { some: { uf: "PE", municipioNome: { equals: "Recife", mode: "insensitive" }, tipoUnidade: "CENTRAL_CONCRETO" } } }]);
  });

  it("segmento usa os segmentos da Empresa vinculada OU a atividade equivalente da candidata", () => {
    const w = montarWhere({ segmento: "concreteira" }) as { AND: Array<{ OR: unknown[] }> };
    expect(w.AND[0].OR).toHaveLength(2);
    expect(JSON.stringify(w.AND[0].OR[1])).toContain("CONCRETO_USINADO");
    const w2 = montarWhere({ segmento: "construtora" }) as { AND: Array<{ OR: unknown[] }> };
    expect(w2.AND[0].OR).toHaveLength(1);
  });

  it("busca por CNPJ usa só dígitos e prefixo", () => {
    const w = montarWhere({ busca: "90.000.001" }) as { AND: Array<{ OR: unknown[] }> };
    const s = JSON.stringify(w.AND[0].OR);
    expect(s).toContain('"cnpjBasico":{"startsWith":"90000001"}');
    expect(s).toContain('"cnpj":{"startsWith":"90000001"}');
  });

  it("querystring, descrição e tipo do relatório", () => {
    expect(querystring({ uf: "PE", busca: undefined }, { pagina: 2 })).toBe("?uf=PE&pagina=2");
    expect(querystring({})).toBe("");
    expect(descreverFiltros({}, {})).toBe("Todo o Brasil, sem filtros");
    expect(descreverFiltros({ uf: "PE", status: "CONFIRMADA" }, { status: "Confirmada" })).toBe("UF: PE · Situação: Confirmada");
    expect(tipoRelatorio({})).toBe("NACIONAL");
    expect(tipoRelatorio({ uf: "PE" })).toBe("UF");
    expect(tipoRelatorio({ uf: "PE", cidade: "Recife" })).toBe("CIDADE");
    expect(tipoRelatorio({ status: "PENDENTE" })).toBe("STATUS");
  });
});
