import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  adquirirParaProcessamentoMock,
  marcarProcessadaMock,
  marcarErroProcessamentoMock,
  enviarTextoMetaMock,
  getContextoJoaoMock,
  analisarMensagemJoaoMock,
  processarRespostaJoaoMock,
} = vi.hoisted(() => ({
  prismaMock: {
    conversa: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    mensagem: { findFirst: vi.fn(), create: vi.fn() },
  },
  adquirirParaProcessamentoMock: vi.fn(),
  marcarProcessadaMock: vi.fn(),
  marcarErroProcessamentoMock: vi.fn(),
  enviarTextoMetaMock: vi.fn(),
  getContextoJoaoMock: vi.fn(),
  analisarMensagemJoaoMock: vi.fn(),
  processarRespostaJoaoMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../processamento-mensagem", () => ({
  adquirirParaProcessamento: (...args: unknown[]) => adquirirParaProcessamentoMock(...args),
  marcarProcessada: (...args: unknown[]) => marcarProcessadaMock(...args),
  marcarErroProcessamento: (...args: unknown[]) => marcarErroProcessamentoMock(...args),
}));
vi.mock("../meta-client", () => ({ enviarTextoMeta: (...args: unknown[]) => enviarTextoMetaMock(...args) }));
vi.mock("@/lib/agentes/joao/contexto", () => ({ getContextoJoao: (...args: unknown[]) => getContextoJoaoMock(...args) }));
vi.mock("@/lib/agentes/joao/handler", () => ({ analisarMensagemJoao: (...args: unknown[]) => analisarMensagemJoaoMock(...args) }));
vi.mock("@/lib/agentes/joao/crm", () => ({ processarRespostaJoao: (...args: unknown[]) => processarRespostaJoaoMock(...args) }));

import { processarValorMetaJoao } from "./joao";

const CANAL = { id: "canal-joao", instanceName: "joao-villa", tipo: "META_CLOUD_API", ativo: true, agenteIA: "joao" } as never;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.mensagem.findFirst.mockResolvedValue(null); // jaProcessada = false
  prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });
  prismaMock.conversa.update.mockResolvedValue({});
  adquirirParaProcessamentoMock.mockResolvedValue(true);
  marcarProcessadaMock.mockResolvedValue(undefined);
});

// Mensagem sem texto (ex.: tipo não suportado) — o fluxo de IA nunca é acionado, o que
// permite testar só o efeito colateral de reabertura sem precisar simular toda a
// análise/resposta do João.
function valorSemTexto(overrides: { messageId?: string } = {}) {
  return {
    messaging_product: "whatsapp" as const,
    metadata: { display_phone_number: "5581999999999", phone_number_id: "PHONE_JOAO" },
    contacts: [{ profile: { name: "Cliente Teste" }, wa_id: "5581988887777" }],
    messages: [
      {
        from: "5581988887777",
        id: overrides.messageId ?? "wamid.ABC",
        timestamp: "123",
        type: "unsupported",
      },
    ],
  };
}

describe("processarValorMetaJoao — Ciclo de Atendimento (reabertura automática)", () => {
  it("PENDENTE reabre para ABERTA ao chegar mensagem do cliente", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-joao", status: "PENDENTE" });

    await processarValorMetaJoao({ canal: CANAL, value: valorSemTexto({ messageId: "wamid.reabre-1" }) });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date), status: "ABERTA" },
    });
  });

  it("CONCLUIDA reabre para ABERTA ao chegar mensagem do cliente", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-joao", status: "CONCLUIDA" });

    await processarValorMetaJoao({ canal: CANAL, value: valorSemTexto({ messageId: "wamid.reabre-2" }) });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date), status: "ABERTA" },
    });
  });

  it("SPAM NUNCA reabre sozinha", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-joao", status: "SPAM" });

    await processarValorMetaJoao({ canal: CANAL, value: valorSemTexto({ messageId: "wamid.spam-1" }) });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date) },
    });
  });

  it("ABERTA não sofre escrita extra de status", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-joao", status: "ABERTA" });

    await processarValorMetaJoao({ canal: CANAL, value: valorSemTexto({ messageId: "wamid.aberta-1" }) });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date) },
    });
  });
});
