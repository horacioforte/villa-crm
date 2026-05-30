import type { NextAuthConfig } from "next-auth";

const publicRoutes = ["/login"];
const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "villa-crm-development-secret";

function getAuthBaseUrl(baseUrl: string) {
  return process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? baseUrl;
}

export const authConfig = {
  secret: authSecret,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      const authBaseUrl = getAuthBaseUrl(baseUrl);

      if (url.startsWith("/")) {
        return new URL(url, authBaseUrl).toString();
      }

      try {
        const targetUrl = new URL(url);
        const allowedOrigin = new URL(authBaseUrl).origin;

        if (targetUrl.origin === allowedOrigin) {
          return targetUrl.toString();
        }
      } catch {
        return authBaseUrl;
      }

      return authBaseUrl;
    },
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
