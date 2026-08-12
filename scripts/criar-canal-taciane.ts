// ARQUIVO: scripts/criar-canal-taciane.ts
// Cria o canal WhatsApp da Taciane (Fase 2 — Central de Atendimento / Workspace
// Comercial), via Meta Cloud API. Taciane é humana — agenteIA fica sempre null, nunca
// mapeado a nenhum processador automático.
//
// Só grava NOMES de variáveis de ambiente (accessTokenEnvVar, verifyTokenEnvVar,
// appSecretEnvVar) — nunca o valor de nenhum segredo. TACIANE_META_ACCESS_TOKEN e
// TACIANE_META_VERIFY_TOKEN precisam estar na allowlist de
// lib/whatsapp/env-allowlist.ts (já estão) antes de qualquer código resolver esses
// nomes para um valor real. META_APP_SECRET já estava permitido (compartilhado com
// Maria/João — mesmo aplicativo Meta).
//
// phoneNumberId e displayPhoneNumber vêm da checagem visual feita no Meta for
// Developers (não são segredo — são identificadores do número, por isso vão direto no
// banco, sem indireção por env var). displayPhoneNumber é gravado EXATAMENTE como
// confirmado pela Meta ("+55 81 7401-8568"), sem normalização nem inclusão manual do
// dígito 9.
//
// O canal fica ativo:true, mas permanece inerte até WHATSAPP_TACIANE_CONVERSAS_V2 ser
// ligada em app/api/webhook/whatsapp/taciane/route.ts — nenhum código lê esse canal
// fora desse caminho, e mesmo esse caminho não persiste nada com a flag desligada.
//
// Modo padrão: DRY RUN (só relatório, nenhuma escrita). Passe --apply para gravar de fato.
//
// Uso:
//   npx tsx scripts/criar-canal-taciane.ts            (dry run)
//   npx tsx scripts/criar-canal-taciane.ts --apply     (grava)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const APLICAR = process.argv.includes("--apply");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const INSTANCE_NAME = "taciane-villa";
const PHONE_NUMBER_ID = "1238399969356190";
const DISPLAY_PHONE_NUMBER = "+55 81 7401-8568";
const USUARIO_ID_TACIANE = "cmpv7osai000004k1i3almvf9";

async function main() {
  const relatorio: Record<string, unknown> = { modo: APLICAR ? "APLICAR" : "DRY_RUN" };

  await prisma.$transaction(async (tx) => {
    // ── Passo 1: confirmar o usuário Taciane existente (nunca inventar um id) ──
    const usuarioTaciane = await tx.usuario.findUnique({
      where: { id: USUARIO_ID_TACIANE },
      select: { id: true, nome: true, email: true, papel: true, ativo: true },
    });

    relatorio.usuarioTacianeEncontrado = usuarioTaciane;

    if (!usuarioTaciane) {
      relatorio.erro = `Usuário ${USUARIO_ID_TACIANE} não encontrado — canal NÃO será criado (nenhum responsavelPadraoId é inventado).`;
      return;
    }

    if (usuarioTaciane.nome !== "Taciane") {
      relatorio.aviso = `Nome atual do usuário é "${usuarioTaciane.nome}", não "Taciane" — rode scripts/corrigir-usuario-taciane.ts --apply antes (ou junto) deste script.`;
    }

    // ── Passo 2: canal da Taciane (idempotente por instanceName e por phoneNumberId) ──
    const canalPorPhoneNumberId = await tx.canalWhatsapp.findUnique({ where: { phoneNumberId: PHONE_NUMBER_ID } });
    if (canalPorPhoneNumberId && canalPorPhoneNumberId.instanceName !== INSTANCE_NAME) {
      relatorio.erro = `phoneNumberId ${PHONE_NUMBER_ID} já está em uso pelo canal "${canalPorPhoneNumberId.instanceName}" — abortado por segurança, nenhuma alteração feita.`;
      return;
    }

    let canal = await tx.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });

    if (!canal) {
      relatorio.canalACriar = true;
      if (APLICAR) {
        canal = await tx.canalWhatsapp.create({
          data: {
            nome: "Taciane",
            tipo: "META_CLOUD_API",
            instanceName: INSTANCE_NAME,
            phoneNumberId: PHONE_NUMBER_ID,
            displayPhoneNumber: DISPLAY_PHONE_NUMBER,
            accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN",
            verifyTokenEnvVar: "TACIANE_META_VERIFY_TOKEN",
            appSecretEnvVar: "META_APP_SECRET",
            agenteIA: null,
            responsavelPadraoId: usuarioTaciane.id,
            ativo: true,
          },
        });
      }
    } else {
      relatorio.canalACriar = false;
      relatorio.canalExistente = canal;

      // Detecta divergência sem nunca sobrescrever sozinho — só relata.
      const divergencias: string[] = [];
      if (canal.tipo !== "META_CLOUD_API") divergencias.push(`tipo atual=${canal.tipo}, esperado=META_CLOUD_API`);
      if (canal.phoneNumberId !== PHONE_NUMBER_ID) divergencias.push(`phoneNumberId atual=${canal.phoneNumberId}, esperado=${PHONE_NUMBER_ID}`);
      if (canal.displayPhoneNumber !== DISPLAY_PHONE_NUMBER) divergencias.push(`displayPhoneNumber atual=${canal.displayPhoneNumber}, esperado=${DISPLAY_PHONE_NUMBER}`);
      if (canal.agenteIA !== null) divergencias.push(`agenteIA atual=${canal.agenteIA}, esperado=null`);
      if (canal.responsavelPadraoId !== usuarioTaciane.id) {
        divergencias.push(`responsavelPadraoId atual=${canal.responsavelPadraoId}, esperado=${usuarioTaciane.id}`);
      }
      if (canal.accessTokenEnvVar !== "TACIANE_META_ACCESS_TOKEN") {
        divergencias.push(`accessTokenEnvVar atual=${canal.accessTokenEnvVar}, esperado=TACIANE_META_ACCESS_TOKEN`);
      }
      if (canal.verifyTokenEnvVar !== "TACIANE_META_VERIFY_TOKEN") {
        divergencias.push(`verifyTokenEnvVar atual=${canal.verifyTokenEnvVar}, esperado=TACIANE_META_VERIFY_TOKEN`);
      }
      if (canal.appSecretEnvVar !== "META_APP_SECRET") {
        divergencias.push(`appSecretEnvVar atual=${canal.appSecretEnvVar}, esperado=META_APP_SECRET`);
      }
      relatorio.divergenciasComCanalExistente = divergencias;
    }

    relatorio.canalFinal = canal;
  });

  console.log(JSON.stringify(relatorio, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nenhuma escrita foi feita. Rode com --apply para gravar.");
  }
}

main().finally(() => prisma.$disconnect());
