// ARQUIVO: scripts/teste-integracao-webhook-joao.ts
// Teste de integração LOCAL do fluxo V2 do webhook do João — roda o código real
// (não mockado) contra um banco Postgres descartável (irmão da produção, apagado ao
// final), com payloads assinados de verdade. Cobre os 8 cenários pedidos para a
// homologação controlada.
//
// Diferença em relação à suíte Vitest (lib/whatsapp/joao-webhook-v2.test.ts): aqui
// nada é mockado exceto a chamada de saída para graph.facebook.com (para não enviar
// WhatsApp de verdade) — Prisma, banco, allowlist, verificação de assinatura e a
// chamada real à Anthropic (mesma IA de produção) rodam de ponta a ponta.
//
// Uso: npx tsx scripts/teste-integracao-webhook-joao.ts

import "./env";
import { createHmac } from "node:crypto";
import pg from "pg";

const APP_SECRET_LOCAL_TESTE = "app-secret-local-de-teste-nao-e-o-real";
const DISPOSABLE_DB_NAME = "villa_teste_integracao_webhook_joao";

type Resultado = { cenario: string; ok: boolean; detalhe?: string };
const resultados: Resultado[] = [];

function registrar(cenario: string, ok: boolean, detalhe?: string) {
  resultados.push({ cenario, ok, detalhe });
  console.log(`${ok ? "OK " : "FALHOU "} — ${cenario}${detalhe ? " — " + detalhe : ""}`);
}

async function main() {
  const baseUrl = new URL(process.env.DATABASE_URL as string);

  // ── 1. Cria banco descartável e aplica as 25 migrations reais ──────────────
  const admin = new pg.Client({ connectionString: baseUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${DISPOSABLE_DB_NAME}"`).catch(() => {});
  await admin.query(`CREATE DATABASE "${DISPOSABLE_DB_NAME}"`);
  await admin.end();

  const dbUrl = new URL(baseUrl.toString());
  dbUrl.pathname = `/${DISPOSABLE_DB_NAME}`;

  // process.env.DATABASE_URL precisa apontar para o banco descartável ANTES de
  // qualquer import de lib/prisma.ts (que lê a env var na hora do módulo carregar) —
  // por isso os imports do código sob teste são dinâmicos, depois desta linha.
  process.env.DATABASE_URL = dbUrl.toString();
  process.env.META_JOAO_APP_SECRET = APP_SECRET_LOCAL_TESTE; // só neste processo — nunca o valor real

  const { execSync } = await import("node:child_process");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env } });

  // ── 2. Imports dinâmicos do código real, já apontando para o banco descartável ──
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../app/generated/prisma/client");
  const adapter = new PrismaPg({ connectionString: dbUrl.toString() });
  const prisma = new PrismaClient({ adapter });

  const { processarWebhookJoaoV2 } = await import("../lib/whatsapp/joao-webhook-v2");

  // ── 3. Seed do canal joao-villa ─────────────────────────────────────────────
  const PHONE_NUMBER_ID = "1168722372992684_TESTE";
  await prisma.canalWhatsapp.create({
    data: {
      nome: "João — Meta Cloud API (teste local)",
      tipo: "META_CLOUD_API",
      instanceName: "joao-villa",
      phoneNumberId: PHONE_NUMBER_ID,
      accessTokenEnvVar: "META_JOAO_ACCESS_TOKEN",
      appSecretEnvVar: "META_JOAO_APP_SECRET",
      agenteIA: "joao",
      ativo: true,
    },
  });
  process.env.META_JOAO_ACCESS_TOKEN = "access-token-local-de-teste-nao-e-o-real";

  // ── 4. Fake fetch: intercepta só graph.facebook.com; deixa o resto (Anthropic) passar de verdade ──
  const fetchOriginal = globalThis.fetch;
  let comportamentoMeta: "sucesso" | "falha" = "sucesso";

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.includes("graph.facebook.com")) {
      if (comportamentoMeta === "sucesso") {
        return new Response(JSON.stringify({ messages: [{ id: `wamid.SIMULADO.${Date.now()}` }] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ error: { code: 131_047, message: "Falha simulada da Meta API (janela de 24h expirada)." } }),
        { status: 400 },
      );
    }
    return fetchOriginal(input, init);
  }) as typeof fetch;

  function assinar(rawBody: string) {
    return `sha256=${createHmac("sha256", APP_SECRET_LOCAL_TESTE).update(rawBody, "utf8").digest("hex")}`;
  }

  function montarPayload(opts: { messageId: string; telefone: string; texto: string; phoneNumberId?: string }) {
    return {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-teste",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "5581999999999", phone_number_id: opts.phoneNumberId ?? PHONE_NUMBER_ID },
                contacts: [{ profile: { name: "Cliente Teste Integração" }, wa_id: opts.telefone }],
                messages: [
                  { from: opts.telefone, id: opts.messageId, timestamp: "1234567890", type: "text", text: { body: opts.texto } },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  function criarRequest(body: unknown, { assinaturaValida = true, semAssinatura = false } = {}) {
    const rawBody = JSON.stringify(body);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!semAssinatura) {
      headers["x-hub-signature-256"] = assinaturaValida
        ? assinar(rawBody)
        : `sha256=${"0".repeat(64)}`; // assinatura sintaticamente válida, mas errada
    }
    return new Request("http://localhost/api/webhook/whatsapp/joao", { method: "POST", headers, body: rawBody });
  }

  // ── Cenário 1: assinatura válida + mensagem nova ────────────────────────────
  {
    const msgId = "wamid.CENARIO1";
    const telefone = "5581900000001";
    const res = await processarWebhookJoaoV2(criarRequest(montarPayload({ messageId: msgId, telefone, texto: "Olá, tudo bem?" })));
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar(
      "1. assinatura válida + mensagem nova",
      res.status === 200 && mensagem?.autor === "CLIENTE" && mensagem?.status === "RECEBIDA" && mensagem?.receivedAt !== null,
      `status HTTP=${res.status}, autor=${mensagem?.autor}, status msg=${mensagem?.status}`,
    );
  }

  // ── Cenário 2: assinatura inválida ──────────────────────────────────────────
  {
    const msgId = "wamid.CENARIO2";
    const telefone = "5581900000002";
    const res = await processarWebhookJoaoV2(
      criarRequest(montarPayload({ messageId: msgId, telefone, texto: "Teste assinatura inválida" }), { assinaturaValida: false }),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("2. assinatura inválida — rejeitada, nada processado", res.status === 401 && !mensagem, `status HTTP=${res.status}`);
  }

  // ── Cenário 3: phone_number_id correto (já coberto no 1, reforça isoladamente) ──
  {
    const msgId = "wamid.CENARIO3";
    const telefone = "5581900000003";
    await processarWebhookJoaoV2(criarRequest(montarPayload({ messageId: msgId, telefone, texto: "Confirma número certo" })));
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("3. phone_number_id correto — processado", !!mensagem);
  }

  // ── Cenário 4: phone_number_id divergente ───────────────────────────────────
  {
    const msgId = "wamid.CENARIO4";
    const telefone = "5581900000004";
    const res = await processarWebhookJoaoV2(
      criarRequest(montarPayload({ messageId: msgId, telefone, texto: "Número errado", phoneNumberId: "NUMERO_DE_OUTRO_CANAL" })),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("4. phone_number_id divergente — evento ignorado", res.status === 200 && !mensagem);
  }

  // ── Cenário 5: mensagem nova (variação de conteúdo, reforça cenário 1) ──────
  {
    const msgId = "wamid.CENARIO5";
    const telefone = "5581900000005";
    await processarWebhookJoaoV2(criarRequest(montarPayload({ messageId: msgId, telefone, texto: "Quero saber sobre bomba de concreto" })));
    const total = await prisma.mensagem.count({ where: { externalMessageId: msgId } });
    registrar("5. mensagem nova — grava exatamente 1 linha", total === 1, `total=${total}`);
  }

  // ── Cenário 6: reenvio do mesmo evento (idempotência) ───────────────────────
  {
    const msgId = "wamid.CENARIO6";
    const telefone = "5581900000006";
    const payload = montarPayload({ messageId: msgId, telefone, texto: "Mensagem que será reenviada" });
    await processarWebhookJoaoV2(criarRequest(payload));
    await processarWebhookJoaoV2(criarRequest(payload)); // mesmo evento, de novo
    const total = await prisma.mensagem.count({ where: { externalMessageId: msgId } });
    registrar("6. reenvio do mesmo evento — não duplica", total === 1, `total=${total}`);
  }

  // ── Cenário 7: resposta da Meta simulada com sucesso ────────────────────────
  {
    comportamentoMeta = "sucesso";
    const msgId = "wamid.CENARIO7";
    const telefone = "5581900000007";
    await processarWebhookJoaoV2(criarRequest(montarPayload({ messageId: msgId, telefone, texto: "Preciso de orçamento urgente" })));
    const respostaEnviada = await prisma.mensagem.findFirst({
      where: { direcao: "SAIDA", autor: "IA", conversa: { telefone } },
      orderBy: { createdAt: "desc" },
    });
    const entrada7 = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar(
      "7. resposta da Meta simulada (sucesso) — Mensagem ENVIADA com externalMessageId",
      respostaEnviada?.status === "ENVIADA" && !!respostaEnviada?.externalMessageId,
      `status=${respostaEnviada?.status}, externalMessageId=${respostaEnviada?.externalMessageId ?? "null"}`,
    );
    registrar(
      "7b. mensagem de entrada correspondente termina com processamentoStatus=PROCESSADA",
      entrada7?.processamentoStatus === "PROCESSADA" && !!entrada7?.processadaEm && entrada7?.processamentoTentativas === 1,
      `processamentoStatus=${entrada7?.processamentoStatus}, tentativas=${entrada7?.processamentoTentativas}`,
    );
  }

  // ── Cenário 8: falha da Meta simulada ───────────────────────────────────────
  {
    comportamentoMeta = "falha";
    const msgId = "wamid.CENARIO8";
    const telefone = "5581900000008";
    await processarWebhookJoaoV2(criarRequest(montarPayload({ messageId: msgId, telefone, texto: "Outra mensagem qualquer" })));
    const respostaComErro = await prisma.mensagem.findFirst({
      where: { direcao: "SAIDA", autor: "IA", conversa: { telefone } },
      orderBy: { createdAt: "desc" },
    });
    const entrada8 = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar(
      "8. falha da Meta simulada — Mensagem ERRO com errorCode/errorMessage sanitizada",
      respostaComErro?.status === "ERRO" && !!respostaComErro?.errorCode && !!respostaComErro?.errorMessage,
      `status=${respostaComErro?.status}, errorCode=${respostaComErro?.errorCode ?? "null"}`,
    );
    registrar(
      "8b. mensagem de entrada correspondente termina com processamentoStatus=ERRO_PROCESSAMENTO (identificável e reprocessável)",
      entrada8?.processamentoStatus === "ERRO_PROCESSAMENTO" &&
        entrada8?.processamentoErroCodigo === "131047" &&
        !!entrada8?.processamentoErro &&
        entrada8?.processamentoTentativas === 1,
      `processamentoStatus=${entrada8?.processamentoStatus}, erroCodigo=${entrada8?.processamentoErroCodigo}, tentativas=${entrada8?.processamentoTentativas}`,
    );
    comportamentoMeta = "sucesso";
  }

  // ── Cenário 9: aquisição atômica — duas execuções concorrentes na MESMA mensagem ──
  {
    const msgId = "wamid.CENARIO9";
    const telefone = "5581900000009";
    const payload = montarPayload({ messageId: msgId, telefone, texto: "Mensagem para testar corrida na aquisição" });

    // Duas chamadas verdadeiramente em paralelo (mesmo evento, ainda não existe no banco
    // até a primeira inserir) — simula duas invocações concorrentes do webhook.
    await Promise.all([processarWebhookJoaoV2(criarRequest(payload)), processarWebhookJoaoV2(criarRequest(payload))]);

    const entrada9 = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    const totalRespostas9 = await prisma.mensagem.count({ where: { direcao: "SAIDA", autor: "IA", conversa: { telefone } } });
    registrar(
      "9. duas execuções concorrentes — só uma processa (1 tentativa, 1 resposta enviada, PROCESSADA)",
      entrada9?.processamentoTentativas === 1 && entrada9?.processamentoStatus === "PROCESSADA" && totalRespostas9 === 1,
      `tentativas=${entrada9?.processamentoTentativas}, status=${entrada9?.processamentoStatus}, respostasEnviadas=${totalRespostas9}`,
    );
  }

  globalThis.fetch = fetchOriginal;
  await prisma.$disconnect();

  // ── Limpeza do banco descartável ─────────────────────────────────────────
  const admin2 = new pg.Client({ connectionString: baseUrl.toString() });
  await admin2.connect();
  await admin2.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${DISPOSABLE_DB_NAME}' AND pid <> pg_backend_pid()
  `);
  await new Promise((r) => setTimeout(r, 500));
  await admin2.query(`DROP DATABASE "${DISPOSABLE_DB_NAME}"`);
  await admin2.end();

  console.log("\n─────────────────────────────────────────");
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`${resultados.length - falhas.length}/${resultados.length} cenários OK.`);
  if (falhas.length) {
    console.log("Cenários com falha:", falhas.map((f) => f.cenario).join(", "));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Erro fatal no teste de integração:", err);
  process.exitCode = 1;
});
