import { describe, expect, it } from "vitest";
import { buildMelhorProximaAcao, buildTarefaPayloadFromRecomendacao } from "./next-action";

describe("buildMelhorProximaAcao", () => {
  it("prioriza uma tarefa vencida quando existe uma pendência urgente", () => {
    const resultado = buildMelhorProximaAcao({
      tarefasVencidas: 1,
      propostasAbertas: 1,
      ultimaMensagemEm: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      ultimaMensagemCliente: false,
      oportunidadeAtiva: true,
    });

    expect(resultado.acao).toBe("Ligue agora");
    expect(resultado.motivos).toContain("existe uma tarefa vencida");
    expect(resultado.confianca).toBe("alta");
    expect(resultado.naoAgir).toContain("perda");
  });

  it("sugere follow-up quando há proposta aberta e sem retorno", () => {
    const resultado = buildMelhorProximaAcao({
      tarefasVencidas: 0,
      propostasAbertas: 1,
      ultimaMensagemEm: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      ultimaMensagemCliente: false,
      oportunidadeAtiva: true,
    });

    expect(resultado.acao).toBe("Envie um follow-up");
    expect(resultado.motivos).toContain("a proposta permanece aberta sem resposta");
    expect(resultado.confianca).toBe("media");
  });

  it("retorna ação genérica quando não há sinais fortes", () => {
    const resultado = buildMelhorProximaAcao({
      tarefasVencidas: 0,
      propostasAbertas: 0,
      ultimaMensagemEm: new Date(Date.now() - 1000 * 60 * 60 * 2),
      ultimaMensagemCliente: true,
      oportunidadeAtiva: true,
    });

    expect(resultado.acao).toBe("Mantenha o acompanhamento");
    expect(resultado.confianca).toBe("baixa");
  });

  it("constrói um payload de tarefa a partir da recomendação", () => {
    const payload = buildTarefaPayloadFromRecomendacao({
      acao: "Envie um follow-up",
      urgencia: "alta",
      motivos: ["proposta aberta", "cliente sem retorno"],
      oportunidadeId: "opp-1",
      empresaId: "empresa-1",
      pessoaId: "pessoa-1",
    });

    expect(payload.titulo).toBe("Enviar follow-up");
    expect(payload.prioridade).toBe("ALTA");
    expect(payload.tipo).toBe("RETORNO_CLIENTE");
    expect(payload.oportunidadeId).toBe("opp-1");
  });
});
