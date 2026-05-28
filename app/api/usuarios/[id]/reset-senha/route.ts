import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sanitizeUsuario } from "@/lib/usuarios";
import { resetSenhaSchema } from "@/lib/validations/usuario";

type ResetSenhaRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: ResetSenhaRouteContext) {
  const authResult = await requirePermission("usuarios", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = resetSenhaSchema.parse(await request.json());
    const before = await prisma.usuario.findUnique({
      where: {
        id,
      },
    });

    if (!before) {
      return NextResponse.json(
        { message: "Usuario nao encontrado." },
        { status: 404 },
      );
    }

    const senhaHash = await bcrypt.hash(data.senha, 12);
    const usuario = await prisma.usuario.update({
      where: {
        id,
      },
      data: {
        senhaHash,
      },
      include: {
        filial: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    const safeUsuario = sanitizeUsuario(usuario);

    await auditLog({
      action: "USUARIO_PASSWORD_RESET",
      entity: "Usuario",
      entityId: usuario.id,
      before: sanitizeUsuario(before),
      after: safeUsuario,
      metadata: {
        resetBy: authResult.id,
      },
      userId: authResult.id,
      request,
    });

    return NextResponse.json(safeUsuario);
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

    return NextResponse.json(
      { message: "Nao foi possivel resetar a senha." },
      { status: 500 },
    );
  }
}
