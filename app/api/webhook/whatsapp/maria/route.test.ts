import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getContextoConversaMock,
  analisarMensagemMock,
  classificarTermometroLeadMock,
  enviarWhatsappMetaMock,
  registrarLeadQualificadoMock,
  registrarInteracaoParcialMock,
  getCanalMariaMock,
  mensagemJaProcessadaMock,
  persistirConversaMariaMock,
} = vi.hoisted(() => ({
  getContextoConversaMock: vi.fn(),
  analisarMensagemMock: vi.fn(),
  classificarTermometroLeadMock: vi.fn(),
  enviarWhatsappMetaMock: vi.fn(),
  registrarLeadQualificadoMock: vi.fn(),
  registrarInteracaoParcialMock: vi.fn(),
  getCanalMariaMock: vi.fn(),
  mensagemJaProcessadaMock: vi.fn(),
  persistirConversaMariaMock: vi.fn(),
}));

vi.mock("@/lib/agentes/maria/contexto", () => ({
  getContextoConversa: (...args: unknown[]) => getContextoConversaMock(...args),
}));
vi.mock("@/lib/agentes/maria/handler", () => ({
  analisarMensagem: (...args: unknown[]) => analisarMensagemMock(...args),
  classificarTermometroLead: (...args: unknown[]) => classificarTermometroLeadMock(...args),
}));
vi.mock("@/lib/agentes/maria/crm", () => ({
  enviarWhatsappMeta: (...args: unknown[]) => enviarWhatsappMetaMock(...args),
  registrarLeadQualificado: (...args: unknown[]) => registrarLeadQualificadoMock(...args),
  registrarInteracaoParcial: (...args: unknown[]) => registrarInteracaoParcialMock(...args),
}));
vi.mock("@/lib/whatsapp/agentes/maria", () => ({
  getCanalMaria: (...args: unknown[]) => getCanalMariaMock(...args),
  mensagemJaProcessada: (...args: unknown[]) => mensagemJaProcessadaMock(...args),
  persistirConversaMaria: (...args: unknown[]) => persistirConversaMariaMock(...args),
}));

import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };
const CANAL_MARIA = { id: "canal-maria", instanceName: "maria-villa", tipo: "META_CLOUD_API", ativo: true };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  getContextoConversaMock.mockResolvedValue({});
  analisarMensagemMock.mockResolvedValue({
    resposta: "Claro, qual a cidade da obra?",
    isLead: true,
    qualificado: false,
  });
  enviarWhatsappMetaMock.mockResolvedValue(undefined);
  registrarInteracaoParcialMock.mockResolvedValue(undefined);
  registrarLeadQualificadoMock.mockResolvedValue({ oportunidadeId: "op-1", criada: true });
  getCanalMariaMock.mockResolvedValue(CANAL_MARIA);
  mensagemJaProcessadaMock.mockResolvedValue(false);
  persistirConversaMariaMock.mockResolvedValue({ id: "conversa-1" });
});

function payloadComMensagem(overrides: { id?: string | null; texto?: string; from?: string } = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              messages: [
                {
                  from: overrides.from ?? "558199999999",
                  id: overrides.id === undefined ? "wamid.123" : overrides.id,
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: overrides.texto ?? "Preciso de uma bomba para obra em Recife" },
                },
              ],
              contacts: [{ profile: { name: "Cliente Teste" }, wa_id: overrides.from ?? "558199999999" }],
            },
          },
        ],
      },
    ],
  };
}

function criarRequest(body: unknown) {
  return new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/maria", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/webhook/whatsapp/maria — flag desligada (comportamento atual, inalterado)", () => {
  it("processa a mensagem normalmente e nunca toca a persistência adicional", async () => {
    delete process.env.WHATSAPP_MARIA_CONVERSAS_V2;

    const res = await POST(criarRequest(payloadComMensagem()));

    expect(res.status).toBe(200);
    expect(analisarMensagemMock).toHaveBeenCalledTimes(1);
    expect(enviarWhatsappMetaMock).toHaveBeenCalledTimes(1);
    expect(registrarInteracaoParcialMock).toHaveBeenCalledTimes(1);

    expect(getCanalMariaMock).not.toHaveBeenCalled();
    expect(mensagemJaProcessadaMock).not.toHaveBeenCalled();
    expect(persistirConversaMariaMock).not.toHaveBeenCalled();
  });

  it('com WHATSAPP_MARIA_CONVERSAS_V2="false" o comportamento também é o atual', async () => {
    process.env.WHATSAPP_MARIA_CONVERSAS_V2 = "false";

    await POST(criarRequest(payloadComMensagem()));

    expect(persistirConversaMariaMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhook/whatsapp/maria — flag ligada", () => {
  beforeEach(() => {
    process.env.WHATSAPP_MARIA_CONVERSAS_V2 = "true";
  });

  it("mensagem nova: fluxo comercial roda normalmente e a persistência adicional é chamada com o canal correto", async () => {
    const res = await POST(criarRequest(payloadComMensagem({ id: "wamid.nova" })));

    expect(res.status).toBe(200);
    expect(analisarMensagemMock).toHaveBeenCalledTimes(1);
    expect(enviarWhatsappMetaMock).toHaveBeenCalledTimes(1);

    expect(mensagemJaProcessadaMock).toHaveBeenCalledWith({ canal: CANAL_MARIA, externalMessageId: "wamid.nova" });
    expect(persistirConversaMariaMock).toHaveBeenCalledTimes(1);
    const chamada = persistirConversaMariaMock.mock.calls[0][0];
    expect(chamada.canal).toBe(CANAL_MARIA);
    expect(chamada.externalMessageId).toBe("wamid.nova");
    expect(chamada.telefone).toBe("558199999999");
    expect(chamada.nomeContato).toBe("Cliente Teste");
    expect(chamada.textoResposta).toBe("Claro, qual a cidade da obra?");
    expect(chamada.messageType).toBe("text");
  });

  it("reentrega da mesma mensagem: NENHUM reprocessamento comercial roda (sem segunda resposta ao cliente)", async () => {
    mensagemJaProcessadaMock.mockResolvedValue(true);

    const res = await POST(criarRequest(payloadComMensagem({ id: "wamid.repetida" })));

    expect(res.status).toBe(200);
    expect(analisarMensagemMock).not.toHaveBeenCalled();
    expect(enviarWhatsappMetaMock).not.toHaveBeenCalled();
    expect(registrarLeadQualificadoMock).not.toHaveBeenCalled();
    expect(registrarInteracaoParcialMock).not.toHaveBeenCalled();
    expect(persistirConversaMariaMock).not.toHaveBeenCalled();
  });

  it("nenhum efeito comercial duplicado: lead qualificado é registrado exatamente 1 vez", async () => {
    analisarMensagemMock.mockResolvedValue({ resposta: "Perfeito, vou te passar pra Morgana.", isLead: true, qualificado: true });
    classificarTermometroLeadMock.mockResolvedValue({ temperatura: "QUENTE", urgente: true, motivo: "Cliente de SP" });

    await POST(criarRequest(payloadComMensagem({ id: "wamid.lead" })));

    expect(registrarLeadQualificadoMock).toHaveBeenCalledTimes(1);
    expect(registrarInteracaoParcialMock).not.toHaveBeenCalled();
    expect(persistirConversaMariaMock).toHaveBeenCalledTimes(1);
  });

  it("canal ainda não cadastrado: fluxo comercial roda normalmente, persistência adicional é pulada", async () => {
    getCanalMariaMock.mockResolvedValue(null);

    const res = await POST(criarRequest(payloadComMensagem({ id: "wamid.sem-canal" })));

    expect(res.status).toBe(200);
    expect(enviarWhatsappMetaMock).toHaveBeenCalledTimes(1);
    expect(mensagemJaProcessadaMock).not.toHaveBeenCalled();
    expect(persistirConversaMariaMock).not.toHaveBeenCalled();
  });

  it("mensagem sem message.id da Meta: fluxo comercial roda normalmente, persistência adicional é pulada (nenhum id é inventado)", async () => {
    const res = await POST(criarRequest(payloadComMensagem({ id: null })));

    expect(res.status).toBe(200);
    expect(enviarWhatsappMetaMock).toHaveBeenCalledTimes(1);
    expect(getCanalMariaMock).not.toHaveBeenCalled();
    expect(persistirConversaMariaMock).not.toHaveBeenCalled();
  });

  it("falha ao checar idempotência (ex.: erro de banco): segue como se a flag estivesse desligada, fluxo comercial roda normalmente", async () => {
    getCanalMariaMock.mockRejectedValue(new Error("conexão com o banco falhou"));

    const res = await POST(criarRequest(payloadComMensagem({ id: "wamid.erro-check" })));

    expect(res.status).toBe(200);
    expect(enviarWhatsappMetaMock).toHaveBeenCalledTimes(1);
    expect(persistirConversaMariaMock).not.toHaveBeenCalled();
  });

  it("falha na persistência adicional (gravação): NÃO quebra o fluxo principal — resposta 200, IA e CRM já concluídos", async () => {
    persistirConversaMariaMock.mockRejectedValue(new Error("falha ao gravar Mensagem"));

    const res = await POST(criarRequest(payloadComMensagem({ id: "wamid.falha-gravacao" })));

    expect(res.status).toBe(200);
    expect(enviarWhatsappMetaMock).toHaveBeenCalledTimes(1);
    expect(registrarInteracaoParcialMock).toHaveBeenCalledTimes(1);
  });
});
