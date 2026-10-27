import { describe, expect, it } from "vitest";
import { empresaPrincipal, linkWhatsapp, linksConferenciaGrupo, siteDoGrupo, urlDeSite, urlSegura, whatsappsDoGrupo } from "./links-conferencia";

describe("urlDeSite", () => {
  it("aceita domínio puro, com www e com caminho", () => {
    expect(urlDeSite("polimix.com.br")).toBe("https://polimix.com.br/");
    expect(urlDeSite("www.polimix.com.br/contato")).toBe("https://www.polimix.com.br/contato");
    expect(urlDeSite("http://polimix.com.br")).toBe("http://polimix.com.br/");
  });
  it("recusa lixo e esquemas perigosos", () => {
    for (const v of ["", "   ", "sem ponto", "javascript:alert(1)", "localhost", null, undefined]) expect(urlDeSite(v)).toBeNull();
  });
});

describe("siteDoGrupo", () => {
  it("prefere o contato SITE", () => {
    const r = siteDoGrupo([{ tipo: "EMAIL", valor: "vendas@outra.com.br" }, { tipo: "SITE", valor: "polimix.com.br", fonteUrl: "https://fonte.com/x" }]);
    expect(r).toMatchObject({ url: "https://polimix.com.br/", origem: "SITE", fonteUrl: "https://fonte.com/x" });
  });
  it("sem SITE, usa o domínio do e-mail corporativo", () => {
    expect(siteDoGrupo([{ tipo: "EMAIL", valor: "Contato@CONCREUSI.com.br" }])).toMatchObject({ url: "https://concreusi.com.br", origem: "EMAIL" });
  });
  it("ignora e-mail gratuito e de órgão público", () => {
    expect(siteDoGrupo([{ tipo: "EMAIL", valor: "fulano@gmail.com" }, { tipo: "EMAIL", valor: "x@hotmail.com.br" }, { tipo: "EMAIL", valor: "y@prefeitura.pe.gov.br" }])).toBeNull();
  });
  it("pula o e-mail gratuito e usa o corporativo seguinte", () => {
    expect(siteDoGrupo([{ tipo: "EMAIL", valor: "a@gmail.com" }, { tipo: "EMAIL", valor: "b@usina.com.br" }])?.url).toBe("https://usina.com.br");
  });
  it("sem nada: null (botão desabilitado 'sem site')", () => {
    expect(siteDoGrupo([])).toBeNull();
    expect(siteDoGrupo([{ tipo: "TELEFONE", valor: "8133330000" }])).toBeNull();
  });
});

describe("linkWhatsapp / whatsappsDoGrupo", () => {
  it("monta wa.me com 55, com ou sem o DDI no número", () => {
    expect(linkWhatsapp("(81) 98888-7777")).toBe("https://wa.me/5581988887777");
    expect(linkWhatsapp("+55 81 98888-7777")).toBe("https://wa.me/5581988887777");
    expect(linkWhatsapp("5581988887777")).toBe("https://wa.me/5581988887777");
  });
  it("não pré-preenche texto", () => {
    expect(linkWhatsapp("81988887777")).not.toMatch(/[?&]text=/);
  });
  it("número inválido vira null", () => {
    for (const v of ["", "123", "81 3333", null, undefined, "00000000000"]) expect(linkWhatsapp(v)).toBeNull();
  });
  it("lista no máximo 3 WhatsApps distintos, com rótulo formatado e fonte", () => {
    const r = whatsappsDoGrupo([
      { tipo: "WHATSAPP", valor: "81988887777", fonteUrl: "https://site.com/contato" },
      { tipo: "WHATSAPP", valor: "+55 (81) 98888-7777" }, // repetido
      { tipo: "TELEFONE", valor: "81999990000" }, // não é WhatsApp
      { tipo: "WHATSAPP", valor: "81977776666", fonteUrl: "javascript:alert(1)" },
      { tipo: "WHATSAPP", valor: "81966665555" },
      { tipo: "WHATSAPP", valor: "81955554444" },
    ]);
    expect(r.map(x => x.rotulo)).toEqual(["WhatsApp (81) 98888-7777", "WhatsApp (81) 97777-6666", "WhatsApp (81) 96666-5555"]);
    expect(r[0]).toMatchObject({ url: "https://wa.me/5581988887777", fonteUrl: "https://site.com/contato" });
    expect(r[1].fonteUrl).toBeNull();
  });
});

describe("urlSegura", () => {
  it("só http(s)", () => {
    expect(urlSegura("https://a.com/x")).toBe("https://a.com/x");
    expect(urlSegura("javascript:alert(1)")).toBeNull();
    expect(urlSegura("data:text/html,x")).toBeNull();
    expect(urlSegura(null)).toBeNull();
  });
});

describe("linksConferenciaGrupo", () => {
  const empresas = [
    { razaoSocial: "FILIAL LTDA", nomeFantasia: null, totalUnidadesAtivas: 1, municipioMatriz: "Olinda", ufMatriz: "PE" },
    { razaoSocial: "POLIMIX CONCRETO LTDA", nomeFantasia: "Polimix", totalUnidadesAtivas: 9, municipioMatriz: "Recife", ufMatriz: "PE" },
  ];
  it("escolhe a empresa com mais unidades como principal", () => {
    expect(empresaPrincipal(empresas)?.nomeFantasia).toBe("Polimix");
    expect(empresaPrincipal([])).toBeNull();
  });
  it("busca usa nome fantasia + cidade/UF da principal", () => {
    const r = linksConferenciaGrupo({ empresas, contatos: [] });
    expect(r.google).toContain(encodeURIComponent('"Polimix" Recife PE concreto'));
    expect(r.maps).toContain("google.com/maps");
    expect(r.maps).toContain(encodeURIComponent("Polimix Recife PE"));
    expect(r.instagram).toContain(encodeURIComponent("site:instagram.com"));
    expect(r.site).toBeNull();
    expect(r.whatsapps).toEqual([]);
  });
  it("sem empresas, não quebra", () => {
    expect(linksConferenciaGrupo({ empresas: [], contatos: [] })).toEqual({ site: null, maps: null, instagram: null, google: null, whatsapps: [] });
  });
});
