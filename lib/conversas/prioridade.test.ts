import { describe, expect, it } from "vitest";
import { getPrioridadeAguardando, ordenarConversasPorPrioridade } from "./prioridade";

const AGORA = new Date("2026-01-01T12:00:00.000Z").getTime();
const minutosAtras = (min: number) => new Date(AGORA - min * 60_000).toISOString();

describe("getPrioridadeAguardando", () => {
  it("null quando a conversa não está aguardando resposta (nenhuma prioridade a exibir)", () => {
    expect(getPrioridadeAguardando(null, AGORA)).toBeNull();
    expect(getPrioridadeAguardando(undefined, AGORA)).toBeNull();
  });

  it("Normal entre 0 e 30 min (inclusive)", () => {
    expect(getPrioridadeAguardando(minutosAtras(0), AGORA)?.prioridade).toBe("normal");
    expect(getPrioridadeAguardando(minutosAtras(12), AGORA)?.prioridade).toBe("normal");
    expect(getPrioridadeAguardando(minutosAtras(30), AGORA)?.prioridade).toBe("normal");
  });

  it("Atenção acima de 30 min até 4h (inclusive)", () => {
    expect(getPrioridadeAguardando(minutosAtras(31), AGORA)?.prioridade).toBe("atencao");
    expect(getPrioridadeAguardando(minutosAtras(47), AGORA)?.prioridade).toBe("atencao");
    expect(getPrioridadeAguardando(minutosAtras(4 * 60), AGORA)?.prioridade).toBe("atencao");
  });

  it("Urgente acima de 4h", () => {
    expect(getPrioridadeAguardando(minutosAtras(4 * 60 + 1), AGORA)?.prioridade).toBe("urgente");
    expect(getPrioridadeAguardando(minutosAtras(4 * 60 + 32), AGORA)?.prioridade).toBe("urgente");
    expect(getPrioridadeAguardando(minutosAtras(26 * 60), AGORA)?.prioridade).toBe("urgente");
  });

  it("labels exatos exigidos", () => {
    expect(getPrioridadeAguardando(minutosAtras(12), AGORA)?.label).toBe("Normal");
    expect(getPrioridadeAguardando(minutosAtras(47), AGORA)?.label).toBe("Atenção");
    expect(getPrioridadeAguardando(minutosAtras(4 * 60 + 32), AGORA)?.label).toBe("Urgente");
  });
});

describe("ordenarConversasPorPrioridade", () => {
  it("conversas aguardando resposta vêm antes das que não estão aguardando", () => {
    const naoAguardando = { id: "nao-aguardando", aguardandoRespostaDesde: null, ultimaMensagemEm: minutosAtras(1) };
    const aguardandoNormal = { id: "aguardando-normal", aguardandoRespostaDesde: minutosAtras(5), ultimaMensagemEm: minutosAtras(5) };

    const ordenadas = ordenarConversasPorPrioridade([naoAguardando, aguardandoNormal]);

    expect(ordenadas[0].id).toBe("aguardando-normal");
    expect(ordenadas[1].id).toBe("nao-aguardando");
  });

  it("dentro de aguardando, urgente > atenção > normal", () => {
    const normal = { id: "normal", aguardandoRespostaDesde: minutosAtras(5) };
    const atencao = { id: "atencao", aguardandoRespostaDesde: minutosAtras(45) };
    const urgente = { id: "urgente", aguardandoRespostaDesde: minutosAtras(5 * 60) };

    const ordenadas = ordenarConversasPorPrioridade([normal, atencao, urgente]);

    expect(ordenadas.map((c) => c.id)).toEqual(["urgente", "atencao", "normal"]);
  });

  it("dentro da mesma faixa (ambas aguardando), espera mais longa aparece primeiro", () => {
    const esperandoPouco = { id: "pouco", aguardandoRespostaDesde: minutosAtras(5) };
    const esperandoMais = { id: "mais", aguardandoRespostaDesde: minutosAtras(20) };

    const ordenadas = ordenarConversasPorPrioridade([esperandoPouco, esperandoMais]);

    expect(ordenadas.map((c) => c.id)).toEqual(["mais", "pouco"]);
  });

  it("entre conversas que não estão aguardando, a mais recente (ultimaMensagemEm) aparece primeiro", () => {
    const antiga = { id: "antiga", aguardandoRespostaDesde: null, ultimaMensagemEm: minutosAtras(120) };
    const recente = { id: "recente", aguardandoRespostaDesde: null, ultimaMensagemEm: minutosAtras(5) };

    const ordenadas = ordenarConversasPorPrioridade([antiga, recente]);

    expect(ordenadas.map((c) => c.id)).toEqual(["recente", "antiga"]);
  });

  it("não depende da ordem de entrada nem de estabilidade de sort — entrada embaralhada dá o mesmo resultado", () => {
    const a = { id: "a", aguardandoRespostaDesde: minutosAtras(5 * 60) }; // urgente
    const b = { id: "b", aguardandoRespostaDesde: null, ultimaMensagemEm: minutosAtras(1) };
    const c = { id: "c", aguardandoRespostaDesde: minutosAtras(45) }; // atenção

    const ordenadas = ordenarConversasPorPrioridade([b, c, a]);

    expect(ordenadas.map((x) => x.id)).toEqual(["a", "c", "b"]);
  });
});
