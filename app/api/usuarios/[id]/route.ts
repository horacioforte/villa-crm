import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sanitizeUsuario } from "@/lib/usuarios";
import { usuarioPatchSchema } from "@/lib/validations/usuario";

type UsuarioRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: UsuarioRouteContext) {
  const authResult = await requirePermission("usuarios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  const usuario = await prisma.usuario.findUnique({
    where: {
      id,
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

  if (!usuario) {
    return NextResponse.json(
      { message: "Usuario nao encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(sanitizeUsuario(usuario));
}

export async function PATCH(request: Request, context: UsuarioRouteContext) {
  const authResult = await requirePermission("usuarios", "update", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  try {
    const data = usuarioPatchSchema.parse(await request.json());
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
      data,
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
      action: "USUARIO_UPDATED",
      entity: "Usuario",
      entityId: usuario.id,
      before: safeBefore,
      after: safeUsuario,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(safeUsuario);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Dados invalidos.",
          errors: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Nao foi possivel editar o usuario." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: UsuarioRouteContext) {
  const authResult = await requirePermission("usuarios", "delete", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { id } = await context.params;

  if (id === authResult.id) {
    return NextResponse.json(
      { message: "Voce nao pode desativar seu proprio usuario." },
      { status: 400 },
    );
  }

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
        ativo: false,
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
      action: "USUARIO_DEACTIVATED",
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
      { message: "Nao foi possivel desativar o usuario." },
      { status: 500 },
    );
  }
}
