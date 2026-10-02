import { describe, expect, it } from "vitest";
import { endpointNeon, mascararEndpoint, validarAmbienteIsolado, validarBancoLocalDeTeste } from "./ambiente";

const PROD = "postgresql://u:senha@ep-aged-shadow-a1b2c3-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";
const PROD_DIRETA = "postgresql://u:senha@ep-aged-shadow-a1b2c3.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";
const BRANCH = "postgresql://u:senha@ep-quiet-river-z9y8x7.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require";

describe("base-nacional/ambiente", () => {
  it("extrai o endpoint Neon com e sem pooler", () => {
    expect(endpointNeon(PROD)).toBe("ep-aged-shadow-a1b2c3");
    expect(endpointNeon(PROD_DIRETA)).toBe("ep-aged-shadow-a1b2c3");
    expect(endpointNeon("postgresql://localhost/db")).toBeNull();
  });

  it("bloqueia quando o branch aponta para produção", () => {
    expect(() => validarAmbienteIsolado(PROD_DIRETA, [PROD])).toThrow(/PRODUÇÃO/);
    expect(() => validarAmbienteIsolado(PROD, [PROD_DIRETA])).toThrow(/PRODUÇÃO/);
  });

  it("bloqueia quando falta URL ou referência de produção", () => {
    expect(() => validarAmbienteIsolado(undefined, [PROD])).toThrow();
    expect(() => validarAmbienteIsolado(BRANCH, [undefined])).toThrow();
  });

  it("aceita endpoint diferente e nunca expõe credenciais", () => {
    const r = validarAmbienteIsolado(BRANCH, [PROD, PROD_DIRETA]);
    expect(r.endpoint).toBe("ep-quiet-river-z9y8x7");
    expect(r.endpointMascarado).toBe("ep-quiet-river-z9***");
    expect(r.endpointMascarado).not.toContain("senha");
    expect(mascararEndpoint(null)).toBe("(desconhecido)");
  });

  it("banco local de teste só aceita localhost", () => {
    expect(validarBancoLocalDeTeste(undefined)).toBeNull();
    expect(validarBancoLocalDeTeste("postgresql://postgres@localhost:55432/x")?.endpoint).toBe("local");
    expect(() => validarBancoLocalDeTeste(PROD)).toThrow(/localhost/);
  });
});
