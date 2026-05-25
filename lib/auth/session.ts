import { NextResponse } from "next/server";

import type { PapelUsuario } from "@/app/generated/prisma/client";
import { auth } from "@/auth";
import { auditLog } from "@/lib/audit";
import { can, type Action, type Resource } from "@/lib/auth/permissions";

export type AuthenticatedUser = {
  id: string;
  nome?: string | null;
  email?: string | null;
  papel: PapelUsuario;
  filialId?: string | null;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();

  if (!session?.user?.id || !session.user.papel) {
    return null;
  }

  return {
    id: session.user.id,
    nome: session.user.name,
    email: session.user.email,
    papel: session.user.papel,
    filialId: session.user.filialId,
  };
}

export async function requireAuth(request?: Request) {
  const user = await getCurrentUser();

  if (!user) {
    await auditLog({
      action: "AUTH_REQUIRED",
      entity: "Auth",
      request,
    });

    return NextResponse.json(
      { message: "Autenticacao obrigatoria." },
      { status: 401 },
    );
  }

  return user;
}

export async function requirePermission(
  resource: Resource,
  action: Action,
  request?: Request,
) {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!can(authResult.papel, resource, action)) {
    await auditLog({
      action: "PERMISSION_DENIED",
      entity: resource,
      metadata: {
        action,
        role: authResult.papel,
      },
      userId: authResult.id,
      request,
    });

    return NextResponse.json(
      { message: "Voce nao tem permissao para executar esta acao." },
      { status: 403 },
    );
  }

  return authResult;
}
