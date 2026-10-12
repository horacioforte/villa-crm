// ARQUIVO: scripts/base-nacional/robo-correcao-v51.ts
// REGRA: nunca remover. Apenas acrescentar.
// Correção v5.1 (09/10/2026): o robô v5 marcou como PROVÁVEL empresas cujo site só citava termos genéricos
// ("concreto estrutural" de construtora). Esta correção desfaz SOMENTE o que o próprio robô gravou:
// volta a situação anterior registrada no histórico, quando nenhuma pessoa alterou a empresa depois.
// Mantém as evidências (são verdadeiras: o site cita o termo) e registra tudo no histórico. Só branch autorizado.
// Uso: npx tsx scripts/base-nacional/robo-correcao-v51.ts [--commit]

import { Client } from "pg";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { TERMOS_CONCRETO_FORTES } from "../../lib/base-nacional/robo/site";

const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";

async function main() {
  const commit = process.argv.includes("--commit");
  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) throw new Error(`BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado.`);
  const c = new Client({ connectionString: amb.url });
  await c.connect();
  try {
    await c.query("BEGIN");
    const alvos = (await c.query(`
      SELECT h."candidataId" id, h."statusAnterior", h."confiancaAnterior", h."tipoAnterior", ca."razaoSocial", t.classificacao, t."roboResumo"
      FROM "ConcreteiraValidacaoHistorico" h
      JOIN "ConcreteiraCandidata" ca ON ca.id = h."candidataId"
      JOIN "ConcreteiraTriagem" t ON t."candidataId" = h."candidataId"
      WHERE h.origem = 'ROBO_GRATUITO' AND h."tipoEvento" = 'VALIDACAO' AND h."statusNovo" = 'PROVAVEL'
        AND ca."statusValidacao" = 'PROVAVEL' AND t."situacaoFila" = 'AGUARDANDO'
        AND NOT EXISTS (SELECT 1 FROM "ConcreteiraValidacaoHistorico" h2 WHERE h2."candidataId" = h."candidataId"
                        AND h2."createdAt" > h."createdAt" AND h2.origem <> 'ROBO_GRATUITO')`)).rows;
    let corrigidas = 0;
    for (const a of alvos) {
      const paginas: string[] = a.roboResumo?.paginas ?? [];
      const termos = (await c.query(`SELECT unnest("termosConcreto") t FROM "ConcreteiraRoboCache" WHERE url = ANY($1)`, [paginas])).rows.map(r => r.t as string);
      if (termos.some(t => TERMOS_CONCRETO_FORTES.has(t))) continue; // evidência forte: mantém
      const dispensada = !["FORTE_INDICIO_CONCRETEIRA", "POSSIVEL_CONCRETEIRA", "INCONCLUSIVA"].includes(a.classificacao);
      const motivo = `Correção do robô v5.1: o site só cita termos genéricos (${[...new Set(termos)].join(", ")}), comuns em construtoras. A marcação automática de PROVÁVEL foi desfeita; evidência mantida como indício fraco.`;
      await c.query(`UPDATE "ConcreteiraCandidata" SET "statusValidacao" = $2::"StatusValidacaoConcreteira", confianca = $3::"ConfiancaInformacao", "tipoAtividade" = $4::"TipoAtividadeConcreteira", justificativa = $5, "updatedAt" = now() WHERE id = $1`,
        [a.id, a.statusAnterior, a.confiancaAnterior, a.tipoAnterior, motivo]);
      await c.query(`UPDATE "ConcreteiraTriagem" SET "sugestaoRobo" = 'INDICIO_FRACO_PELO_SITE', "situacaoFila" = $2::"SituacaoFilaVerificacao", "motivoFila" = $3, "potencialCompra" = $4::"NivelPotencial", "emRevisaoPorId" = NULL, "emRevisaoDesde" = NULL, "updatedAt" = now() WHERE "candidataId" = $1`,
        [a.id, dispensada ? "DISPENSADA_TRIAGEM" : "AGUARDANDO", `Triagem: ${a.classificacao}; site só com termo genérico de concreto (indício fraco).`, dispensada ? "BAIXO" : "DESCONHECIDO"]);
      await c.query(`UPDATE "ConcreteiraEvidencia" SET confianca = 'BAIXA', titulo = replace(titulo, 'Site próprio cita concreto', 'Site próprio — termo genérico de concreto (indício fraco)') WHERE "candidataId" = $1 AND agente = 'robo-gratuito' AND titulo LIKE 'Site próprio cita concreto%'`, [a.id]);
      await c.query(`INSERT INTO "ConcreteiraValidacaoHistorico"(id, "candidataId", "tipoEvento", origem, agente, "statusAnterior", "statusNovo", "confiancaAnterior", "confiancaNova", "tipoAnterior", "tipoNovo", motivo, "createdAt")
        VALUES (gen_random_uuid()::text, $1, 'VALIDACAO', 'ROBO_GRATUITO', 'robo-gratuito', 'PROVAVEL', $2::"StatusValidacaoConcreteira", 'MEDIA', $3::"ConfiancaInformacao", 'CONCRETO_USINADO', $4::"TipoAtividadeConcreteira", $5, now())`,
        [a.id, a.statusAnterior, a.confiancaAnterior, a.tipoAnterior, motivo]);
      corrigidas++;
      console.log(`[correcao] ${a.razaoSocial}: PROVAVEL → ${a.statusAnterior} (${dispensada ? "dispensada pela triagem" : "fila"})`);
    }
    await c.query(commit ? "COMMIT" : "ROLLBACK");
    console.log(`[correcao] ${commit ? "GRAVADO" : "simulado e desfeito"}: ${corrigidas} de ${alvos.length} candidatas marcadas pelo robô`);
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { await c.end(); }
}
main().catch(e => { console.error("[correcao] ERRO", e instanceof Error ? e.message : e); process.exit(1); });
