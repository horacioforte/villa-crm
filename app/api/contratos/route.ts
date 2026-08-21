import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { NivelRisco, Prisma } from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { buildAnalisePrompt } from "@/lib/contratos/regras";
import { prisma } from "@/lib/prisma";
import { analisarContratoSchema } from "@/lib/validations/contrato";

const analiseSelect = {
  id: true,
  nomeArquivo: true,
  tipoContrato: true,
  tipoDetectado: true,
  partes: true,
  prazo: true,
  valor: true,
  reajuste: true,
  riscoGeral: true,
  resumo: true,
  resultado: true,
  createdAt: true,
  empresa: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
  oportunidade: { select: { id: true, titulo: true } },
  createdBy: { select: { id: true, nome: true } },
} satisfies Prisma.AnaliseContratoSelect;

const RISCO_MAP: Record<string, NivelRisco> = {
  Baixo: "BAIXO",
  Médio: "MEDIO",
  Medio: "MEDIO",
  Alto: "ALTO",
};

export async function GET(request: Request) {
  const authResult = await requirePermission("contratos", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const analises = await prisma.analiseContrato.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: analiseSelect,
  });

  return NextResponse.json(analises);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("contratos", "create", request);
  if (authResult instanceof NextResponse) return authResult;

  let data: ReturnType<typeof analisarContratoSchema.parse>;
  try {
    data = analisarContratoSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: error.issues[0]?.message ?? "Dados invalidos.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ message: "Dados invalidos." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "ANTHROPIC_API_KEY não configurada no servidor." },
      { status: 503 },
    );
  }

  const messageContent = data.pdfBase64
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: data.pdfBase64 },
        },
        { type: "text", text: "Analise este contrato do cliente:" },
      ]
    : `Analise este contrato:\n\n${(data.texto ?? "").slice(0, 12000)}`;

  let parsed: Record<string, unknown>;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: buildAnalisePrompt(data.tipoContrato),
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      console.error("Anthropic API error (analise de contrato):", err);
      return NextResponse.json(
        { message: "Erro ao chamar a IA para analisar o contrato." },
        { status: 502 },
      );
    }

    const aiData = await response.json();
    const raw: string =
      aiData.content?.map((block: { text?: string }) => block.text ?? "").join("") ?? "";
    parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch (error) {
    console.error("Analise de contrato error:", error);
    return NextResponse.json(
      { message: "Não foi possível analisar o contrato. Verifique o arquivo/texto enviado." },
      { status: 500 },
    );
  }

  const riscoGeral = RISCO_MAP[String(parsed.riscoGeral)] ?? null;
  const partes = Array.isArray(parsed.partes)
    ? parsed.partes.filter((p): p is string => typeof p === "string")
    : [];

  const createData = {
    nomeArquivo: data.nomeArquivo,
    tipoContrato: data.tipoContrato,
    tipoDetectado: typeof parsed.tipoDetectado === "string" ? parsed.tipoDetectado : null,
    partes,
    prazo: typeof parsed.prazo === "string" ? parsed.prazo : null,
    valor: typeof parsed.valor === "string" ? parsed.valor : null,
    reajuste: typeof parsed.reajuste === "string" ? parsed.reajuste : null,
    riscoGeral,
    resumo: typeof parsed.resumo === "string" ? parsed.resumo : null,
    resultado: parsed as Prisma.InputJsonValue,
    textoAnalisado: data.texto ? data.texto.slice(0, 12000) : null,
    empresaId: data.empresaId,
    oportunidadeId: data.oportunidadeId,
    filialId: authResult.filialId ?? undefined,
    createdById: authResult.id,
  };

  try {
    const analise = await prisma.analiseContrato.create({
      data: createData,
      select: analiseSelect,
    });

    await auditLog({
      action: "ANALISE_CONTRATO_CREATED",
      entity: "AnaliseContrato",
      entityId: analise.id,
      after: analise,
      userId: authResult.id,
      request,
    });

    return NextResponse.json({ ...analise, persistido: true }, { status: 201 });
  } catch (error) {
    // A análise foi feita com sucesso mesmo que o registro não tenha sido salvo —
    // devolvemos o resultado ao usuário para não perder o trabalho da IA.
    console.error("Erro ao salvar analise de contrato:", error);
    return NextResponse.json(
      {
        id: null,
        persistido: false,
        message: "Análise concluída, mas não foi possível salvar no histórico.",
        nomeArquivo: createData.nomeArquivo,
        tipoContrato: createData.tipoContrato,
        tipoDetectado: createData.tipoDetectado,
        partes: createData.partes,
        prazo: createData.prazo,
        valor: createData.valor,
        reajuste: createData.reajuste,
        riscoGeral: createData.riscoGeral,
        resumo: createData.resumo,
        resultado: parsed,
        createdAt: new Date().toISOString(),
        empresa: null,
        oportunidade: null,
        createdBy: null,
      },
      { status: 201 },
    );
  }
}
