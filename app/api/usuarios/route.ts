import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { sanitizeUsuario } from "@/lib/usuarios";
import { usuarioCreateSchema } from "@/lib/validations/usuario";

export async function GET(request: Request) {
  const authResult = await requirePermission("usuarios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const usuarios = await prisma.usuario.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      ativo: true,
      filialId: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      filial: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  });

  return NextResponse.json(usuarios);
}

export async function POST(request: Request) {
  const authResult = await requirePermission("usuarios", "create", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const data = usuarioCreateSchema.parse(await request.json());
    const senhaHash = await bcrypt.hash(data.senha, 12);

    const usuario = await prisma.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senhaHash,
        papel: data.papel,
        filialId: data.filialId,
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

    const safeUsuario = sanitizeUsuario(usuario);

    await auditLog({
      action: "USUARIO_CREATED",
      entity: "Usuario",
      entityId: usuario.id,
      after: safeUsuario,
      userId: authResult.id,
      request,
    });

    return NextResponse.json(safeUsuario, { status: 201 });
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

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Ja existe um usuario com este e-mail." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { message: "Nao foi possivel criar o usuario." },
      { status: 500 },
    );
  }
}
