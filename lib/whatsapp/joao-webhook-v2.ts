// ARQUIVO: lib/whatsapp/joao-webhook-v2.ts
// Fase 2 — adaptador legado do fluxo V2 do webhook do João.
//
// Só é executado quando WHATSAPP_JOAO_V2=true (ver app/api/webhook/whatsapp/joao/route.ts).
// O fluxo V1 (legado) continua existindo e funcionando sem nenhuma alteração.
//
// Etapa 4 (roteador unificado) — ACRESCENTADO: o núcleo do processamento (idempotência,
// conversa, IA, envio, estado de processamento) foi extraído para
// lib/whatsapp/agentes/joao.ts, que também é usado por lib/whatsapp/meta-router-v2.ts.
// Este arquivo agora é só o adaptador HTTP: resolve o canal por instanceName (forma
// legada, específica desta rota), valida assinatura com o App Secret DO CANAL
// (canal.appSecretEnvVar — diferente do roteador unificado, que usa um App Secret
// global; ver lib/whatsapp/meta-router-v2.ts para a justificativa), parseia o payload,
// e delega cada "value" para processarValorMetaJoao. Nenhum comportamento observável
// mudou em relação à versão anterior deste arquivo.
//
// Processamento é síncrono (aguardado) antes de responder ao webhook: não há fila
// persistente nem worker em background configurado neste projeto ainda. Uma Promise
// "solta" (disparada sem await, respondendo 200 antes dela terminar) não é confiável em
// ambiente serverless — a própria função pode ser congelada/encerrada assim que a
// resposta é enviada, interrompendo o processamento no meio. Por isso, exatamente como
// o fluxo V1 já faz (e como foi corrigido no commit 33635c5 deste projeto, que existia
// por ter descoberto esse mesmo problema na prática), o V2 aguarda todo o processamento
// terminar antes de responder. maxDuration=90s (já configurado na rota) é o limite
// disponível.
//
// Risco residual do processamento síncrono (interrupção no meio) — fechado pelo estado
// persistente Mensagem.processamentoStatus (ver lib/whatsapp/processamento-mensagem.ts):
// se o processo morrer entre a aquisição (PROCESSANDO) e a conclusão, a mensagem fica
// visivelmente presa, identificável e reprocessável.

import { prisma } from "@/lib/prisma";
import { CanalWhatsappTipo } from "@/app/generated/prisma/client";
import { resolveWhatsappEnvVar } from "./env-allowlist";
import { verificarAssinaturaMeta } from "./verify-signature";
import { processarValorMetaJoao, type MetaWebhookPayload } from "./agentes/joao";

const INSTANCE_NAME = "joao-villa";

// ─── Handler principal (adaptador legado) ─────────────────────────────────────

export async function processarWebhookJoaoV2(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const canal = await prisma.canalWhatsapp.findUnique({ where: { instanceName: INSTANCE_NAME } });

  if (!canal || !canal.ativo || canal.tipo !== CanalWhatsappTipo.META_CLOUD_API) {
    console.error("[joao/webhook v2] Canal joao-villa não encontrado, inativo, ou não é META_CLOUD_API.");
    // Não é um problema do lado da Meta — não faz sentido pedir reentrega.
    return Response.json({ ok: true });
  }

  if (!canal.appSecretEnvVar) {
    console.error("[joao/webhook v2] Canal sem appSecretEnvVar configurado — assinatura não pode ser validada.");
    return Response.json({ ok: false, message: "Canal sem App Secret configurado." }, { status: 500 });
  }

  let appSecret: string;
  try {
    appSecret = await resolveWhatsappEnvVar(canal.appSecretEnvVar, "app_secret", { canalId: canal.id });
  } catch (err) {
    console.error("[joao/webhook v2] Falha ao resolver App Secret do canal:", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, message: "Falha ao resolver credencial do canal." }, { status: 500 });
  }

  const assinaturaValida = verificarAssinaturaMeta({
    rawBody,
    signatureHeader: request.headers.get("x-hub-signature-256"),
    appSecret,
  });

  if (!assinaturaValida) {
    console.warn("[joao/webhook v2] Assinatura X-Hub-Signature-256 inválida — requisição rejeitada.");
    return Response.json({ ok: false, message: "Assinatura inválida." }, { status: 401 });
  }

  let body: MetaWebhookPayload;
  try {
    body = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return Response.json({ ok: true });
  }

  await prisma.canalWhatsapp
    .update({ where: { id: canal.id }, data: { ultimoWebhookEm: new Date() } })
    .catch((err) => console.error("[joao/webhook v2] Falha ao atualizar ultimoWebhookEm:", err));

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;

      if (value.metadata?.phone_number_id !== canal.phoneNumberId) {
        console.warn("[joao/webhook v2] phone_number_id do evento não corresponde ao canal — evento ignorado.", {
          esperado: canal.phoneNumberId,
          recebido: value.metadata?.phone_number_id,
        });
        continue;
      }

      await processarValorMetaJoao({ canal, value });
    }
  }

  return Response.json({ ok: true });
}
