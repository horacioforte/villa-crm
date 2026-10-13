// ARQUIVO: lib/base-nacional/joao/joao.test.ts
// REGRA: nunca remover. Apenas acrescentar.
import { describe, expect, it } from "vitest";
import { agruparCandidatas } from "./agrupar";
import { extrairContatos, extrairPessoasComCargo, linksDeContato } from "./extrair";
import { classificarCargo, dominioRegistravel, nomePessoaPlausivel, normalizarLinkedinPessoa, normalizarTelefoneBR, textoCitaEmpresa, tokensDistintivos, validarEmail } from "./validar";

describe("validar", () => {
  it("telefone brasileiro", () => {
    expect(normalizarTelefoneBR("+55 (81) 99876-5432")).toBe("81998765432");
    expect(normalizarTelefoneBR("(11) 3333-4444")).toBe("1133334444");
    expect(normalizarTelefoneBR("0800 123 4567")).toBe("08001234567");
    expect(normalizarTelefoneBR("(81) 0000-0000")).toBeNull();
    expect(normalizarTelefoneBR("123")).toBeNull();
    expect(normalizarTelefoneBR("(81) 8876-5432 1")).toBeNull();
  });
  it("e-mail corporativo e domínio da empresa", () => {
    expect(validarEmail("Comercial@Polimix.com.br", ["www.polimix.com.br"])).toMatchObject({ valido: true, corporativo: true, confereEmpresa: true });
    expect(validarEmail("joao.silva@gmail.com", ["polimix.com.br"])).toMatchObject({ valido: true, corporativo: false, confereEmpresa: false });
    expect(validarEmail("contato@contabilxyz.com.br", ["polimix.com.br"])).toMatchObject({ corporativo: true, confereEmpresa: false });
    expect(validarEmail("seuemail@dominio.com").valido).toBe(false);
    expect(validarEmail("logo@2x.png").valido).toBe(false);
    expect(dominioRegistravel("mail.vendas.supermix.com.br")).toBe("supermix.com.br");
  });
  it("cargo e prioridade", () => {
    expect(classificarCargo("Sócio-Administrador").prioridade).toBe(1);
    expect(classificarCargo("Diretor Comercial").prioridade).toBe(2);
    expect(classificarCargo("Gerente de Operações").prioridade).toBe(3);
    expect(classificarCargo("Gerente de Manutenção").papel).toBe("RESPONSAVEL_MANUTENCAO");
    expect(classificarCargo("Gerente de Frota").papel).toBe("RESPONSAVEL_FROTA");
    expect(classificarCargo("Gerente de Suprimentos").papel).toBe("COMPRADOR");
    expect(classificarCargo("Auxiliar administrativo").prioridade).toBe(9);
  });
  it("homônimos: só aceita texto que cita a empresa", () => {
    const t = tokensDistintivos("POLIMIX CONCRETO LTDA", "POLIMIX");
    expect(t).toEqual(["POLIMIX"]);
    expect(textoCitaEmpresa("Diretor de Operações na Polimix Concreto", t)).toBe(true);
    expect(textoCitaEmpresa("Diretor de Operações na Votorantim", t)).toBe(false);
    expect(textoCitaEmpresa("qualquer coisa", [])).toBe(false);
  });
  it("nome de pessoa e LinkedIn", () => {
    expect(nomePessoaPlausivel("João da Silva")).toBe(true);
    expect(nomePessoaPlausivel("Concreto Usinado")).toBe(false);
    expect(nomePessoaPlausivel("Fale Conosco Comercial")).toBe(false);
    expect(normalizarLinkedinPessoa("https://br.linkedin.com/in/Joao-Silva-123?trk=x")).toBe("https://www.linkedin.com/in/joao-silva-123");
    expect(normalizarLinkedinPessoa("https://www.linkedin.com/company/polimix")).toBeNull();
  });
});

describe("extrair", () => {
  const texto = "Fale conosco: (81) 3333-4444 · WhatsApp (81) 99876-5432 · comercial@concretex.com.br · CNPJ 12.345.678/0001-90 · CEP 50000-000. José Carlos Pereira – Diretor Comercial. Gerente de Operações: Maria Souza Lima.";
  const links = [{ href: "https://wa.me/5581991112222", texto: "WhatsApp" }, { href: "mailto:vendas@concretex.com.br", texto: "e-mail" }, { href: "tel:+558133335555", texto: "ligue" },
    { href: "https://www.linkedin.com/company/concretex/", texto: "LinkedIn" }, { href: "/contato", texto: "Contato" }, { href: "https://outro.com/contato", texto: "x" }];
  it("contatos publicados no site", () => {
    const a = extrairContatos(texto, links, ["concretex.com.br"]);
    const v = (t: string) => a.filter(x => x.tipo === t).map(x => x.normalizado).sort();
    expect(v("TELEFONE")).toEqual(["8133334444", "8133335555"]);
    expect(v("WHATSAPP")).toEqual(["81991112222", "81998765432"]);
    expect(v("EMAIL")).toEqual(["comercial@concretex.com.br", "vendas@concretex.com.br"]);
    expect(v("LINKEDIN")).toEqual(["https://www.linkedin.com/company/concretex"]);
    expect(a.find(x => x.normalizado === "comercial@concretex.com.br")?.confereEmpresa).toBe(true);
  });
  it("pessoas com cargo, sem inventar", () => {
    const p = extrairPessoasComCargo(texto);
    expect(p.map(x => x.nome).sort()).toEqual(["José Carlos Pereira", "Maria Souza Lima"]);
    expect(p.find(x => x.nome === "Maria Souza Lima")?.prioridade).toBe(3);
    expect(extrairPessoasComCargo("Concreto usinado de qualidade. Atendimento comercial.")).toEqual([]);
  });
  it("links de contato só do próprio domínio", () => {
    expect(linksDeContato(new URL("https://concretex.com.br/"), links)).toEqual(["https://concretex.com.br/contato"]);
  });
});

describe("agrupar", () => {
  it("une por ligação forte e mantém chave estável pela menor raiz", () => {
    const g = agruparCandidatas([
      { candidataId: "a", raiz: "20000000", nome: "Topmix", unidadesAtivas: 4, ordem: 0 },
      { candidataId: "b", raiz: "10000000", nome: "Super Concreto", unidadesAtivas: 1, ordem: 5 },
      { candidataId: "c", raiz: "30000000", nome: "Outra", unidadesAtivas: 1, ordem: 1 },
    ], [{ a: "b", b: "a", motivo: "sócia pessoa jurídica (QSA)" }]);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ chave: "jg-10000000", principal: "a", candidataIds: ["a", "b"], ordem: 0, motivos: ["sócia pessoa jurídica (QSA)"] });
  });
});

describe("revisão 13/10/2026", () => {
  it("recusa menus, cidades e cargos colados como nome de pessoa", () => {
    expect(nomePessoaPlausivel("Clientes Orçamentos Fale Conosco Matriz")).toBe(false);
    expect(nomePessoaPlausivel("Prudente Ir")).toBe(false);
    expect(nomePessoaPlausivel("Sônia Regina Diretora Rogério Silvestrini")).toBe(false);
    expect(nomePessoaPlausivel("João Paulo Fernandes")).toBe(true);
    expect(extrairPessoasComCargo("Sawil Contabilidade em Presidente Prudente Ir para o conteúdo")).toEqual([]);
  });
  it("telefone de exemplo e e-mail com %20", () => {
    expect(normalizarTelefoneBR("+55 32 1234-5678")).toBeNull();
    expect(validarEmail("mailto:%20sawil@sawil.com.br").normalizado).toBe("sawil@sawil.com.br");
  });
});

