import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const APP_SECRET_FAKE = "app-secret-global-fake-nao-real";
const VERIFY_TOKEN_FAKE = "verify-token-taciane-fake-nao-real";
const PHONE_NUMBER_ID_TACIANE = "1238399969356190";

const {
  auditLogMock,
  resolveWhatsappEnvVarMock,
  getCanalTacianeMock,
  mensagemJaProcessadaMock,
  persistirMensagemClienteMock,
} = vi.hoisted(() => ({
  auditLogMock: vi.fn(),
  resolveWhatsappEnvVarMock: vi.fn(),
  getCanalTacianeMock: vi.fn(),
  mensagemJaProcessadaMock: vi.fn(),
  persistirMensagemClienteMock: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ auditLog: (...args: unknown[]) => auditLogMock(...args) }));
vi.mock("@/lib/whatsapp/env-allowlist", () => ({
  resolveWhatsappEnvVar: (...args: unknown[]) => resolveWhatsappEnvVarMock(...args),
}));
vi.mock("@/lib/whatsapp/agentes/taciane", () => ({
  getCanalTaciane: (...args: unknown[]) => getCanalTacianeMock(...args),
  mensagemJaProcessada: (...args: unknown[]) => mensagemJaProcessadaMock(...args),
  persistirMensagemCliente: (...args: unknown[]) => persistirMensagemClienteMock(...args),
}));

import { GET, POST } from "./route";

const CANAL = { id: "canal-taciane", instanceName: "taciane-villa", tipo: "META_CLOUD_API", ativo: true };

beforeEach(() => {
  vi.clearAllMocks();
  resolveWhatsappEnvVarMock.mockImplementation(async (nome: string) => {
    if (nome === "META_APP_SECRET") return APP_SECRET_FAKE;
    if (nome === "TACIANE_META_VERIFY_TOKEN") return VERIFY_TOKEN_FAKE;
    throw new Error(`nome inesperado em teste: ${nome}`);
  });
  getCanalTacianeMock.mockResolvedValue(CANAL);
  mensagemJaProcessadaMock.mockResolvedValue(false);
  persistirMensagemClienteMock.mockResolvedValue({ id: "conversa-1" });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function assinar(rawBody: string, secret = APP_SECRET_FAKE) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function payloadComMensagem({
  phoneNumberId = PHONE_NUMBER_ID_TACIANE,
  messageId = "wamid.TACIANE-1",
  texto = "Preciso de uma betoneira",
  from = "558199999999",
}: { phoneNumberId?: string; messageId?: string | null; texto?: string; from?: string } = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "+55 81 7401-8568", phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: "Cliente Teste" }, wa_id: from }],
              messages:
                messageId === null
                  ? []
                  : [{ from, id: messageId, timestamp: "1700000000", type: "text", text: { body: texto } }],
            },
          },
        ],
      },
    ],
  };
}

function criarRequestPost(
  body: unknown,
  { assinarComSecretErrado = false, semAssinatura = false }: { assinarComSecretErrado?: boolean; semAssinatura?: boolean } = {},
) {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!semAssinatura) {
    headers["x-hub-signature-256"] = assinar(rawBody, assinarComSecretErrado ? "secret-errado" : APP_SECRET_FAKE);
  }
  return new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/taciane", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function criarRequestGet(params: Record<string, string>) {
  const url = new URL("https://villa-crm.vercel.app/api/webhook/whatsapp/taciane");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

// ─── GET — verificação do handshake ──────────────────────────────────────────

describe("GET /api/webhook/whatsapp/taciane — verificação do handshake", () => {
  it("verify_token válido: responde 200 com o challenge", async () => {
    const res = await GET(
      criarRequestGet({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN_FAKE, "hub.challenge": "abc123" }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("abc123");
  });

  it("verify_token inválido: responde 403, sem revelar o token esperado", async () => {
    const res = await GET(
      criarRequestGet({ "hub.mode": "subscribe", "hub.verify_token": "token-errado", "hub.challenge": "abc123" }),
    );
    expect(res.status).toBe(403);
    const texto = await res.text();
    expect(texto).not.toContain(VERIFY_TOKEN_FAKE);
  });

  it("verify token não configurado/permitido: responde 403 (nunca 500 vazando detalhe)", async () => {
    resolveWhatsappEnvVarMock.mockRejectedValue(new Error("não permitido"));
    const res = await GET(
      criarRequestGet({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN_FAKE, "hub.challenge": "abc123" }),
    );
    expect(res.status).toBe(403);
  });
});

// ─── POST — assinatura HMAC ──────────────────────────────────────────────────

describe("POST /api/webhook/whatsapp/taciane — assinatura X-Hub-Signature-256", () => {
  it("assinatura válida: processa normalmente", async () => {
    process.env.WHATSAPP_TACIANE_CONVERSAS_V2 = "true";
    const res = await POST(criarRequestPost(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).toHaveBeenCalledTimes(1);
  });

  it("assinatura ausente: rejeita com 401, sem consultar o canal", async () => {
    const res = await POST(criarRequestPost(payloadComMensagem(), { semAssinatura: true }));
    expect(res.status).toBe(401);
    expect(getCanalTacianeMock).not.toHaveBeenCalled();
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it("assinatura inválida (secret errado): rejeita com 401, sem consultar o canal", async () => {
    const res = await POST(criarRequestPost(payloadComMensagem(), { assinarComSecretErrado: true }));
    expect(res.status).toBe(401);
    expect(getCanalTacianeMock).not.toHaveBeenCalled();
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });
});

// ─── POST — guarda de phone_number_id ────────────────────────────────────────

describe("POST /api/webhook/whatsapp/taciane — guarda de phone_number_id", () => {
  beforeEach(() => {
    process.env.WHATSAPP_TACIANE_CONVERSAS_V2 = "true";
  });

  it("phone_number_id correto: processa normalmente", async () => {
    const res = await POST(criarRequestPost(payloadComMensagem({ phoneNumberId: PHONE_NUMBER_ID_TACIANE })));
    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).toHaveBeenCalledTimes(1);
  });

  it("phone_number_id divergente: ignora, audita, nunca persiste nem chama outro canal", async () => {
    const res = await POST(criarRequestPost(payloadComMensagem({ phoneNumberId: "OUTRO_NUMERO_QUALQUER" })));
    expect(res.status).toBe(200);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "WHATSAPP_TACIANE_PHONE_NUMBER_ID_DIVERGENTE",
        metadata: { phoneNumberIdRecebido: "OUTRO_NUMERO_QUALQUER" },
      }),
    );
    expect(getCanalTacianeMock).not.toHaveBeenCalled();
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });
});

// ─── POST — feature flag ─────────────────────────────────────────────────────

describe("POST /api/webhook/whatsapp/taciane — feature flag WHATSAPP_TACIANE_CONVERSAS_V2", () => {
  it("flag ausente (padrão OFF): responde 200 mas não persiste nada", async () => {
    delete process.env.WHATSAPP_TACIANE_CONVERSAS_V2;
    const res = await POST(criarRequestPost(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(getCanalTacianeMock).not.toHaveBeenCalled();
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it('flag "false": responde 200 mas não persiste nada', async () => {
    process.env.WHATSAPP_TACIANE_CONVERSAS_V2 = "false";
    const res = await POST(criarRequestPost(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it('flag "true": processa e persiste normalmente', async () => {
    process.env.WHATSAPP_TACIANE_CONVERSAS_V2 = "true";
    const res = await POST(criarRequestPost(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).toHaveBeenCalledTimes(1);
  });
});

// ─── POST — inbound de cliente ────────────────────────────────────────────────

describe("POST /api/webhook/whatsapp/taciane — inbound de cliente (flag ligada)", () => {
  beforeEach(() => {
    process.env.WHATSAPP_TACIANE_CONVERSAS_V2 = "true";
  });

  it("mensagem nova: persiste via persistirMensagemCliente com os dados corretos (CLIENTE/RECEBIDA)", async () => {
    const res = await POST(
      criarRequestPost(payloadComMensagem({ messageId: "wamid.nova", texto: "Quero alugar uma betoneira", from: "558188887777" })),
    );

    expect(res.status).toBe(200);
    expect(mensagemJaProcessadaMock).toHaveBeenCalledWith({ canal: CANAL, externalMessageId: "wamid.nova" });
    expect(persistirMensagemClienteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canal: CANAL,
        telefone: "558188887777",
        nomeContato: "Cliente Teste",
        externalMessageId: "wamid.nova",
        messageType: "text",
        texto: "Quero alugar uma betoneira",
      }),
    );
  });

  it("reentrega do mesmo evento (mesmo message.id): não persiste de novo", async () => {
    mensagemJaProcessadaMock.mockResolvedValue(true);

    await POST(criarRequestPost(payloadComMensagem({ messageId: "wamid.repetido" })));

    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it("concorrência: falha em persistirMensagemCliente (ex.: corrida P2002) não derruba a rota — responde 200", async () => {
    persistirMensagemClienteMock.mockRejectedValue(new Error("corrida concorrente simulada"));

    const res = await POST(criarRequestPost(payloadComMensagem({ messageId: "wamid.corrida" })));

    expect(res.status).toBe(200);
  });

  it("mensagem sem message.id: descartada, nenhum identificador é inventado", async () => {
    const payload = payloadComMensagem();
    // Remove o id da mensagem sem remover a mensagem inteira.
    (payload.entry[0].changes[0].value.messages as unknown[])[0] = {
      from: "558199999999",
      timestamp: "1700000000",
      type: "text",
      text: { body: "sem id" },
    };

    const res = await POST(criarRequestPost(payload));

    expect(res.status).toBe(200);
    expect(mensagemJaProcessadaMock).not.toHaveBeenCalled();
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it("canal inexistente: ignora sem persistir", async () => {
    getCanalTacianeMock.mockResolvedValue(null);

    const res = await POST(criarRequestPost(payloadComMensagem()));

    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it("canal inativo: ignora sem persistir", async () => {
    getCanalTacianeMock.mockResolvedValue({ ...CANAL, ativo: false });

    const res = await POST(criarRequestPost(payloadComMensagem()));

    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });
});

// ─── POST — payload inválido ──────────────────────────────────────────────────

describe("POST /api/webhook/whatsapp/taciane — payload inválido", () => {
  it("corpo não é JSON válido: retorna 400 (mas a assinatura já foi validada antes)", async () => {
    const rawBody = "{ isto não é json";
    const headers = { "x-hub-signature-256": assinar(rawBody), "Content-Type": "application/json" };
    const res = await POST(
      new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/taciane", { method: "POST", headers, body: rawBody }),
    );
    expect(res.status).toBe(400);
  });

  it('objeto diferente de "whatsapp_business_account": retorna 200 sem processar', async () => {
    process.env.WHATSAPP_TACIANE_CONVERSAS_V2 = "true";
    const res = await POST(criarRequestPost({ object: "outra_coisa", entry: [] }));
    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });
});

// ─── Nenhum segredo em log ────────────────────────────────────────────────────

describe("POST /api/webhook/whatsapp/taciane — nenhum segredo em log", () => {
  it("logs de warn/error nunca contêm o App Secret ou o Verify Token em texto plano", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    process.env.WHATSAPP_TACIANE_CONVERSAS_V2 = "true";
    await POST(criarRequestPost(payloadComMensagem(), { assinarComSecretErrado: true }));
    await GET(criarRequestGet({ "hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "x" }));

    const todasChamadas = [...warnSpy.mock.calls, ...errorSpy.mock.calls, ...infoSpy.mock.calls]
      .flat()
      .map((v) => JSON.stringify(v));

    for (const chamada of todasChamadas) {
      expect(chamada).not.toContain(APP_SECRET_FAKE);
      expect(chamada).not.toContain(VERIFY_TOKEN_FAKE);
    }

    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });
});

// ─── Garantias estáticas — ausência total de IA e de fallback ────────────────

function codigoSemComentarios(conteudo: string): string {
  return conteudo
    .split("\n")
    .map((linha) => linha.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("Garantia estática — ausência total de IA e de fallback para outros canais", () => {
  it("route.ts não importa nem chama nenhum agente de IA", () => {
    const codigo = codigoSemComentarios(readFileSync(join(__dirname, "route.ts"), "utf-8"));
    expect(codigo).not.toMatch(/analisarMensagem/);
    expect(codigo).not.toMatch(/from ["']@\/lib\/agentes/);
  });

  it("route.ts não referencia Maria, João ou Morgana (sem fallback entre canais)", () => {
    const codigo = codigoSemComentarios(readFileSync(join(__dirname, "route.ts"), "utf-8"));
    expect(codigo).not.toMatch(/maria/i);
    expect(codigo).not.toMatch(/joao|João/i);
    expect(codigo).not.toMatch(/morgana/i);
  });

  it("lib/whatsapp/agentes/taciane.ts não importa nem chama nenhum agente de IA", () => {
    const codigo = codigoSemComentarios(
      readFileSync(join(process.cwd(), "lib/whatsapp/agentes/taciane.ts"), "utf-8"),
    );
    expect(codigo).not.toMatch(/analisarMensagem/);
    expect(codigo).not.toMatch(/from ["']@\/lib\/agentes/);
  });
});
