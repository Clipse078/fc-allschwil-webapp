import { NextResponse } from "next/server";

/** Generic, non-enumerating message for security-sensitive rate limits. */
export const GENERIC_RATE_LIMIT_MESSAGE =
  "Zu viele Anfragen. Bitte versuche es später erneut.";

/**
 * Build a canonical 429 response for abuse-protection surfaces.
 *
 * Never exposes internal rule names, counters, emails, user IDs, tenant IDs,
 * or IP addresses.
 */
export function createRateLimitResponse(
  retryAfterMs: number,
  body: Record<string, unknown> = { error: GENERIC_RATE_LIMIT_MESSAGE },
): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

  return NextResponse.json(body, {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

/**
 * Convert a retry-after duration in milliseconds to whole seconds for headers.
 */
export function retryAfterSecondsFromMs(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}
