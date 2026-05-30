import type { NextAuthConfig } from "next-auth";

const publicRoutes = ["/login"];
const authSecret = process.env.AUTH_SECRET ?? "villa-crm-development-secret";

export const authConfig = {
  secret: authSecret,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublicRoute =
        publicRoutes.includes(pathname) || pathname.startsWith("/api/auth");

      if (isPublicRoute) {
        return true;
      }

      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;
