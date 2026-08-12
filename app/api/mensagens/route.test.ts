import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getCurrentUserMock, enviarTextoMetaMock, CanalInvalidoErrorFake, EnvioMetaErrorFake } = vi.hoisted(
  () => {
    class CanalInvalidoErrorFake extends Error {}
    class EnvioMetaErrorFake extends Error {}
    return {
      prismaMock: {
        conversa: { findUnique: vi.fn(), update: vi.fn() },
        mensagem: { create: vi.fn() },
      },
      getCurrentUserMock: vi.fn(),
      enviarTextoMetaMock: vi.fn(),
      CanalInvalidoErrorFake,
      EnvioMetaErrorFake,
    };
  },
);

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args) }));
vi.mock("@/lib/whatsapp/meta-client", () => ({
  enviarTextoMeta: (...args: unknown[]) => enviarTextoMetaMock(...args),
  CanalInvalidoError: CanalInvalidoErrorFake,
  EnvioMetaError: EnvioMetaErrorFake,
}));

import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };
const USER = { id: "user-1", nome: "Atendente" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  getCurrentUserMock.mockResolvedValue(USER);
  prismaMock.conversa.update.mockResolvedValue({});
  prismaMock.mensagem.create.mockResolvedValue({ id: "msg-evolution" });
});

function criarRequest(body: unknown) {
  return new Request("https://villa-crm.vercel.app/api/mensagens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/mensagens — roteamento determinístico por canal (sem fallback)", () => {
  it("canal META_CLOUD_API com a flag ligada: usa meta-client, nunca chama Evolution (fetch)", async () => {
    process.env.WHATSAPP_JOAO_V2 = "true";
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "joao-villa",
      canalWhatsappId: "canal-joao",
      canalWhatsapp: { tipo: "META_CLOUD_API" },
    });
    enviarTextoMetaMock.mockResolvedValue({ id: "msg-meta", status: "ENVIADA" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(res.status).toBe(200);
    expect(enviarTextoMetaMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("canal META_CLOUD_API com a flag desligada: usa o caminho Evolution legado (comportamento inalterado), não chama meta-client", async () => {
    delete process.env.WHATSAPP_JOAO_V2;
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "joao-villa",
      canalWhatsappId: "canal-joao",
      canalWhatsapp: { tipo: "META_CLOUD_API" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key: { id: "wa-1" } }) }));

    await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("canal CHATWOOT_MIRROR: bloqueia o envio, não chama meta-client nem Evolution", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "morgana-villa",
      canalWhatsappId: "canal-x",
      canalWhatsapp: { tipo: "CHATWOOT_MIRROR" },
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(res.status).toBe(422);
    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("conversa sem canal vinculado (legado): usa Evolution, exatamente como antes", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "morgana-villa",
      canalWhatsappId: null,
      canalWhatsapp: null,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key: { id: "wa-2" } }) }));

    await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("Evolution: grava canalWhatsappId e externalMessageId (= key.id devolvido no envio) na Mensagem — habilita reconciliação do eco fromMe da Morgana", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "morgana-villa",
      canalWhatsappId: "canal-morgana",
      canalWhatsapp: { tipo: "EVOLUTION" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key: { id: "wamid-evolution-123" } }) }));

    await POST(criarRequest({ conversaId: "c1", conteudo: "Já te retorno" }));

    expect(prismaMock.mensagem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        canalWhatsappId: "canal-morgana",
        externalMessageId: "wamid-evolution-123",
      }),
    });
    vi.unstubAllGlobals();
  });

  it("Evolution: quando a resposta não traz key.id, externalMessageId fica undefined/null — sem quebrar o envio", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "morgana-villa",
      canalWhatsappId: "canal-morgana",
      canalWhatsapp: { tipo: "EVOLUTION" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "Já te retorno" }));

    expect(res.status).toBe(200);
    expect(prismaMock.mensagem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ canalWhatsappId: "canal-morgana", externalMessageId: undefined }),
    });
    vi.unstubAllGlobals();
  });

  it("quando o envio via meta-client falha, NÃO tenta Evolution como fallback", async () => {
    process.env.WHATSAPP_JOAO_V2 = "true";
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "joao-villa",
      canalWhatsappId: "canal-joao",
      canalWhatsapp: { tipo: "META_CLOUD_API" },
    });
    enviarTextoMetaMock.mockRejectedValue(new EnvioMetaErrorFake("Erro simulado da Meta API."));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(res.status).toBe(502);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("POST /api/mensagens — canal META_CLOUD_API humano (agenteIA === null, ex.: Taciane), flag WHATSAPP_META_HUMANO_OUTBOUND_V2", () => {
  it("flag ligada: usa meta-client, nunca chama Evolution (fetch), persiste HUMANO/SAIDA via meta-client", async () => {
    process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2 = "true";
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "taciane-villa",
      canalWhatsappId: "canal-taciane",
      canalWhatsapp: { tipo: "META_CLOUD_API", agenteIA: null },
    });
    enviarTextoMetaMock.mockResolvedValue({ id: "msg-taciane", status: "ENVIADA" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "Oi, tudo bem?" }));

    expect(res.status).toBe(200);
    expect(enviarTextoMetaMock).toHaveBeenCalledTimes(1);
    expect(enviarTextoMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({ canalId: "canal-taciane", autorUsuarioId: "user-1" }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled(); // gravação é responsabilidade do meta-client, não desta rota
    vi.unstubAllGlobals();
  });

  it("flag ausente: BLOQUEIA o envio (422), nunca chama meta-client nem Evolution (fetch), nenhuma Mensagem é criada", async () => {
    delete process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2;
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "taciane-villa",
      canalWhatsappId: "canal-taciane",
      canalWhatsapp: { tipo: "META_CLOUD_API", agenteIA: null },
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "Oi, tudo bem?" }));

    expect(res.status).toBe(422);
    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('flag "false": BLOQUEIA o envio (422), sem fallback', async () => {
    process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2 = "false";
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "taciane-villa",
      canalWhatsappId: "canal-taciane",
      canalWhatsapp: { tipo: "META_CLOUD_API", agenteIA: null },
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(res.status).toBe(422);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("POST /api/mensagens — isolamento entre WHATSAPP_META_HUMANO_OUTBOUND_V2 e WHATSAPP_JOAO_V2", () => {
  it("canal de IA (agenteIA: 'joao') com WHATSAPP_META_HUMANO_OUTBOUND_V2=true mas WHATSAPP_JOAO_V2 ausente: continua indo por Evolution, a flag nova não afeta João", async () => {
    process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2 = "true";
    delete process.env.WHATSAPP_JOAO_V2;
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "joao-villa",
      canalWhatsappId: "canal-joao",
      canalWhatsapp: { tipo: "META_CLOUD_API", agenteIA: "joao" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key: { id: "wa-joao" } }) }));

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(res.status).toBe(200);
    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("canal de IA (agenteIA: 'maria') com WHATSAPP_META_HUMANO_OUTBOUND_V2=true mas WHATSAPP_JOAO_V2 ausente: continua indo por Evolution, a flag nova não afeta Maria", async () => {
    process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2 = "true";
    delete process.env.WHATSAPP_JOAO_V2;
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "maria-villa",
      canalWhatsappId: "canal-maria",
      canalWhatsapp: { tipo: "META_CLOUD_API", agenteIA: "maria" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key: { id: "wa-maria" } }) }));

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(res.status).toBe(200);
    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("canal João com WHATSAPP_JOAO_V2=true (comportamento já existente): continua indo por meta-client, mesmo sem WHATSAPP_META_HUMANO_OUTBOUND_V2", async () => {
    process.env.WHATSAPP_JOAO_V2 = "true";
    delete process.env.WHATSAPP_META_HUMANO_OUTBOUND_V2;
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      telefone: "5581999999999",
      instanceName: "joao-villa",
      canalWhatsappId: "canal-joao",
      canalWhatsapp: { tipo: "META_CLOUD_API", agenteIA: "joao" },
    });
    enviarTextoMetaMock.mockResolvedValue({ id: "msg-meta", status: "ENVIADA" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ conversaId: "c1", conteudo: "oi" }));

    expect(res.status).toBe(200);
    expect(enviarTextoMetaMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
