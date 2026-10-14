import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de app/api/conversas/[id]/status/route.test.ts: $transaction é "interativa"
// (recebe uma função), então o mock chama o callback de verdade com um `tx` também mockado.
const { prismaMock, tx } = vi.hoisted(() => {
  const tx = {
    joaoEnriquecimentoGrupo: { update: vi.fn() },
    concreteiraCandidataContato: { updateMany: vi.fn() },
    concreteiraCandidata: { findMany: vi.fn() },
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

const { decidirGrupoJoao, validarDecisaoJoao, PUBLICOS_JOAO } = await import("./fila-comercial");

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
