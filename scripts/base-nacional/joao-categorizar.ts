// ARQUIVO: scripts/base-nacional/joao-categorizar.ts
// REGRA: nunca remover. Apenas acrescentar.
// Fila comercial do João (13/10/2026): calcula indicadores e a categoria A/B/C de cada grupo, por código,
// usando só dados já gravados (sem IA, sem busca nova, sem LinkedIn). Não mexe em decisões humanas já tomadas.
// Inválidos (situacao INVALIDO ou inativos) não contam, mas continuam no histórico.
// Uso: npx tsx scripts/base-nacional/joao-categorizar.ts [--simular]

import { Client } from "pg";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { categorizar, type Indicadores } from "../../lib/base-nacional/joao/categorizar";
import { validarEmail } from "../../lib/base-nacional/joao/validar";

const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";

async function main() {
  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) throw new Error(`BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado.`);
  const simular = process.argv.includes("--simular");
  const db = new Client({ connectionString: amb.url });
  await db.connect();
  try {
    const grupos = (await db.query(`SELECT chave, "candidataIds" ids FROM "JoaoEnriquecimentoGrupo" WHERE publico IN ('PILOTO_20','LOTE_206') ORDER BY ordem`)).rows as Array<{ chave: string; ids: string[] }>;
    const todos = grupos.flatMap(g => g.ids);
    const cands = new Map((await db.query(`SELECT id, coalesce(porte,'00') porte, coalesce("capitalSocial",0)::float capital FROM "ConcreteiraCandidata" WHERE id = ANY($1)`, [todos])).rows.map(r => [r.id, r]));
    const unis = (await db.query(`SELECT "candidataId" id, uf FROM "ConcreteiraCandidataUnidade" WHERE ativa AND "candidataId" = ANY($1)`, [todos])).rows;
    const pess = (await db.query(`SELECT "candidataId" id, fonte::text fonte, papeis::text[] papeis FROM "ConcreteiraCandidataPessoa" WHERE ativo AND situacao <> 'INVALIDO' AND "candidataId" = ANY($1)`, [todos])).rows;
    const cont = (await db.query(`SELECT "candidataId" id, tipo::text tipo, fonte::text fonte, confianca::text confianca, "valorNormalizado" v FROM "ConcreteiraCandidataContato" WHERE ativo AND situacao <> 'INVALIDO' AND "candidataId" = ANY($1)`, [todos])).rows;
    const por = <T extends { id: string }>(l: T[]) => { const m = new Map<string, T[]>(); for (const x of l) { if (!m.has(x.id)) m.set(x.id, []); m.get(x.id)!.push(x); } return m; };
    const U = por(unis), P = por(pess), K = por(cont);
    const cont3 = { A: 0, B: 0, C: 0 } as Record<string, number>;
    const extra = { comWhatsapp: 0, comEmailCorporativo: 0, soTelefone: 0, semContato: 0 };
    for (const g of grupos) {
      const us = g.ids.flatMap(id => U.get(id) ?? []), ps = g.ids.flatMap(id => P.get(id) ?? []), ks = g.ids.flatMap(id => K.get(id) ?? []);
      const ind: Indicadores = {
        empresas: g.ids.length,
        unidadesAtivas: us.length,
        ufs: [...new Set(us.map(u => u.uf).filter(Boolean))].sort(),
        portes: [...new Set(g.ids.map(id => cands.get(id)?.porte ?? "00"))].sort(),
        capitalSocial: g.ids.reduce((s, id) => s + (cands.get(id)?.capital ?? 0), 0),
        decisoresSocietarios: ps.filter(p => p.fonte === "RECEITA_FEDERAL" && (p.papeis ?? []).some((x: string) => x === "PROPRIETARIO_SOCIO" || x === "ADMINISTRADOR")).length,
        outrosDecisores: ps.filter(p => p.fonte !== "RECEITA_FEDERAL").length,
        whatsapp: ks.filter(k => k.tipo === "WHATSAPP").length,
        emailCorporativo: ks.filter(k => k.tipo === "EMAIL" && k.confianca !== "BAIXA" && validarEmail(k.v).corporativo).length,
        emailOutros: ks.filter(k => k.tipo === "EMAIL" && !(k.confianca !== "BAIXA" && validarEmail(k.v).corporativo)).length,
        telefoneSite: ks.filter(k => k.tipo === "TELEFONE" && k.fonte !== "RECEITA_FEDERAL").length,
        telefoneReceita: ks.filter(k => k.tipo === "TELEFONE" && k.fonte === "RECEITA_FEDERAL").length,
      };
      const { categoria, motivo } = categorizar(ind);
      cont3[categoria]++;
      if (ind.whatsapp) extra.comWhatsapp++;
      if (ind.emailCorporativo) extra.comEmailCorporativo++;
      if (!ind.whatsapp && !ind.emailCorporativo && ind.telefoneSite + ind.telefoneReceita) extra.soTelefone++;
      if (!ind.whatsapp && !ind.emailCorporativo && !(ind.telefoneSite + ind.telefoneReceita)) extra.semContato++;
      if (!simular) await db.query(`UPDATE "JoaoEnriquecimentoGrupo" SET "categoriaComercial" = $2::"CategoriaComercialJoao", "categoriaMotivo" = $3, indicadores = $4::jsonb, "categorizadoEm" = now(), "updatedAt" = now() WHERE chave = $1`,
        [g.chave, categoria, motivo, JSON.stringify(ind)]);
    }
    console.log(`[joao-categorias] ${simular ? "SIMULADO" : "GRAVADO"} ${JSON.stringify({ grupos: grupos.length, ...cont3, ...extra })}`);
  } finally { await db.end(); }
}
main().catch(e => { console.error("[joao-categorias] ERRO", e instanceof Error ? e.message : e); process.exit(1); });
