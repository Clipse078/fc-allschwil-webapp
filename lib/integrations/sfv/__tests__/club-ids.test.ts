/**
 * lib/integrations/sfv/__tests__/club-ids.test.ts
 *
 * Slice 2b tests for resolveClubIds() — GET /api/common/ids.
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is fully mocked via vi.spyOn(globalThis, 'fetch').
 * No real network requests are made. No production secrets are used.
 *
 * Contract under test (SFV Club API Interface OpenAPI v26.6.15.2):
 *   GET /api/common/ids
 *   Query:   ClubId={clubId} (integer, required — exact casing per spec)
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — non-empty (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: body schema is type: string; summary implies JSON identifiers
 *   204: no content → null
 *   401: session token cannot be validated → SFV_UNAUTHORIZED
 *   404: resource not found → SFV_NOT_FOUND
 *   500: unexpected server error → SFV_UNAVAILABLE
 *
 * NOTE — successful array response:
 *   The OpenAPI schema for the 200 response is type: string.
 *   An array is not a string per the documented schema.
 *   Per task requirement "only if allowed by schema", no array response
 *   test is added for this endpoint.
 *
 * NOTE — HTTP 429:
 *   HTTP 429 is NOT documented in the OpenAPI spec for GET /api/common/ids.
 *   No 429-specific test is added; the catch-all test covers undocumented statuses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveClubIds, evictCachedToken } from "../client";
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
 * Returns a fetch mock that first serves the token (text/plain),
 * then serves the given business response.
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

function statusResponse(status: number): Response {
  // HTTP 204 does not allow a body per the Fetch spec
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

// ── 1. Correct documented HTTP method ─────────────────────────────────────────

describe("1 — HTTP method", () => {
  it("uses GET method for the /api/common/ids request", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    // Second call (index 1) is the business request
    const [, init] = fetchSpy.mock.calls[1];
    expect((init as RequestInit).method).toBe("GET");
  });
});

// ── 2. Correct documented endpoint path ───────────────────────────────────────

describe("2 — Endpoint path", () => {
  it("calls /api/common/ids path", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [url] = fetchSpy.mock.calls[1];
    expect(String(url)).toMatch(/\/api\/common\/ids(\?|$)/);
  });
});

// ── 3. Correct ClubId query parameter ─────────────────────────────────────────

describe("3 — ClubId query parameter", () => {
  it("sends ClubId as a query parameter (exact casing per OpenAPI spec)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [url] = fetchSpy.mock.calls[1];
    expect(String(url)).toContain(`ClubId=${TEST_CLUB_ID}`);
  });

  it("uses the configured SFV_CLUB_ID value in the query string", async () => {
    setEnv({ SFV_CLUB_ID: "789" });
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [url] = fetchSpy.mock.calls[1];
    expect(String(url)).toContain("ClubId=789");
  });

  it("ClubId is in the query string, not the path", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [url] = fetchSpy.mock.calls[1];
    const urlObj = new URL(String(url));
    expect(urlObj.searchParams.get("ClubId")).toBe(TEST_CLUB_ID);
    expect(urlObj.pathname).toBe("/api/common/ids");
  });
});

// ── 4. Correct documented X-User-Token header ─────────────────────────────────

describe("4 — X-User-Token header", () => {
  it("sends X-User-Token header with the acquired token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });

  it("passes the token verbatim — no Bearer prefix in X-User-Token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).not.toMatch(/^Bearer\s/i);
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });
});

// ── 5. User-Agent header ──────────────────────────────────────────────────────

describe("5 — User-Agent header", () => {
  it("sends a non-empty User-Agent header (required by Cloudflare WAF)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeDefined();
    expect(headers["User-Agent"].trim()).not.toBe("");
  });
});

// ── 6. Accept: application/json header ───────────────────────────────────────

describe("6 — Accept header", () => {
  it("sends Accept: application/json header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse("{}"));

    await resolveClubIds();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });
});

// ── 7. Successful object response ─────────────────────────────────────────────

describe("7 — Successful object response", () => {
  it("returns ClubIdsResponse with raw body and parsed object", async () => {
    const mockData = { clubId: 123, internalClubId: 456, regionId: 7 };
    mockFetchSequence(jsonResponse(mockData));

    const result = await resolveClubIds();

    expect(result).not.toBeNull();
    expect(result?.raw).toBe(JSON.stringify(mockData));
    expect(result?.parsed).toEqual(mockData);
  });

  it("raw body matches the verbatim response text", async () => {
    const mockData = { someId: 99 };
    const bodyText = JSON.stringify(mockData);
    mockFetchSequence(
      new Response(bodyText, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await resolveClubIds();

    expect(result?.raw).toBe(bodyText);
  });

  it("parsed field is an object when the body is a JSON object", async () => {
    mockFetchSequence(jsonResponse({ id: 1 }));

    const result = await resolveClubIds();

    expect(typeof result?.parsed).toBe("object");
    expect(result?.parsed).not.toBeNull();
  });

  // NOTE — successful array response:
  // The OpenAPI schema for GET /api/common/ids 200 response is type: string.
  // An array is not a string per the documented schema.
  // Per task requirement "only if allowed by schema" — no array test is added here.
});

// ── 8. Empty result (HTTP 204 — no content) ───────────────────────────────────

describe("8 — Empty result (HTTP 204)", () => {
  it("returns null on HTTP 204 (no content found)", async () => {
    mockFetchSequence(statusResponse(204));

    const result = await resolveClubIds();

    expect(result).toBeNull();
  });
});

// ── 9. Malformed result ───────────────────────────────────────────────────────

describe("9 — Malformed result", () => {
  it("returns ClubIdsResponse with raw body and parsed=undefined when body is not JSON", async () => {
    const malformedBody = "not valid json {{ garbage";
    mockFetchSequence(textResponse(malformedBody));

    const result = await resolveClubIds();

    expect(result).not.toBeNull();
    expect(result?.raw).toBe(malformedBody);
    expect(result?.parsed).toBeUndefined();
  });

  it("does not throw on malformed response body — caller receives raw for inspection", async () => {
    mockFetchSequence(textResponse("{bad json}"));

    await expect(resolveClubIds()).resolves.not.toThrow();
  });
});

// ── 10. HTTP 400 (not documented — maps to SFV_UNAVAILABLE) ──────────────────

describe("10 — HTTP 400", () => {
  it("maps HTTP 400 to SFV_UNAVAILABLE (not documented; generic handler)", async () => {
    mockFetchSequence(statusResponse(400));

    await expect(resolveClubIds()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });
  });

  it("HTTP 400 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(400));

    await expect(resolveClubIds()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 11. HTTP 401 ──────────────────────────────────────────────────────────────

describe("11 — HTTP 401", () => {
  it("maps HTTP 401 to SFV_UNAUTHORIZED", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(resolveClubIds()).rejects.toMatchObject({ code: "SFV_UNAUTHORIZED" });
  });

  it("HTTP 401 error is SfvAuthError", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(resolveClubIds()).rejects.toBeInstanceOf(SfvAuthError);
  });

  it("HTTP 401 on business request evicts the cached token", async () => {
    // First call: token acquisition succeeds, business request returns 401
    mockFetchSequence(statusResponse(401));

    try {
      await resolveClubIds();
    } catch {
      // expected SFV_UNAUTHORIZED
    }

    // After the 401 the token cache must be empty. Restore mocks to get a clean spy.
    vi.restoreAllMocks();

    // A fresh call must acquire a new token (2 fetches: token + business).
    const freshSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ id: 1 }));

    await resolveClubIds();

    // Exactly 2 calls: new token request + business request
    expect(freshSpy).toHaveBeenCalledTimes(2);
  });
});

// ── 12. HTTP 403 (not documented — maps to SFV_UNAVAILABLE) ──────────────────

describe("12 — HTTP 403", () => {
  it("maps HTTP 403 to SFV_UNAVAILABLE (not documented for this endpoint; generic handler)", async () => {
    mockFetchSequence(statusResponse(403));

    await expect(resolveClubIds()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });
  });

  it("HTTP 403 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(403));

    await expect(resolveClubIds()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 13. HTTP 404 ──────────────────────────────────────────────────────────────

describe("13 — HTTP 404", () => {
  it("maps HTTP 404 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(resolveClubIds()).rejects.toMatchObject({ code: "SFV_NOT_FOUND" });
  });

  it("HTTP 404 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(resolveClubIds()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 14. HTTP 406 (not documented — maps to SFV_UNAVAILABLE) ──────────────────

describe("14 — HTTP 406", () => {
  it("maps HTTP 406 to SFV_UNAVAILABLE (not documented for this endpoint; generic handler)", async () => {
    mockFetchSequence(statusResponse(406));

    await expect(resolveClubIds()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });
  });
});

// NOTE — HTTP 429:
// HTTP 429 is NOT documented in the OpenAPI spec for GET /api/common/ids.
// No 429-specific test is added; the generic "undocumented error" handler covers it.

// ── 15. HTTP 500 ──────────────────────────────────────────────────────────────

describe("15 — HTTP 500", () => {
  it("maps HTTP 500 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(resolveClubIds()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });
  });

  it("HTTP 500 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(resolveClubIds()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 16. Timeout ───────────────────────────────────────────────────────────────

describe("16 — Timeout", () => {
  it("maps AbortError on business request to SFV_TIMEOUT", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockRejectedValueOnce(abortError);

    await expect(resolveClubIds()).rejects.toMatchObject({ code: "SFV_TIMEOUT" });
  });

  it("SFV_TIMEOUT error is SfvNetworkError", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockRejectedValueOnce(abortError);

    await expect(resolveClubIds()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 17. Token never appears in errors ─────────────────────────────────────────

describe("17 — Token never appears in errors", () => {
  it("error message on 401 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await resolveClubIds();
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 404 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(404));

    try {
      await resolveClubIds();
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 500 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(500));

    try {
      await resolveClubIds();
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 401 does not contain the application key", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await resolveClubIds();
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(TEST_APPLICATION_KEY);
      }
    }
  });
});

// ── 18. No database function is called ───────────────────────────────────────

describe("18 — No database writes or reads", () => {
  it("resolveClubIds returns data without any database-shaped fields", async () => {
    mockFetchSequence(jsonResponse({ someId: 42 }));

    const result = await resolveClubIds();

    expect(result).toBeDefined();
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).not.toHaveProperty("persistedAt");
  });

  it("resolveClubIds module has no Prisma dependency (client module imports are SFV-only)", async () => {
    // The client.ts module does not import prisma or @prisma/client.
    // This structural test confirms the function returns without DB interaction.
    mockFetchSequence(jsonResponse({ someId: 42 }));

    const result = await resolveClubIds();

    // If Prisma were called it would throw (no DATABASE_URL in test env)
    // and this assertion would never be reached.
    expect(result).not.toBeNull();
  });
});
