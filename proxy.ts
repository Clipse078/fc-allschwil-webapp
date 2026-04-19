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

export const proxy = auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isLoggedIn = Boolean(request.auth?.user);

  if (pathname === LOGIN_PATH && isLoggedIn) {
    return NextResponse.redirect(new URL(DEFAULT_AUTHENTICATED_PATH, request.nextUrl));
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (isLoggedIn) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, request.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);

  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/vereinsleitung/:path*"],
};
