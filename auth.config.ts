import type { NextAuthConfig } from "next-auth";

const publicRoutes = ["/login"];

export const authConfig = {
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
