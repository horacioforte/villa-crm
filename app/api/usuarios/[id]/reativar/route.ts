import { NextResponse } from "next/server";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sanitizeUsuario } from "@/lib/usuarios";

type ReativarUsuarioRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  context: ReativarUsuarioRouteContext,
) {
  const authResult = await requirePermission("usuarios", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
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

    const usuario = await prisma.usuario.update({
      where: {
        id,
      },
      data: {
        ativo: true,
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

    const safeBefore = sanitizeUsuario(before);
    const safeUsuario = sanitizeUsuario(usuario);

    await auditLog({
      action: "USUARIO_REACTIVATED",
      entity: "Usuario",
      entityId: usuario.id,
      before: safeBefore,
      after: safeUsuario,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(safeUsuario);
  } catch {
    return NextResponse.json(
      { message: "Nao foi possivel reativar o usuario." },
      { status: 500 },
    );
  }
}
