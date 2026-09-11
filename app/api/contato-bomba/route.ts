// ARQUIVO: app/api/contato-bomba/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// API exclusiva da Landing Page Bomba Lança 68 m.
// NÃO cria Oportunidade. Cria: Empresa, Pessoa, HistoricoContato, Tarefa.
// Diagnóstico completo + UTMs ficam em HistoricoContato.detalhes.
// Camada 1: Tarefa sempre atribuída à Morgana (comercial@villaempreendimentos.com.br).
// Camada 2: HistoricoContato de status do WhatsApp (sucesso ou falha) após tentativa.

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  InfluenciaDecisao,
  NivelRelacionamento,
  PrioridadeTarefa,
  StatusTarefa,
  TemperaturaOportunidade,
  TipoAtividade,
  TipoContato,
  TipoPessoa,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

// ─── Validação de entrada ────────────────────────────────────────────────────

const bombaSchema = z.object({
  // Dados pessoais
  nome: z.string().trim().min(2),
  empresa: z.string().trim().min(1),
  cargo: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  telefone: z.string().trim().min(8),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  nome_obra: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  cidade: z.string().trim().min(2),
  uf: z.string().trim().optional().or(z.literal("").transform(() => undefined)),

  // Respostas do diagnóstico (labels das opções escolhidas)
  tipo_obra: z.string().trim().optional(),
  fase_obra: z.string().trim().optional(),
  prazo: z.string().trim().optional(),
  desafio: z.string().trim().optional(),
  alcance: z.string().trim().optional(),
  volume: z.string().trim().optional(),
  observacao: z.string().trim().optional().or(z.literal("").transform(() => undefined)),

  // Score e classificação calculados no frontend
  score: z.coerce.number().min(0).max(100),
  temperatura: z.enum(["QUENTE", "MEDIA", "FRIA"]),
  classificacao: z.string().trim().optional(),

  // UTMs e rastreamento
  utm_source: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  utm_medium: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  utm_campaign: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  utm_content: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  utm_term: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  referrer: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  landing_page: z.string().trim().optional().or(z.literal("").transform(() => undefined)),
  converted_at: z.string().trim().optional(),
});

type BombaInput = z.infer<typeof bombaSchema>;

// ─── Responsável padrão ───────────────────────────────────────────────────────
// Morgana é identificada pelo email institucional, não por ID hardcoded.
// Se o usuário não for encontrado (e.g. email mudou), a Tarefa fica sem responsável
// mas o lead continua salvo — nenhum dado é perdido.
const MORGANA_EMAIL = "comercial@villaempreendimentos.com.br";

// ─── Utilitários ─────────────────────────────────────────────────────────────

function normalizarTelefone(telefone: string) {
  const digits = telefone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function getTaskDueDate() {
  const date = new Date();
  date.setHours(date.getHours() + 2);
  return date;
}

function buildDetalhes(data: BombaInput): string {
  const linhas = [
    "🏗️ DIAGNÓSTICO BOMBA LANÇA 68 M — VILLA",
    "",
    `EMPRESA: ${data.empresa}`,
    `CONTATO: ${data.nome}${data.cargo ? ` — ${data.cargo}` : ""}`,
    data.nome_obra ? `OBRA: ${data.nome_obra}` : null,
    `LOCAL: ${data.cidade}${data.uf ? `/${data.uf}` : ""}`,
    "",
    "DIAGNÓSTICO",
    data.tipo_obra ? `• Tipo de obra: ${data.tipo_obra}` : null,
    data.fase_obra ? `• Fase atual: ${data.fase_obra}` : null,
    data.prazo ? `• Prazo de necessidade: ${data.prazo}` : null,
    data.desafio ? `• Principal desafio: ${data.desafio}` : null,
    data.alcance ? `• Alcance estimado: ${data.alcance}` : null,
    data.volume ? `• Volume previsto: ${data.volume}` : null,
    data.observacao ? `• Observação: ${data.observacao}` : null,
    "",
    "QUALIFICAÇÃO",
    `• Score: ${data.score}/100`,
    `• Classificação: ${data.classificacao ?? "—"}`,
    `• Temperatura: ${data.temperatura}`,
    "",
    "IDENTIFICAÇÃO DA CAMPANHA",
    "• Canal: LANDING_BOMBA_68M",
    "• Produto de interesse: BOMBA_LANCA",
    "• Origem: landing-bomba-68m",
    data.converted_at ? `• Data/hora: ${data.converted_at}` : null,
    "",
    "UTM / RASTREAMENTO",
    data.utm_source ? `• utm_source: ${data.utm_source}` : null,
    data.utm_medium ? `• utm_medium: ${data.utm_medium}` : null,
    data.utm_campaign ? `• utm_campaign: ${data.utm_campaign}` : null,
    data.utm_content ? `• utm_content: ${data.utm_content}` : null,
    data.utm_term ? `• utm_term: ${data.utm_term}` : null,
    data.referrer ? `• Referrer: ${data.referrer}` : null,
    data.landing_page ? `• Landing page: ${data.landing_page}` : null,
  ];

  return linhas.filter(Boolean).join("\n");
}

function buildResumo(data: BombaInput): string {
  return [
    `Diagnóstico Bomba 68m recebido | origem: landing-bomba-68m | canal: LANDING_BOMBA_68M | produto: BOMBA_LANCA`,
    `${data.empresa} — ${data.cidade}${data.uf ? `/${data.uf}` : ""}`,
    `Score: ${data.score}/100 | ${data.classificacao ?? data.temperatura}`,
  ].join(" — ");
}

function buildContextoMaria(data: BombaInput): string {
  return [
    "🏗️ DIAGNÓSTICO BOMBA LANÇA 68 M",
    "",
    `EMPRESA: ${data.empresa}`,
    data.nome_obra ? `OBRA: ${data.nome_obra}` : null,
    `LOCAL: ${data.cidade}${data.uf ? `/${data.uf}` : ""}`,
    data.tipo_obra ? `TIPO DE OBRA: ${data.tipo_obra}` : null,
    data.fase_obra ? `FASE: ${data.fase_obra}` : null,
    data.volume ? `VOLUME PREVISTO: ${data.volume}` : null,
    data.prazo ? `PRAZO: ${data.prazo}` : null,
    data.desafio ? `DESAFIO PRINCIPAL: ${data.desafio}` : null,
    data.alcance ? `ALCANCE NECESSÁRIO: ${data.alcance}` : null,
    data.observacao ? `OBSERVAÇÃO: ${data.observacao}` : null,
    "",
    `ORIGEM: Landing Page — Bomba Lança 68 m`,
    data.utm_campaign ? `CAMPANHA: ${data.utm_campaign}` : null,
    `CLASSIFICAÇÃO: ${data.classificacao ?? data.temperatura} (Score: ${data.score}/100)`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Detalhes do log de WhatsApp (Camada 2) ──────────────────────────────────
// NOTA: nenhum token, segredo ou credencial é gravado nestes logs.

function buildDetalhesWhatsAppSucesso(
  nome: string,
  empresa: string,
  telefoneNorm: string,
  dataHora: string
): string {
  return [
    "✅ WHATSAPP DISPARADO COM SUCESSO",
    "",
    `Empresa: ${empresa}`,
    `Contato: ${nome}`,
    `Telefone (normalizado E.164): ${telefoneNorm}`,
    `Template utilizado: villa_bomba_68m`,
    `Variável {{1}}: ${nome}`,
    `Data/hora do disparo: ${dataHora}`,
    "",
    "STATUS: Template enviado via Meta Cloud API. Mensagem de contexto enviada após 5s.",
    "OBSERVAÇÃO: Nenhuma credencial ou token está registrada neste log.",
  ].join("\n");
}

function buildDetalhesWhatsAppFalha(
  nome: string,
  empresa: string,
  telefoneNorm: string,
  dataHora: string,
  erro?: string
): string {
  return [
    "⚠️ FALHA NO DISPARO DO WHATSAPP — CONTATO MANUAL NECESSÁRIO",
    "",
    `Empresa: ${empresa}`,
    `Contato: ${nome}`,
    `Telefone (normalizado E.164): ${telefoneNorm}`,
    `Template tentado: villa_bomba_68m`,
    `Data/hora da tentativa: ${dataHora}`,
    erro ? `Erro retornado: ${erro}` : "Erro retornado: não disponível",
    "",
    "AÇÃO NECESSÁRIA: Entrar em contato manualmente pelo WhatsApp do lead.",
    "PRIORIDADE: URGENTE",
    "OBSERVAÇÃO: Nenhuma credencial ou token está registrada neste log.",
  ].join("\n");
}

// ─── WhatsApp via Meta ────────────────────────────────────────────────────────

// Retorna true se o template foi aceito pela Meta Cloud API, false caso contrário.
async function enviarTemplateBomba68m(telefone: string, nome: string): Promise<boolean> {
  const phoneNumberId = process.env.MARIA_META_PHONE_NUMBER_ID?.replace(/[^\x20-\x7E]/g, "").trim();
  const accessToken = process.env.MARIA_META_ACCESS_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
  if (!phoneNumberId || !accessToken || !telefone) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

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
            name: "villa_bomba_68m",
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: nome }],
              },
            ],
          },
        }),
      }
    );
    const body = await response.text().catch(() => "");
    if (!response.ok) {
      console.error("[API_CONTATO_BOMBA] Template Meta erro", { status: response.status, body });
      return false;
    }
    console.info("[API_CONTATO_BOMBA] Template Meta ok", { status: response.status });
    return true;
  } catch (error) {
    console.error("[API_CONTATO_BOMBA] Falha/timeout template Meta:", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Retorna true se a mensagem de contexto foi aceita, false caso contrário.
async function enviarMensagemContextoMaria(telefone: string, contexto: string): Promise<boolean> {
  const phoneNumberId = process.env.MARIA_META_PHONE_NUMBER_ID?.replace(/[^\x20-\x7E]/g, "").trim();
  const accessToken = process.env.MARIA_META_ACCESS_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
  if (!phoneNumberId || !accessToken || !telefone) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

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
          type: "text",
          text: { body: contexto },
        }),
      }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[API_CONTATO_BOMBA] Contexto Maria erro", { status: response.status, body });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[API_CONTATO_BOMBA] Falha/timeout contexto Maria:", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Resultado do disparo do WhatsApp.
type WhatsAppDispatchResult = {
  ok: boolean;       // true = template enviado com sucesso
  templateOk: boolean;
  contextoOk: boolean;
  telefone: string;
  erro?: string;
};

async function dispararWhatsApp(data: BombaInput): Promise<WhatsAppDispatchResult> {
  const telefone = normalizarTelefone(data.telefone);
  if (!telefone) {
    return { ok: false, templateOk: false, contextoOk: false, telefone: "", erro: "Telefone vazio após normalização" };
  }

  let templateOk = false;
  let contextoOk = false;
  let templateErro: string | undefined;

  // Mensagem 1 — template aprovado pela Meta (abre a janela de 24h)
  try {
    templateOk = await enviarTemplateBomba68m(telefone, data.nome);
  } catch (e) {
    templateErro = e instanceof Error ? e.message : String(e);
  }

  if (!templateOk) {
    return {
      ok: false,
      templateOk: false,
      contextoOk: false,
      telefone,
      erro: templateErro ?? "Meta API recusou o template (template não aprovado ou número inválido)",
    };
  }

  // Aguarda 5s antes da mensagem 2 (contexto rico para Maria, janela 24h necessária)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Mensagem 2 — contexto estruturado para Maria
  try {
    contextoOk = await enviarMensagemContextoMaria(telefone, buildContextoMaria(data));
  } catch {
    // contextoOk fica false — não impede o fluxo principal
  }

  return { ok: true, templateOk: true, contextoOk, telefone };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "JSON inválido." },
      { status: 400 }
    );
  }

  const parsed = bombaSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Dados inválidos.", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const telefoneLimpo = normalizarTelefone(data.telefone);
  const empresaNome = data.empresa.trim();
  const detalhes = buildDetalhes(data);
  const resumo = buildResumo(data);
  const dataVencimento = getTaskDueDate();

  // ── Camada 1: localiza Morgana por email — não por ID hardcoded ──────────────
  // Se o usuário não for encontrado (email mudado), morganaId fica null e a Tarefa
  // é criada sem responsável — o lead não é perdido, apenas fica sem dono.
  const morgana = await prisma.usuario.findFirst({
    where: { email: MORGANA_EMAIL, ativo: true },
    select: { id: true },
  });
  const morganaId = morgana?.id ?? null;

  if (!morganaId) {
    console.warn(`[API_CONTATO_BOMBA] Usuário Morgana não encontrado (email: ${MORGANA_EMAIL}). Tarefa criada sem responsável.`);
  }

  try {
    // Transação principal — retorna IDs necessários para as etapas pós-transação
    const { empresaId, pessoaId, tarefaId } = await prisma.$transaction(async (tx) => {
      // 1. Upsert Empresa (mínimo — sem poluir observacoes com diagnóstico)
      const empresaWhere = data.email
        ? {
            OR: [
              { email: { equals: data.email, mode: "insensitive" as const } },
              { razaoSocial: { equals: empresaNome, mode: "insensitive" as const } },
              { telefone: telefoneLimpo || data.telefone },
            ],
          }
        : {
            OR: [
              { razaoSocial: { equals: empresaNome, mode: "insensitive" as const } },
              { telefone: telefoneLimpo || data.telefone },
            ],
          };

      let empresa = await tx.empresa.findFirst({ where: empresaWhere });

      if (!empresa) {
        empresa = await tx.empresa.create({
          data: {
            razaoSocial: empresaNome,
            nomeFantasia: empresaNome,
            telefone: telefoneLimpo || data.telefone,
            email: data.email ?? null,
            segmento: "Lead inbound",
            cidade: data.cidade,
            estado: data.uf ?? null,
            ativa: true,
            // observacoes: intencionalmente vazio — diagnóstico fica no HistoricoContato
          },
        });
      }

      // 2. Upsert Pessoa
      const pessoaWhere = data.email
        ? {
            empresaId: empresa.id,
            OR: [
              { email: { equals: data.email, mode: "insensitive" as const } },
              { whatsapp: telefoneLimpo || data.telefone },
              { telefone: telefoneLimpo || data.telefone },
              { nome: { equals: data.nome, mode: "insensitive" as const } },
            ],
          }
        : {
            empresaId: empresa.id,
            OR: [
              { whatsapp: telefoneLimpo || data.telefone },
              { telefone: telefoneLimpo || data.telefone },
              { nome: { equals: data.nome, mode: "insensitive" as const } },
            ],
          };

      let pessoa = await tx.pessoa.findFirst({ where: pessoaWhere });

      if (!pessoa) {
        pessoa = await tx.pessoa.create({
          data: {
            nome: data.nome,
            email: data.email ?? null,
            telefone: telefoneLimpo || data.telefone,
            whatsapp: telefoneLimpo || data.telefone,
            cargo: data.cargo ?? null,
            tipo: TipoPessoa.CONTATO,
            influenciaDecisao: InfluenciaDecisao.INFLUENCIADOR,
            nivelRelacionamento: NivelRelacionamento.NEUTRO,
            empresaId: empresa.id,
            ativa: true,
          },
        });
      }

      // 3. HistoricoContato — diagnóstico completo + UTMs em detalhes
      // NÃO vinculado a oportunidade (não criamos uma)
      await tx.historicoContato.create({
        data: {
          tipo: TipoContato.WHATSAPP,
          resumo,
          detalhes, // diagnóstico completo + score + UTMs aqui
          empresaId: empresa.id,
          pessoaId: pessoa.id,
          // oportunidadeId: null — sem oportunidade
        },
      });

      // 4. Tarefa de alerta — atribuída à Morgana (Camada 1)
      const prioridade =
        data.temperatura === "QUENTE"
          ? PrioridadeTarefa.URGENTE
          : data.temperatura === "MEDIA"
            ? PrioridadeTarefa.ALTA
            : PrioridadeTarefa.MEDIA;

      const tarefa = await tx.tarefa.create({
        data: {
          titulo: `[Bomba 68m] Lead: ${data.nome} — ${empresaNome} (${data.cidade}${data.uf ? `/${data.uf}` : ""})`,
          descricao: [
            `Score: ${data.score}/100 | ${data.classificacao ?? data.temperatura}`,
            data.desafio ? `Desafio: ${data.desafio}` : null,
            data.prazo ? `Prazo: ${data.prazo}` : null,
            data.alcance ? `Alcance: ${data.alcance}` : null,
            `WhatsApp: ${data.telefone}`,
          ]
            .filter(Boolean)
            .join(" | "),
          tipo: TipoAtividade.WHATSAPP,
          prioridade,
          status: StatusTarefa.PENDENTE,
          dataVencimento,
          horaVencimento: dataVencimento.toTimeString().slice(0, 5),
          empresaId: empresa.id,
          pessoaId: pessoa.id,
          responsavelId: morganaId, // Camada 1: Morgana é a responsável automática
          // oportunidadeId: null — sem oportunidade
        },
      });

      return { empresaId: empresa.id, pessoaId: pessoa.id, tarefaId: tarefa.id };
    });

    // ── Camada 2: dispara WhatsApp e registra o resultado no histórico ─────────
    const dataHora = new Date().toISOString();
    const wapp = await dispararWhatsApp(data);

    if (wapp.ok) {
      // WhatsApp enviado — registra sucesso
      await prisma.historicoContato.create({
        data: {
          tipo: TipoContato.WHATSAPP,
          resumo: "[Bomba 68m] WhatsApp disparado ✅",
          detalhes: buildDetalhesWhatsAppSucesso(data.nome, empresaNome, wapp.telefone, dataHora),
          empresaId,
          pessoaId,
        },
      }).catch((e) => console.error("[API_CONTATO_BOMBA] Erro ao criar HistoricoContato de sucesso:", e));
    } else {
      // WhatsApp falhou — registra falha e torna a Tarefa visualmente urgente
      await prisma.historicoContato.create({
        data: {
          tipo: TipoContato.WHATSAPP,
          resumo: "[Bomba 68m] WhatsApp falhou — contato manual necessário ⚠️",
          detalhes: buildDetalhesWhatsAppFalha(data.nome, empresaNome, wapp.telefone || telefoneLimpo, dataHora, wapp.erro),
          empresaId,
          pessoaId,
        },
      }).catch((e) => console.error("[API_CONTATO_BOMBA] Erro ao criar HistoricoContato de falha:", e));

      // Atualiza título da Tarefa para sinalizar contato manual necessário
      await prisma.tarefa.update({
        where: { id: tarefaId },
        data: {
          titulo: `⚠️ CONTATO MANUAL — Lead Bomba 68m: ${data.nome} (${empresaNome})`,
          prioridade: PrioridadeTarefa.URGENTE,
        },
      }).catch((e) => console.error("[API_CONTATO_BOMBA] Erro ao atualizar título da Tarefa:", e));
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[API_CONTATO_BOMBA] Erro ao salvar lead:", error);
    return NextResponse.json(
      { success: false, message: "Erro interno ao receber diagnóstico. Tente novamente." },
      { status: 500 }
    );
  }
}
