import type { NextRequest } from "next/server";

/** Stable fallback when no trusted proxy identity is available. */
export const UNKNOWN_CLIENT_IP = "unknown";

/**
 * Extract the client IP from a request behind Vercel / trusted reverse proxies.
 *
 * Vercel sets `x-forwarded-for` with the client IP as the first hop.
 * We parse only the first entry and do not trust arbitrary forwarding chains
 * beyond the platform model.
 *
 * Server-only — do not import from client components.
 */
export function getClientIp(request: Pick<NextRequest, "headers">): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return UNKNOWN_CLIENT_IP;
}
