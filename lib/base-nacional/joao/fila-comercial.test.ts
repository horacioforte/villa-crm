import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de app/api/conversas/[id]/status/route.test.ts: $transaction é "interativa"
// (recebe uma função), então o mock chama o callback de verdade com um `tx` também mockado.
const { prismaMock, tx } = vi.hoisted(() => {
  const tx = {
    joaoEnriquecimentoGrupo: { update: vi.fn() },
    concreteiraCandidataContato: { updateMany: vi.fn() },
    concreteiraCandidata: { findMany: vi.fn(), update: vi.fn() },
    concreteiraValidacaoHistorico: { create: vi.fn() },
  };
  return {
    tx,
    prismaMock: {
      joaoEnriquecimentoGrupo: { findUnique: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { decidirGrupoJoao, validarDecisaoJoao, justificativaDescarte, PUBLICOS_JOAO } = await import("./fila-comercial");
const { MOTIVOS_DESCARTE, MOTIVO_DESCARTE_TIPO_ATIVIDADE } = await import("./fila-comercial-rotulos");

const GRUPO = { chave: "jg-demo", publico: "LOTE_206", candidataIds: ["c1", "c2"], decisaoComercial: null as string | null };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.joaoEnriquecimentoGrupo.findUnique.mockResolvedValue(GRUPO);
  tx.concreteiraCandidata.findMany.mockResolvedValue([
    { id: "c1", statusValidacao: "CONFIRMADA" },
    { id: "c2", statusValidacao: "PROVAVEL" },
  ]);
});

describe("validarDecisaoJoao — pura, sem banco", () => {
  it("\"Aprovado para abordagem\" não exige observação", () => {
    expect(validarDecisaoJoao({ decisao: "APROVADO_ABORDAGEM", observacao: null, contatosInvalidos: [] })).toEqual({ ok: true, obs: "", invalidos: [] });
  });
  it("demais decisões exigem observação com pelo menos 5 caracteres (depois de aparar espaços)", () => {
    expect(validarDecisaoJoao({ decisao: "ADIAR", observacao: "   ab  ", contatosInvalidos: [] })).toEqual({ ok: false, erros: ["Escreva uma observação curta (mínimo 5 caracteres)."] });
    expect(validarDecisaoJoao({ decisao: "ADIAR", observacao: "  pouco uso ainda  ", contatosInvalidos: [] })).toMatchObject({ ok: true, obs: "pouco uso ainda" });
  });
  it("contatosInvalidos só é usado quando a decisão é CONTATO_INVALIDO", () => {
    const r = validarDecisaoJoao({ decisao: "NAO_PRIORITARIA", observacao: "fora do perfil", contatosInvalidos: ["k1", "k2"] });
    expect(r).toMatchObject({ ok: true, invalidos: [] });
  });
  it("contatosInvalidos é truncado em 50 por chamada", () => {
    const muitos = Array.from({ length: 80 }, (_, i) => `k${i}`);
    const r = validarDecisaoJoao({ decisao: "CONTATO_INVALIDO", observacao: "telefone não existe mais", contatosInvalidos: muitos });
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.invalidos).toHaveLength(50);
  });
});

describe("decidirGrupoJoao — grupo inexistente ou fora do público", () => {
  it("grupo não encontrado: erro, nenhuma transação é aberta", async () => {
    prismaMock.joaoEnriquecimentoGrupo.findUnique.mockResolvedValue(null);
    const r = await decidirGrupoJoao({ chave: "jg-fantasma", decisao: "ADIAR", observacao: "teste", contatosInvalidos: [], usuarioId: "u1" });
    expect(r).toEqual({ ok: false, erros: ["Grupo não encontrado."] });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
  it("grupo de público fora de PUBLICOS_JOAO: erro", async () => {
    prismaMock.joaoEnriquecimentoGrupo.findUnique.mockResolvedValue({ ...GRUPO, publico: "OUTRO_PUBLICO" });
    const r = await decidirGrupoJoao({ chave: "jg-demo", decisao: "ADIAR", observacao: "teste", contatosInvalidos: [], usuarioId: "u1" });
    expect(r.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
  it("PUBLICOS_JOAO inclui PILOTO_20 e LOTE_206 (confirma o público usado no teste)", () => {
    expect(PUBLICOS_JOAO).toEqual(expect.arrayContaining(["PILOTO_20", "LOTE_206"]));
  });
});

describe("decidirGrupoJoao — validação propagada (sem tocar no banco de escrita)", () => {
  it("observação curta é recusada antes de abrir transação", async () => {
    const r = await decidirGrupoJoao({ chave: "jg-demo", decisao: "ADIAR", observacao: "oi", contatosInvalidos: [], usuarioId: "u1" });
    expect(r).toEqual({ ok: false, erros: ["Escreva uma observação curta (mínimo 5 caracteres)."] });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("decidirGrupoJoao — histórico (grava em TODAS as empresas do grupo)", () => {
  it("cria ConcreteiraValidacaoHistorico para cada candidata do grupo, nunca só a primeira", async () => {
    const r = await decidirGrupoJoao({ chave: "jg-demo", decisao: "PESQUISAR_MELHOR", observacao: "falta telefone direto", contatosInvalidos: [], usuarioId: "u1" });
    expect(r).toEqual({ ok: true });
    expect(tx.concreteiraValidacaoHistorico.create).toHaveBeenCalledTimes(2); // c1 e c2
    const chamadas = tx.concreteiraValidacaoHistorico.create.mock.calls.map(c => c[0].data);
    expect(chamadas.map((d: { candidataId: string }) => d.candidataId).sort()).toEqual(["c1", "c2"]);
  });
  it("o histórico preserva o status atual da candidata (statusAnterior = statusNovo) — decisão comercial não muda a validação da Receita", async () => {
    await decidirGrupoJoao({ chave: "jg-demo", decisao: "PESQUISAR_MELHOR", observacao: "falta telefone direto", contatosInvalidos: [], usuarioId: "u1" });
    const dados = tx.concreteiraValidacaoHistorico.create.mock.calls[0][0].data;
    expect(dados.statusAnterior).toBe(dados.statusNovo);
    expect(dados.campo).toBe("decisaoComercial");
    expect(dados.valorNovo).toBe("PESQUISAR_MELHOR");
  });
  it("o motivo do histórico nunca afirma que um contato foi feito", async () => {
    await decidirGrupoJoao({ chave: "jg-demo", decisao: "APROVADO_ABORDAGEM", observacao: null, contatosInvalidos: [], usuarioId: "u1" });
    const motivo = tx.concreteiraValidacaoHistorico.create.mock.calls[0][0].data.motivo as string;
    expect(motivo).toMatch(/Nenhum contato foi feito/);
  });
});

describe("decidirGrupoJoao — contatos inválidos ficam ocultos, nunca excluídos", () => {
  it("CONTATO_INVALIDO marca os contatos escolhidos como INVALIDO (updateMany), nunca delete", async () => {
    const r = await decidirGrupoJoao({ chave: "jg-demo", decisao: "CONTATO_INVALIDO", observacao: "telefone não atende mais", contatosInvalidos: ["k1", "k2"], usuarioId: "u1" });
    expect(r).toEqual({ ok: true });
    expect(tx.concreteiraCandidataContato.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["k1", "k2"] }, candidataId: { in: ["c1", "c2"] } },
      data: { situacao: "INVALIDO", verificadoEm: expect.any(Date), verificadoPorId: "u1" },
    });
    // "Inválido" é uma situação (oculta a UI, ver [chave]/page.tsx: situacao: { not: "INVALIDO" }),
    // nunca uma exclusão — o mock de tx nem expõe um método delete para o código poder chamar.
    expect(Object.keys(tx.concreteiraCandidataContato)).not.toContain("delete");
  });
  it("decisão diferente de CONTATO_INVALIDO nunca toca em contatos, mesmo se a lista vier preenchida", async () => {
    await decidirGrupoJoao({ chave: "jg-demo", decisao: "ADIAR", observacao: "ainda sem definição", contatosInvalidos: ["k1"], usuarioId: "u1" });
    expect(tx.concreteiraCandidataContato.updateMany).not.toHaveBeenCalled();
  });
});

describe("decidirGrupoJoao — grava a decisão no grupo com responsável e data", () => {
  it("atualiza joaoEnriquecimentoGrupo com decisaoComercial, decisaoPorId e decisaoEm", async () => {
    await decidirGrupoJoao({ chave: "jg-demo", decisao: "NAO_PRIORITARIA", observacao: "porte pequeno demais", contatosInvalidos: [], usuarioId: "u-responsavel" });
    expect(tx.joaoEnriquecimentoGrupo.update).toHaveBeenCalledWith({
      where: { chave: "jg-demo" },
      data: { decisaoComercial: "NAO_PRIORITARIA", decisaoObservacao: "porte pequeno demais", decisaoPorId: "u-responsavel", decisaoEm: expect.any(Date) },
    });
  });
});

describe("\"Não é concreteira\" — validação pura", () => {
  it("o motivo basta: observação é opcional", () => {
    const r = validarDecisaoJoao({ decisao: "NAO_E_CONCRETEIRA", motivoDescarte: "ARGAMASSA", observacao: null, contatosInvalidos: ["k1"] });
    expect(r).toEqual({ ok: true, obs: "", invalidos: [], descarte: { motivo: "ARGAMASSA", label: "Argamassa", tipoAtividade: "ARGAMASSA" } });
  });
  it("sem motivo (ou motivo desconhecido) é recusado", () => {
    expect(validarDecisaoJoao({ decisao: "NAO_E_CONCRETEIRA", observacao: "x", contatosInvalidos: [] }).ok).toBe(false);
    expect(validarDecisaoJoao({ decisao: "NAO_E_CONCRETEIRA", motivoDescarte: "QUALQUER", observacao: "x", contatosInvalidos: [] }).ok).toBe(false);
  });
  it("mapeia cada motivo para o tipoAtividade combinado", () => {
    expect(MOTIVO_DESCARTE_TIPO_ATIVIDADE).toEqual({
      ARGAMASSA: "ARGAMASSA", PRE_MOLDADO: "PRE_MOLDADO", CONSTRUTORA: "OUTRA_ATIVIDADE",
      MINERACAO_AREIA: "OUTRA_ATIVIDADE", LOJA_REVENDA: "OUTRA_ATIVIDADE", FECHOU_INATIVA: "OUTRA_ATIVIDADE",
    });
    expect(Object.keys(MOTIVO_DESCARTE_TIPO_ATIVIDADE).sort()).toEqual([...MOTIVOS_DESCARTE].sort());
  });
});

describe("\"Não é concreteira\" — gravação em uma transação", () => {
  const dados = { chave: "jg-demo", decisao: "NAO_E_CONCRETEIRA" as const, motivoDescarte: "LOJA_REVENDA", observacao: "vende peças", contatosInvalidos: [], usuarioId: "u1", usuarioNome: "Horácio" };
  beforeEach(() => {
    tx.concreteiraCandidata.findMany.mockResolvedValue([
      { id: "c1", statusValidacao: "PROVAVEL", tipoAtividade: null, confianca: "MEDIA", primeiraVerificacaoEm: null },
      { id: "c2", statusValidacao: "CONFIRMADA", tipoAtividade: "CONCRETO_USINADO", confianca: "ALTA", primeiraVerificacaoEm: new Date("2026-01-01") },
    ]);
  });

  it("grupo vira NAO_PRIORITARIA com a observação padronizada", async () => {
    expect(await decidirGrupoJoao(dados)).toEqual({ ok: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.joaoEnriquecimentoGrupo.update).toHaveBeenCalledWith({
      where: { chave: "jg-demo" },
      data: { decisaoComercial: "NAO_PRIORITARIA", decisaoObservacao: "Não é concreteira — Loja/revenda: vende peças", decisaoPorId: "u1", decisaoEm: expect.any(Date) },
    });
  });
  it("sem observação, grava só o motivo", async () => {
    await decidirGrupoJoao({ ...dados, observacao: null });
    expect(tx.joaoEnriquecimentoGrupo.update.mock.calls[0][0].data.decisaoObservacao).toBe("Não é concreteira — Loja/revenda");
  });
  it("cada candidata recebe status, tipoAtividade, justificativa não vazia e validador", async () => {
    await decidirGrupoJoao(dados);
    expect(tx.concreteiraCandidata.update).toHaveBeenCalledTimes(2);
    for (const [arg] of tx.concreteiraCandidata.update.mock.calls) {
      expect(arg.data).toMatchObject({ statusValidacao: "NAO_E_CONCRETEIRA", tipoAtividade: "OUTRA_ATIVIDADE", validadoPorId: "u1", validadoEm: expect.any(Date), ultimaVerificacaoEm: expect.any(Date) });
      expect(arg.data.justificativa).toMatch(/^Não é concreteira \(Loja\/revenda\) — decisão na Fila do João por Horácio em \d{2}\/\d{2}\/\d{4}: vende peças$/);
    }
    expect(tx.concreteiraCandidata.update.mock.calls[0][0].data.primeiraVerificacaoEm).toEqual(expect.any(Date));
    expect(tx.concreteiraCandidata.update.mock.calls[1][0].data).not.toHaveProperty("primeiraVerificacaoEm");
  });
  it("histórico: VALIDACAO (anterior → NAO_E_CONCRETEIRA) e DECISAO_COMERCIAL para cada candidata; nada é apagado", async () => {
    await decidirGrupoJoao(dados);
    const h = tx.concreteiraValidacaoHistorico.create.mock.calls.map(c => c[0].data);
    expect(h).toHaveLength(4);
    const validacao = h.filter((d: { tipoEvento: string }) => d.tipoEvento === "VALIDACAO");
    expect(validacao.map((d: { statusAnterior: string }) => d.statusAnterior)).toEqual(["PROVAVEL", "CONFIRMADA"]);
    expect(validacao.every((d: { statusNovo: string; tipoNovo: string }) => d.statusNovo === "NAO_E_CONCRETEIRA" && d.tipoNovo === "OUTRA_ATIVIDADE")).toBe(true);
    const decisoes = h.filter((d: { tipoEvento: string }) => d.tipoEvento === "DECISAO_COMERCIAL");
    expect(decisoes.every((d: { valorNovo: string }) => d.valorNovo === "NAO_PRIORITARIA")).toBe(true);
    expect(tx.concreteiraCandidataContato.updateMany).not.toHaveBeenCalled();
  });
  it("motivo ausente: recusa antes de abrir transação", async () => {
    const r = await decidirGrupoJoao({ ...dados, motivoDescarte: null });
    expect(r.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
  it("justificativaDescarte nunca fica vazia", () => {
    expect(justificativaDescarte("Argamassa", "Ana", new Date("2026-10-26T12:00:00Z"), "").length).toBeGreaterThanOrEqual(10);
  });
});
