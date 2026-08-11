// ARQUIVO: app/api/agent/evolution-admin/route.ts
// Endpoint temporário para gerenciar instâncias Evolution API via servidor Vercel
// Autenticação via AGENT_API_KEY
// REGRA: nunca remover. Apenas acrescentar.

import { NextRequest, NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";

// Mascara campos sensíveis antes de logar ou expor em resposta — nunca o segredo
// completo, nem em auditoria, nem em teste, nem em relatório.
function mascararSegredos(config: unknown): unknown {
  if (!config || typeof config !== "object") return config;
  const clone = { ...(config as Record<string, unknown>) };
  if (typeof clone.token === "string" && clone.token.length > 5) {
    clone.token = `${clone.token.slice(0, 3)}***${clone.token.slice(-2)}`;
  }
  return clone;
}

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get("authorization") === `Bearer ${apiKey}`;
}

export async function POST(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const reqBody = await req.json().catch(() => ({}));
  const { action, instance, webhookUrl, enabled } = reqBody;
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  // Cada instância tem seu próprio token na Evolution API
  const apiKey = instance?.startsWith("joao")
    ? (process.env.JOAO_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY)
    : instance?.startsWith("morgana")
    ? (process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY)
    : instance?.startsWith("taciane")
    ? (process.env.TACIANE_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY)
    : process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "Evolution API não configurada." }, { status: 500 });
  }

  if (action === "create") {
    // Tenta com apikey header; se vier 401, tenta com Authorization: Bearer
    const tryCreate = async (headers: Record<string, string>) => {
      const res = await fetch(`${apiUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          instanceName: instance,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      return { res, data: await res.json() };
    };

    // Tenta 3 formatos de auth diferentes
    let { res, data } = await tryCreate({ apikey: apiKey });
    if (res.status === 401) {
      ({ res, data } = await tryCreate({ Authorization: `Bearer ${apiKey}` }));
    }
    if (res.status === 401) {
      // Tenta com query param
      const url = `${apiUrl}/instance/create?apikey=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceName: instance, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });
      data = await r.json();
      res = r;
    }
    return NextResponse.json({ ...data, _debugStatus: res.status }, { status: res.status });
  }

  if (action === "list") {
    const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === "connect") {
    const res = await fetch(`${apiUrl}/instance/connect/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === "status") {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  if (action === "getWebhook") {
    const res = await fetch(`${apiUrl}/webhook/find/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  // Só leitura — consulta a integração NATIVA do Chatwoot da instância (mecanismo
  // separado do webhook genérico acima). Nunca habilita, desabilita nem altera nada.
  if (action === "getChatwoot") {
    const res = await fetch(`${apiUrl}/chatwoot/find/${instance}`, {
      headers: { apikey: apiKey },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  // RESTRITO NESTA ETAPA: só desativação (enabled:false) da instância morgana-villa,
  // nunca em lote, nunca outra instância — guarda explícita no código, não só
  // documentação. Lê a config atual antes de escrever (auditoria com segredo
  // mascarado) e reutiliza exatamente os valores atuais, alterando somente "enabled".
  if (action === "setChatwoot") {
    if (instance !== "morgana-villa") {
      return NextResponse.json(
        { error: "Ação setChatwoot restrita a instance=\"morgana-villa\" nesta etapa." },
        { status: 403 },
      );
    }
    if (enabled !== false) {
      return NextResponse.json(
        { error: "Ação setChatwoot restrita a enabled=false nesta etapa (só desativação)." },
        { status: 403 },
      );
    }

    const findRes = await fetch(`${apiUrl}/chatwoot/find/${instance}`, {
      headers: { apikey: apiKey },
    });
    const configAtual = await findRes.json();

    if (!findRes.ok || typeof configAtual !== "object" || configAtual === null) {
      return NextResponse.json(
        { error: "Não foi possível ler a configuração atual do Chatwoot antes de desativar — write cancelado." },
        { status: 502 },
      );
    }

    await auditLog({
      action: "EVOLUTION_CHATWOOT_DESATIVADO",
      entity: "CanalWhatsapp",
      entityId: null,
      before: mascararSegredos(configAtual),
      metadata: { instance },
    });

    // Reutiliza EXATAMENTE os valores atuais devolvidos pelo find — só "enabled" muda.
    // Formato confirmado por tentativa real: ao contrário do /webhook/set (que exige
    // aninhamento sob "webhook"), o /chatwoot/set exige os campos SOLTOS no corpo —
    // erro real recebido ao tentar aninhar: 'instance requires property "enabled"',
    // "accountId", "token", "url" etc., todos listados como propriedades esperadas
    // diretamente na raiz do body, não dentro de um objeto "chatwoot".
    const novaConfig = { ...(configAtual as Record<string, unknown>), enabled: false };

    const res = await fetch(`${apiUrl}/chatwoot/set/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(novaConfig),
    });
    const data = await res.json();
    return NextResponse.json({ ...(mascararSegredos(data) as object), _debugStatus: res.status }, { status: res.status });
  }

  if (action === "setWebhook") {
    const baseUrl = ((webhookUrl as string | undefined) ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
    const suffix = instance?.startsWith("joao")
      ? "/api/webhook/whatsapp/joao"
      : instance?.startsWith("morgana")
      ? "/api/webhook/whatsapp/morgana"
      : "/api/webhook/whatsapp";
    const url = `${baseUrl}${suffix}`;

    // Formato exigido pela versão atual da Evolution API: corpo aninhado sob
    // "webhook", campos em camelCase — confirmado pelo erro '"instance requires
    // property \"webhook\""' ao enviar o formato antigo (campos soltos, snake_case),
    // e pelos nomes de campo já vistos na resposta de GET /webhook/find/{instance}
    // (url, enabled, webhookByEvents, webhookBase64, events).
    const res = await fetch(`${apiUrl}/webhook/set/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        webhook: {
          url,
          enabled: true,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT"],
        },
      }),
    });
    const data = await res.json();
    return NextResponse.json({ ...data, webhookUrl: url, _debugStatus: res.status }, { status: res.status });
  }

  return NextResponse.json({ error: "Action inválida. Use: create, connect, status, getWebhook, setWebhook, getChatwoot, setChatwoot" }, { status: 400 });
}
