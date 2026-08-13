import { describe, expect, it } from "vitest";
import { statusAposNovaMensagemCliente } from "./reabertura";

describe("statusAposNovaMensagemCliente", () => {
  it("PENDENTE reabre para ABERTA", () => {
    expect(statusAposNovaMensagemCliente("PENDENTE")).toBe("ABERTA");
  });

  it("CONCLUIDA reabre para ABERTA", () => {
    expect(statusAposNovaMensagemCliente("CONCLUIDA")).toBe("ABERTA");
  });

  it("SPAM NUNCA reabre sozinho — só ação humana tira de Spam", () => {
    expect(statusAposNovaMensagemCliente("SPAM")).toBeNull();
  });

  it("ABERTA não precisa de ação (já é o estado ativo)", () => {
    expect(statusAposNovaMensagemCliente("ABERTA")).toBeNull();
  });

  it("status ausente/nulo: não mexe", () => {
    expect(statusAposNovaMensagemCliente(null)).toBeNull();
    expect(statusAposNovaMensagemCliente(undefined)).toBeNull();
  });
});
