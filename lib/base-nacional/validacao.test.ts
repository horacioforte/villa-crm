import { describe, expect, it } from "vitest";
import { planejarAlteracao, planejarEvidencia, planejarVinculo, podeValidar, TABELAS_PERMITIDAS, type Resultado } from "./validacao";

const ADMIN = { id: "u1", papel: "ADMIN" };
const atual = { status: "PENDENTE" as const, confianca: null, tipoAtividade: null };
const T0 = new Date("2026-10-02T12:00:00Z");
const ok = (r: Resultado) => { if (!r.ok) throw new Error(r.erros.join("; ")); return r.operacoes; };
const TABELAS_PROIBIDAS = ["Empresa", "Pessoa", "DossieComercial", "DossieCarteira", "Oportunidade", "Tarefa", "DecisorDossie", "Prospect"];

describe("autorização", () => {
  it("ADMIN, GERENTE e COMERCIAL validam; OPERACIONAL e anônimo não", () => {
    expect(podeValidar("ADMIN")).toBe(true);
    expect(podeValidar("GERENTE")).toBe(true);
    expect(podeValidar("COMERCIAL")).toBe(true);
    expect(podeValidar("OPERACIONAL")).toBe(false);
    expect(podeValidar(null)).toBe(false);
    const r = planejarAlteracao({ candidataId: "c", atual, pedido: { status: "EM_VERIFICACAO", justificativa: "texto suficiente" }, usuario: { id: "x", papel: "OPERACIONAL" } });
    expect(r.ok).toBe(false);
    expect(planejarAlteracao({ candidataId: "c", atual, pedido: { status: "EM_VERIFICACAO", justificativa: "texto suficiente" }, usuario: null }).ok).toBe(false);
  });
});

describe("regras de validação", () => {
  it("justificativa é obrigatória em qualquer alteração", () => {
    const r = planejarAlteracao({ candidataId: "c", atual, pedido: { status: "EM_VERIFICACAO", justificativa: "curta" }, usuario: ADMIN });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join()).toMatch(/justificativa/i);
  });

  it("sem mudança real é recusado", () => {
    expect(planejarAlteracao({ candidataId: "c", atual, pedido: { status: "PENDENTE", justificativa: "nada mudou aqui" }, usuario: ADMIN }).ok).toBe(false);
  });

  it("Confirmada grava validadoPor, validadoEm e justificativa, e exige confiança", () => {
    expect(planejarAlteracao({ candidataId: "c", atual, pedido: { status: "CONFIRMADA", justificativa: "três fontes independentes" }, usuario: ADMIN }).ok).toBe(false);
    const ops = ok(planejarAlteracao({ candidataId: "c", atual, pedido: { status: "CONFIRMADA", confianca: "ALTA", justificativa: "três fontes independentes" }, usuario: ADMIN, agora: T0 }));
    const upd = ops.find(o => o.tabela === "ConcreteiraCandidata")!;
    expect(upd.dados).toMatchObject({ statusValidacao: "CONFIRMADA", validadoPorId: "u1", validadoEm: T0, justificativa: "três fontes independentes", primeiraVerificacaoEm: T0 });
  });

  it("Não é concreteira e descartadas exigem justificativa", () => {
    for (const status of ["NAO_E_CONCRETEIRA", "INATIVA", "NAO_LOCALIZADA"] as const) {
      expect(planejarAlteracao({ candidataId: "c", atual, pedido: { status, justificativa: "" }, usuario: ADMIN }).ok).toBe(false);
      expect(planejarAlteracao({ candidataId: "c", atual, pedido: { status, justificativa: "fonte comprova o motivo" }, usuario: ADMIN }).ok).toBe(true);
    }
  });

  it("toda alteração gera histórico com usuário, data, antes/depois, justificativa e origem", () => {
    const ops = ok(planejarAlteracao({
      candidataId: "c", atual, usuario: ADMIN, agora: T0,
      pedido: { status: "PROVAVEL", confianca: "MEDIA", tipoAtividade: "CONCRETO_USINADO", justificativa: "site confirma usinagem",
        unidade: { id: "u-1", tipoAtual: "DESCONHECIDA", tipoNovo: "CENTRAL_CONCRETO" } },
    }));
    const hist = ops.filter(o => o.tabela === "ConcreteiraValidacaoHistorico");
    expect(hist).toHaveLength(2);
    expect(hist[0].dados).toMatchObject({ statusAnterior: "PENDENTE", statusNovo: "PROVAVEL", confiancaAnterior: null, confiancaNova: "MEDIA", motivo: "site confirma usinagem", usuarioId: "u1", origem: "TELA_BASE_NACIONAL", createdAt: T0 });
    expect(hist[1].dados).toMatchObject({ tipoEvento: "TIPO_UNIDADE", valorAnterior: "DESCONHECIDA", valorNovo: "CENTRAL_CONCRETO" });
  });
});

describe("nenhuma ação toca o cadastro comercial", () => {
  it("todas as operações planejadas ficam nas tabelas novas permitidas", () => {
    const planos = [
      planejarAlteracao({ candidataId: "c", atual, pedido: { status: "CONFIRMADA", confianca: "ALTA", justificativa: "três fontes independentes" }, usuario: ADMIN }),
      planejarVinculo({ candidataId: "c", statusAtual: "CONFIRMADA", empresaId: "e1", candidataJaVinculadaA: null, empresaJaVinculadaACandidata: null, empresaExiste: true, confirmado: true, justificativa: "mesmo CNPJ da Receita", usuario: ADMIN }),
      planejarEvidencia({ candidataId: "c", statusAtual: "PENDENTE", pedido: { tipoFonte: "SITE_EMPRESA", titulo: "Site oficial", url: "https://exemplo.com.br" }, usuario: ADMIN }),
    ];
    for (const p of planos) {
      for (const op of ok(p)) {
        expect((TABELAS_PERMITIDAS as readonly string[]).includes(op.tabela)).toBe(true);
        expect(TABELAS_PROIBIDAS).not.toContain(op.tabela);
        expect(`${op.acao}:${op.tabela}`).not.toBe("create:ConcreteiraCandidata");
      }
      expect(ok(p).some(o => o.tabela === "ConcreteiraValidacaoHistorico")).toBe(true);
      for (const h of ok(p).filter(o => o.tabela === "ConcreteiraValidacaoHistorico")) {
        expect(h.dados.statusNovo).toBeTruthy(); // obrigatório no banco
        expect(h.dados.usuarioId).toBe("u1");
        expect(h.dados.origem).toBe("TELA_BASE_NACIONAL");
      }
    }
  });
});

describe("vínculo manual com Empresa existente", () => {
  const base = { candidataId: "c", statusAtual: "CONFIRMADA" as const, empresaId: "e1", candidataJaVinculadaA: null, empresaJaVinculadaACandidata: null, empresaExiste: true, confirmado: true, justificativa: "mesmo CNPJ da Receita", usuario: ADMIN };
  it("exige confirmação, Empresa existente e justificativa", () => {
    expect(planejarVinculo({ ...base, confirmado: false }).ok).toBe(false);
    expect(planejarVinculo({ ...base, empresaExiste: false }).ok).toBe(false);
    expect(planejarVinculo({ ...base, justificativa: "" }).ok).toBe(false);
  });
  it("impede vincular de novo uma candidata já vinculada", () => {
    expect(planejarVinculo({ ...base, candidataJaVinculadaA: "e9" }).ok).toBe(false);
  });
  it("decisão 1 (05/10/2026): a mesma Empresa pode ter várias candidatas", () => {
    expect(planejarVinculo({ ...base, empresaJaVinculadaACandidata: "outra" }).ok).toBe(true);
  });
  it("não altera a Empresa: só a candidata e o histórico", () => {
    const ops = ok(planejarVinculo(base));
    expect(ops.map(o => o.tabela)).toEqual(["ConcreteiraCandidata", "ConcreteiraValidacaoHistorico"]);
  });
});

describe("evidência manual", () => {
  it("valida URL, data e conteúdo mínimo", () => {
    expect(planejarEvidencia({ candidataId: "c", statusAtual: "PENDENTE", pedido: { tipoFonte: "SITE_EMPRESA", titulo: "Site", url: "javascript:alert(1)" }, usuario: ADMIN }).ok).toBe(false);
    expect(planejarEvidencia({ candidataId: "c", statusAtual: "PENDENTE", pedido: { tipoFonte: "XYZ", titulo: "Site", trecho: "abc" }, usuario: ADMIN }).ok).toBe(false);
    expect(planejarEvidencia({ candidataId: "c", statusAtual: "PENDENTE", pedido: { tipoFonte: "NOTICIA", titulo: "Matéria", trecho: "x", dataEvidencia: new Date(Date.now() + 86400000) }, usuario: ADMIN }).ok).toBe(false);
    expect(planejarEvidencia({ candidataId: "c", statusAtual: "PENDENTE", pedido: { tipoFonte: "NOTICIA", titulo: "Matéria" }, usuario: ADMIN }).ok).toBe(false);
    const ops = ok(planejarEvidencia({ candidataId: "c", statusAtual: "PENDENTE", pedido: { tipoFonte: "NOTICIA", titulo: "Matéria", trecho: "inaugura central", observacao: "obs" }, usuario: ADMIN }));
    expect(ops[0].dados).toMatchObject({ registradoPorId: "u1", observacao: "obs" });
  });
});

// ═══ v4 (05/10/2026) ═══════════════════════════════════════════════════════
import {
  planejarContato, planejarDesvinculo, planejarInativacaoContato, planejarInativacaoPessoa, planejarPessoa, planejarPotencial,
  planejarQualificacao, planejarSituacaoContato,
} from "./validacao";

const BASEV4 = { candidataId: "c", statusAtual: "CONFIRMADA" as const, usuario: ADMIN, agora: T0 };
const historicoDe = (r: Resultado) => ok(r).filter(o => o.tabela === "ConcreteiraValidacaoHistorico").map(o => o.dados);
const textoHistorico = (r: Resultado) => JSON.stringify(historicoDe(r));

describe("v4: contatos", () => {
  const novo = (pedido: Parameters<typeof planejarContato>[0]["pedido"], extra: Partial<Parameters<typeof planejarContato>[0]> = {}) =>
    planejarContato({ ...BASEV4, novoId: "ct-1", unidadesDaCandidata: ["u1"], chavesAtivas: [], pedido, ...extra });

  it("grava telefone completo no contato e MASCARADO no histórico", () => {
    const r = novo({ tipo: "TELEFONE", valor: "(81) 3333-4444" });
    const ct = ok(r).find(o => o.tabela === "ConcreteiraCandidataContato")!.dados;
    expect(ct).toMatchObject({ valor: "(81) 3333-4444", valorNormalizado: "8133334444", registradoPorId: "u1", situacao: "NAO_VERIFICADO" });
    expect(textoHistorico(r)).not.toContain("3333-4444");
    expect(textoHistorico(r)).not.toContain("8133334444");
    expect(textoHistorico(r)).toContain("4444");
  });
  it("e-mail completo nunca vai para o histórico", () => {
    const r = novo({ tipo: "EMAIL", valor: "Comercial@Empresa.com.br" });
    expect(textoHistorico(r)).not.toContain("comercial@empresa.com.br");
    expect(textoHistorico(r)).toContain("co***@empresa.com.br");
  });
  it("valida formato, unidade da candidata e duplicidade de contato ativo", () => {
    expect(novo({ tipo: "TELEFONE", valor: "123" }).ok).toBe(false);
    expect(novo({ tipo: "EMAIL", valor: "sem-arroba" }).ok).toBe(false);
    expect(novo({ tipo: "TELEFONE", valor: "(81) 3333-4444", unidadeId: "outra" }).ok).toBe(false);
    expect(novo({ tipo: "TELEFONE", valor: "+55 81 3333-4444" }, { chavesAtivas: ["TELEFONE:8133334444"] }).ok).toBe(false);
  });
  it("verificado grava data e responsável", () => {
    const ct = ok(novo({ tipo: "SITE", valor: "www.exemplo.com.br", situacao: "VERIFICADO" }))[0].dados;
    expect(ct).toMatchObject({ verificadoEm: T0, verificadoPorId: "u1" });
  });
  it("inativação exige motivo e registra data e responsável; nunca apaga", () => {
    const contato = { id: "ct-1", tipo: "WHATSAPP" as const, valor: "(81) 99999-1234", ativo: true };
    expect(planejarInativacaoContato({ ...BASEV4, contato, motivo: "curto" }).ok).toBe(false);
    const r = planejarInativacaoContato({ ...BASEV4, contato, motivo: "número desativado pelo cliente" });
    const upd = ok(r)[0];
    expect(upd).toMatchObject({ acao: "update", dados: { ativo: false, inativadoEm: T0, inativadoPorId: "u1", motivoInativacao: "número desativado pelo cliente" } });
    expect(textoHistorico(r)).not.toContain("99999-1234");
    expect(planejarInativacaoContato({ ...BASEV4, contato: { ...contato, ativo: false }, motivo: "número desativado pelo cliente" }).ok).toBe(false);
  });
  it("mudança de situação não grava o número completo no histórico", () => {
    const r = planejarSituacaoContato({ ...BASEV4, contato: { id: "ct", tipo: "TELEFONE", valor: "(81) 3333-4444", situacao: "NAO_VERIFICADO", ativo: true }, situacao: "INVALIDO" });
    expect(textoHistorico(r)).not.toContain("3333-4444");
  });
});

describe("v4: pessoas", () => {
  const pedido = { nome: "Fulano de Tal", papeis: ["COMPRADOR", "RESPONSAVEL_FROTA"] as Array<"COMPRADOR" | "RESPONSAVEL_FROTA">, whatsapp: "(81) 98888-7777", email: "fulano@empresa.com.br" };
  const novo = (extra: Partial<Parameters<typeof planejarPessoa>[0]> = {}) =>
    planejarPessoa({ ...BASEV4, novoId: "ps-1", pedido, emailsAtivos: [], whatsappsAtivos: [], ...extra });
  it("aceita vários papéis e mascara contatos no histórico", () => {
    const r = novo();
    expect(ok(r)[0].dados).toMatchObject({ papeis: ["COMPRADOR", "RESPONSAVEL_FROTA"], whatsappNormalizado: "81988887777", emailNormalizado: "fulano@empresa.com.br" });
    expect(textoHistorico(r)).not.toContain("98888-7777");
    expect(textoHistorico(r)).not.toContain("fulano@empresa.com.br");
  });
  it("exige nome e ao menos um papel; impede e-mail/WhatsApp ativos repetidos", () => {
    expect(planejarPessoa({ ...BASEV4, novoId: "x", pedido: { ...pedido, nome: "A" }, emailsAtivos: [], whatsappsAtivos: [] }).ok).toBe(false);
    expect(planejarPessoa({ ...BASEV4, novoId: "x", pedido: { ...pedido, papeis: [] }, emailsAtivos: [], whatsappsAtivos: [] }).ok).toBe(false);
    expect(novo({ emailsAtivos: ["fulano@empresa.com.br"] }).ok).toBe(false);
    expect(novo({ whatsappsAtivos: ["81988887777"] }).ok).toBe(false);
  });
  it("inativação exige motivo e grava data e responsável", () => {
    expect(planejarInativacaoPessoa({ ...BASEV4, pessoa: { id: "p", nome: "X", ativo: true }, motivo: "" }).ok).toBe(false);
    expect(ok(planejarInativacaoPessoa({ ...BASEV4, pessoa: { id: "p", nome: "X", ativo: true }, motivo: "saiu da empresa em 2026" }))[0].dados)
      .toMatchObject({ ativo: false, inativadoEm: T0, inativadoPorId: "u1" });
  });
});

describe("v4: potencial por equipamento", () => {
  const args = { ...BASEV4, novoId: "pt-1", existente: null, unidadesDaCandidata: ["u1"], evidenciasDaCandidata: ["ev1"] };
  it("geral ou por unidade; unidade e evidência precisam ser da candidata", () => {
    expect(ok(planejarPotencial({ ...args, pedido: { equipamento: "BOMBA_LANCA", potencialVenda: "ALTO", interesseLocacao: "BAIXO", quantidadeEstimada: 3 } }))[0])
      .toMatchObject({ acao: "create", dados: { unidadeId: null, equipamento: "BOMBA_LANCA", potencialVenda: "ALTO" } });
    expect(ok(planejarPotencial({ ...args, pedido: { equipamento: "BOMBA_LANCA", unidadeId: "u1", potencialVenda: "ALTO", interesseLocacao: "BAIXO" } }))[0].dados).toMatchObject({ unidadeId: "u1" });
    expect(planejarPotencial({ ...args, pedido: { equipamento: "BOMBA_LANCA", unidadeId: "u9", potencialVenda: "ALTO", interesseLocacao: "BAIXO" } }).ok).toBe(false);
    expect(planejarPotencial({ ...args, pedido: { equipamento: "BOMBA_LANCA", evidenciaId: "ev9", potencialVenda: "ALTO", interesseLocacao: "BAIXO" } }).ok).toBe(false);
  });
  it("reavaliação atualiza o registro existente e guarda antes/depois", () => {
    const r = planejarPotencial({ ...args, existente: { id: "pt-0", potencialVenda: "BAIXO", interesseLocacao: "BAIXO", quantidadeEstimada: null },
      pedido: { equipamento: "CAMINHAO_BETONEIRA", potencialVenda: "ALTO", interesseLocacao: "BAIXO" } });
    expect(ok(r)[0]).toMatchObject({ acao: "update", id: "pt-0" });
    expect(historicoDe(r)[0]).toMatchObject({ valorAnterior: "Venda: Baixo · Locação: Baixo", valorNovo: "Venda: Alto · Locação: Baixo" });
  });
  it("\"Outro\" exige descrição; quantidade inteira e não negativa; sem campos de preço", () => {
    expect(planejarPotencial({ ...args, pedido: { equipamento: "OUTRO", potencialVenda: "ALTO", interesseLocacao: "BAIXO" } }).ok).toBe(false);
    expect(planejarPotencial({ ...args, pedido: { equipamento: "TELEBELT", potencialVenda: "ALTO", interesseLocacao: "BAIXO", quantidadeEstimada: -1 } }).ok).toBe(false);
    const dados = ok(planejarPotencial({ ...args, pedido: { equipamento: "TELEBELT", potencialVenda: "ALTO", interesseLocacao: "BAIXO" } }))[0].dados;
    expect(Object.keys(dados).some(k => /preco|valor/i.test(k))).toBe(false);
  });
});

describe("v4: qualificação e desvínculo", () => {
  it("qualificação exige justificativa e registra responsável", () => {
    const atual = { prioridade: null, observacao: null };
    expect(planejarQualificacao({ ...BASEV4, atual, pedido: { prioridade: "ALTA", observacao: null, justificativa: "" } }).ok).toBe(false);
    const r = planejarQualificacao({ ...BASEV4, atual, pedido: { prioridade: "ALTA", observacao: "frota antiga", justificativa: "visita comercial em out/2026" } });
    expect(ok(r)[0].dados).toMatchObject({ prioridadeComercial: "ALTA", qualificadoPorId: "u1", qualificadoEm: T0 });
    expect(historicoDe(r)).toHaveLength(2);
  });
  it("desvínculo só altera a candidata e exige justificativa", () => {
    expect(planejarDesvinculo({ ...BASEV4, empresaAtualId: "e1", justificativa: "" }).ok).toBe(false);
    expect(planejarDesvinculo({ ...BASEV4, empresaAtualId: null, justificativa: "vínculo errado por homônimo" }).ok).toBe(false);
    expect(ok(planejarDesvinculo({ ...BASEV4, empresaAtualId: "e1", justificativa: "vínculo errado por homônimo" })).map(o => o.tabela))
      .toEqual(["ConcreteiraCandidata", "ConcreteiraValidacaoHistorico"]);
  });
  it("OPERACIONAL não grava nenhuma ação da v4", () => {
    const op = { id: "x", papel: "OPERACIONAL" };
    expect(planejarQualificacao({ ...BASEV4, usuario: op, atual: { prioridade: null, observacao: null }, pedido: { prioridade: "ALTA", observacao: null, justificativa: "texto suficiente" } }).ok).toBe(false);
    expect(planejarContato({ ...BASEV4, usuario: op, novoId: "x", unidadesDaCandidata: [], chavesAtivas: [], pedido: { tipo: "SITE", valor: "a.com.br" } }).ok).toBe(false);
  });
});
