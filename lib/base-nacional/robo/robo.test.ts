// ARQUIVO: lib/base-nacional/robo/robo.test.ts
// REGRA: nunca remover. Apenas acrescentar.
import { describe, expect, it } from "vitest";
import { analisarTexto, concluirSite, dominioDeEmail, extrairTexto, lerPagina, linksInternosRelevantes, robotsPermite } from "./site";
import { encontrarVinculos } from "./vinculos";

describe("domínio próprio", () => {
  it("ignora provedores genéricos e órgãos públicos", () => {
    expect(dominioDeEmail("fulano@gmail.com")).toBeNull();
    expect(dominioDeEmail("x@prefeitura.pe.gov.br")).toBeNull();
    expect(dominioDeEmail("concretousinado@CONCREUSI.COM.BR")).toBe("concreusi.com.br");
  });
});

describe("robots.txt", () => {
  it("respeita Disallow do grupo *", () => {
    expect(robotsPermite("User-agent: *\nDisallow: /", "/")).toBe(false);
    expect(robotsPermite("User-agent: *\nDisallow: /admin", "/")).toBe(true);
    expect(robotsPermite("User-agent: *\nDisallow:", "/qualquer")).toBe(true);
    expect(robotsPermite(null, "/")).toBe(true);
  });
  it("Allow mais específico vence", () => {
    expect(robotsPermite("User-agent: *\nDisallow: /\nAllow: /empresa", "/empresa")).toBe(true);
  });
  it("grupo próprio do robô tem precedência", () => {
    expect(robotsPermite("User-agent: villacrm-robogratuito\nDisallow: /\n\nUser-agent: *\nAllow: /", "/")).toBe(false);
  });
});

describe("análise de texto", () => {
  it("acha termos de concreto, CNPJ e trecho", () => {
    const a = analisarTexto("A Concreforte fornece concreto usinado e bombeado. CNPJ 33.088.457/0001-59. Caminhão betoneira próprio.");
    expect(a.termosConcreto).toContain("concreto usinado");
    expect(a.termosConcreto).toContain("caminhao betoneira");
    expect(a.cnpjs).toContain("33088457000159");
    expect(a.trechos[0].trecho).toMatch(/concreto usinado/);
  });
  it("fck sozinho não basta", () => {
    expect(analisarTexto("Blocos com fck 4 MPa").termosConcreto).toEqual([]);
  });
  it("site de outra atividade nunca vira 'não é' sozinho — só sugestão", () => {
    const p = analisarTexto("Gesso Royal Gipso — gesso projetado e drywall");
    expect(concluirSite({ raiz: "03090118", paginas: [p], algumaLida: true }).conclusao).toBe("OUTRA_ATIVIDADE_NO_SITE");
    expect(concluirSite({ raiz: "03090118", paginas: [], algumaLida: false }).conclusao).toBe("SEM_CONCLUSAO");
  });
  it("domínio de contador é reconhecido como terceiro", () => {
    const p = analisarTexto("GEVEHA Contabilidade — escritório de contabilidade. CNPJ 11.111.111/0001-11");
    expect(concluirSite({ raiz: "55722637", paginas: [p], algumaLida: true }).conclusao).toBe("SITE_DE_TERCEIRO");
  });
  it("extrai texto e links internos relevantes", () => {
    const h = extrairTexto(`<html><title>X</title><script>var a=1</script><a href="/empresa">Quem somos</a><a href="https://outro.com/x">x</a><a href="/foto.jpg">f</a><p>Concreto&nbsp;usinado</p></html>`);
    expect(h.texto).toMatch(/Concreto usinado/);
    expect(linksInternosRelevantes(new URL("https://x.com.br/"), h.links)).toEqual(["https://x.com.br/empresa"]);
  });
});

describe("leitura de página (rede simulada)", () => {
  const resp = (status: number, body: string, tipo = "text/html", headers: Record<string, string> = {}) =>
    new Response(body, { status, headers: { "content-type": tipo, ...headers } });
  it("não visita quando robots.txt bloqueia", async () => {
    const f = (async (u: string) => (String(u).endsWith("/robots.txt") ? resp(200, "User-agent: *\nDisallow: /", "text/plain") : resp(200, "<p>concreto usinado</p>"))) as unknown as typeof fetch;
    const p = await lerPagina("https://bloq1.com.br/", f);
    expect(p.permitidoRobots).toBe(false);
    expect(p.analise).toBeNull();
  });
  it("não contorna 403 nem CAPTCHA", async () => {
    const f403 = (async (u: string) => (String(u).endsWith("/robots.txt") ? resp(404, "") : resp(403, "proibido"))) as unknown as typeof fetch;
    expect((await lerPagina("https://bloq2.com.br/", f403)).erro).toMatch(/não contornado/);
    const fcap = (async (u: string) => (String(u).endsWith("/robots.txt") ? resp(404, "") : resp(200, "<title>Just a moment...</title> captcha"))) as unknown as typeof fetch;
    expect((await lerPagina("https://bloq3.com.br/", fcap)).erro).toMatch(/CAPTCHA/);
  });
  it("lê página permitida", async () => {
    const f = (async (u: string) => (String(u).endsWith("/robots.txt") ? resp(404, "") : resp(200, "<title>Concrex</title><p>Usina de concreto em Caruaru</p>"))) as unknown as typeof fetch;
    const p = await lerPagina("https://ok.com.br/", f);
    expect(p.erro).toBeNull();
    expect(p.analise?.termosConcreto).toContain("usina de concreto");
  });
});

describe("vínculos", () => {
  it("liga por e-mail, telefone e endereço; não duplica domínio quando o e-mail é igual", () => {
    const v = encontrarVinculos([
      { candidataId: "a", cnpjBasico: "1", telefones: ["8136310297"], emails: ["x@concreusi.com.br"], enderecos: [{ cep: "55920000", logradouro: "Rua A", numero: "10" }] },
      { candidataId: "b", cnpjBasico: "2", telefones: ["(81) 3631-0297"], emails: ["x@concreusi.com.br"], enderecos: [{ cep: "55920000", logradouro: "RUA A", numero: "10" }] },
      { candidataId: "c", cnpjBasico: "3", telefones: ["8100000000"], emails: ["y@gmail.com"], enderecos: [{ cep: "55920000", logradouro: "Sitio", numero: "SN" }] },
    ]);
    const ab = v.filter(x => x.a === "a" && x.b === "b").map(x => x.tipo).sort();
    expect(ab).toEqual(["EMAIL", "ENDERECO", "TELEFONE"]);
    expect(v.some(x => x.a === "c" || x.b === "c")).toBe(false);
    expect(v.find(x => x.tipo === "TELEFONE")!.chaveMascarada).not.toContain("3631");
  });
  it("chave compartilhada por muitas empresas vira vínculo fraco", () => {
    const l = ["a", "b", "c", "d", "e"].map((id, i) => ({ candidataId: id, cnpjBasico: String(i), telefones: ["8130487791"], emails: [], enderecos: [] }));
    expect(encontrarVinculos(l).every(x => x.forca === "BAIXA")).toBe(true);
  });
});
