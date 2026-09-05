/**
 * Best-effort in-process sliding-window rate limiter.
 *
 * Classification: BEST-EFFORT — NOT robust distributed rate limiting.
 *
 * Limitations (known and accepted for this slice):
 *   - State is NOT shared across Vercel serverless function instances.
 *     A high-volume attacker can bypass this limiter by distributing
 *     requests across different cold-start instances.
 *   - State is lost on process restart.
 *
 * Why this is retained rather than removed:
 *   - Provides lightweight protection against single-origin burst abuse
 *     even within a single instance lifetime.
 *   - The primary abuse controls are the opaque response design and the
 *     email delivery delay — the rate limiter is additive, not primary.
 *   - Introducing a shared store (Redis/Upstash) solely for this endpoint
 *     is disproportionate without existing infrastructure.
 *
 * Primary distributed protection is Vercel WAF rate limiting — see
 * docs/security/vercel-auth-rate-limits.md and lib/security/abuse-policy.ts.
 *
 * This module remains a defense-in-depth fallback within a single instance.
 */

type Bucket = {
  count: number;
  windowStart: number;
};

const store = new Map<string, Bucket>();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Check whether a given key has exceeded the allowed number of requests
 * within the sliding window.
 *
 * @param key        Identifier, typically IP address.
 * @param limit      Maximum requests per window (default 5).
 * @param windowMs   Window duration in ms (default 15 minutes).
 */
export function checkRateLimit(
  key: string,
  limit = 5,
  windowMs = 15 * 60 * 1000,
): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    const retryAfterMs = windowMs - (now - bucket.windowStart);
    return { allowed: false, retryAfterMs };
  }

  bucket.count += 1;
  return { allowed: true };
}
