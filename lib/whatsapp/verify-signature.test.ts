import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verificarAssinaturaMeta } from "./verify-signature";

const APP_SECRET = "segredo-de-teste-nao-real";

function assinar(rawBody: string, secret = APP_SECRET) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("verificarAssinaturaMeta", () => {
  it("aceita assinatura válida", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const signatureHeader = assinar(rawBody);

    expect(
      verificarAssinaturaMeta({ rawBody, signatureHeader, appSecret: APP_SECRET }),
    ).toBe(true);
  });

  it("rejeita assinatura inválida (secret errado)", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const signatureHeader = assinar(rawBody, "outro-secret");

    expect(
      verificarAssinaturaMeta({ rawBody, signatureHeader, appSecret: APP_SECRET }),
    ).toBe(false);
  });

  it("rejeita assinatura inválida (corpo alterado depois de assinado)", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const signatureHeader = assinar(rawBody);
    const rawBodyAlterado = JSON.stringify({ hello: "world-alterado" });

    expect(
      verificarAssinaturaMeta({ rawBody: rawBodyAlterado, signatureHeader, appSecret: APP_SECRET }),
    ).toBe(false);
  });

  it("rejeita quando o header está ausente", () => {
    expect(
      verificarAssinaturaMeta({ rawBody: "{}", signatureHeader: null, appSecret: APP_SECRET }),
    ).toBe(false);
  });

  it("rejeita quando o algoritmo não é sha256", () => {
    const rawBody = "{}";
    const hex = createHmac("sha256", APP_SECRET).update(rawBody, "utf8").digest("hex");

    expect(
      verificarAssinaturaMeta({ rawBody, signatureHeader: `sha1=${hex}`, appSecret: APP_SECRET }),
    ).toBe(false);
  });

  it("rejeita hex malformado sem lançar exceção", () => {
    expect(
      verificarAssinaturaMeta({ rawBody: "{}", signatureHeader: "sha256=xyz", appSecret: APP_SECRET }),
    ).toBe(false);
  });
});
