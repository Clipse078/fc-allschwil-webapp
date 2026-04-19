import { NextResponse } from "next/server";
import { auth } from "@/auth";

const LOGIN_PATH = "/login";
const DEFAULT_AUTHENTICATED_PATH = "/dashboard";
const PROTECTED_PREFIXES = ["/dashboard", "/vereinsleitung"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

const proxyHandler = auth((request) => {
  const { nextUrl, auth: session } = request;
  const pathname = nextUrl.pathname;
  const isLoggedIn = Boolean(session?.user);

  if (pathname === LOGIN_PATH && isLoggedIn) {
    return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_PATH, nextUrl));
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (isLoggedIn) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, nextUrl);
  const callbackTarget = pathname + nextUrl.search;

  loginUrl.searchParams.set("callbackUrl", callbackTarget);

  return NextResponse.redirect(loginUrl);
});

export function proxy(request: Request) {
  return proxyHandler(request as Parameters<typeof proxyHandler>[0]);
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/vereinsleitung/:path*"],
};
