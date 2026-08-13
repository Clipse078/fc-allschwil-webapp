/**
 * Simple in-process sliding-window rate limiter.
 *
 * Suitable for the password-reset endpoint where the goal is abuse
 * protection without adding an external dependency (Redis, Upstash, etc.).
 *
 * Limitations:
 *   - Not shared across serverless function instances. Use a persistent
 *     store (Redis) for stricter enforcement in multi-instance deployments.
 *   - State is lost on process restart.
 *
 * These limitations are acceptable for the password-reset use-case: the
 * opaque response design and email delivery delay already provide the
 * primary abuse protection; the rate limiter prevents high-volume
 * enumeration from a single origin.
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
 * @param key        Identifier, typically IP address or email.
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
