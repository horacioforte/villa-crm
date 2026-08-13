import { describe, expect, it } from "vitest";
import {
  calcularAguardandoRespostaDesde,
  calcularAguardandoRespostaDesdeMensagens,
  formatarTempoDecorrido,
} from "./aguardando-resposta";

describe("calcularAguardandoRespostaDesde", () => {
  it("null quando nunca houve mensagem de cliente", () => {
    expect(calcularAguardandoRespostaDesde(null, null)).toBeNull();
    expect(calcularAguardandoRespostaDesde(null, "2026-01-01T00:00:00.000Z")).toBeNull();
  });

  it("aguardando quando há mensagem de cliente e nenhuma resposta humana", () => {
    const clienteEm = "2026-01-01T10:00:00.000Z";
    expect(calcularAguardandoRespostaDesde(clienteEm, null)).toBe(new Date(clienteEm).toISOString());
  });

  it("não aguardando quando a resposta humana é mais recente que a mensagem do cliente", () => {
    const clienteEm = "2026-01-01T10:00:00.000Z";
    const humanaEm = "2026-01-01T10:12:00.000Z";
    expect(calcularAguardandoRespostaDesde(clienteEm, humanaEm)).toBeNull();
  });

  it("aguardando quando o cliente mandou mensagem NOVA depois da última resposta humana (reabertura natural)", () => {
    const humanaEm = "2026-01-01T10:12:00.000Z";
    const clienteNovaEm = "2026-01-01T11:00:00.000Z";
    expect(calcularAguardandoRespostaDesde(clienteNovaEm, humanaEm)).toBe(new Date(clienteNovaEm).toISOString());
  });

  it("empate exato (mesmo timestamp) conta como já respondido, não aguardando", () => {
    const mesmoInstante = "2026-01-01T10:00:00.000Z";
    expect(calcularAguardandoRespostaDesde(mesmoInstante, mesmoInstante)).toBeNull();
  });
});

describe("calcularAguardandoRespostaDesdeMensagens", () => {
  it("ignora resposta de IA — SAIDA/IA nunca encerra a espera por atendimento humano", () => {
    const mensagens = [
      { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T10:00:00.000Z" },
      { direcao: "SAIDA", autor: "IA", createdAt: "2026-01-01T10:00:05.000Z" }, // Maria/João responderam automaticamente
    ];
    expect(calcularAguardandoRespostaDesdeMensagens(mensagens)).toBe("2026-01-01T10:00:00.000Z");
  });

  it("resposta HUMANA encerra a espera", () => {
    const mensagens = [
      { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T10:00:00.000Z" },
      { direcao: "SAIDA", autor: "HUMANO", createdAt: "2026-01-01T10:12:00.000Z" },
    ];
    expect(calcularAguardandoRespostaDesdeMensagens(mensagens)).toBeNull();
  });

  it("cliente manda de novo depois da resposta humana — volta a aguardar, a partir da mensagem nova", () => {
    const mensagens = [
      { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T10:00:00.000Z" },
      { direcao: "SAIDA", autor: "HUMANO", createdAt: "2026-01-01T10:12:00.000Z" },
      { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T14:00:00.000Z" },
    ];
    expect(calcularAguardandoRespostaDesdeMensagens(mensagens)).toBe("2026-01-01T14:00:00.000Z");
  });

  it("anomalia histórica do João V1: mensagem do cliente gravada com autor HUMANO (não CLIENTE) ainda conta como ENTRADA aguardando — nunca é confundida com resposta humana porque é ENTRADA, não SAIDA", () => {
    const mensagens = [
      // lib/agentes/joao/crm.ts (V1) grava a mensagem do cliente assim:
      { direcao: "ENTRADA", autor: "HUMANO", createdAt: "2026-01-01T10:00:00.000Z" },
    ];
    expect(calcularAguardandoRespostaDesdeMensagens(mensagens)).toBe("2026-01-01T10:00:00.000Z");
  });

  it("anomalia histórica do João V1 + resposta de IA depois: continua aguardando (IA não conta, e a mensagem HUMANO/ENTRADA não é lida como resposta)", () => {
    const mensagens = [
      { direcao: "ENTRADA", autor: "HUMANO", createdAt: "2026-01-01T10:00:00.000Z" }, // cliente, V1
      { direcao: "SAIDA", autor: "IA", createdAt: "2026-01-01T10:00:03.000Z" }, // João respondeu automaticamente
    ];
    expect(calcularAguardandoRespostaDesdeMensagens(mensagens)).toBe("2026-01-01T10:00:00.000Z");
  });

  it("sem nenhuma mensagem: não aguardando", () => {
    expect(calcularAguardandoRespostaDesdeMensagens([])).toBeNull();
  });

  it("mensagens fora de ordem cronológica no array: usa o MAX de cada categoria, não a ordem de entrada", () => {
    const mensagens = [
      { direcao: "SAIDA", autor: "HUMANO", createdAt: "2026-01-01T09:00:00.000Z" },
      { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T12:00:00.000Z" },
      { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T08:00:00.000Z" },
    ];
    expect(calcularAguardandoRespostaDesdeMensagens(mensagens)).toBe("2026-01-01T12:00:00.000Z");
  });
});

describe("formatarTempoDecorrido", () => {
  const BASE = new Date("2026-01-01T10:00:00.000Z").getTime();

  it("menos de 1 minuto: 'agora'", () => {
    expect(formatarTempoDecorrido(new Date(BASE - 30_000), BASE)).toBe("agora");
  });

  it("minutos: '7 min'", () => {
    expect(formatarTempoDecorrido(new Date(BASE - 7 * 60_000), BASE)).toBe("7 min");
  });

  it("horas e minutos: '1h 32min'", () => {
    expect(formatarTempoDecorrido(new Date(BASE - (60 + 32) * 60_000), BASE)).toBe("1h 32min");
  });

  it("horas exatas, sem minutos: '2h'", () => {
    expect(formatarTempoDecorrido(new Date(BASE - 2 * 60 * 60_000), BASE)).toBe("2h");
  });

  it("exemplo do pedido — 4h 32min", () => {
    expect(formatarTempoDecorrido(new Date(BASE - (4 * 60 + 32) * 60_000), BASE)).toBe("4h 32min");
  });

  it("1 dia exato", () => {
    expect(formatarTempoDecorrido(new Date(BASE - 24 * 60 * 60_000), BASE)).toBe("1 dia");
  });

  it("vários dias: '2 dias'", () => {
    expect(formatarTempoDecorrido(new Date(BASE - 50 * 60 * 60_000), BASE)).toBe("2 dias");
  });
});
