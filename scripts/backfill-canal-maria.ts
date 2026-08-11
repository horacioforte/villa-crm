// ARQUIVO: scripts/backfill-canal-maria.ts
// Cria o canal WhatsApp da Maria (Fase 2 — Central de Atendimento / Workspace Comercial).
//
// Só grava NOMES de variáveis de ambiente (accessTokenEnvVar, verifyTokenEnvVar,
// appSecretEnvVar) — nunca o valor de nenhum segredo. appSecretEnvVar aponta para
// META_APP_SECRET (global, não MARIA_META_APP_SECRET): auditoria de leitura via
// Graph API (/debug_token) já confirmou que Maria e João estão sob o MESMO
// aplicativo Meta (app_id 937150279352653) — ver lib/whatsapp/env-allowlist.ts.
//
// O canal fica ativo:true, mas permanece inerte até a feature flag
// WHATSAPP_MARIA_CONVERSAS_V2 ser ligada em app/api/webhook/whatsapp/maria/route.ts —
// nenhum código lê agenteIA:"maria" fora desse caminho.
//
// ── Vinculação seletiva de Conversa pré-existente (instanceName=maria-villa) ──────
// Só vincula (canalWhatsappId = canal.id) conversas com evidência real de operação:
//   telefone preenchido (não-nulo e não-vazio) OU >=1 Mensagem OU vínculo com
//   Pessoa/Empresa/Oportunidade.
// Conversas sem nenhuma dessas evidências são classificadas como RESÍDUO e apenas
// reportadas — nunca vinculadas, nunca alteradas, nunca deletadas por este script.
// Casos que não se encaixam limpo em nenhuma das duas categorias (ex.: telefone é
// string vazia/só espaço, não NULL) são classificados como AMBÍGUOS e também apenas
// reportados — decisão fica para revisão humana, nunca automática.
//
// Modo padrão: DRY RUN (só relatório, nenhuma escrita). Passe --apply para gravar de fato.
//
// Uso:
//   npx tsx scripts/backfill-canal-maria.ts            (dry run)
//   npx tsx scripts/backfill-canal-maria.ts --apply     (grava)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const APLICAR = process.argv.includes("--apply");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const INSTANCE_NAME = "maria-villa";

type ConversaCandidata = {
  id: string;
  telefone: string | null;
  nomeContato: string | null;
  pessoaId: string | null;
  empresaId: string | null;
  oportunidadeId: string | null;
  canalWhatsappId: string | null;
  _count: { mensagens: number };
};

function classificar(c: ConversaCandidata): "REAL" | "RESIDUO" | "AMBIGUO" {
  const temMensagem = c._count.mensagens > 0;
  const temVinculoCrm = Boolean(c.pessoaId || c.empresaId || c.oportunidadeId);
  const telefonePreenchido = typeof c.telefone === "string" && c.telefone.trim().length > 0;

  if (telefonePreenchido || temMensagem || temVinculoCrm) return "REAL";

  // telefone não-nulo mas vazio/só espaço: evidência inconclusiva, não é "sem telefone"
  // nem "telefone preenchido" — não decide sozinho, reporta para revisão humana.
  if (c.telefone !== null) return "AMBIGUO";

  return "RESIDUO";
}

async function main() {
  const relatorio: Record<string, unknown> = { modo: APLICAR ? "APLICAR" : "DRY_RUN" };

  await prisma.$transaction(async (tx) => {
    // ── Passo 1: canal da Maria (upsert idempotente por instanceName) ────────
    let canal = await tx.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });

    if (!canal) {
      relatorio.canalACriar = true;
      if (APLICAR) {
        canal = await tx.canalWhatsapp.create({
          data: {
            nome: "Maria — Meta Cloud API",
            tipo: "META_CLOUD_API",
            instanceName: INSTANCE_NAME,
            phoneNumberId: process.env.MARIA_META_PHONE_NUMBER_ID ?? null,
            accessTokenEnvVar: "MARIA_META_ACCESS_TOKEN",
            verifyTokenEnvVar: "MARIA_META_VERIFY_TOKEN",
            appSecretEnvVar: "META_APP_SECRET",
            agenteIA: "maria",
            ativo: true,
          },
        });
      }
    } else {
      relatorio.canalACriar = false;
      relatorio.canalExistenteId = canal.id;
    }

    // ── Passo 2: classificar conversas maria-villa sem canal vinculado ────────
    const semCanal = await tx.conversa.findMany({
      where: { instanceName: INSTANCE_NAME, canalWhatsappId: null },
      select: {
        id: true,
        telefone: true,
        nomeContato: true,
        pessoaId: true,
        empresaId: true,
        oportunidadeId: true,
        canalWhatsappId: true,
        _count: { select: { mensagens: true } },
      },
    });

    const reais: ConversaCandidata[] = [];
    const residuo: ConversaCandidata[] = [];
    const ambiguos: ConversaCandidata[] = [];

    for (const c of semCanal) {
      const categoria = classificar(c);
      if (categoria === "REAL") reais.push(c);
      else if (categoria === "AMBIGUO") ambiguos.push(c);
      else residuo.push(c);
    }

    relatorio.conversasReaisAVincular = reais.length;
    relatorio.conversasResiduoIgnoradas = residuo.map((c) => ({ id: c.id, mensagens: c._count.mensagens }));
    relatorio.conversasAmbiguas = ambiguos.map((c) => ({
      id: c.id,
      telefone: c.telefone,
      motivo: "telefone não-nulo mas vazio/em branco — revisão humana necessária",
    }));

    const reaisIds = reais.map((c) => c.id);

    if (APLICAR && canal && reaisIds.length) {
      await tx.conversa.updateMany({
        where: { id: { in: reaisIds } },
        data: { canalWhatsappId: canal.id },
      });
    }

    // ── Passo 3: mensagens das conversas vinculadas (agora ou antes) ─────────
    // Escopo nunca inclui resíduo/ambíguo — essas conversas não têm mensagem hoje
    // (é parte da própria definição de RESIDUO/AMBIGUO acima), mas o filtro por
    // conversaId abaixo garante isso de qualquer forma, não por coincidência.
    const jaVinculadasAntes = await tx.conversa.findMany({
      where: { instanceName: INSTANCE_NAME, canalWhatsappId: { not: null } },
      select: { id: true },
    });
    const conversaIdsElegiveis = [...reaisIds, ...jaVinculadasAntes.map((c) => c.id)];

    const mensagensParaVincular = conversaIdsElegiveis.length
      ? await tx.mensagem.count({
          where: { conversaId: { in: conversaIdsElegiveis }, canalWhatsappId: null },
        })
      : 0;
    relatorio.mensagensParaVincular = mensagensParaVincular;

    if (APLICAR && canal && conversaIdsElegiveis.length) {
      await tx.mensagem.updateMany({
        where: { conversaId: { in: conversaIdsElegiveis }, canalWhatsappId: null },
        data: { canalWhatsappId: canal.id },
      });
    }
  });

  console.log(JSON.stringify(relatorio, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nenhuma escrita foi feita. Rode com --apply para gravar.");
  }
}

main().finally(() => prisma.$disconnect());
