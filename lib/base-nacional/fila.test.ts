// ARQUIVO: lib/base-nacional/fila.test.ts
// REGRA: nunca remover. Apenas acrescentar.
import { describe, expect, it } from "vitest";
import { linksDeBusca, planejarDecisao, podeRevisar, type PedidoDecisao } from "./fila";

const agora = new Date("2026-10-08T15:00:00-03:00");
const base = (pedido: Partial<PedidoDecisao>, extra: Partial<Parameters<typeof planejarDecisao>[0]> = {}) => planejarDecisao({
  candidataId: "rfb-cand-1", usuario: { id: "u1", papel: "COMERCIAL" }, agora,
  reserva: { emRevisaoPorId: "u1", emRevisaoDesde: agora }, situacaoFila: "AGUARDANDO",
  atual: { status: "PENDENTE", confianca: null, tipoAtividade: null, primeiraVerificacaoEm: null, prioridade: null, observacaoComercial: null },
  equipamentosExistentes: [], unidades: ["un1"], evidencias: [], novosIds: { potencial: eq => `pt-${eq}` },
  pedido: { decisao: "CONFIRMADA", confianca: "ALTA", justificativa: "Site oficial mostra usina e frota.", url: "https://x.com.br", potencialCompra: "ALTO", ...pedido },
  ...extra,
});

describe("decisão da fila", () => {
  it("confirmada exige confiança, justificativa e link", () => {
    const r = base({ confianca: null, url: null, justificativa: "curta" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.join(" ")).toMatch(/confiança.*|link/i);
  });
  it("confirmada completa grava situação, evidência, fila concluída e histórico", () => {
    const r = base({ equipamentos: ["CAMINHAO_BETONEIRA", "BOMBA_LANCA"], prioridade: "ALTA", observacaoComercial: "Frota própria." });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tabelas = r.operacoes.map(o => o.tabela);
    expect(tabelas).toContain("ConcreteiraCandidata");
    expect(tabelas).toContain("ConcreteiraEvidencia");
    expect(tabelas.filter(t => t === "ConcreteiraPotencialEquipamento")).toHaveLength(2);
    const fila = r.operacoes.find(o => o.tabela === "ConcreteiraTriagem");
    expect(fila?.acao === "update" && fila.dados).toMatchObject({ situacaoFila: "CONCLUIDA", concluidaPorId: "u1", potencialCompra: "ALTO" });
    const cand = r.operacoes.find(o => o.tabela === "ConcreteiraCandidata");
    expect(cand?.acao === "update" && cand.dados).toMatchObject({ statusValidacao: "CONFIRMADA", validadoPorId: "u1" });
  });
  it("'não é concreteira' exige link (ausência de resultado não é prova)", () => {
    expect(base({ decisao: "NAO_E_CONCRETEIRA", url: null }).ok).toBe(false);
  });
  it("'sem evidência' só exige justificativa e vira NAO_LOCALIZADA", () => {
    const r = base({ decisao: "SEM_EVIDENCIA", confianca: null, url: null, justificativa: "Procurei no Google, Maps e Instagram.", potencialCompra: "DESCONHECIDO" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.operacoes.find(o => o.tabela === "ConcreteiraCandidata")?.dados).toMatchObject({ statusValidacao: "NAO_LOCALIZADA" });
  });
  it("bloqueia quando outra pessoa reservou", () => {
    const r = base({}, { reserva: { emRevisaoPorId: "u2", emRevisaoDesde: agora } });
    expect(r.ok).toBe(false);
  });
  it("reserva vencida pode ser assumida", () => {
    expect(podeRevisar({ emRevisaoPorId: "u2", emRevisaoDesde: new Date(agora.getTime() - 25 * 60_000) }, "u1", agora)).toBe(true);
  });
  it("confirmada só muda com nova evidência", () => {
    const r = base({ decisao: "EM_VERIFICACAO", confianca: null, url: null }, {
      atual: { status: "CONFIRMADA", confianca: "ALTA", tipoAtividade: "CONCRETO_USINADO", primeiraVerificacaoEm: agora, prioridade: null, observacaoComercial: null },
    });
    expect(r.ok).toBe(false);
  });
  it("perfil sem permissão não decide", () => {
    expect(base({}, { usuario: { id: "u9", papel: "FINANCEIRO" } }).ok).toBe(false);
  });
});

describe("buscas prontas", () => {
  it("monta Google, Maps, site, redes e CNPJ, sem dados pessoais", () => {
    const l = linksDeBusca({ razaoSocial: "CONCREUSI LTDA", nomeFantasia: "CONCREFORTE", cidade: "ITAMBE", uf: "PE", cnpj: "33088457000159", site: "concreusi.com.br" });
    expect(l.map(x => x.chave)).toEqual(["google", "maps", "site", "instagram", "facebook", "linkedin", "cnpj", "cnpj-google"]);
    expect(l.find(x => x.chave === "maps")!.url).toContain("google.com/maps/search");
    expect(l.find(x => x.chave === "site")!.url).toBe("https://concreusi.com.br");
  });
});
