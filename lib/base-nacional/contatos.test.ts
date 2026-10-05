import { describe, expect, it } from "vitest";
import { chaveOrdenacao, formatarTelefone, linkContato, mascararEmail, mascararTelefone, normalizarContato, normalizarTelefone, validarContato, valorParaHistorico } from "./contatos";

describe("contatos", () => {
  it("normaliza telefones brasileiros", () => {
    expect(normalizarTelefone("+55 (81) 3333-4444")).toBe("8133334444");
    expect(normalizarTelefone("081 99999-1234")).toBe("81999991234");
    expect(normalizarContato("EMAIL", " A@B.Com ")).toBe("a@b.com");
    expect(normalizarContato("SITE", "https://www.Exemplo.com.br/")).toBe("exemplo.com.br");
  });
  it("valida", () => {
    expect(validarContato("TELEFONE", "(81) 3333-4444")).toBeNull();
    expect(validarContato("TELEFONE", "3333")).not.toBeNull();
    expect(validarContato("EMAIL", "x@y.com")).toBeNull();
    expect(validarContato("EMAIL", "x@y")).not.toBeNull();
    expect(validarContato("SITE", "exemplo.com.br")).toBeNull();
  });
  it("mascara para o histórico", () => {
    expect(mascararTelefone("(81) 99999-1234")).toBe("(81) *****-1234");
    expect(mascararEmail("comercial@empresa.com.br")).toBe("co***@empresa.com.br");
    expect(valorParaHistorico("SITE", "exemplo.com.br")).toBe("exemplo.com.br");
  });
  it("links nunca disparam envio automático (apenas abrem tel:, mailto:, wa.me)", () => {
    expect(linkContato("TELEFONE", "(81) 3333-4444")).toBe("tel:+558133334444");
    expect(linkContato("WHATSAPP", "(81) 99999-1234")).toBe("https://wa.me/5581999991234");
    expect(linkContato("EMAIL", "A@B.com")).toBe("mailto:a@b.com");
  });
  it("formata e gera chave de ordenação sem acentos", () => {
    expect(formatarTelefone("81999991234")).toBe("(81) 99999-1234");
    expect(chaveOrdenacao("ÉPSILON Ação")).toBe("epsilon acao");
  });
});
