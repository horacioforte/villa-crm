import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import type { PapelUsuario } from "@/app/generated/prisma/client";
import { authConfig } from "@/auth.config";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? "villa-crm-development-secret",
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          await auditLog({
            action: "LOGIN_INVALID_PAYLOAD",
            entity: "Usuario",
            metadata: { reason: "invalid_credentials_payload" },
          });
          return null;
        }

        const usuario = await prisma.usuario.findUnique({
          where: {
            email: parsed.data.email.toLowerCase(),
          },
        });

        if (!usuario?.senhaHash || !usuario.ativo) {
          await auditLog({
            action: usuario?.ativo === false ? "LOGIN_INACTIVE_USER" : "LOGIN_USER_NOT_FOUND",
            entity: "Usuario",
            entityId: usuario?.id,
            metadata: { email: parsed.data.email },
            userId: usuario?.id,
          });
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          parsed.data.senha,
          usuario.senhaHash,
        );

        if (!isValidPassword) {
          await auditLog({
            action: "LOGIN_INVALID_PASSWORD",
            entity: "Usuario",
            entityId: usuario.id,
            metadata: { email: parsed.data.email },
            userId: usuario.id,
          });
          return null;
        }

        await prisma.usuario.update({
          where: {
            id: usuario.id,
          },
          data: {
            lastLoginAt: new Date(),
          },
        });

        await auditLog({
          action: "LOGIN_SUCCESS",
          entity: "Usuario",
          entityId: usuario.id,
          userId: usuario.id,
        });

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
          filialId: usuario.filialId,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.papel = user.papel;
        token.filialId = user.filialId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id);
        session.user.papel = token.papel as PapelUsuario;
        session.user.filialId = token.filialId as string | null | undefined;
      }

      return session;
    },
  },
});
