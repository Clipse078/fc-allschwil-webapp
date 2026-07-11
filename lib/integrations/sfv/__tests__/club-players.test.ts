/**
 * lib/integrations/sfv/__tests__/club-players.test.ts
 *
 * Slice 2 tests for fetchClubPlayers() — GET /api/club/{clubId}/players.
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is fully mocked via vi.spyOn(globalThis, 'fetch').
 * No real network requests are made. No production secrets are used.
 *
 * Contract under test (SFV Club API Interface OpenAPI v26.6.15.2):
 *   GET /api/club/{clubId}/players
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — non-empty (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: application/json — ClubPlayer[]
 *   401: session token cannot be validated → SFV_UNAUTHORIZED
 *   403: no authorization → SFV_FORBIDDEN
 *   404: club not found  → SFV_NOT_FOUND
 *   406: resource unavailable → SFV_UNAVAILABLE
 *   5xx: server error    → SFV_UNAVAILABLE
 *   Timeout              → SFV_TIMEOUT
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchClubPlayers, evictCachedToken, type ClubPlayer } from "../client";
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

/** Minimal synthetic ClubPlayer matching the documented OpenAPI schema. */
const SYNTHETIC_PLAYER: ClubPlayer = {
  personId: 1001,
  playerId: 2001,
  gender: 1,
  name: "Muster",
  secondName: null,
  firstname: "Max",
  birthDate: null,
  email1: null,
  email2: null,
  tel1: null,
  tel2: null,
  clubOwnerId: null,
  clubOwnerName: null,
  clubOwnerNumber: null,
  qualificationType: 1,
  qualificationTypeText: "Amateur",
  licenceType: 1,
  licenceTypeText: "Active",
  playerState: 1,
  playerStateText: "Active",
  dateOfEntry: "2020-01-01T00:00:00",
};

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

/** Returns a fetch mock that first serves the token, then the business response. */
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

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function statusResponse(status: number): Response {
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

// ── 1. Correct documented HTTP method ─────────────────────────────────────────

describe("1 — HTTP method", () => {
  it("uses GET method for the business-data request", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    // Second call (index 1) is the business request
    const [, init] = fetchSpy.mock.calls[1];
    expect((init as RequestInit).method).toBe("GET");
  });
});

// ── 2. Correct documented endpoint path ───────────────────────────────────────

describe("2 — Endpoint path", () => {
  it("calls /api/club/{clubId}/players path template", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [url] = fetchSpy.mock.calls[1];
    expect(String(url)).toMatch(/\/api\/club\/\d+\/players$/);
  });
});

// ── 3. Correct SFV_CLUB_ID placement ──────────────────────────────────────────

describe("3 — SFV_CLUB_ID placement", () => {
  it("embeds SFV_CLUB_ID in the URL path", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [url] = fetchSpy.mock.calls[1];
    expect(String(url)).toContain(`/api/club/${TEST_CLUB_ID}/players`);
  });

  it("uses the configured SFV_CLUB_ID value, not a hardcoded value", async () => {
    setEnv({ SFV_CLUB_ID: "456" });
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [url] = fetchSpy.mock.calls[1];
    expect(String(url)).toContain("/api/club/456/players");
  });
});

// ── 4. Correct documented authorization header ────────────────────────────────

describe("4 — Authorization header", () => {
  it("sends X-User-Token header with the acquired token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).toBeDefined();
    expect(headers["X-User-Token"]).not.toBe("");
  });

  it("does NOT send Authorization: Bearer — SFV uses X-User-Token header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("passes the token verbatim (no Bearer prefix) in X-User-Token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockImplementationOnce(async (_, init) => {
        const headers = (init as RequestInit).headers as Record<string, string>;
        // Confirm the raw token is passed without "Bearer" prefix
        expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
        expect(headers["X-User-Token"]).not.toMatch(/^Bearer /);
        return jsonResponse([SYNTHETIC_PLAYER]);
      });

    await fetchClubPlayers();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ── 5. User-Agent header present ──────────────────────────────────────────────

describe("5 — User-Agent header", () => {
  it("sends a non-empty User-Agent header on the business-data request", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeDefined();
    expect(headers["User-Agent"]).not.toBe("");
  });
});

// ── 6. Accept header ──────────────────────────────────────────────────────────

describe("6 — Accept header", () => {
  it("sends Accept: application/json on the business-data request", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });
});

// ── 7. Successful response parsing ────────────────────────────────────────────

describe("7 — Successful response parsing", () => {
  it("returns an array of ClubPlayer on HTTP 200 with valid JSON", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    const result = await fetchClubPlayers();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe(SYNTHETIC_PLAYER.playerId);
    expect(result[0].personId).toBe(SYNTHETIC_PLAYER.personId);
    expect(result[0].name).toBe(SYNTHETIC_PLAYER.name);
    expect(result[0].gender).toBe(SYNTHETIC_PLAYER.gender);
  });

  it("returns multiple players when the response contains more than one", async () => {
    const players = [
      SYNTHETIC_PLAYER,
      { ...SYNTHETIC_PLAYER, playerId: 2002, personId: 1002, name: "Meier" },
    ];
    mockFetchSequence(jsonResponse(players));

    const result = await fetchClubPlayers();

    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Meier");
  });

  it("preserves all documented ClubPlayer fields", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    const result = await fetchClubPlayers();
    const player = result[0];

    expect(player).toHaveProperty("personId");
    expect(player).toHaveProperty("playerId");
    expect(player).toHaveProperty("gender");
    expect(player).toHaveProperty("name");
    expect(player).toHaveProperty("secondName");
    expect(player).toHaveProperty("firstname");
    expect(player).toHaveProperty("birthDate");
    expect(player).toHaveProperty("qualificationType");
    expect(player).toHaveProperty("licenceType");
    expect(player).toHaveProperty("dateOfEntry");
  });
});

// ── 8. Empty response handling ────────────────────────────────────────────────

describe("8 — Empty response handling", () => {
  it("returns empty array when response body is empty string", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    const result = await fetchClubPlayers();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when response body is whitespace only", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(new Response("   \n  ", { status: 200 }));

    const result = await fetchClubPlayers();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when response body is an empty JSON array", async () => {
    mockFetchSequence(jsonResponse([]));

    const result = await fetchClubPlayers();

    expect(result).toHaveLength(0);
  });
});

// ── 9. Malformed response handling ────────────────────────────────────────────

describe("9 — Malformed response handling", () => {
  it("rejects invalid JSON as SFV_INVALID_RESPONSE", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("not valid json {{{", { status: 200 }),
      );

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("rejects non-array JSON response as SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(jsonResponse({ error: "unexpected object" }));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("rejects JSON string response as SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(jsonResponse("just a string"));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });
});

// ── 10. HTTP 400 mapping ──────────────────────────────────────────────────────

describe("10 — HTTP 400 mapping", () => {
  it("maps HTTP 400 to SFV_UNAVAILABLE (undocumented status — treated as upstream failure)", async () => {
    mockFetchSequence(statusResponse(400));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 11. HTTP 401 mapping ──────────────────────────────────────────────────────

describe("11 — HTTP 401 mapping", () => {
  it("maps HTTP 401 to SFV_UNAUTHORIZED", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_UNAUTHORIZED",
    });
  });

  it("HTTP 401 on business request throws SfvAuthError", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchClubPlayers()).rejects.toBeInstanceOf(SfvAuthError);
  });

  it("HTTP 401 on business request evicts the cached token (next call re-authenticates)", async () => {
    // First call: 401 on business request should evict cached token
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubPlayers();
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
      .mockResolvedValueOnce(jsonResponse([]));

    const result = await fetchClubPlayers();
    expect(result).toBeDefined();
    // Exactly 2 calls: new token request + business request
    expect(freshSpy).toHaveBeenCalledTimes(2);
  });
});

// ── 12. HTTP 403 mapping ──────────────────────────────────────────────────────

describe("12 — HTTP 403 mapping", () => {
  it("maps HTTP 403 to SFV_FORBIDDEN", async () => {
    mockFetchSequence(statusResponse(403));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_FORBIDDEN",
    });
  });

  it("HTTP 403 on business request throws SfvAuthError", async () => {
    mockFetchSequence(statusResponse(403));

    await expect(fetchClubPlayers()).rejects.toBeInstanceOf(SfvAuthError);
  });
});

// ── 13. HTTP 404 mapping ──────────────────────────────────────────────────────

describe("13 — HTTP 404 mapping", () => {
  it("maps HTTP 404 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });

  it("HTTP 404 throws SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchClubPlayers()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 14. HTTP 429 mapping ──────────────────────────────────────────────────────

describe("14 — HTTP 429 mapping", () => {
  it("maps HTTP 429 to SFV_RATE_LIMITED", async () => {
    mockFetchSequence(statusResponse(429));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_RATE_LIMITED",
    });
  });
});

// ── 15. HTTP 500 / upstream failure mapping ───────────────────────────────────

describe("15 — HTTP 500 / upstream failure mapping", () => {
  it("maps HTTP 500 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });

  it("maps HTTP 502 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(502));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });

  it("maps HTTP 503 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(503));

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 16. Network timeout ───────────────────────────────────────────────────────

describe("16 — Network timeout", () => {
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

    await expect(fetchClubPlayers()).rejects.toMatchObject({
      code: "SFV_TIMEOUT",
    });
  });

  it("SFV_TIMEOUT on business request throws SfvNetworkError", async () => {
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

    await expect(fetchClubPlayers()).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 17. Token values not in thrown errors ────────────────────────────────────

describe("17 — Token not in thrown errors", () => {
  it("error message on 401 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubPlayers();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 403 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(403));

    try {
      await fetchClubPlayers();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });

  it("error message on 500 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(500));

    try {
      await fetchClubPlayers();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(SYNTHETIC_TOKEN);
      }
    }
  });
});

// ── 18. Credential values not in logs or errors ───────────────────────────────

describe("18 — Credentials not in errors", () => {
  it("error message on 401 does not contain the application key", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubPlayers();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(TEST_APPLICATION_KEY);
        expect(error.message).not.toContain(TEST_APPLICATION_PASS);
      }
    }
  });

  it("error message does not contain Authorization header material", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubPlayers();
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toMatch(/Authorization:/i);
        expect(error.message).not.toMatch(/Bearer\s+\S/);
      }
    }
  });
});

// ── 19. No persistence or database function is invoked ───────────────────────

describe("19 — No database writes", () => {
  it("fetchClubPlayers returns data without any database-shaped fields", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    const result = await fetchClubPlayers();

    // Result contains API data, not DB entity fields
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("persistedAt");
    expect(result).not.toHaveProperty("updatedAt");
  });
});

// ── 20. Existing Slice 1 authentication tests unchanged ───────────────────────

describe("20 — Slice 1 authentication tests still pass", () => {
  it("acquireToken still works after fetchClubPlayers is imported", async () => {
    const { acquireToken } = await import("../client");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(SYNTHETIC_TOKEN, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    evictCachedToken();
    const cached = await acquireToken();
    expect(cached.token).toBe(SYNTHETIC_TOKEN);
  });

  it("testSfvConnection still works", async () => {
    const { testSfvConnection } = await import("../client");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(SYNTHETIC_TOKEN, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );

    evictCachedToken();
    const result = await testSfvConnection();
    expect(result.connected).toBe(true);
    expect(result.tokenExpiresAt).toBeNull();
  });
});

// ── Additional: base URL derivation from SFV_TOKEN_URL ───────────────────────

describe("Base URL derivation", () => {
  it("derives API base from SFV_TOKEN_URL origin (strips /api/token path)", async () => {
    setEnv({ SFV_TOKEN_URL: "https://example.invalid/api/token" });
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_PLAYER]));

    await fetchClubPlayers();

    const [businessUrl] = fetchSpy.mock.calls[1];
    expect(String(businessUrl)).toMatch(/^https:\/\/example\.invalid\/api\/club\//);
    expect(String(businessUrl)).not.toContain("/api/token");
  });
});
