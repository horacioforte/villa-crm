// ARQUIVO: lib/whatsapp/meta-router-v2.ts
// Fase 2 (Etapa 4) — roteador unificado de webhooks Meta Cloud API.
//
// Só é executado quando WHATSAPP_META_ROUTER_V2=true (ver
// app/api/webhook/whatsapp/meta/route.ts). O roteador V1 (que compara o
// phone_number_id contra variáveis de ambiente específicas por agente) continua
// existindo e funcionando sem nenhuma alteração — este módulo é aditivo, não
// substitui nada. Este arquivo, propositalmente, nunca cita o nome dessas variáveis
// específicas por agente — é uma garantia arquitetural verificada por teste
// (meta-router-v2.test.ts) de que o roteamento aqui não depende delas.
//
// Diferença central em relação a todo o resto do código de webhook existente: NENHUMA
// decisão de roteamento é tomada por comparação de env var. O canal é sempre
// identificado por CanalWhatsapp.phoneNumberId, lido do banco.
//
// ─── Ordem segura de validação (por que esta ordem, não outra) ────────────────
//
//   rawBody
//   → resolver App Secret GLOBAL (não depende do payload nem de qual canal é)
//   → validar assinatura X-Hub-Signature-256
//   → só então fazer JSON.parse do payload
//   → só então extrair phone_number_id e identificar CanalWhatsapp
//   → validar canal ativo e tipo META_CLOUD_API
//   → mapear agenteIA → processador
//
// Se a ordem fosse "identificar canal primeiro, validar depois", estaríamos usando
// dado não confiável (o payload) para decidir QUAL segredo usar antes de saber se o
// payload é legítimo — e ainda assim precisaríamos de um segredo para validar, então
// a única ordem que faz sentido é validar com um segredo que não depende do payload.
//
// ─── App Secret: global por aplicativo, não por canal ─────────────────────────
//
// Auditoria de leitura confirmou (Graph API, /debug_token) que os dois números hoje
// configurados (Maria e o rotulado "João") pertencem ao MESMO aplicativo Meta
// (app_id 937150279352653). A assinatura X-Hub-Signature-256 é calculada pela Meta
// usando o App Secret do APLICATIVO dono da assinatura de webhook — não existe "App
// Secret por número". Por isso o roteador valida com um App Secret GLOBAL
// (META_APP_SECRET), resolvido uma única vez, ANTES de saber qual canal/agente está
// envolvido — nunca via CanalWhatsapp.appSecretEnvVar (esse campo continua existindo
// e em uso só pelo adaptador legado do João, lib/whatsapp/joao-webhook-v2.ts).
//
// O mecanismo abaixo já é escrito para múltiplos aplicativos Meta (tenta cada nome de
// env var da lista em ordem, usa o primeiro que validar) — hoje a lista tem 1 item
// porque só há 1 aplicativo em uso; se um dia um agente novo viver sob um App Meta
// diferente, basta acrescentar o nome aqui, sem reescrever a lógica de validação.
//
// ─── Sem fallback entre agentes ────────────────────────────────────────────────
//
// agenteIA não mapeado (ex.: "maria", ainda não migrada) → evento é ignorado com log
// sanitizado. Nunca cai para Maria, Evolution ou Chatwoot — silêncio auditável, não
// tentativa de processar pelo caminho errado.

import { prisma } from "@/lib/prisma";
import { CanalWhatsappTipo, type CanalWhatsapp } from "@/app/generated/prisma/client";
import { resolveWhatsappEnvVar } from "./env-allowlist";
import { verificarAssinaturaMeta } from "./verify-signature";
import { processarValorMetaJoao, type MetaValue, type MetaWebhookPayload } from "./agentes/joao";

// Candidatos de App Secret global, em ordem de tentativa. Hoje só 1 aplicativo Meta
// está em uso — a lista já é extensível para múltiplos aplicativos sem mudar a lógica.
const APP_SECRET_ENV_VARS_GLOBAIS = ["META_APP_SECRET"];

type ProcessadorAgente = (ctx: { canal: CanalWhatsapp; value: MetaValue }) => Promise<void>;

// Mapeamento inicial permitido — só "joao" tem processador implementado até agora.
const RESOLVER_PROCESSADOR: Record<string, ProcessadorAgente> = {
  joao: processarValorMetaJoao,
};

// ─── Assinatura (App Secret global, antes de qualquer parse do payload) ───────

async function validarAssinaturaContraAppsConhecidos(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  for (const envVarName of APP_SECRET_ENV_VARS_GLOBAIS) {
    let secret: string;
    try {
      secret = await resolveWhatsappEnvVar(envVarName, "app_secret");
    } catch (err) {
      console.error(
        `[meta-router v2] App Secret global "${envVarName}" não configurado ou não permitido:`,
        err instanceof Error ? err.message : err,
      );
      continue; // tenta o próximo candidato, se houver
    }

    if (verificarAssinaturaMeta({ rawBody, signatureHeader, appSecret: secret })) {
      return true;
    }
  }
  return false;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function processarRoteadorMetaV2(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const assinaturaValida = await validarAssinaturaContraAppsConhecidos(
    rawBody,
    request.headers.get("x-hub-signature-256"),
  );

  if (!assinaturaValida) {
    console.warn("[meta-router v2] Assinatura X-Hub-Signature-256 inválida — requisição rejeitada.");
    return Response.json({ ok: false, message: "Assinatura inválida." }, { status: 401 });
  }

  let body: MetaWebhookPayload;
  try {
    body = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    console.warn("[meta-router v2] Payload inválido — JSON.parse falhou.");
    return Response.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return Response.json({ ok: true });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      await processarValor(change.value);
    }
  }

  return Response.json({ ok: true });
}

async function processarValor(value: MetaValue) {
  const phoneNumberId = value?.metadata?.phone_number_id;

  if (!phoneNumberId) {
    console.warn("[meta-router v2] Evento sem phone_number_id — ignorado.");
    return;
  }

  const canal = await prisma.canalWhatsapp.findUnique({ where: { phoneNumberId } });

  if (!canal) {
    console.warn("[meta-router v2] Canal não encontrado para o phone_number_id recebido.", { phoneNumberId });
    return;
  }

  if (!canal.ativo) {
    console.warn("[meta-router v2] Canal inativo — evento ignorado.", { canalId: canal.id, phoneNumberId });
    return;
  }

  if (canal.tipo !== CanalWhatsappTipo.META_CLOUD_API) {
    console.warn("[meta-router v2] Canal não é META_CLOUD_API — evento ignorado.", {
      canalId: canal.id,
      tipo: canal.tipo,
    });
    return;
  }

  await prisma.canalWhatsapp
    .update({ where: { id: canal.id }, data: { ultimoWebhookEm: new Date() } })
    .catch((err) => console.error("[meta-router v2] Falha ao atualizar ultimoWebhookEm:", err));

  const processador = RESOLVER_PROCESSADOR[canal.agenteIA ?? ""];

  if (!processador) {
    // Agente ainda não migrado para o roteador unificado (ex.: "maria") — nunca cai
    // para outro processador/provedor. Log sanitizado (sem token/segredo), auditável.
    console.warn("[meta-router v2] agenteIA não suportado pelo roteador unificado ainda — evento ignorado.", {
      canalId: canal.id,
      agenteIA: canal.agenteIA,
    });
    return;
  }

  await processador({ canal, value }).catch((err) => {
    console.error("[meta-router v2] Falha ao processar evento:", err instanceof Error ? err.message : err);
  });
}
