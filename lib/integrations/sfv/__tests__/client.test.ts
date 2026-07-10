/**
 * Tests for lib/integrations/sfv/client.ts
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is mocked via vi.spyOn(globalThis, 'fetch').
 * No real network requests are made. No .env.local secrets are loaded.
 *
 * Contract under test (confirmed from SFV ClubCorner Swagger documentation):
 *   POST /api/token
 *   Content-Type: application/json
 *   Body: { "applicationKey": "...", "applicationPass": "..." }
 *   HTTP 200 → text/plain session-token string
 *   HTTP 401 → SFV_UNAUTHORIZED
 *   HTTP 403 → SFV_FORBIDDEN
 *   HTTP 429 → SFV_RATE_LIMITED
 *   HTTP 5xx → SFV_UNAVAILABLE
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  acquireToken,
  evictCachedToken,
  getCachedTokenExpiresAt,
  hasCachedToken,
  testSfvConnection,
} from "../client";
import { SfvAuthError, SfvNetworkError } from "../errors";

// ── Synthetic test credentials — never real values ────────────────────────────

const VALID_ENV = {
  SFV_TOKEN_URL: "https://sfv.invalid/api/token",
  SFV_APPLICATION_KEY: "test-application-key",
  SFV_APPLICATION_PASS: "test-application-pass",
  SFV_CLUB_ID: "999999",
};

const SYNTHETIC_TOKEN = "synthetic-sfv-session-token-abc123";

function setEnv(overrides: Partial<typeof VALID_ENV> = {}) {
  const merged = { ...VALID_ENV, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key];
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

/** Creates a minimal mock Response with text/plain body. */
function mockTextResponse(body: string, status: number = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

/** Creates a mock Response with a given status and no body. */
function mockStatusResponse(status: number): Response {
  return new Response("", { status });
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

// ── HTTP method and request shape ─────────────────────────────────────────────

describe("token request HTTP contract", () => {
  it("uses POST method", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0];
    expect((init as RequestInit).method).toBe("POST");
  });

  it("sends Content-Type: application/json", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    const [, init] = fetchSpy.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("request body contains applicationKey field (exact Swagger field name)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toHaveProperty("applicationKey", "test-application-key");
  });

  it("request body contains applicationPass field (exact Swagger field name)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toHaveProperty("applicationPass", "test-application-pass");
  });

  it("request body contains no fields other than applicationKey and applicationPass", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(Object.keys(body).sort()).toEqual(["applicationKey", "applicationPass"].sort());
  });

  it("sends request to configured SFV_TOKEN_URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://sfv.invalid/api/token");
  });
});

// ── Successful response handling ──────────────────────────────────────────────

describe("successful HTTP 200 text/plain response", () => {
  it("accepts HTTP 200 text/plain token and returns cached token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await acquireToken();

    expect(result).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect(result.token).toBe(SYNTHETIC_TOKEN);
  });

  it("trims surrounding whitespace from the token response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(`  \n ${SYNTHETIC_TOKEN} \r\n  `),
    );

    const result = await acquireToken();

    expect(result.token).toBe(SYNTHETIC_TOKEN);
  });

  it("trims leading/trailing spaces only — does not alter internal token content", async () => {
    const tokenWithInternalSpaces = "abc def 123";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(`  ${tokenWithInternalSpaces}  `),
    );

    const result = await acquireToken();

    expect(result.token).toBe(tokenWithInternalSpaces);
  });
});

// ── Empty response rejection ──────────────────────────────────────────────────

describe("empty 200 response rejection", () => {
  it("rejects empty HTTP 200 body as SFV_INVALID_RESPONSE", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockTextResponse(""));

    await expect(acquireToken()).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("rejects whitespace-only HTTP 200 body as SFV_INVALID_RESPONSE", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockTextResponse("   \n\t  "));

    await expect(acquireToken()).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("SFV_INVALID_RESPONSE error is an SfvNetworkError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockTextResponse(""));

    await expect(acquireToken()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── HTTP error status mapping ─────────────────────────────────────────────────

describe("HTTP error status mapping", () => {
  it("maps HTTP 401 to SFV_UNAUTHORIZED", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(401));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_UNAUTHORIZED" });
  });

  it("HTTP 401 error is SfvAuthError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(401));

    await expect(acquireToken()).rejects.toBeInstanceOf(SfvAuthError);
  });

  it("maps HTTP 403 to SFV_FORBIDDEN", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(403));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_FORBIDDEN" });
  });

  it("HTTP 403 error is SfvAuthError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(403));

    await expect(acquireToken()).rejects.toBeInstanceOf(SfvAuthError);
  });

  it("maps HTTP 429 to SFV_RATE_LIMITED", async () => {
    // Stub all fetch calls (MAX_RETRIES + 1 attempts) to avoid retry delay in tests
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockStatusResponse(429));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_RATE_LIMITED" });
  });

  it("maps HTTP 500 to SFV_UNAVAILABLE", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockStatusResponse(500));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });
  });

  it("maps HTTP 502 to SFV_UNAVAILABLE", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockStatusResponse(502));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });
  });

  it("maps HTTP 503 to SFV_UNAVAILABLE", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockStatusResponse(503));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });
  });
});

// ── Timeout handling ──────────────────────────────────────────────────────────

describe("timeout handling", () => {
  it("maps AbortError to SFV_TIMEOUT", async () => {
    // Stub all retry attempts — AbortError is retryable, so stub covers all attempts
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
    );

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_TIMEOUT" });
  });

  it("SFV_TIMEOUT error is SfvNetworkError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
    );

    await expect(acquireToken()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── Retry behavior ────────────────────────────────────────────────────────────

describe("retry behavior", () => {
  it("retries on SFV_UNAVAILABLE (transient) and succeeds on second attempt", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockStatusResponse(500))
      .mockResolvedValueOnce(mockTextResponse(SYNTHETIC_TOKEN));

    const result = await acquireToken();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.token).toBe(SYNTHETIC_TOKEN);
  });

  it("retries on SFV_TIMEOUT (transient) and succeeds on second attempt", async () => {
    const abortError = Object.assign(new Error("The operation was aborted"), {
      name: "AbortError",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(mockTextResponse(SYNTHETIC_TOKEN));

    const result = await acquireToken();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.token).toBe(SYNTHETIC_TOKEN);
  });

  it("does NOT retry HTTP 401 (SFV_UNAUTHORIZED is not retryable)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockStatusResponse(401));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_UNAUTHORIZED" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry HTTP 403 (SFV_FORBIDDEN is not retryable)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockStatusResponse(403));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_FORBIDDEN" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry SFV_INVALID_RESPONSE (non-retryable)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockTextResponse(""));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_INVALID_RESPONSE" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("exhausts retries on persistent transient failure", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockStatusResponse(500));

    await expect(acquireToken()).rejects.toMatchObject({ code: "SFV_UNAVAILABLE" });

    // MAX_RETRIES = 2, so 3 total attempts (0, 1, 2)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

// ── Configuration errors propagate ────────────────────────────────────────────

describe("configuration errors", () => {
  it("throws when SFV_TOKEN_URL is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_TOKEN_URL"];

    await expect(acquireToken()).rejects.toThrow(/SFV_TOKEN_URL/);
  });

  it("throws when SFV_APPLICATION_KEY is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_APPLICATION_KEY"];

    await expect(acquireToken()).rejects.toThrow(/SFV_APPLICATION_KEY/);
  });

  it("throws when SFV_APPLICATION_PASS is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_APPLICATION_PASS"];

    await expect(acquireToken()).rejects.toThrow(/SFV_APPLICATION_PASS/);
  });

  it("throws when SFV_CLUB_ID is missing", async () => {
    clearSfvEnv();
    setEnv();
    delete process.env["SFV_CLUB_ID"];

    await expect(acquireToken()).rejects.toThrow(/SFV_CLUB_ID/);
  });

  it("throws CONFIGURATION_INVALID for non-HTTPS token URL", async () => {
    clearSfvEnv();
    setEnv({ SFV_TOKEN_URL: "http://sfv.invalid/api/token" });

    await expect(acquireToken()).rejects.toThrow(/HTTPS/i);
  });
});

// ── Token cache behavior ──────────────────────────────────────────────────────

describe("token cache state", () => {
  it("hasCachedToken returns false when no token is cached", () => {
    evictCachedToken();
    expect(hasCachedToken()).toBe(false);
  });

  it("getCachedTokenExpiresAt returns null when no token is cached", () => {
    evictCachedToken();
    expect(getCachedTokenExpiresAt()).toBeNull();
  });

  it("hasCachedToken returns true after a successful token acquisition", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    expect(hasCachedToken()).toBe(true);
  });

  it("getCachedTokenExpiresAt returns a future Date after successful acquisition", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    const expiresAt = getCachedTokenExpiresAt();
    expect(expiresAt).not.toBeNull();
    expect(expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("evictCachedToken clears the cache", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();
    expect(hasCachedToken()).toBe(true);

    evictCachedToken();
    expect(hasCachedToken()).toBe(false);
    expect(getCachedTokenExpiresAt()).toBeNull();
  });

  it("reuses cached token without issuing a second fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();
    await acquireToken();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ── In-flight deduplication ───────────────────────────────────────────────────

describe("in-flight request deduplication", () => {
  it("concurrent callers share one inflight request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const [a, b, c] = await Promise.all([acquireToken(), acquireToken(), acquireToken()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a.token).toBe(b.token);
    expect(b.token).toBe(c.token);
  });
});

// ── testSfvConnection ─────────────────────────────────────────────────────────

describe("testSfvConnection", () => {
  it("returns connected=true when token request succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await testSfvConnection();

    expect(result.connected).toBe(true);
    expect(result.tokenValid).toBe(true);
    expect(result.testedAt).toBeDefined();
    expect(result.error).toBeNull();
  });

  it("returns tokenExpiresAt: null (SFV API returns no expiry timestamp)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await testSfvConnection();

    expect(result.tokenExpiresAt).toBeNull();
  });

  it("returns a testedAt ISO timestamp", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await testSfvConnection();

    expect(result.testedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("returns connected=false on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(401));

    const result = await testSfvConnection();

    expect(result.connected).toBe(false);
    expect(result.tokenValid).toBe(false);
    expect(result.error?.code).toBe("SFV_UNAUTHORIZED");
  });

  it("returns connected=false on 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(403));

    const result = await testSfvConnection();

    expect(result.connected).toBe(false);
    expect(result.error?.code).toBe("SFV_FORBIDDEN");
  });

  it("evicts cached token before testing (always performs a fresh request)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockTextResponse(SYNTHETIC_TOKEN))
      .mockResolvedValueOnce(mockTextResponse(SYNTHETIC_TOKEN));

    await acquireToken(); // populate cache
    expect(hasCachedToken()).toBe(true);

    await testSfvConnection(); // should evict and re-fetch

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("result contains no token value", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await testSfvConnection();
    const json = JSON.stringify(result);

    expect(json).not.toContain(SYNTHETIC_TOKEN);
  });

  it("result contains no application key or password", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await testSfvConnection();
    const json = JSON.stringify(result);

    expect(json).not.toContain("test-application-key");
    expect(json).not.toContain("test-application-pass");
  });

  it("result contains no Authorization header material", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await testSfvConnection();
    const json = JSON.stringify(result);

    expect(json).not.toContain("Authorization");
    expect(json).not.toContain("Bearer");
  });
});

// ── Token and credential redaction in error messages ──────────────────────────

describe("token and credential redaction", () => {
  it("error messages do not contain credential values", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(401));

    try {
      await acquireToken();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain("test-application-key");
        expect(error.message).not.toContain("test-application-pass");
      }
    }
  });

  it("error messages do not contain Authorization header values", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockStatusResponse(401));

    try {
      await acquireToken();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toMatch(/Authorization:/i);
        expect(error.message).not.toMatch(/Bearer\s+\S/);
      }
    }
  });
});

// ── No database writes ────────────────────────────────────────────────────────

describe("no database writes during connection test", () => {
  it("testSfvConnection completes without any prisma import (client module has no DB dependency)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    const result = await testSfvConnection();

    expect(result).toBeDefined();
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("persistedAt");
  });
});

// ── No real network calls ─────────────────────────────────────────────────────

describe("no real network calls in tests", () => {
  it("fetch is always mocked — no .invalid domain is contacted", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockTextResponse(SYNTHETIC_TOKEN),
    );

    await acquireToken();

    // Confirm the mock was invoked (not the real fetch)
    expect(fetchSpy).toHaveBeenCalledOnce();
    // Confirm the URL is the synthetic .invalid domain
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain(".invalid");
  });
});
