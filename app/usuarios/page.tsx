import { redirect } from "next/navigation";

import { UsuariosClient } from "@/components/usuarios/UsuariosClient";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function UsuariosPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.papel !== "ADMIN") {
    redirect("/");
  }

  const [usuarios, filiais] = await Promise.all([
    prisma.usuario.findMany({
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
    }),
    prisma.filial.findMany({
      where: {
        ativa: true,
      },
      orderBy: {
        nome: "asc",
      },
      select: {
        id: true,
        nome: true,
      },
    }),
  ]);

  return (
    <UsuariosClient
      initialUsuarios={usuarios}
      filiais={filiais}
      currentUserId={currentUser.id}
    />
  );
}
