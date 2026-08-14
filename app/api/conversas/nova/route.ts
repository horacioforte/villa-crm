// ARQUIVO: app/api/conversas/nova/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Inicia uma conversa nova via CRM, sem precisar que o cliente tenha mandado
// mensagem antes. Aceita qualquer instanceName (maria-villa, taciane-villa, etc.).
// Detecta automaticamente se o canal é Evolution ou Meta Cloud API e usa a rota certa.
// Cria a Conversa + a Mensagem no banco e devolve { conversaId }.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { CanalWhatsappTipo } from "@/app/generated/prisma/client";
import { enviarTextoMeta, CanalInvalidoError, EnvioMetaError } from "@/lib/whatsapp/meta-client";

const INSTANCES_VALIDAS = ["maria-villa", "joao-villa", "morgana-villa", "taciane-villa"];

function getApiKeyEvolution(instanceName: string): string {
  if (instanceName.startsWith("joao")) return process.env.JOAO_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  if (instanceName.startsWith("morgana")) return process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  if (instanceName.startsWith("taciane")) return process.env.TACIANE_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  return process.env.EVOLUTION_API_KEY ?? ""; // maria + default
}

function normalizarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { telefone, mensagem, nomeContato, oportunidadeId, pessoaId, instanceName: rawInstance } = body as {
    telefone?: string;
    mensagem?: string;
    nomeContato?: string;
    oportunidadeId?: string;
    pessoaId?: string;
    instanceName?: string;
  };

  if (!telefone || !mensagem) {
    return NextResponse.json({ error: "telefone e mensagem são obrigatórios." }, { status: 400 });
  }

  const INSTANCE_NAME = INSTANCES_VALIDAS.includes(rawInstance ?? "")
    ? (rawInstance as string)
    : "maria-villa";

  const telFull = normalizarTelefone(telefone);
  const telSem55 = telFull.slice(2);

  // Busca canal com tipo para saber se é Meta ou Evolution
  const canal = await prisma.canalWhatsapp.findUnique({
    where: { instanceName: INSTANCE_NAME },
    select: { id: true, tipo: true, ativo: true },
  });

  const ehMeta = canal?.tipo === CanalWhatsappTipo.META_CLOUD_API;

  // Reutiliza conversa existente ou cria nova
  let conversa = await prisma.conversa.findFirst({
    where: {
      instanceName: INSTANCE_NAME,
      status: { not: "SPAM" },
      OR: [
        { telefone: { contains: telSem55 } },
        { telefone: { contains: telFull } },
      ],
    },
    orderBy: { ultimaMensagemEm: "desc" },
    select: { id: true, telefone: true, canalWhatsappId: true },
  });

  if (!conversa) {
    conversa = await prisma.conversa.create({
      data: {
        instanceName: INSTANCE_NAME,
        telefone: telFull,
        nomeContato: nomeContato ?? null,
        canalWhatsappId: canal?.id ?? null,
        oportunidadeId: oportunidadeId ?? null,
        pessoaId: pessoaId ?? null,
        atendidoPorId: user.id,
        ultimaMensagemEm: new Date(),
      },
      select: { id: true, telefone: true, canalWhatsappId: true },
    });
  }

  // ─── Envio via Meta Cloud API ────────────────────────────────────────────
  if (ehMeta && canal) {
    try {
      await enviarTextoMeta({
        canalId: canal.id,
        conversaId: conversa.id,
        telefone: telFull,
        texto: mensagem,
        autorUsuarioId: user.id,
      });
      await prisma.conversa.update({
        where: { id: conversa.id },
        data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
      });
      return NextResponse.json({ conversaId: conversa.id });
    } catch (err) {
      const msg =
        err instanceof CanalInvalidoError || err instanceof EnvioMetaError
          ? err.message
          : "Erro ao enviar pela Meta Cloud API.";
      // Se o erro for "janela de 24h fechada", informa claramente
      const metaErr = err instanceof EnvioMetaError ? err : null;
      const fora24h = metaErr?.message?.includes("outside") || metaErr?.errorCode === "131047";
      if (fora24h) {
        return NextResponse.json(
          { error: "Janela de 24h encerrada. Para reabrir a conversa, use um template aprovado pela Meta — ou aguarde o cliente mandar mensagem primeiro." },
          { status: 422 }
        );
      }
      console.error("[api/conversas/nova] Erro Meta", err);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ─── Envio via Evolution API ─────────────────────────────────────────────
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = getApiKeyEvolution(INSTANCE_NAME);
  let waMessageId: string | undefined;

  try {
    const resp = await fetch(`${apiUrl}/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: telFull, text: mensagem }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      waMessageId = data?.key?.id as string | undefined;
    } else {
      const errText = await resp.text().catch(() => "");
      console.error("[api/conversas/nova] Evolution API error", resp.status, errText);
    }
  } catch (err) {
    console.error("[api/conversas/nova] Erro ao chamar Evolution API", err);
  }

  await prisma.mensagem.create({
    data: {
      conversaId: conversa.id,
      conteudo: mensagem,
      direcao: "SAIDA",
      autor: "HUMANO",
      autorUsuarioId: user.id,
      waMessageId,
      status: waMessageId ? "ENVIADA" : "ERRO",
      canalWhatsappId: canal?.id ?? null,
    },
  });

  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
  });

  return NextResponse.json({ conversaId: conversa.id });
}
