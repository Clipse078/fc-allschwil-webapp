/**
 * lib/integrations/sfv/__tests__/team-picture.test.ts
 *
 * Focused tests for fetchTeamPicture() — GET /api/team/picture/{teamId}.
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is fully mocked via vi.spyOn(globalThis, 'fetch').
 * No real network requests are made. No production secrets are used.
 *
 * CONTRACT UNDER TEST (SFV Club API Interface OpenAPI v26.6.15.2
 *                      + production observations 2026-07-12):
 *   Tag:     Team
 *   Method:  GET
 *   Path:    /api/team/picture/{teamId}
 *   Path param: teamId (int32, required) — percent-encoded in URL
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — non-empty (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: application/json — JSON-quoted base64 string ("binary data encoded in base64")
 *   204: no content found → null
 *   401: session token cannot be validated → SFV_UNAUTHORIZED + cache eviction
 *   404: resource not found (no image) → SFV_NOT_FOUND
 *   500: unexpected server error → SFV_UNAVAILABLE
 *
 * RETRY CONTRACT:
 *   On 401, the cached token is evicted and the request is retried once with
 *   a freshly acquired token (one controlled retry — no loop).
 *   A second 401 propagates as SFV_UNAUTHORIZED without further retry.
 *
 * PRODUCTION OBSERVATIONS:
 *   - Response body is a JSON string value (double-quoted), not raw base64 text.
 *   - Content-Type is application/json; charset=utf-8 (not image/*).
 *   - No cache-control, etag, last-modified, or content-length headers observed.
 *   - teamId alone is sufficient; no ClubId, SeasonId, or OrganisationId required.
 *   - Own teams and opponent teams behave identically.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchTeamPicture,
  evictCachedToken,
  type TeamPictureResponse,
} from "../client";
import { SfvAuthError, SfvNetworkError } from "../errors";

// ── Synthetic test credentials — never real values ────────────────────────────

const TEST_TOKEN_URL = "https://example.invalid/api/token";
const TEST_APPLICATION_KEY = "test-application-key-not-real";
const TEST_APPLICATION_PASS = "test-application-password-not-real";
const TEST_CLUB_ID = "123";

const VALID_ENV = {
  SFV_TOKEN_URL: TEST_TOKEN_URL,
  SFV_APPLICATION_KEY: TEST_APPLICATION_KEY,
  SFV_APPLICATION_PASS: TEST_APPLICATION_PASS,
  SFV_CLUB_ID: TEST_CLUB_ID,
};

/** Synthetic token — visibly fake, never a real credential. */
const SYNTHETIC_TOKEN = "test-token-opaque-24char";

/**
 * Minimal valid GIF encoded as base64.
 * This is a well-known 1x1 transparent GIF.
 * Used to simulate a non-empty image response from the SFV API.
 */
const SYNTHETIC_BASE64 =
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Representative team ID from production data (FC Allschwil). */
const SYNTHETIC_TEAM_ID = 31927;

/** Opponent team ID from production schedule data (FC Grenchen 15). */
const OPPONENT_TEAM_ID = 40982;

function setEnv(overrides: Partial<typeof VALID_ENV> = {}) {
  const merged = { ...VALID_ENV, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key as string];
    } else {
      process.env[key] = value;
    }
  }
}

function clearSfvEnv() {
  delete process.env["SFV_TOKEN_URL"];
  delete process.env["SFV_APPLICATION_KEY"];
  delete process.env["SFV_APPLICATION_PASS"];
  delete process.env["SFV_CLUB_ID"];
}

/**
 * Mocks fetch with exactly two calls: token request → business request.
 * Returns the fetch spy for inspection.
 */
function mockFetchSequence(businessResponse: Response): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(SYNTHETIC_TOKEN, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    )
    .mockResolvedValueOnce(businessResponse);
}

/**
 * Returns a 200 response with the canonical picture contract:
 * content-type: application/json, body is a JSON-quoted base64 string.
 */
function pictureResponse(base64 = SYNTHETIC_BASE64, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(base64), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function statusResponse(status: number): Response {
  return new Response(status === 204 ? null : "", { status });
}

beforeEach(() => {
  setEnv();
  evictCachedToken();
  vi.restoreAllMocks();
});

afterEach(() => {
  clearSfvEnv();
  evictCachedToken();
  vi.restoreAllMocks();
});

// ── 1. HTTP method ─────────────────────────────────────────────────────────────

describe("1 — HTTP method", () => {
  it("uses GET method for the /api/team/picture/{teamId} request", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [, init] = fetchSpy.mock.calls[1];
    expect((init as RequestInit).method).toBe("GET");
  });
});

// ── 2. Endpoint path ─────────────────────────────────────────────────────────

describe("2 — Endpoint path", () => {
  it("calls the exact /api/team/picture/{teamId} path", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe(`/api/team/picture/${SYNTHETIC_TEAM_ID}`);
  });

  it("inserts the teamId correctly into the path", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(OPPONENT_TEAM_ID);

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe(`/api/team/picture/${OPPONENT_TEAM_ID}`);
  });

  it("uses the base URL derived from SFV_TOKEN_URL", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).origin).toBe(new URL(TEST_TOKEN_URL).origin);
  });
});

// ── 3. teamId path encoding ───────────────────────────────────────────────────

describe("3 — teamId path encoding", () => {
  it("encodes teamId via encodeURIComponent in the URL path", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());
    const numericId = 31927;

    await fetchTeamPicture(numericId);

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe(`/api/team/picture/${encodeURIComponent(String(numericId))}`);
  });

  it("sends no query parameters beyond teamId path segment", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [url] = fetchSpy.mock.calls[1];
    const searchParams = new URL(String(url)).searchParams;
    expect([...searchParams.keys()]).toHaveLength(0);
  });
});

// ── 4. Authentication header — X-User-Token ───────────────────────────────────

describe("4 — Authentication header (X-User-Token)", () => {
  it("sends the X-User-Token header with the acquired token value", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("X-User-Token")).toBe(SYNTHETIC_TOKEN);
  });

  it("does not add a Bearer prefix to the token", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = new Headers((init as RequestInit).headers);
    const tokenHeader = headers.get("X-User-Token") ?? "";
    expect(tokenHeader.startsWith("Bearer")).toBe(false);
  });

  it("does not use an Authorization header", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("Authorization")).toBeNull();
  });
});

// ── 5. SFV_USER_AGENT header ─────────────────────────────────────────────────

describe("5 — User-Agent header (Cloudflare WAF requirement)", () => {
  it("sends a non-empty User-Agent header on every business request", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = new Headers((init as RequestInit).headers);
    const ua = headers.get("User-Agent");
    expect(ua).toBeTruthy();
    expect(typeof ua).toBe("string");
  });

  it("sends a non-empty User-Agent on the token request", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [, init] = fetchSpy.mock.calls[0];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("User-Agent")).toBeTruthy();
  });
});

// ── 6. Accept header ─────────────────────────────────────────────────────────

describe("6 — Accept header", () => {
  it("sends Accept: application/json on the business request", async () => {
    const fetchSpy = mockFetchSequence(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("Accept")).toBe("application/json");
  });
});

// ── 7. One controlled retry after 401 ─────────────────────────────────────────

describe("7 — Controlled retry after 401", () => {
  it("retries the business request once after a 401 response", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).not.toBeNull();
    expect(result!.base64).toBe(SYNTHETIC_BASE64);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("the retry uses a freshly acquired token (re-authentication after 401)", async () => {
    const FRESH_TOKEN = "refreshed-token-different";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(FRESH_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    // The 4th fetch call (index 3) is the retry business request — it must carry the fresh token.
    const [, retryInit] = fetchSpy.mock.calls[3];
    const retryHeaders = new Headers((retryInit as RequestInit).headers);
    expect(retryHeaders.get("X-User-Token")).toBe(FRESH_TOKEN);
  });
});

// ── 8. Cached-token eviction before retry ─────────────────────────────────────

describe("8 — Cached-token eviction on 401", () => {
  it("evicts the cached token when the business request returns 401", async () => {
    mockFetchSequence(new Response(null, { status: 401 }));

    try {
      await fetchTeamPicture(SYNTHETIC_TEAM_ID);
    } catch {
      // expected
    }

    vi.restoreAllMocks();

    // Next call to fetchTeamPicture must re-acquire a token (fetch called twice again).
    const freshSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(pictureResponse());

    await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(freshSpy).toHaveBeenCalledTimes(2);
  });
});

// ── 9. No second retry loop ───────────────────────────────────────────────────

describe("9 — No second retry loop", () => {
  it("throws SFV_UNAUTHORIZED if the retry also returns 401 (no further retry)", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_UNAUTHORIZED",
    });
  });

  it("makes exactly 4 fetch calls total when both initial and retry return 401", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    try {
      await fetchTeamPicture(SYNTHETIC_TEAM_ID);
    } catch {
      // expected
    }

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("the error after a double 401 (initial + retry) is SfvAuthError", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toBeInstanceOf(SfvAuthError);
  });
});

// ── 10. Timeout handling ──────────────────────────────────────────────────────

describe("10 — Timeout handling", () => {
  it("maps AbortError on the business request to SFV_TIMEOUT", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockRejectedValueOnce(abortError);

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_TIMEOUT",
    });
  });

  it("SFV_TIMEOUT error is SfvNetworkError", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockRejectedValueOnce(abortError);

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 11. HTTP 404 handling ─────────────────────────────────────────────────────

describe("11 — HTTP 404 (no image for teamId)", () => {
  it("maps HTTP 404 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });

  it("HTTP 404 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toBeInstanceOf(SfvNetworkError);
  });

  it("includes teamId in the 404 error message for diagnostics", async () => {
    mockFetchSequence(statusResponse(404));

    try {
      await fetchTeamPicture(SYNTHETIC_TEAM_ID);
      expect.fail("Expected error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toContain(String(SYNTHETIC_TEAM_ID));
      }
    }
  });
});

// ── 12. HTTP 204 handling ─────────────────────────────────────────────────────

describe("12 — HTTP 204 (no content found)", () => {
  it("returns null on HTTP 204 (no picture available)", async () => {
    mockFetchSequence(statusResponse(204));

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).toBeNull();
  });
});

// ── 13. Missing-image behaviour ───────────────────────────────────────────────

describe("13 — Missing-image behaviour", () => {
  it("returns null for an empty response body (treated as no content)", async () => {
    mockFetchSequence(
      new Response("", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).toBeNull();
  });

  it("returns null when base64 string is empty after trim", async () => {
    mockFetchSequence(
      new Response(JSON.stringify("   "), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).toBeNull();
  });

  it("throws SFV_NOT_FOUND for an unknown team ID (404 from API)", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchTeamPicture(999999999)).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });
});

// ── 14. No secret leakage in errors ──────────────────────────────────────────

describe("14 — No secret leakage in errors", () => {
  it("error message on 401 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchTeamPicture(SYNTHETIC_TEAM_ID);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 500 does not contain the application key", async () => {
    mockFetchSequence(statusResponse(500));

    try {
      await fetchTeamPicture(SYNTHETIC_TEAM_ID);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(TEST_APPLICATION_KEY);
      }
    }
  });

  it("error message on 404 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(404));

    try {
      await fetchTeamPicture(SYNTHETIC_TEAM_ID);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("SFV_INVALID_RESPONSE error does not contain base64 content", async () => {
    // Simulate a non-string JSON value (e.g. an object instead of a string)
    mockFetchSequence(
      new Response(JSON.stringify({ unexpected: "object" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      await fetchTeamPicture(SYNTHETIC_TEAM_ID);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain("unexpected");
        expect(error.message).not.toContain(SYNTHETIC_BASE64);
      }
    }
  });
});

// ── 15. Unknown team ID behaviour ─────────────────────────────────────────────

describe("15 — Unknown team ID behaviour", () => {
  it("throws SFV_NOT_FOUND for a synthetic unknown team ID", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchTeamPicture(999999999)).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });
});

// ── 16. Correct response mapping ─────────────────────────────────────────────

describe("16 — Correct response mapping", () => {
  it("returns the base64 string exactly as received from the API", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).not.toBeNull();
    expect(result!.base64).toBe(SYNTHETIC_BASE64);
  });

  it("maps the Content-Type header to the contentType field", async () => {
    mockFetchSequence(
      new Response(JSON.stringify(SYNTHETIC_BASE64), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }),
    );

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.contentType).toBe("application/json; charset=utf-8");
  });

  it("maps missing Content-Length to contentLength null", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.contentLength).toBeNull();
  });

  it("maps missing ETag to etag null", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.etag).toBeNull();
  });

  it("maps missing Last-Modified to lastModified null", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.lastModified).toBeNull();
  });

  it("maps missing Cache-Control to cacheControl null", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.cacheControl).toBeNull();
  });
});

// ── 17. Base64 response form ─────────────────────────────────────────────────

describe("17 — Base64 response form", () => {
  it("correctly parses a JSON-quoted base64 string from the response body", async () => {
    mockFetchSequence(pictureResponse(SYNTHETIC_BASE64));

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).not.toBeNull();
    expect(typeof result!.base64).toBe("string");
    expect(result!.base64).toBe(SYNTHETIC_BASE64);
  });

  it("throws SFV_INVALID_RESPONSE if response body is not valid JSON", async () => {
    mockFetchSequence(
      new Response("not valid json content", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("throws SFV_INVALID_RESPONSE if JSON response is not a string (e.g. object)", async () => {
    mockFetchSequence(
      new Response(JSON.stringify({ data: SYNTHETIC_BASE64 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("throws SFV_INVALID_RESPONSE if JSON response is not a string (e.g. array)", async () => {
    mockFetchSequence(
      new Response(JSON.stringify([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("SFV_INVALID_RESPONSE error is SfvNetworkError", async () => {
    mockFetchSequence(
      new Response("not valid json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 18. Non-empty base64 response ─────────────────────────────────────────────

describe("18 — Non-empty base64 response", () => {
  it("returns a non-empty base64 string for a valid team picture", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).not.toBeNull();
    expect(result!.base64.length).toBeGreaterThan(0);
  });

  it("returned base64 string is a valid base64 alphabet", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.base64).toMatch(/^[A-Za-z0-9+/\r\n]+=*$/);
  });
});

// ── 19. Empty response body handling ──────────────────────────────────────────

describe("19 — Empty body handling", () => {
  it("returns null when the response body is whitespace-only", async () => {
    mockFetchSequence(
      new Response("   \n  ", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).toBeNull();
  });
});

// ── 20. Safe cache-header extraction ─────────────────────────────────────────

describe("20 — Safe cache-header extraction", () => {
  it("maps ETag header when present", async () => {
    mockFetchSequence(pictureResponse(SYNTHETIC_BASE64, { ETag: '"abc123"' }));

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.etag).toBe('"abc123"');
  });

  it("maps Last-Modified header when present", async () => {
    mockFetchSequence(
      pictureResponse(SYNTHETIC_BASE64, { "Last-Modified": "Mon, 01 Jul 2026 00:00:00 GMT" }),
    );

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.lastModified).toBe("Mon, 01 Jul 2026 00:00:00 GMT");
  });

  it("maps Cache-Control header when present", async () => {
    mockFetchSequence(
      pictureResponse(SYNTHETIC_BASE64, { "Cache-Control": "max-age=3600" }),
    );

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.cacheControl).toBe("max-age=3600");
  });

  it("maps Content-Length header as integer when present", async () => {
    mockFetchSequence(
      pictureResponse(SYNTHETIC_BASE64, { "Content-Length": "3945" }),
    );

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.contentLength).toBe(3945);
  });

  it("exposes all null cache headers when no cache headers are sent (matching observed production behaviour)", async () => {
    mockFetchSequence(pictureResponse());

    const result = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result!.etag).toBeNull();
    expect(result!.lastModified).toBeNull();
    expect(result!.cacheControl).toBeNull();
    expect(result!.contentLength).toBeNull();
  });
});

// ── 21. HTTP 500 handling ──────────────────────────────────────────────────────

describe("21 — HTTP 500 (unexpected server error)", () => {
  it("maps HTTP 500 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });

  it("HTTP 500 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 22. Undocumented HTTP status codes ────────────────────────────────────────

describe("22 — Undocumented HTTP status codes", () => {
  it("maps HTTP 400 to SFV_UNAVAILABLE (generic handler)", async () => {
    mockFetchSequence(statusResponse(400));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });

  it("maps HTTP 503 to SFV_UNAVAILABLE (generic handler)", async () => {
    mockFetchSequence(statusResponse(503));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 23. Network error ─────────────────────────────────────────────────────────

describe("23 — Network error", () => {
  it("maps generic network failure to SFV_UNAVAILABLE", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(SYNTHETIC_TOKEN, { status: 200, headers: { "Content-Type": "text/plain" } }))
      .mockRejectedValueOnce(new Error("Network failure"));

    await expect(fetchTeamPicture(SYNTHETIC_TEAM_ID)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 24. TypeScript return type contract ───────────────────────────────────────

describe("24 — Return type contract", () => {
  it("returns an object matching TeamPictureResponse on HTTP 200", async () => {
    mockFetchSequence(pictureResponse());

    const result: TeamPictureResponse | null = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).not.toBeNull();
    expect(typeof result!.base64).toBe("string");
    expect(typeof result!.contentType).toBe("string");
    expect(result!.contentLength === null || typeof result!.contentLength === "number").toBe(true);
    expect(result!.etag === null || typeof result!.etag === "string").toBe(true);
    expect(result!.lastModified === null || typeof result!.lastModified === "string").toBe(true);
    expect(result!.cacheControl === null || typeof result!.cacheControl === "string").toBe(true);
  });

  it("returns null on HTTP 204", async () => {
    mockFetchSequence(statusResponse(204));

    const result: TeamPictureResponse | null = await fetchTeamPicture(SYNTHETIC_TEAM_ID);

    expect(result).toBeNull();
  });
});
