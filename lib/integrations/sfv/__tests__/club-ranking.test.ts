/**
 * lib/integrations/sfv/__tests__/club-ranking.test.ts
 *
 * Focused tests for fetchClubRanking() — GET /api/club/ranking.
 *
 * All tests use synthetic credentials with the .invalid domain.
 * The HTTP layer is fully mocked via vi.spyOn(globalThis, 'fetch').
 * No real network requests are made. No production secrets are used.
 *
 * Contract under test (SFV Club API Interface OpenAPI v26.6.15.2):
 *   Tag:     ClubSchedule
 *   GET /api/club/ranking
 *   Query:   SeasonId (int32, required), ClubId (int32, required)
 *   Query:   OrganisationId, TeamId, LeagueId, Language, DivisionId,
 *            GroupeId, MatchType (all optional)
 *   Note:    "GroupeId" is the exact upstream spelling (with trailing 'e').
 *   Header:  X-User-Token — raw opaque session token (no "Bearer" prefix)
 *   Header:  User-Agent   — non-empty (required by Cloudflare WAF)
 *   Header:  Accept       — application/json
 *   200: application/json — Ranking[] (mapped as ClubRankingEntry[])
 *   401: session token cannot be validated → SFV_UNAUTHORIZED + cache eviction
 *   404: resource not found → SFV_NOT_FOUND
 *   406: resource not available → SFV_NOT_FOUND
 *   500: unexpected server error → SFV_UNAVAILABLE
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchClubRanking,
  evictCachedToken,
  type ClubRankingEntry,
  type ClubRankingParams,
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

/** Minimal synthetic ClubRankingEntry matching all 19 documented OpenAPI Ranking fields. */
const SYNTHETIC_ENTRY: ClubRankingEntry = {
  leagueId: 17131,
  leagueNumber: 4,
  leagueName: "4. Liga Gruppe 1",
  divisionId: 2001,
  divisionName: "Vorrunde",
  groupId: 3001,
  groupName: "Gruppe 1",
  teamName: "FC Allschwil",
  clubNumber: 3502,
  position: 1,
  matches: 10,
  wins: 7,
  draws: 2,
  losses: 1,
  penaltyPoints: 0,
  goalsFor: 25,
  goalsAgainst: 8,
  points: 23,
  teamId: 31927,
};

/** Required parameters for the club ranking request. */
const REQUIRED_PARAMS: ClubRankingParams = {
  SeasonId: 2027,
  ClubId: 483,
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

// ── 1. HTTP method ────────────────────────────────────────────────────────────

describe("1 — HTTP method", () => {
  it("uses GET method for the /api/club/ranking request", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    expect((init as RequestInit).method).toBe("GET");
  });
});

// ── 2. Endpoint path ──────────────────────────────────────────────────────────

describe("2 — Endpoint path", () => {
  it("calls /api/club/ranking path", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).pathname).toBe("/api/club/ranking");
  });
});

// ── 3. Required query parameters ──────────────────────────────────────────────

describe("3 — Required query parameters", () => {
  it("sends SeasonId as a query parameter (exact casing per OpenAPI spec)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking({ SeasonId: 2027, ClubId: 483 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("SeasonId")).toBe("2027");
  });

  it("sends ClubId as a query parameter (exact casing per OpenAPI spec)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking({ SeasonId: 2027, ClubId: 483 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("ClubId")).toBe("483");
  });
});

// ── 4. Optional parameter omission ───────────────────────────────────────────

describe("4 — Optional parameter omission", () => {
  const optionalParams: (keyof ClubRankingParams)[] = [
    "OrganisationId",
    "TeamId",
    "LeagueId",
    "Language",
    "DivisionId",
    "GroupeId",
    "MatchType",
  ];

  for (const param of optionalParams) {
    it(`omits ${param} from query string when not provided`, async () => {
      const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

      await fetchClubRanking(REQUIRED_PARAMS);

      const [url] = fetchSpy.mock.calls[1];
      expect(new URL(String(url)).searchParams.has(param)).toBe(false);
    });
  }

  it("includes GroupeId when provided (with trailing 'e' — exact upstream spelling)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking({ ...REQUIRED_PARAMS, GroupeId: 3001 });

    const [url] = fetchSpy.mock.calls[1];
    const urlObj = new URL(String(url));
    // Must use "GroupeId" (with 'e'), not "GroupId"
    expect(urlObj.searchParams.get("GroupeId")).toBe("3001");
    expect(urlObj.searchParams.has("GroupId")).toBe(false);
  });

  it("includes TeamId when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking({ ...REQUIRED_PARAMS, TeamId: 31927 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("TeamId")).toBe("31927");
  });

  it("includes LeagueId when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking({ ...REQUIRED_PARAMS, LeagueId: 17131 });

    const [url] = fetchSpy.mock.calls[1];
    expect(new URL(String(url)).searchParams.get("LeagueId")).toBe("17131");
  });
});

// ── 5. Authentication headers ─────────────────────────────────────────────────

describe("5 — Authentication headers", () => {
  it("sends X-User-Token header with the acquired token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });

  it("passes the token verbatim — no Bearer prefix in X-User-Token", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-User-Token"]).not.toMatch(/^Bearer\s/i);
    expect(headers["X-User-Token"]).toBe(SYNTHETIC_TOKEN);
  });

  it("does not send Authorization: Bearer header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });
});

// ── 6. User-Agent header ──────────────────────────────────────────────────────

describe("6 — User-Agent header", () => {
  it("sends a non-empty User-Agent header (required by Cloudflare WAF)", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeDefined();
    expect(headers["User-Agent"].trim()).not.toBe("");
  });
});

// ── 7. Accept header ──────────────────────────────────────────────────────────

describe("7 — Accept header", () => {
  it("sends Accept: application/json header", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    const [, init] = fetchSpy.mock.calls[1];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/json");
  });
});

// ── 8. Successful array response ──────────────────────────────────────────────

describe("8 — Successful array response", () => {
  it("returns ClubRankingEntry[] on HTTP 200", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubRanking(REQUIRED_PARAMS);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("maps all 19 ClubRankingEntry fields from the response", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubRanking(REQUIRED_PARAMS);

    expect(result[0]).toEqual(SYNTHETIC_ENTRY);
  });

  it("handles nullable string fields", async () => {
    const entryWithNulls: ClubRankingEntry = {
      ...SYNTHETIC_ENTRY,
      leagueName: null,
      divisionName: null,
      groupName: null,
      teamName: null,
    };
    mockFetchSequence(jsonResponse([entryWithNulls]));

    const result = await fetchClubRanking(REQUIRED_PARAMS);

    expect(result[0].leagueName).toBeNull();
    expect(result[0].divisionName).toBeNull();
    expect(result[0].groupName).toBeNull();
    expect(result[0].teamName).toBeNull();
  });
});

// ── 9. Complete field mapping — all 19 fields ─────────────────────────────────

describe("9 — Complete field mapping (all 19 Ranking schema fields)", () => {
  it("preserves exact field names from the OpenAPI Ranking schema", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubRanking(REQUIRED_PARAMS);
    const entry = result[0];

    expect(entry).toHaveProperty("leagueId");
    expect(entry).toHaveProperty("leagueNumber");
    expect(entry).toHaveProperty("leagueName");
    expect(entry).toHaveProperty("divisionId");
    expect(entry).toHaveProperty("divisionName");
    expect(entry).toHaveProperty("groupId");
    expect(entry).toHaveProperty("groupName");
    expect(entry).toHaveProperty("teamName");
    expect(entry).toHaveProperty("clubNumber");
    expect(entry).toHaveProperty("position");
    expect(entry).toHaveProperty("matches");
    expect(entry).toHaveProperty("wins");
    expect(entry).toHaveProperty("draws");
    expect(entry).toHaveProperty("losses");
    expect(entry).toHaveProperty("penaltyPoints");
    expect(entry).toHaveProperty("goalsFor");
    expect(entry).toHaveProperty("goalsAgainst");
    expect(entry).toHaveProperty("points");
    expect(entry).toHaveProperty("teamId");
  });
});

// ── 10. GroupeId upstream spelling ────────────────────────────────────────────

describe("10 — GroupeId upstream spelling preservation", () => {
  it("sends GroupeId (with 'e') not GroupId when provided", async () => {
    const fetchSpy = mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking({ ...REQUIRED_PARAMS, GroupeId: 3001 });

    const [url] = fetchSpy.mock.calls[1];
    const urlObj = new URL(String(url));
    expect(urlObj.searchParams.get("GroupeId")).toBe("3001");
    expect(urlObj.searchParams.has("GroupId")).toBe(false);
  });
});

// ── 11. Empty response body ───────────────────────────────────────────────────

describe("11 — Empty response body", () => {
  it("returns [] when HTTP 200 body is empty", async () => {
    mockFetchSequence(
      new Response("", { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const result = await fetchClubRanking(REQUIRED_PARAMS);

    expect(result).toEqual([]);
  });
});

// ── 12. HTTP 401 ──────────────────────────────────────────────────────────────

describe("12 — HTTP 401", () => {
  it("maps HTTP 401 to SFV_UNAUTHORIZED", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAUTHORIZED",
    });
  });

  it("HTTP 401 error is SfvAuthError", async () => {
    mockFetchSequence(statusResponse(401));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvAuthError);
  });

  it("HTTP 401 on business request evicts the cached token", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubRanking(REQUIRED_PARAMS);
    } catch {
      // expected SFV_UNAUTHORIZED
    }

    vi.restoreAllMocks();

    const freshSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(SYNTHETIC_TOKEN, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([SYNTHETIC_ENTRY]));

    await fetchClubRanking(REQUIRED_PARAMS);

    expect(freshSpy).toHaveBeenCalledTimes(2);
  });
});

// ── 13. HTTP 404 ──────────────────────────────────────────────────────────────

describe("13 — HTTP 404", () => {
  it("maps HTTP 404 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(404));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });
});

// ── 14. HTTP 406 ──────────────────────────────────────────────────────────────

describe("14 — HTTP 406 (resource not available)", () => {
  it("maps HTTP 406 to SFV_NOT_FOUND", async () => {
    mockFetchSequence(statusResponse(406));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_NOT_FOUND",
    });
  });

  it("HTTP 406 error is SfvNetworkError", async () => {
    mockFetchSequence(statusResponse(406));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toBeInstanceOf(SfvNetworkError);
  });
});

// ── 15. HTTP 500 ──────────────────────────────────────────────────────────────

describe("15 — HTTP 500", () => {
  it("maps HTTP 500 to SFV_UNAVAILABLE", async () => {
    mockFetchSequence(statusResponse(500));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 16. Undocumented HTTP status codes ────────────────────────────────────────

describe("16 — Undocumented HTTP status codes", () => {
  it("maps HTTP 400 to SFV_UNAVAILABLE (generic handler)", async () => {
    mockFetchSequence(statusResponse(400));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_UNAVAILABLE",
    });
  });
});

// ── 17. Timeout ───────────────────────────────────────────────────────────────

describe("17 — Timeout", () => {
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

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_TIMEOUT",
    });
  });
});

// ── 18. Malformed response ────────────────────────────────────────────────────

describe("18 — Malformed response", () => {
  it("maps non-JSON response to SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(
      new Response("not valid json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });

  it("maps non-array JSON to SFV_INVALID_RESPONSE", async () => {
    mockFetchSequence(jsonResponse({ teamId: 1 }));

    await expect(fetchClubRanking(REQUIRED_PARAMS)).rejects.toMatchObject({
      code: "SFV_INVALID_RESPONSE",
    });
  });
});

// ── 19. Token never appears in errors ────────────────────────────────────────

describe("19 — Token never appears in errors", () => {
  it("error message on 401 does not contain the token value", async () => {
    mockFetchSequence(statusResponse(401));

    try {
      await fetchClubRanking(REQUIRED_PARAMS);
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
      await fetchClubRanking(REQUIRED_PARAMS);
      expect.fail("Expected an error to be thrown");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).not.toContain(TEST_APPLICATION_KEY);
      }
    }
  });
});

// ── 20. No database access ───────────────────────────────────────────────────

describe("20 — No database writes or reads", () => {
  it("fetchClubRanking returns data without any database-shaped fields", async () => {
    mockFetchSequence(jsonResponse([SYNTHETIC_ENTRY]));

    const result = await fetchClubRanking(REQUIRED_PARAMS);

    expect(result[0]).not.toHaveProperty("createdAt");
    expect(result[0]).not.toHaveProperty("updatedAt");
    expect(result[0]).not.toHaveProperty("persistedAt");
  });
});
