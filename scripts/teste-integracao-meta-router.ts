// ARQUIVO: scripts/teste-integracao-meta-router.ts
// Teste de integração REAL do roteador unificado (/api/webhook/whatsapp/meta V2),
// rodando contra o banco de HOMOLOGAÇÃO (branch Neon já criado nesta etapa) — nunca
// contra produção, e sem criar/derrubar bancos descartáveis à parte (regra desta
// etapa: todo trabalho fica só em Preview/homologação).
//
// Cria canais de teste dedicados (não reaproveita o CanalWhatsapp real "joao-villa"
// já existente no branch), roda os cenários, e limpa só os dados que criou ao final.
//
// Uso: npx tsx scripts/teste-integracao-meta-router.ts

import fs from "node:fs";
import { createHmac } from "node:crypto";

const APP_SECRET_TESTE = "app-secret-global-de-teste-nao-e-o-real";
const PREFIXO_TESTE = `teste-router-${Date.now()}`;

type Resultado = { cenario: string; ok: boolean; detalhe?: string };
const resultados: Resultado[] = [];
function registrar(cenario: string, ok: boolean, detalhe?: string) {
  resultados.push({ cenario, ok, detalhe });
  console.log(`${ok ? "OK " : "FALHOU "} — ${cenario}${detalhe ? " — " + detalhe : ""}`);
}

async function main() {
  const homologUrl = fs
    .readFileSync(
      "/private/tmp/claude-501/-Users-horacioforte-Desktop-villa-crm/169d8214-dc24-4b09-b27f-b8462aa19b08/scratchpad/homolog/database_url.txt",
      "utf8",
    )
    .trim();

  process.env.DATABASE_URL = homologUrl;
  process.env.META_APP_SECRET = APP_SECRET_TESTE;

  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../app/generated/prisma/client");
  const adapter = new PrismaPg({ connectionString: homologUrl });
  const prisma = new PrismaClient({ adapter });

  const { processarRoteadorMetaV2 } = await import("../lib/whatsapp/meta-router-v2");

  // ── Seeds de teste (canais dedicados, nunca o "joao-villa" real) ────────────
  const canalJoaoTeste = await prisma.canalWhatsapp.create({
    data: {
      nome: "João — Meta Teste (integração router)",
      tipo: "META_CLOUD_API",
      instanceName: `${PREFIXO_TESTE}-joao`,
      phoneNumberId: `${PREFIXO_TESTE}-PHONE-JOAO`,
      agenteIA: "joao",
      ativo: true,
    },
  });

  const canalAgenteNaoImplementado = await prisma.canalWhatsapp.create({
    data: {
      nome: "Maria — Meta (ainda não migrada ao router)",
      tipo: "META_CLOUD_API",
      instanceName: `${PREFIXO_TESTE}-maria`,
      phoneNumberId: `${PREFIXO_TESTE}-PHONE-MARIA`,
      agenteIA: "maria",
      ativo: true,
    },
  });

  const canalInativo = await prisma.canalWhatsapp.create({
    data: {
      nome: "Canal de teste inativo",
      tipo: "META_CLOUD_API",
      instanceName: `${PREFIXO_TESTE}-inativo`,
      phoneNumberId: `${PREFIXO_TESTE}-PHONE-INATIVO`,
      agenteIA: "joao",
      ativo: false,
    },
  });

  const canalTipoDiferente = await prisma.canalWhatsapp.create({
    data: {
      nome: "Canal de teste tipo Evolution",
      tipo: "EVOLUTION",
      instanceName: `${PREFIXO_TESTE}-evolution`,
      phoneNumberId: `${PREFIXO_TESTE}-PHONE-EVOLUTION`,
      agenteIA: "joao",
      ativo: true,
    },
  });

  // Fake fetch: intercepta só graph.facebook.com (envio da resposta do João) e
  // api.anthropic.com continua real, exatamente como no teste do webhook do João.
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (url.includes("graph.facebook.com")) {
      return new Response(JSON.stringify({ messages: [{ id: `wamid.SIMULADO.${Date.now()}` }] }), { status: 200 });
    }
    return fetchOriginal(input, init);
  }) as typeof fetch;

  function assinar(rawBody: string, secret = APP_SECRET_TESTE) {
    return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
  }

  function montarPayload(opts: { phoneNumberId: string; messageId: string; telefone: string; texto?: string }) {
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
                metadata: { display_phone_number: "5581999999999", phone_number_id: opts.phoneNumberId },
                contacts: [{ profile: { name: "Cliente Teste Router" }, wa_id: opts.telefone }],
                messages: [
                  {
                    from: opts.telefone,
                    id: opts.messageId,
                    timestamp: "1234567890",
                    type: "text",
                    text: { body: opts.texto ?? "Olá, teste do roteador." },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
  }

  function criarRequest(body: unknown, { assinaturaValida = true } = {}) {
    const rawBody = JSON.stringify(body);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    headers["x-hub-signature-256"] = assinaturaValida ? assinar(rawBody) : `sha256=${"0".repeat(64)}`;
    return new Request("http://localhost/api/webhook/whatsapp/meta", { method: "POST", headers, body: rawBody });
  }

  // ── Cenário 1: roteamento correto pelo phone_number_id → agenteIA=joao ─────
  {
    const msgId = "wamid.ROUTER.1";
    const telefone = "5581900000101";
    const res = await processarRoteadorMetaV2(
      criarRequest(montarPayload({ phoneNumberId: canalJoaoTeste.phoneNumberId!, messageId: msgId, telefone })),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar(
      "1. roteamento correto por phone_number_id (agenteIA=joao)",
      res.status === 200 && mensagem?.canalWhatsappId === canalJoaoTeste.id && mensagem?.autor === "CLIENTE",
      `status=${res.status}, canalWhatsappId=${mensagem?.canalWhatsappId}`,
    );
  }

  // ── Cenário 2: assinatura inválida ──────────────────────────────────────────
  {
    const msgId = "wamid.ROUTER.2";
    const res = await processarRoteadorMetaV2(
      criarRequest(
        montarPayload({ phoneNumberId: canalJoaoTeste.phoneNumberId!, messageId: msgId, telefone: "5581900000102" }),
        { assinaturaValida: false },
      ),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("2. assinatura inválida — rejeitada, nada gravado", res.status === 401 && !mensagem);
  }

  // ── Cenário 3: canal inexistente (phone_number_id desconhecido) ────────────
  {
    const msgId = "wamid.ROUTER.3";
    const res = await processarRoteadorMetaV2(
      criarRequest(montarPayload({ phoneNumberId: "NUMERO_TOTALMENTE_DESCONHECIDO", messageId: msgId, telefone: "5581900000103" })),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("3. canal inexistente — ignorado com segurança", res.status === 200 && !mensagem);
  }

  // ── Cenário 4: canal inativo ─────────────────────────────────────────────────
  {
    const msgId = "wamid.ROUTER.4";
    const res = await processarRoteadorMetaV2(
      criarRequest(montarPayload({ phoneNumberId: canalInativo.phoneNumberId!, messageId: msgId, telefone: "5581900000104" })),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("4. canal inativo — ignorado com segurança", res.status === 200 && !mensagem);
  }

  // ── Cenário 5: canal de tipo diferente (EVOLUTION) ──────────────────────────
  {
    const msgId = "wamid.ROUTER.5";
    const res = await processarRoteadorMetaV2(
      criarRequest(montarPayload({ phoneNumberId: canalTipoDiferente.phoneNumberId!, messageId: msgId, telefone: "5581900000105" })),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("5. canal tipo EVOLUTION — ignorado por este roteador", res.status === 200 && !mensagem);
  }

  // ── Cenário 6: agenteIA não implementado (maria) — sem fallback ────────────
  {
    const msgId = "wamid.ROUTER.6";
    const res = await processarRoteadorMetaV2(
      criarRequest(montarPayload({ phoneNumberId: canalAgenteNaoImplementado.phoneNumberId!, messageId: msgId, telefone: "5581900000106" })),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId } });
    registrar("6. agenteIA=maria (não implementado) — ignorado, sem fallback", res.status === 200 && !mensagem);
  }

  // ── Cenário 7: mensagem duplicada (mesmo evento, dois envios sequenciais) ──
  {
    const msgId = "wamid.ROUTER.7";
    const telefone = "5581900000107";
    const payload = montarPayload({ phoneNumberId: canalJoaoTeste.phoneNumberId!, messageId: msgId, telefone });
    await processarRoteadorMetaV2(criarRequest(payload));
    await processarRoteadorMetaV2(criarRequest(payload));
    const total = await prisma.mensagem.count({ where: { externalMessageId: msgId } });
    registrar("7. mensagem duplicada — não duplica no banco", total === 1, `total=${total}`);
  }

  // ── Cenário 8: concorrência real (duas entregas em paralelo) ───────────────
  {
    const msgId = "wamid.ROUTER.8";
    const telefone = "5581900000108";
    const payload = montarPayload({ phoneNumberId: canalJoaoTeste.phoneNumberId!, messageId: msgId, telefone });
    await Promise.all([processarRoteadorMetaV2(criarRequest(payload)), processarRoteadorMetaV2(criarRequest(payload))]);
    const total = await prisma.mensagem.count({ where: { externalMessageId: msgId } });
    registrar("8. concorrência real (Promise.all) — só uma linha gravada", total === 1, `total=${total}`);
  }

  // ── Cenário 9: consistência canal/conversa/mensagem ─────────────────────────
  {
    const msgId = "wamid.ROUTER.9";
    const telefone = "5581900000109";
    await processarRoteadorMetaV2(
      criarRequest(montarPayload({ phoneNumberId: canalJoaoTeste.phoneNumberId!, messageId: msgId, telefone })),
    );
    const mensagem = await prisma.mensagem.findFirst({ where: { externalMessageId: msgId }, include: { conversa: true } });
    registrar(
      "9. consistência: Mensagem.canalWhatsappId === Conversa.canalWhatsappId",
      !!mensagem && mensagem.canalWhatsappId === mensagem.conversa.canalWhatsappId && mensagem.conversa.canalWhatsappId === canalJoaoTeste.id,
      `mensagem.canal=${mensagem?.canalWhatsappId}, conversa.canal=${mensagem?.conversa.canalWhatsappId}`,
    );
  }

  globalThis.fetch = fetchOriginal;

  // ── Limpeza: só os dados criados por este teste ─────────────────────────────
  const conversasTeste = await prisma.conversa.findMany({
    where: { canalWhatsappId: { in: [canalJoaoTeste.id, canalAgenteNaoImplementado.id, canalInativo.id, canalTipoDiferente.id] } },
    select: { id: true },
  });
  const conversaIds = conversasTeste.map((c) => c.id);
  if (conversaIds.length) {
    await prisma.mensagem.deleteMany({ where: { conversaId: { in: conversaIds } } });
    await prisma.conversa.deleteMany({ where: { id: { in: conversaIds } } });
  }
  await prisma.canalWhatsapp.deleteMany({
    where: { id: { in: [canalJoaoTeste.id, canalAgenteNaoImplementado.id, canalInativo.id, canalTipoDiferente.id] } },
  });

  await prisma.$disconnect();

  console.log("\n─────────────────────────────────────────");
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`${resultados.length - falhas.length}/${resultados.length} cenários OK.`);
  if (falhas.length) {
    console.log("Cenários com falha:", falhas.map((f) => f.cenario).join(", "));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Erro fatal no teste de integração do roteador:", err);
  process.exitCode = 1;
});
