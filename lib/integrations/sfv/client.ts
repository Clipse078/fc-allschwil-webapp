/**
 * lib/integrations/sfv/client.ts
 *
 * Server-only SFV / ClubCorner authentication adapter.
 *
 * SECURITY RULES (enforced throughout this module):
 *   - Token values are never returned to the browser or logged.
 *   - Authorization headers are never included in error messages.
 *   - Raw upstream response bodies are never surfaced in errors.
 *   - No token persistence in database or browser storage.
 *   - Retry only on safe transient failures; never retry 401/403.
 *
 * AUTHENTICATION CONTRACT (SFV ClubCorner API — confirmed from Swagger):
 *   POST /api/token
 *   Content-Type: application/json
 *   Body: { "applicationKey": "<key>", "applicationPass": "<pass>" }
 *   Success: HTTP 200, Content-Type: text/plain, body is the raw session-token string
 *   Failure: HTTP 401 (authentication failure), HTTP 500 (server error)
 *   Token validity: 30 minutes initial; extended on each valid authenticated request.
 *   No expiry timestamp is returned in the response.
 */

import { getSfvConfig, type SfvConfig } from "./config";
import {
  SfvError,
  SfvAuthError,
  SfvNetworkError,
  toSafePublicError,
  isRetryableSfvError,
  type SfvErrorCode,
} from "./errors";

// ── Token cache ───────────────────────────────────────────────────────────────

/**
 * Parsed token held in memory. Never persisted to database or browser storage.
 *
 * `expiresAt` reflects the LOCAL CACHE POLICY only — the SFV API does not
 * return an expiry timestamp. This field must NOT be surfaced in API responses
 * as if it were an SFV-supplied expiry.
 */
type CachedToken = {
  token: string;
  /**
   * Local cache expiry. Set to LOCAL_TOKEN_CACHE_MAX_AGE_MS from acquisition
   * time. This is a local policy — not derived from or implied by the SFV API.
   */
  expiresAt: Date;
};

let cachedToken: CachedToken | null = null;

/**
 * In-flight deduplication: while a token request is in progress, further callers
 * await the same promise instead of issuing parallel requests.
 */
let inflight: Promise<CachedToken> | null = null;

/**
 * Local maximum token cache age in milliseconds.
 * Conservative — shorter than the documented 30-minute initial SFV token validity.
 * This is a LOCAL CACHE POLICY. The SFV API does not return an expiry timestamp.
 * Actual server-side validity is 30 minutes; extended on each valid API request.
 */
const LOCAL_TOKEN_CACHE_MAX_AGE_MS = 20 * 60 * 1000; // 20 minutes

/** Seconds before local cache expiry to proactively refresh the token. */
const EXPIRY_BUFFER_SECONDS = 60;

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Maximum retry attempts for transient failures (not authentication failures). */
const MAX_RETRIES = 2;

/** Base delay in milliseconds for retry backoff. */
const RETRY_BASE_DELAY_MS = 500;

// ── Token request ─────────────────────────────────────────────────────────────

/**
 * Executes the authenticated token request to the SFV ClubCorner API.
 *
 * Contract (confirmed from official SFV Swagger documentation):
 *   - Method: POST
 *   - Content-Type: application/json
 *   - Body fields: applicationKey, applicationPass (exact names per Swagger)
 *   - Success: HTTP 200, text/plain body containing the raw session token
 *   - HTTP 401: authentication failure
 *   - HTTP 500: server error
 *
 * Security invariants:
 *   - Never logs the request body or credential values.
 *   - Never includes Authorization header values in thrown errors.
 *   - Applies REQUEST_TIMEOUT_MS; AbortError maps to SFV_TIMEOUT.
 */
async function executeTokenRequest(config: SfvConfig): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        applicationKey: config.applicationKey,
        applicationPass: config.applicationPass,
      }),
      signal: controller.signal,
    });

    if (response.status === 401) {
      throw new SfvAuthError("SFV_UNAUTHORIZED", "SFV token request rejected: 401 Unauthorized.");
    }
    if (response.status === 403) {
      throw new SfvAuthError("SFV_FORBIDDEN", "SFV token request rejected: 403 Forbidden.");
    }
    if (response.status === 429) {
      throw new SfvNetworkError(
        "SFV_RATE_LIMITED",
        "SFV token endpoint returned 429 Too Many Requests.",
      );
    }
    if (!response.ok) {
      throw new SfvNetworkError(
        "SFV_UNAVAILABLE",
        `SFV token endpoint returned HTTP ${response.status}.`,
      );
    }

    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!trimmed) {
      throw new SfvNetworkError(
        "SFV_INVALID_RESPONSE",
        "SFV token response did not contain a valid token.",
      );
    }

    return trimmed;
  } catch (error) {
    if (error instanceof SfvError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SfvNetworkError("SFV_TIMEOUT", "SFV token request timed out.");
    }
    throw new SfvNetworkError("SFV_UNAVAILABLE", "SFV token request failed: network error.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function isTokenExpired(cached: CachedToken): boolean {
  const bufferMs = EXPIRY_BUFFER_SECONDS * 1000;
  return cached.expiresAt.getTime() - bufferMs <= Date.now();
}

// ── Retry logic ───────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireTokenWithRetry(config: SfvConfig): Promise<CachedToken> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = await executeTokenRequest(config);
      return {
        token,
        expiresAt: new Date(Date.now() + LOCAL_TOKEN_CACHE_MAX_AGE_MS),
      };
    } catch (error) {
      lastError = error;

      const safe = toSafePublicError(error);

      if (!isRetryableSfvError(safe.code as SfvErrorCode)) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

// ── Public adapter interface ──────────────────────────────────────────────────

/**
 * Acquires a valid SFV access token.
 *
 * Uses in-memory caching governed by LOCAL_TOKEN_CACHE_MAX_AGE_MS (20 minutes).
 * This is a local policy: the SFV API does not return an expiry timestamp.
 * Concurrent callers await the same inflight request to prevent parallel fetches.
 *
 * Throws a typed SfvError on failure. Never returns the token to the browser.
 * Callers must use the token server-side only.
 */
export async function acquireToken(): Promise<CachedToken> {
  if (cachedToken && !isTokenExpired(cachedToken)) {
    return cachedToken;
  }

  if (inflight) {
    return inflight;
  }

  const config = getSfvConfig();

  inflight = acquireTokenWithRetry(config).then(
    (result) => {
      cachedToken = result;
      inflight = null;
      return result;
    },
    (error) => {
      inflight = null;
      throw error;
    },
  );

  return inflight;
}

/**
 * Evicts the cached token. Used after a 401 response to force re-authentication
 * on the next call to acquireToken().
 */
export function evictCachedToken(): void {
  cachedToken = null;
  inflight = null;
}

/**
 * Returns the local-policy expiry of the cached token, or null if none is cached.
 *
 * IMPORTANT: This reflects a LOCAL CACHE POLICY, not an SFV-provided expiry.
 * Do not surface this value in API responses as if it were an SFV-supplied timestamp.
 * Safe to use for internal cache management decisions only.
 */
export function getCachedTokenExpiresAt(): Date | null {
  return cachedToken?.expiresAt ?? null;
}

/**
 * Returns true if a non-expired token is currently cached.
 * Safe to include in API responses — contains no credential material.
 */
export function hasCachedToken(): boolean {
  return cachedToken !== null && !isTokenExpired(cachedToken);
}

/**
 * Tests the SFV connection by acquiring a token.
 * Returns a sanitized result object suitable for the API response.
 *
 * tokenExpiresAt is always null: the SFV API does not return an expiry timestamp,
 * and the local cache deadline must not be presented as an SFV-supplied value.
 *
 * Never includes the token, application key, password, or Authorization header.
 */
export async function testSfvConnection(): Promise<{
  connected: boolean;
  tokenValid: boolean;
  tokenExpiresAt: null;
  testedAt: string;
  error: { code: string; message: string } | null;
}> {
  const testedAt = new Date().toISOString();

  evictCachedToken();

  try {
    await acquireToken();

    return {
      connected: true,
      tokenValid: true,
      tokenExpiresAt: null,
      testedAt,
      error: null,
    };
  } catch (error) {
    const safe = toSafePublicError(error);

    return {
      connected: false,
      tokenValid: false,
      tokenExpiresAt: null,
      testedAt,
      error: { code: safe.code, message: safe.message },
    };
  }
}
