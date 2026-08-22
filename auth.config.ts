import type { NextAuthConfig } from "next-auth";

const publicRoutes = [
  "/login",
  "/diagnostico-central-de-concreto",
  "/api/contato",
  "/api/webhook/site",
  "/api/webhook/whatsapp",
  "/api/webhook/whatsapp/joao",
  "/api/webhook/whatsapp/maria",
  "/api/webhook/whatsapp/meta",
  "/api/email/cron",
  "/api/email/processar",
];
const publicRoutePrefixes = ["/api/webhook/whatsapp/contexto/", "/api/agent/", "/api/cron/"];
const authSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "villa-crm-development-secret";

function getAuthBaseUrl(baseUrl: string) {
  const candidates = [process.env.AUTH_URL, process.env.NEXTAUTH_URL, baseUrl];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return new URL(candidate).toString();
    } catch {
      // Ignora valores mascarados/inválidos vindos do ambiente (ex.: https://[SENSITIVE]).
    }
  }

  return baseUrl;
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
        publicRoutes.includes(pathname) ||
        publicRoutePrefixes.some((route) => pathname.startsWith(route)) ||
        pathname.startsWith("/api/auth");

      if (isPublicRoute) {
        return true;
      }

      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;
