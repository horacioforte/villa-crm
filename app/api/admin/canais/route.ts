// ARQUIVO: app/api/admin/canais/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Endpoint de diagnóstico e administração dos canais WhatsApp cadastrados no banco.
// GET → lista todos os canais com tipo, instanceName, ativo, phoneNumberId
// PATCH → atualiza o tipo de um canal (body: { id, tipo })

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const canais = await prisma.canalWhatsapp.findMany({
    select: {
      id: true,
      instanceName: true,
      tipo: true,
      ativo: true,
      phoneNumberId: true,
      accessTokenEnvVar: true,
      agenteIA: true,
      _count: { select: { conversas: true } },
    },
    orderBy: { instanceName: "asc" },
  });

  return NextResponse.json(canais);
}

export async function POST(req: NextRequest) {
  // Upsert idempotente do canal da Maria (equivalente a scripts/backfill-canal-maria.ts --apply)
  // Cria o canal se não existir; atualiza phoneNumberId se já existir mas estiver nulo.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { instanceName, nome, tipo, agenteIA, accessTokenEnvVar, verifyTokenEnvVar, appSecretEnvVar, phoneNumberId } = body as {
    instanceName?: string;
    nome?: string;
    tipo?: string;
    agenteIA?: string | null;
    accessTokenEnvVar?: string;
    verifyTokenEnvVar?: string;
    appSecretEnvVar?: string;
    phoneNumberId?: string;
  };

  if (!instanceName) return NextResponse.json({ error: "instanceName é obrigatório." }, { status: 400 });

  const existente = await prisma.canalWhatsapp.findUnique({ where: { instanceName } });

  if (existente) {
    // Atualiza apenas campos nulos para não sobrescrever configuração existente
    const updates: Record<string, unknown> = {};
    if (!existente.phoneNumberId && phoneNumberId) updates.phoneNumberId = phoneNumberId;
    if (!existente.accessTokenEnvVar && accessTokenEnvVar) updates.accessTokenEnvVar = accessTokenEnvVar;
    if (!existente.verifyTokenEnvVar && verifyTokenEnvVar) updates.verifyTokenEnvVar = verifyTokenEnvVar;
    if (!existente.appSecretEnvVar && appSecretEnvVar) updates.appSecretEnvVar = appSecretEnvVar;

    const canal = Object.keys(updates).length
      ? await prisma.canalWhatsapp.update({ where: { instanceName }, data: updates, select: { id: true, instanceName: true, tipo: true, ativo: true, phoneNumberId: true, accessTokenEnvVar: true } })
      : existente;
    return NextResponse.json({ action: "already_exists", canal });
  }

  const canal = await prisma.canalWhatsapp.create({
    data: {
      nome: nome ?? instanceName,
      tipo: (tipo ?? "META_CLOUD_API") as never,
      instanceName,
      phoneNumberId: phoneNumberId ?? process.env.MARIA_META_PHONE_NUMBER_ID ?? null,
      accessTokenEnvVar: accessTokenEnvVar ?? "MARIA_META_ACCESS_TOKEN",
      verifyTokenEnvVar: verifyTokenEnvVar ?? "MARIA_META_VERIFY_TOKEN",
      appSecretEnvVar: appSecretEnvVar ?? "META_APP_SECRET",
      agenteIA: agenteIA ?? null,
      ativo: true,
    },
    select: { id: true, instanceName: true, tipo: true, ativo: true, phoneNumberId: true, accessTokenEnvVar: true },
  });

  return NextResponse.json({ action: "created", canal }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, tipo, phoneNumberId, accessTokenEnvVar, ativo } = body as {
    id?: string;
    tipo?: string;
    phoneNumberId?: string;
    accessTokenEnvVar?: string;
    ativo?: boolean;
  };

  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const canal = await prisma.canalWhatsapp.update({
    where: { id },
    data: {
      ...(tipo !== undefined ? { tipo: tipo as never } : {}),
      ...(phoneNumberId !== undefined ? { phoneNumberId } : {}),
      ...(accessTokenEnvVar !== undefined ? { accessTokenEnvVar } : {}),
      ...(ativo !== undefined ? { ativo } : {}),
    },
    select: { id: true, instanceName: true, tipo: true, ativo: true, phoneNumberId: true, accessTokenEnvVar: true },
  });

  return NextResponse.json(canal);
}
