import { handlers } from "@/auth";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/security/client-ip";
import { checkApplicationRateLimit } from "@/lib/security/abuse-policy";
import { createRateLimitResponse } from "@/lib/security/rate-limit-response";

/**
 * Auth.js App Router entrypoint.
 *
 * Credentials login POSTs to /api/auth/callback/credentials (and related
 * sign-in paths). Application-layer burst limiting complements Vercel WAF.
 */
export async function GET(req: NextRequest) {
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isCredentialsLogin =
    pathname.endsWith("/callback/credentials") || pathname.endsWith("/signin/credentials");

  if (isCredentialsLogin) {
    const rateCheck = checkApplicationRateLimit("login", getClientIp(req));
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterMs);
    }
  }

  return handlers.POST(req);
}
