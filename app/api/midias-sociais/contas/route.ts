import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { Prisma } from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { criarRedeSocialContaSchema } from "@/lib/validations/rede-social";

const redeSocialContaSelect = {
  id: true,
  rede: true,
  nome: true,
  businessId: true,
  pageId: true,
  contaAnunciosId: true,
  accessTokenEnvVar: true,
  ativo: true,
  statusConexao: true,
  ultimaSincronizacaoEm: true,
  ultimoErro: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, nome: true } },
} satisfies Prisma.RedeSocialContaSelect;

export async function GET(request: Request) {
  const authResult = await requirePermission("midias_sociais", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const contas = await prisma.redeSocialConta.findMany({
    orderBy: { rede: "asc" },
    select: redeSocialContaSelect,
  });

  return NextResponse.json(contas);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("midias_sociais", "create", request);
  if (authResult instanceof NextResponse) return authResult;

  let data: ReturnType<typeof criarRedeSocialContaSchema.parse>;
  try {
    data = criarRedeSocialContaSchema.parse(await request.json());
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

  try {
    const conta = await prisma.redeSocialConta.create({
      data: {
        rede: data.rede,
        nome: data.nome,
        businessId: data.businessId ?? null,
        pageId: data.pageId ?? null,
        contaAnunciosId: data.contaAnunciosId ?? null,
        accessTokenEnvVar: data.accessTokenEnvVar ?? null,
        createdById: authResult.id,
      },
      select: redeSocialContaSelect,
    });

    await auditLog({
      action: "REDE_SOCIAL_CONTA_CREATED",
      entity: "RedeSocialConta",
      entityId: conta.id,
      after: conta,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(conta, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: `Já existe uma conta cadastrada para ${data.rede}.` },
        { status: 409 },
      );
    }

    console.error("Erro ao registrar conta de rede social:", error);
    return NextResponse.json(
      { message: "Não foi possível registrar a conta." },
      { status: 500 },
    );
  }
}
