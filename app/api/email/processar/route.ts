import { NextResponse } from "next/server";
import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser } from "mailparser";
import { z } from "zod";

import {
  CanalOrigem,
  InfluenciaDecisao,
  NivelRelacionamento,
  PrioridadeTarefa,
  StatusOportunidade,
  StatusTarefa,
  TemperaturaOportunidade,
  TipoAtividade,
  TipoContato,
  TipoOperacao,
  TipoPessoa,
  TipoServico,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

const classificacaoSchema = z.object({
  isLead: z.boolean(),
  motivo: z.string().nullable().optional(),
  nome: z.string().nullable().optional(),
  tipoServico: z
    .enum([
      "BOMBA_LANCA",
      "BOMBA_ESTACIONARIA",
      "BETONEIRA",
      "CENTRAL_IN_LOCO",
      "TELEBELT",
    ])
    .nullable()
    .optional(),
  cidade: z.string().nullable().optional(),
  volume: z.string().nullable().optional(),
  prazo: z.string().nullable().optional(),
  telefone: z.string().nullable().optional(),
  urgente: z.boolean().default(false),
  temperatura: z.enum(["QUENTE", "MEDIA", "FRIA"]).default("MEDIA"),
  resumo: z.string().nullable().optional(),
});

type ClassificacaoEmail = z.infer<typeof classificacaoSchema>;

function getBearerToken(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error("[EMAIL_PROCESSAR] CRON_SECRET nao configurado.");
    return false;
  }

  return getBearerToken(request) === secret;
}

function assertEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} nao configurada.`);
  }

  return value;
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEmailText(text?: string, html?: string | false) {
  if (text?.trim()) {
    return text.trim();
  }

  return typeof html === "string" ? stripHtml(html) : "";
}

function extractJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("Resposta da IA nao contem JSON.");
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function safeText(value: string | null | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function buildEmailPrompt({
  remetente,
  assunto,
  corpo,
}: {
  remetente: string;
  assunto: string;
  corpo: string;
}) {
  return `Você é a Maria, SDR da Villa Empreendimentos (locação de bombas de concreto, betoneiras, centrais e telebelt).

Analise este email e responda APENAS com JSON válido, sem markdown:
{
  "isLead": true/false,
  "motivo": "por que é ou não é lead",
  "nome": "nome da pessoa/empresa ou null",
  "tipoServico": "BOMBA_LANCA|BOMBA_ESTACIONARIA|BETONEIRA|CENTRAL_IN_LOCO|TELEBELT|null",
  "cidade": "cidade/estado ou null",
  "volume": "volume estimado ou null",
  "prazo": "prazo mencionado ou null",
  "telefone": "telefone/whatsapp ou null",
  "urgente": true/false,
  "temperatura": "QUENTE|MEDIA|FRIA",
  "resumo": "resumo em 1-2 frases do que o cliente precisa"
}

Regras:
- isLead = true SE o email fala sobre obra, concreto, equipamento, locação, orçamento, bomba, betoneira, central ou telebelt.
- isLead = false SE for spam, marketing, newsletter, fornecedor, vaga de emprego, cobrança, financeiro ou sem relação com construção.
- QUENTE: urgência, prazo < 30 dias, perguntou preço, volume > 500m³.
- MEDIA: interesse claro mas sem urgência.
- FRIA: dúvida genérica, apenas informações.

Email:
De: ${remetente}
Assunto: ${assunto}
Corpo: ${corpo.substring(0, 3000)}`;
}

async function classificarEmail(input: {
  remetente: string;
  assunto: string;
  corpo: string;
}) {
  const apiKey = assertEnv("ANTHROPIC_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: buildEmailPrompt(input) }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Erro Anthropic ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.content?.[0]?.type === "text" ? data.content[0].text : "";
    return classificacaoSchema.parse(JSON.parse(extractJson(text)));
  } finally {
    clearTimeout(timeout);
  }
}

async function enviarRespostaBrevo({
  destinatario,
  nome,
  assunto,
}: {
  destinatario: string;
  nome?: string | null;
  assunto: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn("[EMAIL_PROCESSAR] BREVO_API_KEY nao configurada.");
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const primeiroNome = nome?.split(" ")[0]?.trim();

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: "Maria — Villa Empreendimentos",
          email: "maria.comercial@villaempreendimentos.com.br",
        },
        to: [{ email: destinatario }],
        replyTo: {
          name: "Maria — Villa Empreendimentos",
          email: "maria.comercial@villaempreendimentos.com.br",
        },
        subject: `Re: ${assunto}`,
        htmlContent: `
          <p>Olá${primeiroNome ? ` ${primeiroNome}` : ""}!</p>
          <p>Recebemos sua mensagem e nossa equipe comercial entrará em contato em até 2 horas.</p>
          <p>Qualquer dúvida, responda este email.</p>
          <br />
          <p>Maria<br />Villa Empreendimentos<br />(81) XXXX-XXXX</p>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[EMAIL_PROCESSAR] Erro Brevo:", errorText);
    }
  } catch (error) {
    console.error("[EMAIL_PROCESSAR] Falha/timeout Brevo:", error);
  } finally {
    clearTimeout(timeout);
  }
}

function buildDescricaoEmail({
  remetente,
  assunto,
  corpo,
  dados,
}: {
  remetente: string;
  assunto: string;
  corpo: string;
  dados: ClassificacaoEmail;
}) {
  return [
    `Lead recebido por email.`,
    `De: ${remetente}`,
    `Assunto: ${assunto}`,
    dados.tipoServico ? `Tipo de servico: ${dados.tipoServico}` : null,
    dados.cidade ? `Cidade: ${dados.cidade}` : null,
    dados.volume ? `Volume: ${dados.volume}` : null,
    dados.prazo ? `Prazo: ${dados.prazo}` : null,
    dados.telefone ? `Telefone: ${dados.telefone}` : null,
    "",
    dados.resumo ? `Resumo IA: ${dados.resumo}` : null,
    "",
    corpo.substring(0, 1500),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

async function persistirLead({
  remetente,
  emailRemetente,
  assunto,
  corpo,
  dados,
}: {
  remetente: string;
  emailRemetente?: string;
  assunto: string;
  corpo: string;
  dados: ClassificacaoEmail;
}) {
  const nome = safeText(dados.nome, emailRemetente ?? (remetente || "Lead via email"));
  const empresaNome = nome;
  const descricao = buildDescricaoEmail({ remetente, assunto, corpo, dados });

  return prisma.$transaction(async (tx) => {
    const empresaWhere = emailRemetente
      ? {
          OR: [
            { email: { equals: emailRemetente, mode: "insensitive" as const } },
            { razaoSocial: { equals: empresaNome, mode: "insensitive" as const } },
          ],
        }
      : {
          razaoSocial: { equals: empresaNome, mode: "insensitive" as const },
        };

    let empresa = await tx.empresa.findFirst({ where: empresaWhere });

    if (!empresa) {
      empresa = await tx.empresa.create({
        data: {
          razaoSocial: empresaNome,
          nomeFantasia: dados.nome?.trim() || null,
          telefone: dados.telefone?.trim() || null,
          email: emailRemetente ?? null,
          segmento: "Lead inbound email",
          cidade: dados.cidade?.trim() || null,
          observacoes: descricao,
          ativa: true,
        },
      });
    }

    const pessoaWhere = emailRemetente
      ? {
          empresaId: empresa.id,
          OR: [
            { email: { equals: emailRemetente, mode: "insensitive" as const } },
            { nome: { equals: nome, mode: "insensitive" as const } },
          ],
        }
      : {
          empresaId: empresa.id,
          nome: { equals: nome, mode: "insensitive" as const },
        };

    let pessoa = await tx.pessoa.findFirst({ where: pessoaWhere });

    if (!pessoa) {
      pessoa = await tx.pessoa.create({
        data: {
          nome,
          email: emailRemetente ?? null,
          telefone: dados.telefone?.trim() || null,
          whatsapp: dados.telefone?.trim() || null,
          tipo: TipoPessoa.CONTATO,
          influenciaDecisao: InfluenciaDecisao.INFLUENCIADOR,
          nivelRelacionamento: NivelRelacionamento.NEUTRO,
          empresaId: empresa.id,
          ativa: true,
        },
      });
    }

    const oportunidade = await tx.oportunidade.create({
      data: {
        titulo: `Email inbound — ${nome}`,
        descricao,
        tipo: TipoOperacao.LOCACAO,
        tipoServico: dados.tipoServico
          ? (dados.tipoServico as TipoServico)
          : undefined,
        canalOrigem: CanalOrigem.OUTROS,
        status: StatusOportunidade.NOVA,
        temperatura: dados.temperatura as TemperaturaOportunidade,
        temperaturaMotivo: dados.motivo ?? null,
        empresaId: empresa.id,
        pessoaId: pessoa.id,
        ativa: true,
      },
    });

    await tx.historicoContato.create({
      data: {
        oportunidadeId: oportunidade.id,
        empresaId: empresa.id,
        pessoaId: pessoa.id,
        tipo: TipoContato.EMAIL,
        resumo: dados.resumo || `Email de ${remetente}`,
        detalhes: `De: ${remetente}\nAssunto: ${assunto}\n\n${corpo.substring(0, 1500)}`,
      },
    });

    const dataVencimento = new Date();
    dataVencimento.setHours(dataVencimento.getHours() + 2);

    await tx.tarefa.create({
      data: {
        oportunidadeId: oportunidade.id,
        empresaId: empresa.id,
        pessoaId: pessoa.id,
        titulo: `Responder email: ${nome}`,
        descricao,
        tipo: TipoAtividade.EMAIL,
        prioridade: dados.urgente ? PrioridadeTarefa.URGENTE : PrioridadeTarefa.ALTA,
        status: StatusTarefa.PENDENTE,
        dataVencimento,
        horaVencimento: dataVencimento.toTimeString().slice(0, 5),
      },
    });

    return oportunidade;
  });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 });
  }

  let client: ImapFlow | null = null;
  const processados: string[] = [];
  const erros: string[] = [];

  try {
    client = new ImapFlow({
      host: assertEnv("IMAP_HOST"),
      port: Number(assertEnv("IMAP_PORT")),
      secure: true,
      auth: {
        user: assertEnv("IMAP_USER"),
        pass: assertEnv("IMAP_PASSWORD"),
      },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const messages: FetchMessageObject[] = [];

      for await (const msg of client.fetch("1:*", {
        envelope: true,
        flags: true,
        source: true,
      })) {
        if (!msg.flags?.has("\\Seen") && msg.source) {
          messages.push(msg);
        }
      }

      for (const msg of messages) {
        const assunto = msg.envelope?.subject || "(sem assunto)";

        try {
          const parsed = await simpleParser(msg.source as Buffer);
          const remetente = parsed.from?.text || "";
          const emailRemetente = parsed.from?.value?.[0]?.address;
          const corpo = getEmailText(parsed.text, parsed.html);
          const dados = await classificarEmail({ remetente, assunto, corpo });

          if (!dados.isLead) {
            await client.messageFlagsAdd(msg.seq, ["\\Seen"]);
            processados.push(`IGNORADO: ${assunto} — ${dados.motivo ?? "nao lead"}`);
            continue;
          }

          const oportunidade = await persistirLead({
            remetente,
            emailRemetente,
            assunto,
            corpo,
            dados,
          });

          if (emailRemetente) {
            await enviarRespostaBrevo({
              destinatario: emailRemetente,
              nome: dados.nome,
              assunto,
            });
          }

          await client.messageFlagsAdd(msg.seq, ["\\Seen"]);
          processados.push(
            `LEAD: ${assunto} — ${dados.temperatura} — ${oportunidade.id}`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro desconhecido";
          erros.push(`Erro no email "${assunto}": ${message}`);
          console.error("[EMAIL_PROCESSAR] Erro no email:", error);
        }
      }
    } finally {
      lock.release();
    }

    return NextResponse.json({
      processados: processados.length,
      detalhes: processados,
      erros,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    console.error("[EMAIL_PROCESSAR] Falha geral:", error);
    return NextResponse.json({ erro: message }, { status: 500 });
  } finally {
    await client?.logout().catch(() => undefined);
  }
}
