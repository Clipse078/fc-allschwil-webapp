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

/**
 * User-Agent sent with every SFV API request.
 *
 * The SFV ClubCorner API is fronted by Cloudflare. Requests without a
 * User-Agent header are blocked at the CDN layer with HTTP 403 (Cloudflare
 * error code 1010 — bot/IP access denied) before reaching the origin server.
 * A recognisable User-Agent is required for requests to reach the SFV API.
 *
 * Confirmed by live test (2026-07-11): without this header the production
 * Cloudflare layer returns 403 before the request reaches the SFV origin.
 */
const SFV_USER_AGENT = "fc-allschwil-webapp/0.1 (SFV-Integration)";

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
        "User-Agent": SFV_USER_AGENT,
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

// ── Business data types (Slice 2) ─────────────────────────────────────────────

/**
 * Represents a single player record returned by GET /api/club/{clubId}/players.
 *
 * All nullable fields may be absent from the upstream response; the contract
 * is defined by the official SFV Club API Interface OpenAPI v26.6.15.2 spec.
 * Personal data (email1, email2, tel1, tel2, birthDate) is handled server-side
 * only and must never be forwarded to the browser.
 */
export type ClubPlayer = {
  personId: number;
  playerId: number;
  /** 1 = male, 2 = female (SFV Gender enum). */
  gender: 1 | 2;
  name: string | null;
  secondName: string | null;
  firstname: string | null;
  /** ISO 8601 date-time string, or null. Personal data — server-side only. */
  birthDate: string | null;
  /** Personal data — server-side only. */
  email1: string | null;
  /** Personal data — server-side only. */
  email2: string | null;
  /** Personal data — server-side only. */
  tel1: string | null;
  /** Personal data — server-side only. */
  tel2: string | null;
  clubOwnerId: number | null;
  clubOwnerName: string | null;
  clubOwnerNumber: number | null;
  qualificationType: number;
  qualificationTypeText: string | null;
  licenceType: number;
  licenceTypeText: string | null;
  playerState: number | null;
  playerStateText: string | null;
  /** ISO 8601 date-time string. */
  dateOfEntry: string;
};

// ── Club players request (Slice 2) ────────────────────────────────────────────

/**
 * Executes a read-only GET /api/club/{clubId}/players request.
 *
 * Contract (confirmed from SFV Club API Interface OpenAPI v26.6.15.2):
 *   Method:  GET
 *   Path:    /api/club/{clubId}/players
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — SFV_USER_AGENT (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: application/json — ClubPlayer[]
 *   401: SFV_UNAUTHORIZED (token invalid; cached token is evicted)
 *   403: SFV_FORBIDDEN
 *   404: SFV_NOT_FOUND
 *   429: SFV_RATE_LIMITED
 *   5xx: SFV_UNAVAILABLE
 *
 * Security invariants:
 *   - Token is never included in thrown errors or logs.
 *   - clubId is validated as non-empty numeric before the request is sent.
 *   - No data is persisted.
 */
async function executeClubPlayersRequest(
  config: SfvConfig,
  token: string,
): Promise<ClubPlayer[]> {
  const baseUrl = new URL(config.tokenUrl).origin;
  const url = `${baseUrl}/api/club/${encodeURIComponent(config.clubId)}/players`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-User-Token": token,
        "User-Agent": SFV_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 401) {
      evictCachedToken();
      throw new SfvAuthError(
        "SFV_UNAUTHORIZED",
        "SFV club players request rejected: 401 Unauthorized.",
      );
    }
    if (response.status === 403) {
      throw new SfvAuthError(
        "SFV_FORBIDDEN",
        "SFV club players request rejected: 403 Forbidden.",
      );
    }
    if (response.status === 404) {
      throw new SfvNetworkError(
        "SFV_NOT_FOUND",
        "SFV club players: club not found (404).",
      );
    }
    if (response.status === 429) {
      throw new SfvNetworkError(
        "SFV_RATE_LIMITED",
        "SFV club players endpoint returned 429 Too Many Requests.",
      );
    }
    if (!response.ok) {
      throw new SfvNetworkError(
        "SFV_UNAVAILABLE",
        `SFV club players endpoint returned HTTP ${response.status}.`,
      );
    }

    const rawText = await response.text();
    if (!rawText.trim()) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new SfvNetworkError(
        "SFV_INVALID_RESPONSE",
        "SFV club players response is not valid JSON.",
      );
    }

    if (!Array.isArray(parsed)) {
      throw new SfvNetworkError(
        "SFV_INVALID_RESPONSE",
        "SFV club players response expected an array.",
      );
    }

    return parsed as ClubPlayer[];
  } catch (error) {
    if (error instanceof SfvError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SfvNetworkError("SFV_TIMEOUT", "SFV club players request timed out.");
    }
    throw new SfvNetworkError(
      "SFV_UNAVAILABLE",
      "SFV club players request failed: network error.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches the list of registered players for the configured club.
 *
 * Endpoint: GET /api/club/{clubId}/players
 * Documented in: SFV Club API Interface OpenAPI v26.6.15.2
 *
 * Uses the in-memory token cache from acquireToken(). On 401, the cache is
 * evicted automatically so the next call will re-authenticate.
 *
 * Returns an empty array when the upstream body is empty (204-equivalent).
 * Never persists data to the database.
 *
 * PERSONAL DATA WARNING: the returned ClubPlayer objects contain personal
 * fields (email1, email2, tel1, tel2, birthDate). Callers must handle these
 * server-side only and must not forward them to the browser.
 */
export async function fetchClubPlayers(): Promise<ClubPlayer[]> {
  const config = getSfvConfig();
  const cached = await acquireToken();
  return executeClubPlayersRequest(config, cached.token);
}

// ── Club identifier resolution (Slice 2b) ────────────────────────────────────

/**
 * Conservative response container for GET /api/common/ids.
 *
 * OpenAPI v26.6.15.2 declares the 200 response body as schema `type: string`.
 * The endpoint summary states "return json with all relevant ids."
 * No named properties or sub-schema are defined in the specification.
 *
 * Both fields are returned so callers can inspect without this layer
 * assuming a concrete shape:
 *   raw    — verbatim response text body, exactly as received.
 *   parsed — result of JSON.parse(raw), or undefined if not parseable.
 */
export type ClubIdsResponse = {
  /** Verbatim text body received from GET /api/common/ids. */
  raw: string;
  /**
   * Result of JSON.parse(raw). Undefined if the body is not valid JSON.
   * The documented schema is type: string; the actual object shape is
   * conservatively left as unknown for caller inspection.
   */
  parsed: unknown;
};

/**
 * Executes a read-only GET /api/common/ids request.
 *
 * Contract (SFV Club API Interface OpenAPI v26.6.15.2):
 *   Method:  GET
 *   Path:    /api/common/ids
 *   Query:   ClubId={clubId} (integer, required — exact casing per spec)
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — SFV_USER_AGENT (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: body declared as type: string; summary implies JSON — both raw and
 *        parsed values are returned for caller inspection.
 *   204: no content found → returns null.
 *   401: session token cannot be validated → SFV_UNAUTHORIZED + evict cache.
 *   404: resource not found → SFV_NOT_FOUND.
 *   5xx and undocumented errors → SFV_UNAVAILABLE.
 *
 * Security invariants:
 *   - Token is never included in thrown errors or logs.
 *   - No data is persisted.
 */
async function executeClubIdsRequest(
  config: SfvConfig,
  token: string,
): Promise<ClubIdsResponse | null> {
  const baseUrl = new URL(config.tokenUrl).origin;
  const url = `${baseUrl}/api/common/ids?ClubId=${encodeURIComponent(config.clubId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-User-Token": token,
        "User-Agent": SFV_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 204) {
      return null;
    }

    if (response.status === 401) {
      evictCachedToken();
      throw new SfvAuthError(
        "SFV_UNAUTHORIZED",
        "SFV common/ids request rejected: 401 Unauthorized.",
      );
    }

    if (response.status === 404) {
      throw new SfvNetworkError(
        "SFV_NOT_FOUND",
        "SFV common/ids: resource not found (404).",
      );
    }

    if (!response.ok) {
      throw new SfvNetworkError(
        "SFV_UNAVAILABLE",
        `SFV common/ids endpoint returned HTTP ${response.status}.`,
      );
    }

    const raw = await response.text();

    let parsed: unknown = undefined;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Body is not JSON-parseable; raw is preserved as-is per conservative contract.
    }

    return { raw, parsed };
  } catch (error) {
    if (error instanceof SfvError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SfvNetworkError("SFV_TIMEOUT", "SFV common/ids request timed out.");
    }
    throw new SfvNetworkError(
      "SFV_UNAVAILABLE",
      "SFV common/ids request failed: network error.",
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolves identifier mappings for the configured club from GET /api/common/ids.
 *
 * Endpoint: GET /api/common/ids?ClubId={SFV_CLUB_ID}
 * Documented in: SFV Club API Interface OpenAPI v26.6.15.2
 *
 * The 200 response schema is declared as type: string. The endpoint summary
 * says "return json with all relevant ids." Because no named properties are
 * defined in the schema, both the raw body and a best-effort parsed value are
 * returned for caller inspection without this layer guessing the shape.
 *
 * Returns null on 204 (no content found).
 * Never persists data. No database reads or writes.
 */
export async function resolveClubIds(): Promise<ClubIdsResponse | null> {
  const config = getSfvConfig();
  const cached = await acquireToken();
  return executeClubIdsRequest(config, cached.token);
}

// ── Team list types and client (Slice 3a) ─────────────────────────────────────

/**
 * Represents a single team returned by GET /api/team/list.
 *
 * All fields match the OpenAPI v26.6.15.2 TeamDetail schema exactly.
 * additionalProperties: false — no extra fields are expected.
 */
export type TeamDetail = {
  isHomeTeam: boolean;
  teamId: number;
  teamName: string | null;
  teamFullname: string | null;
  clubNumber: number;
  clubName: string | null;
  teamLeagueId: number;
  teamLeagueName: string | null;
  teamDivisionName: string | null;
  teamOrganisationId: number;
  isTeamActive: boolean;
};

/**
 * Parameters for GET /api/team/list (OpenAPI v26.6.15.2).
 *
 * SeasonId and ClubId are required. All other parameters are optional query
 * filters. Parameter names preserve exact OpenAPI casing.
 */
export type TeamListParams = {
  SeasonId: number;
  ClubId: number;
  OrganisationId?: number;
  TeamId?: number;
  LeagueId?: number;
  CupId?: number;
  DivisionId?: number;
  GroupId?: number;
  RoundNbr?: number;
  MatchType?: number;
  Language?: number;
  /** ISO 8601 date-time string. */
  DateFrom?: string;
  /** ISO 8601 date-time string. */
  DateUntil?: string;
};

/**
 * Executes a read-only GET /api/team/list request.
 *
 * Contract (SFV Club API Interface OpenAPI v26.6.15.2):
 *   Method:  GET
 *   Path:    /api/team/list
 *   Query:   SeasonId (int32, required), ClubId (int32, required), optional filters
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — SFV_USER_AGENT (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: application/json — TeamDetail[]
 *   204: no content found → returns []
 *   401: session token cannot be validated → SFV_UNAUTHORIZED + evict cache
 *   404: resource not found → SFV_NOT_FOUND
 *   500: unexpected server error → SFV_UNAVAILABLE
 *
 * Security invariants:
 *   - Token is never included in thrown errors or logs.
 *   - No data is persisted.
 */
async function executeTeamListRequest(
  config: SfvConfig,
  token: string,
  params: TeamListParams,
): Promise<TeamDetail[]> {
  const baseUrl = new URL(config.tokenUrl).origin;
  const qs = new URLSearchParams();
  qs.set("SeasonId", String(params.SeasonId));
  qs.set("ClubId", String(params.ClubId));
  if (params.OrganisationId !== undefined) qs.set("OrganisationId", String(params.OrganisationId));
  if (params.TeamId !== undefined) qs.set("TeamId", String(params.TeamId));
  if (params.LeagueId !== undefined) qs.set("LeagueId", String(params.LeagueId));
  if (params.CupId !== undefined) qs.set("CupId", String(params.CupId));
  if (params.DivisionId !== undefined) qs.set("DivisionId", String(params.DivisionId));
  if (params.GroupId !== undefined) qs.set("GroupId", String(params.GroupId));
  if (params.RoundNbr !== undefined) qs.set("RoundNbr", String(params.RoundNbr));
  if (params.MatchType !== undefined) qs.set("MatchType", String(params.MatchType));
  if (params.Language !== undefined) qs.set("Language", String(params.Language));
  if (params.DateFrom !== undefined) qs.set("DateFrom", params.DateFrom);
  if (params.DateUntil !== undefined) qs.set("DateUntil", params.DateUntil);

  const url = `${baseUrl}/api/team/list?${qs.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-User-Token": token,
        "User-Agent": SFV_USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (response.status === 204) {
      return [];
    }

    if (response.status === 401) {
      evictCachedToken();
      throw new SfvAuthError(
        "SFV_UNAUTHORIZED",
        "SFV team list request rejected: 401 Unauthorized.",
      );
    }

    if (response.status === 404) {
      throw new SfvNetworkError("SFV_NOT_FOUND", "SFV team list: resource not found (404).");
    }

    if (!response.ok) {
      throw new SfvNetworkError(
        "SFV_UNAVAILABLE",
        `SFV team list endpoint returned HTTP ${response.status}.`,
      );
    }

    const rawText = await response.text();
    if (!rawText.trim()) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new SfvNetworkError(
        "SFV_INVALID_RESPONSE",
        "SFV team list response is not valid JSON.",
      );
    }

    if (!Array.isArray(parsed)) {
      throw new SfvNetworkError(
        "SFV_INVALID_RESPONSE",
        "SFV team list response expected an array.",
      );
    }

    return parsed as TeamDetail[];
  } catch (error) {
    if (error instanceof SfvError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SfvNetworkError("SFV_TIMEOUT", "SFV team list request timed out.");
    }
    throw new SfvNetworkError("SFV_UNAVAILABLE", "SFV team list request failed: network error.");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches the list of teams for a given club and season.
 *
 * Endpoint: GET /api/team/list
 * Documented in: SFV Club API Interface OpenAPI v26.6.15.2
 *
 * Uses the in-memory token cache from acquireToken(). On 401, the cache is
 * evicted automatically so the next call will re-authenticate.
 *
 * Returns an empty array on 204 (no content found) or empty response body.
 * Never persists data to the database.
 */
export async function fetchTeamList(params: TeamListParams): Promise<TeamDetail[]> {
  const config = getSfvConfig();
  const cached = await acquireToken();
  return executeTeamListRequest(config, cached.token, params);
}

// ── SFV connection test (Slice 1) ─────────────────────────────────────────────

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
