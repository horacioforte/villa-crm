import { describe, expect, it } from "vitest";
import {
  classificarConversa,
  montarFilaDeAlertas,
  PRECEDENCIA_MOTIVOS,
  type ConversaParaAlerta,
  type TarefaVencidaParaAlerta,
} from "./alertas";

const AGORA = new Date("2026-01-01T12:00:00.000Z");
const minutosAtras = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString();
const diasAtras = (dias: number) => new Date(AGORA.getTime() - dias * 24 * 60 * 60_000).toISOString();

function conversaBase(overrides: Partial<ConversaParaAlerta> = {}): ConversaParaAlerta {
  return {
    id: "conversa-1",
    nomeContato: "Cliente Teste",
    telefone: "5581999999999",
    instanceName: "taciane-villa",
    canalTipo: "HUMANO",
    atendidoPorId: "usuario-1",
    atendidoPorNome: "Taciane",
    tarefaAtualId: null,
    aguardandoRespostaDesde: null,
    ultimaMensagemEm: minutosAtras(5),
    empresaNome: "Construtora Teste",
    oportunidade: null,
    ultimaMensagem: null,
    ...overrides,
  };
}

function tarefaBase(overrides: Partial<TarefaVencidaParaAlerta> = {}): TarefaVencidaParaAlerta {
  return {
    id: "tarefa-1",
    titulo: "Follow-up WhatsApp",
    dataVencimento: diasAtras(2),
    responsavelId: "usuario-1",
    ...overrides,
  };
}

describe("classificarConversa", () => {
  it("conversa sem nenhum sinal desta sprint: retorna null (não entra na fila)", () => {
    const conversa = conversaBase({
      atendidoPorId: "usuario-1",
      aguardandoRespostaDesde: null,
    });
    expect(classificarConversa(conversa, null, AGORA.getTime())).toBeNull();
  });

  it("conversa aguardando resposta há 20min (Normal): não gera alerta", () => {
    const conversa = conversaBase({ aguardandoRespostaDesde: minutosAtras(20) });
    expect(classificarConversa(conversa, null, AGORA.getTime())).toBeNull();
  });

  it("Atenção (30min-4h aguardando resposta): motivo aguardando_atencao", () => {
    const conversa = conversaBase({ aguardandoRespostaDesde: minutosAtras(45) });
    const alerta = classificarConversa(conversa, null, AGORA.getTime());
    expect(alerta?.motivos).toEqual(["aguardando_atencao"]);
    expect(alerta?.severidade).toBe("aguardando_atencao");
  });

  it("Urgente (>4h aguardando resposta): motivo aguardando_urgente", () => {
    const conversa = conversaBase({ aguardandoRespostaDesde: minutosAtras(5 * 60) });
    const alerta = classificarConversa(conversa, null, AGORA.getTime());
    expect(alerta?.motivos).toEqual(["aguardando_urgente"]);
    expect(alerta?.severidade).toBe("aguardando_urgente");
  });

  it("sem responsável: motivo sem_responsavel mesmo sem estar aguardando resposta", () => {
    const conversa = conversaBase({ atendidoPorId: null, atendidoPorNome: null, aguardandoRespostaDesde: null });
    const alerta = classificarConversa(conversa, null, AGORA.getTime());
    expect(alerta?.motivos).toEqual(["sem_responsavel"]);
    expect(alerta?.severidade).toBe("sem_responsavel");
  });

  it("tarefa WhatsApp vencida vinculada: motivo tarefa_whatsapp_vencida", () => {
    const conversa = conversaBase({ tarefaAtualId: "tarefa-1" });
    const alerta = classificarConversa(conversa, "tarefa-1", AGORA.getTime());
    expect(alerta?.motivos).toEqual(["tarefa_whatsapp_vencida"]);
    expect(alerta?.tarefaVencidaId).toBe("tarefa-1");
  });

  it("múltiplos motivos na mesma conversa: todos aparecem em motivos[], severidade é o mais crítico", () => {
    const conversa = conversaBase({
      atendidoPorId: null,
      atendidoPorNome: null,
      aguardandoRespostaDesde: minutosAtras(5 * 60),
      tarefaAtualId: "tarefa-1",
    });
    const alerta = classificarConversa(conversa, "tarefa-1", AGORA.getTime());

    expect(alerta?.motivos).toEqual(
      expect.arrayContaining(["aguardando_urgente", "sem_responsavel", "tarefa_whatsapp_vencida"]),
    );
    expect(alerta?.motivos).toHaveLength(3);
    // aguardando_urgente é o primeiro item de PRECEDENCIA_MOTIVOS -> é a severidade.
    expect(alerta?.severidade).toBe(PRECEDENCIA_MOTIVOS[0]);
    expect(alerta?.severidade).toBe("aguardando_urgente");
  });

  it("canalTipo é repassado sem alteração (HUMANO)", () => {
    const conversa = conversaBase({ atendidoPorId: null, atendidoPorNome: null, canalTipo: "HUMANO" });
    expect(classificarConversa(conversa, null, AGORA.getTime())?.canalTipo).toBe("HUMANO");
  });

  it("canalTipo é repassado sem alteração (IA) — Maria/João entram na fila como qualquer outro canal", () => {
    const conversa = conversaBase({
      instanceName: "joao-villa",
      canalTipo: "IA",
      atendidoPorId: null,
      atendidoPorNome: null,
    });
    const alerta = classificarConversa(conversa, null, AGORA.getTime());
    expect(alerta?.canalTipo).toBe("IA");
    expect(alerta?.instanceName).toBe("joao-villa");
  });

  it("dados de contexto (empresa, oportunidade, última mensagem, responsável) são repassados sem alteração", () => {
    const conversa = conversaBase({
      atendidoPorId: null,
      atendidoPorNome: null,
      empresaNome: "Betoneiras Alfa Ltda",
      oportunidade: { id: "op-1", titulo: "Locação de betoneira", valor: 15000 },
      ultimaMensagem: { conteudo: "Bom dia, ainda não recebi retorno", direcao: "ENTRADA", createdAt: minutosAtras(10) },
    });
    const alerta = classificarConversa(conversa, null, AGORA.getTime());

    expect(alerta?.empresaNome).toBe("Betoneiras Alfa Ltda");
    expect(alerta?.oportunidade).toEqual({ id: "op-1", titulo: "Locação de betoneira", valor: 15000 });
    expect(alerta?.ultimaMensagem?.conteudo).toBe("Bom dia, ainda não recebi retorno");
  });
});

describe("montarFilaDeAlertas — deduplicação", () => {
  it("uma conversa com vários motivos nunca aparece duplicada na fila (um único item)", () => {
    const conversa = conversaBase({
      id: "conversa-dup",
      atendidoPorId: null,
      atendidoPorNome: null,
      aguardandoRespostaDesde: minutosAtras(5 * 60),
      tarefaAtualId: "tarefa-1",
    });
    const fila = montarFilaDeAlertas({
      conversas: [conversa],
      tarefasVencidas: [tarefaBase({ id: "tarefa-1" })],
      agora: AGORA.getTime(),
    });

    const itensDaConversa = fila.filter((item) => item.tipo === "conversa" && item.conversaId === "conversa-dup");
    expect(itensDaConversa).toHaveLength(1);
    expect(fila).toHaveLength(1); // e a tarefa não aparece solta, pois está vinculada
  });

  it("tarefa vencida vinculada a uma conversa: aparece só como motivo da conversa, não como item solto", () => {
    const conversa = conversaBase({ id: "c1", tarefaAtualId: "tarefa-1", atendidoPorId: "usuario-1" });
    const fila = montarFilaDeAlertas({
      conversas: [conversa],
      tarefasVencidas: [tarefaBase({ id: "tarefa-1" })],
      agora: AGORA.getTime(),
    });

    expect(fila).toHaveLength(1);
    expect(fila[0].tipo).toBe("conversa");
    expect(fila[0].tipo === "conversa" && fila[0].motivos).toContain("tarefa_whatsapp_vencida");
  });

  it("tarefa vencida sem conversa vinculada: aparece como item solto tipo 'tarefa' (não é descartada nem associada artificialmente)", () => {
    const conversa = conversaBase({ id: "c1", atendidoPorId: "usuario-1", aguardandoRespostaDesde: null });
    const fila = montarFilaDeAlertas({
      conversas: [conversa],
      tarefasVencidas: [tarefaBase({ id: "tarefa-solta" })],
      agora: AGORA.getTime(),
    });

    expect(fila).toHaveLength(1);
    expect(fila[0]).toMatchObject({ tipo: "tarefa", tarefaId: "tarefa-solta" });
  });
});

describe("montarFilaDeAlertas — ordenação", () => {
  it("ordena por severidade (urgente > sem responsável > tarefa vencida > atenção) e depois por antiguidade", () => {
    const conversaAtencao = conversaBase({ id: "c-atencao", aguardandoRespostaDesde: minutosAtras(45) });
    const conversaSemResp = conversaBase({
      id: "c-sem-resp",
      atendidoPorId: null,
      atendidoPorNome: null,
      aguardandoRespostaDesde: null,
    });
    const conversaUrgente = conversaBase({ id: "c-urgente", aguardandoRespostaDesde: minutosAtras(10 * 60) });
    const tarefaSolta = tarefaBase({ id: "tarefa-solta", dataVencimento: diasAtras(1) });

    const fila = montarFilaDeAlertas({
      conversas: [conversaAtencao, conversaSemResp, conversaUrgente],
      tarefasVencidas: [tarefaSolta],
      agora: AGORA.getTime(),
    });

    const ordem = fila.map((item) => (item.tipo === "conversa" ? item.conversaId : item.tarefaId));
    expect(ordem).toEqual(["c-urgente", "c-sem-resp", "tarefa-solta", "c-atencao"]);
  });

  it("dentro da mesma severidade, espera mais longa vem primeiro", () => {
    const urgente3h = conversaBase({ id: "c-urgente-mais-novo", aguardandoRespostaDesde: minutosAtras(4 * 60 + 10) });
    const urgente10h = conversaBase({ id: "c-urgente-mais-antigo", aguardandoRespostaDesde: minutosAtras(10 * 60) });

    const fila = montarFilaDeAlertas({
      conversas: [urgente3h, urgente10h],
      tarefasVencidas: [],
      agora: AGORA.getTime(),
    });

    expect(fila.map((item) => (item.tipo === "conversa" ? item.conversaId : item.tarefaId))).toEqual([
      "c-urgente-mais-antigo",
      "c-urgente-mais-novo",
    ]);
  });
});
