import type { DefaultSession } from "next-auth";
import type { PapelUsuario } from "@/app/generated/prisma/client";

declare module "next-auth" {
  interface User {
    id: string;
    papel: PapelUsuario;
    filialId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      papel: PapelUsuario;
      filialId?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    papel: PapelUsuario;
    filialId?: string | null;
  }
}
