// ARQUIVO: app/api/whatsapp/recontato/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Disparo manual do template villa_maria_recontato via Meta Cloud API.
// Maria usa este endpoint para re-engajar leads frios cuja janela de 24h
// WhatsApp já foi encerrada — o template reabre a conversa oficialmente.
//
// Segurança:
// - Requer sessão autenticada (getCurrentUser).
// - Nenhum token, segredo ou credencial é gravado em logs ou HistoricoContato.
// - Lê credenciais apenas de env vars (MARIA_META_PHONE_NUMBER_ID / MARIA_META_ACCESS_TOKEN).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { TipoContato } from "@/app/generated/prisma/client";

export const maxDuration = 20;

// ─── Validação ────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  conversaId: z.string().min(1),
  nome: z.string().trim().optional(),
});

// ─── Utilitários ─────────────────────────────────────────────────────────────

function normalizarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? nomeCompleto.trim();
}

// ─── Envio via Meta Cloud API ─────────────────────────────────────────────────
// Mesmo padrão do app/api/contato-bomba/route.ts.
// Nenhum token é logado aqui ou no chamador.

async function enviarTemplateRecontato(
  telefone: string,
  nomeParam: string
): Promise<{ ok: boolean; erro?: string }> {
  const phoneNumberId = process.env.MARIA_META_PHONE_NUMBER_ID
    ?.replace(/[^\x20-\x7E]/g, "")
    .trim();
  const accessToken = process.env.MARIA_META_ACCESS_TOKEN
    ?.replace(/[^\x20-\x7E]/g, "")
    .trim();

  if (!phoneNumberId || !accessToken) {
    return { ok: false, erro: "Credenciais Meta não configuradas no ambiente." };
  }
  if (!telefone) {
    return { ok: false, erro: "Telefone vazio após normalização." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefone,
          type: "template",
          template: {
            name: "villa_maria_recontato",
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: nomeParam }],
              },
            ],
          },
        }),
      }
    );

    const texto = await response.text().catch(() => "");
    if (!response.ok) {
      console.error("[recontato] Template Meta erro", { status: response.status, body: texto });
      return { ok: false, erro: `Meta API retornou ${response.status}` };
    }

    console.info("[recontato] Template villa_maria_recontato enviado", { status: response.status });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[recontato] Falha/timeout template Meta:", msg);
    return { ok: false, erro: msg };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Autenticação
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Parse do body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { conversaId, nome: nomeBody } = parsed.data;

  // Busca a conversa para obter telefone e vínculos com CRM
  const conversa = await prisma.conversa.findUnique({
    where: { id: conversaId },
    select: {
      id: true,
      telefone: true,
      nomeContato: true,
      pessoaId: true,
      empresaId: true,
    },
  });

  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }
  if (!conversa.telefone) {
    return NextResponse.json(
      { error: "Esta conversa não possui telefone registrado." },
      { status: 422 }
    );
  }

  const telefone = normalizarTelefone(conversa.telefone);
  if (!telefone) {
    return NextResponse.json({ error: "Telefone inválido." }, { status: 422 });
  }

  // Nome para o {{1}} do template — prioriza o que veio no body, depois nomeContato
  const nomeCompleto = nomeBody ?? conversa.nomeContato ?? "cliente";
  const nomeParam = primeiroNome(nomeCompleto);

  const dataHora = new Date().toISOString();

  // Dispara o template
  const resultado = await enviarTemplateRecontato(telefone, nomeParam);

  // Loga o resultado em HistoricoContato (sem credenciais)
  if (conversa.pessoaId || conversa.empresaId) {
    const resumo = resultado.ok
      ? `[Recontato] Template villa_maria_recontato enviado ✅ — ${nomeCompleto}`
      : `[Recontato] Falha no envio do template villa_maria_recontato ⚠️ — ${nomeCompleto}`;

    const detalhes = resultado.ok
      ? [
          "✅ RECONTATO WHATSAPP ENVIADO",
          "",
          `Contato: ${nomeCompleto}`,
          `Telefone (normalizado): ${telefone}`,
          `Template: villa_maria_recontato`,
          `Variável {{1}}: ${nomeParam}`,
          `Data/hora: ${dataHora}`,
          `Disparado por: ${user.nome ?? user.email}`,
          "",
          "OBSERVAÇÃO: Nenhuma credencial ou token está registrada neste log.",
        ].join("\n")
      : [
          "⚠️ FALHA NO RECONTATO WHATSAPP",
          "",
          `Contato: ${nomeCompleto}`,
          `Telefone (normalizado): ${telefone}`,
          `Template tentado: villa_maria_recontato`,
          `Erro: ${resultado.erro ?? "não disponível"}`,
          `Data/hora: ${dataHora}`,
          `Disparado por: ${user.nome ?? user.email}`,
          "",
          "AÇÃO NECESSÁRIA: Tentar recontato manual.",
          "OBSERVAÇÃO: Nenhuma credencial ou token está registrada neste log.",
        ].join("\n");

    await prisma.historicoContato
      .create({
        data: {
          tipo: TipoContato.WHATSAPP,
          resumo,
          detalhes,
          pessoaId: conversa.pessoaId ?? undefined,
          empresaId: conversa.empresaId ?? undefined,
        },
      })
      .catch((e) =>
        console.error("[recontato] Erro ao criar HistoricoContato:", e)
      );
  }

  if (!resultado.ok) {
    return NextResponse.json(
      { ok: false, erro: resultado.erro ?? "Falha desconhecida." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
