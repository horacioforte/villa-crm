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
  it("impede vínculo duplicado", () => {
    expect(planejarVinculo({ ...base, candidataJaVinculadaA: "e9" }).ok).toBe(false);
    expect(planejarVinculo({ ...base, empresaJaVinculadaACandidata: "outra" }).ok).toBe(false);
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
