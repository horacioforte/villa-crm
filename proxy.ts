import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const publicRoutes = ["/login", "/api/agent"];

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = Boolean(request.auth?.user);
  const isPublicRoute =
    publicRoutes.includes(pathname) || pathname.startsWith("/api/auth");
  const isApiRoute = pathname.startsWith("/api");

  if (isPublicRoute && isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (isApiRoute) {
      return NextResponse.json(
        { message: "Autenticacao obrigatoria." },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.href);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
